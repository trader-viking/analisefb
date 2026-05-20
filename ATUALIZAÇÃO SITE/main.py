"""
Automação Clube Theo Borges
Loga no site, abre cada partida do dia, gera PDF de cada uma
e produz relatório consolidado no formato Quadro Operacional.
Usa a API gratuita do Google Gemini.
"""
import json
import re
import sys
import time
import asyncio
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse, urljoin

import pdfplumber
from playwright.async_api import async_playwright

# Notificações Telegram (opcional — funciona sem)
try:
    from telegram_helper import (
        enviar_relatorio_pronto,
        enviar_erro,
    )
except ImportError:
    enviar_relatorio_pronto = None
    enviar_erro = None
from google import genai

BASE_DIR = Path(__file__).parent
CONFIG_PATH = BASE_DIR / "config.json"
PDF_DIR = BASE_DIR / "pdfs"
OUTPUT_DIR = BASE_DIR / "relatorios"
DEBUG_DIR = BASE_DIR / "debug"

LOGIN_URL = "https://clube.theoborges.com/login"
LISTA_URL_BASE = "https://clube.theoborges.com/matches?dia={dia}"

SEL_EMAIL = "#email"
SEL_SENHA = "#password"
SEL_BOTAO = 'button[type="submit"]'


# ============================================================
# Configuração
# ============================================================
def load_config():
    if not CONFIG_PATH.exists():
        print("ERRO: config.json não encontrado.")
        sys.exit(1)
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def slug(texto: str, max_len: int = 80) -> str:
    """Converte texto em nome de arquivo seguro."""
    t = re.sub(r"[^\w\s-]", "", texto or "").strip()
    t = re.sub(r"\s+", "_", t)
    return t[:max_len] or "sem_nome"


# ============================================================
# Etapa 1 — Login
# ============================================================
async def fazer_login(page, config):
    print(f"→ Acessando {LOGIN_URL}")
    await page.goto(LOGIN_URL)
    await page.wait_for_load_state("networkidle")

    try:
        await page.wait_for_selector(SEL_EMAIL, timeout=10000)
    except Exception:
        await page.screenshot(path=str(DEBUG_DIR / "erro_form_login.png"))
        raise RuntimeError("Formulário de login não apareceu.")

    usuario = config.get("usuario", "").strip()
    senha = config.get("senha", "").strip()
    if not usuario or not senha:
        raise RuntimeError("Usuário ou senha vazios no config.json.")

    print(f"→ Preenchendo credenciais (usuário: {usuario})")
    await page.fill(SEL_EMAIL, usuario)
    await page.fill(SEL_SENHA, senha)

    print("→ Clicando em Entrar")
    try:
        async with page.expect_navigation(timeout=20000, wait_until="networkidle"):
            await page.click(SEL_BOTAO)
    except Exception:
        await page.wait_for_load_state("networkidle", timeout=10000)

    if "/login" in page.url:
        screenshot = DEBUG_DIR / f"login_falhou_{datetime.now().strftime('%H%M%S')}.png"
        await page.screenshot(path=str(screenshot), full_page=True)
        msgs = await page.evaluate("""
            () => {
                const sels = ['.alert','.error','.invalid-feedback','[role="alert"]',
                              '.text-red-500','.text-red-600','.text-danger',
                              '.bg-red-100','ul.list-disc li'];
                const out = [];
                for (const s of sels) {
                    document.querySelectorAll(s).forEach(el => {
                        const t = (el.textContent || '').trim();
                        if (t && t.length < 300) out.push(t);
                    });
                }
                return [...new Set(out)];
            }
        """)
        raise RuntimeError(
            f"Login falhou. URL: {page.url}\nMensagens: {msgs}\nScreenshot: {screenshot}"
        )

    print(f"✓ Login OK ({page.url})")


# URL alternativa de fallback (usada quando o site redireciona pra /planos)
LISTA_URL_FALLBACK = "https://clube.theoborges.com/matches?t=82ba3a95c7"


# ============================================================
# Etapa 2 — Coletar partidas do dia
# ============================================================
async def coletar_partidas(page, dia: str = "hoje"):
    """Vai pra lista do dia e retorna lista de partidas com liga."""
    lista_url = LISTA_URL_BASE.format(dia=dia)
    print(f"→ Indo para lista do dia ({dia}): {lista_url}")
    await page.goto(lista_url)
    await page.wait_for_load_state("networkidle")
    await page.wait_for_timeout(2000)

    # Se o site redirecionou pra /planos, usa URL alternativa
    if "/planos" in page.url or "/plano" in page.url:
        print(f"⚠ Redirecionado para {page.url}. Usando URL alternativa...")
        await page.goto(LISTA_URL_FALLBACK)
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)
        print(f"→ Agora em: {page.url}")

        # Se a URL alternativa não trouxer o dia pedido, ajusta via JS na própria página
        # (o site geralmente tem links pra alternar entre hoje/amanha)
        if dia != "hoje":
            try:
                await page.evaluate(f"""
                    () => {{
                        const link = document.querySelector('a[href*="dia={dia}"]');
                        if (link) link.click();
                    }}
                """)
                await page.wait_for_load_state("networkidle")
                await page.wait_for_timeout(2000)
            except Exception:
                pass

    # Expandir TODAS as ligas que estiverem fechadas (accordion)
    print("→ Expandindo ligas fechadas (accordion)...")
    expansao = await page.evaluate("""
        async () => {
            // Procura todos os blocos de liga
            const blocos = document.querySelectorAll('.bloco-liga');
            let totalBlocos = blocos.length;
            let abertosInicial = 0;
            let cliques = 0;

            // Conta quantos já estão abertos
            for (const b of blocos) {
                if (b.getAttribute('data-loaded') === '1') abertosInicial++;
            }

            // Clica em cada botão de toggle/cabeçalho que pareça fechado
            for (const b of blocos) {
                const loaded = b.getAttribute('data-loaded');
                if (loaded === '1') continue;  // já está aberto

                // Procura o botão de expandir
                const btn = b.querySelector('.toggle-partidas, .toggle, .liga-header, .titulo-liga');
                if (btn) {
                    btn.click();
                    cliques++;
                    // Pequena pausa entre cliques pra não sobrecarregar
                    await new Promise(r => setTimeout(r, 80));
                }
            }
            return { totalBlocos, abertosInicial, cliques };
        }
    """)
    print(f"   {expansao['totalBlocos']} ligas no total | {expansao['abertosInicial']} já abertas | {expansao['cliques']} cliques de expansão")

    # Espera o conteúdo carregar via AJAX (cada clique pode disparar fetch)
    if expansao["cliques"] > 0:
        # Tempo proporcional ao número de cliques, com limite máximo
        espera_ms = min(expansao["cliques"] * 250, 8000)
        await page.wait_for_timeout(espera_ms)
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(1500)

    # Segunda passada: garante que tudo abriu (algumas vezes precisa clicar de novo)
    extra = await page.evaluate("""
        async () => {
            const blocos = document.querySelectorAll('.bloco-liga');
            let cliques = 0;
            for (const b of blocos) {
                const tem_conteudo = b.querySelector('.liga-conteudo a.jogo-detalhes, a[href*="/game/"]');
                if (!tem_conteudo) {
                    const btn = b.querySelector('.toggle-partidas, .toggle, .liga-header, .titulo-liga');
                    if (btn) {
                        btn.click();
                        cliques++;
                        await new Promise(r => setTimeout(r, 100));
                    }
                }
            }
            return cliques;
        }
    """)
    if extra > 0:
        print(f"   {extra} ligas reabertas na segunda passada")
        await page.wait_for_timeout(min(extra * 300, 5000))
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(1000)

    partidas = await page.evaluate("""
        () => {
            const out = [];
            const blocos = document.querySelectorAll('.bloco-liga');
            for (const bloco of blocos) {
                // Nome da liga: prioriza h3 dentro de .liga-nome
                let liga = '';
                const h3 = bloco.querySelector('.liga-nome h3, .titulo-liga h3, h3');
                if (h3) liga = (h3.textContent || '').trim();

                // País (fallback / metadado adicional)
                const pais = bloco.getAttribute('data-country') || '';

                // Partidas dentro do bloco
                const links = bloco.querySelectorAll('a.jogo-detalhes, a[href*="/game/"]');
                for (const a of links) {
                    const url = a.href;
                    let horario = '';
                    const elH = a.querySelector('.col-hora strong, .col-hora');
                    if (elH) horario = (elH.textContent || '').trim();

                    let timeCasa = '';
                    const elC = a.querySelector('.col-time.right');
                    if (elC) timeCasa = (elC.textContent || '').trim();

                    let timeFora = '';
                    const elF = a.querySelector('.col-time.left');
                    if (elF) timeFora = (elF.textContent || '').trim();

                    let nome = '';
                    if (timeCasa && timeFora) {
                        nome = `${timeCasa} x ${timeFora}`;
                    } else {
                        nome = (a.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 200);
                    }

                    out.push({ url, nome, liga, pais, horario, timeCasa, timeFora });
                }
            }

            // Fallback: se não achou nada via .bloco-liga, pega todos os /game/ soltos
            if (out.length === 0) {
                const links = document.querySelectorAll('a[href*="/game/"]');
                for (const a of links) {
                    out.push({
                        url: a.href,
                        nome: (a.textContent || '').trim().slice(0, 200),
                        liga: 'Sem_Liga',
                        pais: '',
                        horario: '',
                        timeCasa: '',
                        timeFora: '',
                    });
                }
            }

            return out;
        }
    """)

    print(f"→ {len(partidas)} partida(s) encontrada(s)")

    # Conta por liga e mostra um resumo
    contagem = {}
    for p in partidas:
        liga = p.get("liga") or "Sem_Liga"
        contagem[liga] = contagem.get(liga, 0) + 1
    if contagem:
        print(f"→ Distribuição por liga:")
        for liga, n in sorted(contagem.items(), key=lambda x: -x[1]):
            print(f"     • {liga}: {n}")

    # Normaliza URLs para o modo detalhado
    partidas_norm = []
    for p in partidas:
        url = p["url"]
        if "modo=detalhado" not in url:
            sep = "&" if "?" in url else "?"
            extras = []
            if "dia=" not in url:
                extras.append(f"dia={dia}")
            extras.append("modo=detalhado")
            url = url + sep + "&".join(extras)
        # Adiciona o token de acesso (caso o plano esteja expirado)
        if "t=82ba3a95c7" not in url and "t=" not in url:
            url += "&t=82ba3a95c7"
        p["url"] = url
        if not p.get("liga"):
            p["liga"] = "Sem_Liga"
        partidas_norm.append(p)

    return partidas_norm


# ============================================================
# Etapa 3 — Gerar PDF de cada partida (em subpasta por liga)
# ============================================================
async def gerar_pdf_partida(context, partida, pasta_dia, indice):
    """Abre a página da partida e salva como PDF dentro da subpasta da liga."""
    page = await context.new_page()
    try:
        await page.goto(partida["url"], wait_until="networkidle", timeout=60000)
        await page.wait_for_timeout(1500)

        # Se foi redirecionado pra /planos, tenta de novo forçando o token
        if "/planos" in page.url or "/plano" in page.url:
            url_com_token = partida["url"]
            if "t=82ba3a95c7" not in url_com_token:
                sep = "&" if "?" in url_com_token else "?"
                url_com_token = url_com_token + sep + "t=82ba3a95c7"
            print(f"     ⚠ redirect detectado, tentando com token: {url_com_token}")
            await page.goto(url_com_token, wait_until="networkidle", timeout=60000)
            await page.wait_for_timeout(1500)

            # Se ainda assim caiu no /planos, pula essa partida
            if "/planos" in page.url or "/plano" in page.url:
                raise RuntimeError("Redirecionado para /planos mesmo com token")

        # Cria subpasta da liga
        nome_liga = slug(partida.get("liga") or "Sem_Liga", 60)
        pasta_liga = pasta_dia / nome_liga
        pasta_liga.mkdir(exist_ok=True)

        # Nome do arquivo
        partes_nome = [f"{indice:03d}"]
        if partida.get("horario"):
            partes_nome.append(partida["horario"].replace(":", "h"))
        partes_nome.append(slug(partida["nome"], 60))
        nome_arq = "_".join(partes_nome) + ".pdf"
        caminho = pasta_liga / nome_arq

        await page.pdf(
            path=str(caminho),
            format="A4",
            print_background=True,
            margin={"top": "10mm", "right": "10mm", "bottom": "10mm", "left": "10mm"},
        )
        return caminho
    finally:
        await page.close()


# ============================================================
# Etapa 4 — Extrair texto do PDF
# ============================================================
def extrair_texto_pdf(caminho: Path) -> str:
    blocos = []
    try:
        with pdfplumber.open(caminho) as pdf:
            for pagina in pdf.pages:
                t = pagina.extract_text()
                if t:
                    blocos.append(t)
    except Exception as e:
        print(f"  ⚠ erro lendo PDF: {e}")
    return "\n\n".join(blocos)


# ============================================================
# ============================================================
# Etapa 5 — Análise em LOTES com Gemini (retorno em JSON)
# ============================================================
PROMPT_LOTE = """Você é um analista esportivo experiente operando sob o protocolo Arkeiro de sports trading profissional.

Analise CADA partida e retorne APENAS um JSON válido, sem texto antes ou depois, sem markdown, sem ```json. APENAS o JSON cru.

=====================================================================
REGRA FUNDAMENTAL: APENAS 5 MÉTODOS SÃO PERMITIDOS
=====================================================================
NÃO sugira nenhum outro tipo de aposta. NÃO mencione Over 2.5, Under, Ambas Marcam,
Escanteios, Cartões, Resultado Correto que não seja 2x2, ou qualquer outro mercado.

Os ÚNICOS 5 métodos que você pode aplicar são:

1. BACK FAVORITO
   - Apostar na vitória do favorito (mercado 1x2).
   - Aplicar quando: favorito claro nas odds (< 1.80) + boas condições (em casa,
     com elenco completo, contra adversário em má fase).
   - Modos: pré-jogo OU ao vivo (após confirmação tática).

2. LAY ZEBRA
   - Apostar CONTRA a vitória do azarão (zebra). Lucra se vencer o favorito OU empatar.
   - Aplicar quando: zebra com odd inflada (> 5.00) e desempenho ruim recente,
     OU quando a zebra abre o placar mas é considerada inferior tecnicamente
     (lay após gol — entrada ao vivo).
   - Modos: pré-jogo OU ao vivo.

3. OVER LIMITE 70+
   - Apostar em "Mais X.5 gols" ao vivo quando favorito vence por 2 gols após 70min.
   - Aplicar quando: ALTO ÍNDICE DE GOLS NO FIM + FAVORITO CLARO.
   - Modo: APENAS ao vivo, gatilho específico de placar e minuto.

4. BACK 2x2
   - Apostar no placar exato 2x2.
   - CRITÉRIOS DE ELEGIBILIDADE (todos devem estar presentes):
     a) Alto índice de Over 2.5 gols nos jogos recentes de ambos os times
        (>= 65% dos últimos 10 jogos terminam com 3+ gols)
     b) Alto índice de Ambas Marcam (BTTS) nos jogos recentes de ambos
        (>= 65% dos últimos 10 jogos terminam com gols dos dois lados)
     c) Alto índice de Over HT (Mais 0.5 gols no 1º tempo)
        (>= 70% dos últimos 10 jogos têm gol antes do intervalo)
   - REGRAS DE SAÍDA (gestão de risco):
     * Entrar pré-jogo com odd alta (geralmente 10.00 a 15.00)
     * SAIR (cash-out) sempre que o placar passar por:
       - 1x1 (após o 2º gol — proteger lucro parcial)
       - 2x1 (favorável: a 1 gol do alvo, cash-out parcial)
       - 1x2 (favorável: a 1 gol do alvo, cash-out parcial)
     * NUNCA segurar até o final se chegar nesses placares intermediários
   - Aplicar quando:
     * Os 3 critérios estatísticos acima estão presentes
     * Ambos os times têm defesa frágil (sofrem 1.5+ gols por jogo)
     * Ambos têm ataque produtivo (marcam 1.5+ gols por jogo)
   - Modo: pré-jogo (preferencial, para captar odd alta)

5. BACK GOLEADA
   - Apostar que algum time vai marcar 4+ gols E vencer o jogo.
   - Aplicar quando: favoritismo EXTREMO (odd do favorito < 1.40)
     + adversário com defesa muito frágil + favorito em ótima fase ofensiva
     (3+ gols por jogo nos últimos 5).
   - Modos: pré-jogo OU ao vivo (quando favorito já está 2-0 ou 3-0 com pressão).

=====================================================================
DECISÃO POR PARTIDA
=====================================================================
Para CADA partida, decida:
- Se ALGUM dos 5 métodos se aplica com confiança → vai para "entradas",
  e você marca quais métodos se aplicam (pode ser mais de 1).
- Se NENHUM dos 5 métodos se encaixa → vai para "evitar" com o motivo
  (ex: "Sem favoritismo claro nem padrão de gols").

NÃO force entradas. Se a partida não se encaixa em nenhum método, manda pra "evitar".

=====================================================================
FILOSOFIA (protocolo Arkeiro)
=====================================================================
- Profitabilidade = DELTA entre preço de mercado e realidade estatística.
- Fair Odd = 1 / Probabilidade. Entrar acima da Fair Odd gera +EV.
- Você é Estrategista de Performance, não apostador.

=====================================================================
SCHEMA DO JSON:
=====================================================================

{{
  "entradas": [
    {{
      "horario": "HH:MM",
      "liga": "Nome da liga",
      "jogo": "Time A x Time B",
      "metodos_aplicados": ["back_favorito", "back_goleada"],
      "mercado_principal": "Nome do mercado do método principal (ex: 'Vitória Bayern')",
      "odd_principal": "1.45",
      "fair_odd_calculada": "1.30",
      "valor_esperado": "+11.5% EV — odd 1.45 vs Fair Odd 1.30",
      "mercado_secundario": "Nome do mercado secundário (de outro método aplicável)",
      "odd_secundaria": "5.00",
      "desempenho_1t": "Casa marca 1.8 no 1ºT",
      "desempenho_2t": "Visitante sofre 1.4 no 2ºT",
      "motivacao_tecnica": "Texto detalhado explicando por que esse jogo é entrada de valor. Inclua estatísticas, contexto, retrospecto recente.",
      "coeficiente_regularidade": "Casa: CV baixo / Visitante: CV moderado",
      "mando_de_campo": "Casa faz X% dos pontos em casa OU descrição do desempenho padrão",
      "condicoes_campo": "Pitch, clima, fadiga. Se irrelevante: 'sem fatores relevantes'",
      "desfalques_chave": "Decision-makers ausentes. Se completo: 'elenco completo'",
      "especificidades_gols": "Como cada time marca",
      "momento_gols": "Janelas de gols",
      "jogadores_chave": "Principais decisores",
      "placares_provaveis": "Ex: 2x1, 3x1",
      "momento_entrada": "Pré-jogo, após 1º gol, etc.",
      "situacao_saida": "Quando fazer cash-out",
      "stake_recomendada": "2%",
      "plano_execucao": {{
        "abordagem": "propor ou forçar",
        "justificativa_abordagem": "Por que propor/forçar",
        "gatilho_saida_parcial": "Eventos que justificam reduzir exposição",
        "hard_stop": "Regra robótica de saída total"
      }},
      "back_favorito": {{
        "aplicavel": true,
        "modo": "pre_jogo ou ao_vivo",
        "favorito": "Nome do favorito",
        "odd_alvo": "1.45",
        "razao": "Por que esse jogo é Back Favorito (ex: 'Favoritismo claro em casa contra time em má fase')",
        "gatilho_ao_vivo": "Se modo='ao_vivo': qual confirmação tática esperar (ex: 'após 15min se dominância clara')",
        "stake_recomendada": "2%"
      }},
      "lay_zebra": {{
        "aplicavel": true,
        "modo": "pre_jogo ou ao_vivo",
        "zebra": "Nome da zebra",
        "odd_zebra_alvo": "5.50",
        "razao": "Por que apostar contra a zebra",
        "gatilho_ao_vivo": "Se modo='ao_vivo': condição (ex: 'lay após zebra marcar primeiro')",
        "stake_recomendada": "2%"
      }},
      "over_limite_70": {{
        "aplicavel": true,
        "favorito": "Nome do favorito",
        "indice_gols_final": "Estatística de gols após 70min",
        "condicao_entrada": "Entrar se favorito vencer por 2 gols após 70min",
        "mercado_sugerido": "Mais X.5 gols (uma linha acima do placar)",
        "odd_esperada": "1.60 a 2.20",
        "stake_recomendada": "1%",
        "observacoes": "Pontos de atenção"
      }},
      "back_2x2": {{
        "aplicavel": true,
        "razao": "Por que esse jogo tem padrão de 2x2 (alto Over 2.5 + Ambas Marcam + Over HT, defesas frágeis dos dois lados)",
        "indice_over_2_5": "% de jogos com Over 2.5 nos últimos 10 (ex: '75% — Time A 80%, Time B 70%')",
        "indice_ambas_marcam": "% de jogos com Ambas Marcam (ex: '70% — Time A 75%, Time B 65%')",
        "indice_over_ht": "% de jogos com Over 0.5 HT (ex: '80% — Time A 85%, Time B 75%')",
        "modo": "pre_jogo",
        "odd_alvo": "12.00",
        "regra_saida": "Cash-out total ao chegar em 1x1; cash-out parcial em 2x1 ou 1x2. NUNCA segurar nesses placares.",
        "stake_recomendada": "0.5%"
      }},
      "back_goleada": {{
        "aplicavel": true,
        "candidato": "Nome do time candidato a marcar 4+",
        "razao": "Por que tem cenário de goleada (favoritismo extremo + defesa frágil)",
        "modo": "pre_jogo ou ao_vivo",
        "mercado_sugerido": "Time marca 4+ e vence (ou similar)",
        "odd_esperada": "3.50 a 7.00",
        "stake_recomendada": "1%"
      }},
      "confirmacao_visual": {{
        "aplicavel": true,
        "perfil_tatico": "Perfil tático esperado",
        "gatilhos_aceleracao": "Encaixe defensivo, subida de linhas, velocidade de passes",
        "alerta_armadilha": "Sinais de armadilha",
        "mercado_recomendado": "Qual mercado dos 5 entrar quando confirmar",
        "momento_observacao": "Janela típica"
      }}
    }}
  ],
  "evitar": [
    {{
      "horario": "HH:MM",
      "jogo": "Time A x Time B",
      "liga": "Nome da liga",
      "motivo": "Por que nenhum dos 5 métodos se aplica"
    }}
  ]
}}

REGRAS CRÍTICAS:
1. APENAS o JSON. Sem ```json, sem texto antes ou depois.
2. Use APENAS os 5 métodos listados. NUNCA sugira Over 2.5, Ambas Marcam, Escanteios etc.
3. "metodos_aplicados" é OBRIGATÓRIO — lista os métodos que se encaixam.
   Valores válidos: "back_favorito", "lay_zebra", "over_limite_70", "back_2x2", "back_goleada".
4. Para cada método na lista "metodos_aplicados", preencha o objeto correspondente
   com aplicavel=true. Para os outros 4 métodos, use null (sem objeto).
5. "mercado_principal" deve refletir o método MAIS forte aplicável (o de maior confiança).
6. "confirmacao_visual" é opcional — preencha quando houver leitura tática clara,
   senão use null.
7. Todos os valores são strings (mesmo odds: "1.85", não 1.85).
8. Cada partida vai para "entradas" OU "evitar", nunca em ambos.

---

DADOS DO LOTE:

{conteudo}
"""


def _extrair_json(texto: str) -> dict:
    """Extrai JSON da resposta do Gemini, mesmo se vier com texto extra ou ```json."""
    import json
    import re

    if not texto:
        return {"entradas": [], "evitar": []}

    # Remove blocos ```json``` ou ``` se existirem
    texto = re.sub(r"^```(?:json)?\s*", "", texto.strip(), flags=re.IGNORECASE)
    texto = re.sub(r"\s*```\s*$", "", texto.strip())

    # Procura o primeiro { e o último } (caso tenha texto antes/depois)
    inicio = texto.find("{")
    fim = texto.rfind("}")
    if inicio == -1 or fim == -1 or fim < inicio:
        return {"entradas": [], "evitar": []}

    candidato = texto[inicio:fim + 1]
    try:
        return json.loads(candidato)
    except json.JSONDecodeError:
        # Tenta limpar quebras de linha problemáticas dentro de strings
        try:
            limpo = re.sub(r'(?<!\\)\n', ' ', candidato)
            return json.loads(limpo)
        except Exception:
            return {"entradas": [], "evitar": []}


def chamar_gemini(client, modelo: str, prompt: str, max_tentativas: int = 5) -> str:
    """Chama o Gemini com retry em caso de rate limit ou sobrecarga do serviço."""
    for tentativa in range(max_tentativas):
        try:
            resp = client.models.generate_content(model=modelo, contents=prompt)
            return resp.text or ""
        except Exception as e:
            msg = str(e).lower()
            # Erro de cota / rate limit
            if "quota" in msg or "rate" in msg or "429" in msg or "resource_exhausted" in msg:
                espera = 35 * (tentativa + 1)
                print(f"     ⏳ Limite de cota. Aguardando {espera}s...")
                time.sleep(espera)
                continue
            # Erro de sobrecarga do Google (503) — esperar e tentar de novo
            if "503" in msg or "unavailable" in msg or "high demand" in msg or "overloaded" in msg:
                espera = 20 * (tentativa + 1)
                print(f"     ⏳ Gemini sobrecarregado. Aguardando {espera}s...")
                time.sleep(espera)
                continue
            # Erro de servidor (500/502/504)
            if "500" in msg or "502" in msg or "504" in msg or "internal" in msg:
                espera = 15 * (tentativa + 1)
                print(f"     ⏳ Erro temporário do Gemini. Aguardando {espera}s...")
                time.sleep(espera)
                continue
            # Outros erros: propaga
            raise
    raise RuntimeError(f"Falhou após {max_tentativas} tentativas. Tente trocar 'modelo' no config.json para 'gemini-2.5-flash-lite' ou 'gemini-2.0-flash'.")


def analisar_em_lotes(client, modelo: str, blocos: list, tamanho_lote: int = 10) -> dict:
    """Divide em lotes, analisa cada um e retorna um dict {entradas: [...], evitar: [...]}."""
    total_lotes = (len(blocos) + tamanho_lote - 1) // tamanho_lote
    print(f"→ Dividindo em {total_lotes} lote(s) de até {tamanho_lote} partidas")

    todas_entradas = []
    todos_evitar = []

    for i in range(0, len(blocos), tamanho_lote):
        lote = blocos[i:i + tamanho_lote]
        num_lote = i // tamanho_lote + 1
        print(f"\n  [Lote {num_lote}/{total_lotes}] Analisando {len(lote)} partidas...")

        conteudo_lote = "\n".join(lote)
        prompt = PROMPT_LOTE.format(conteudo=conteudo_lote[:400000])
        try:
            resultado_texto = chamar_gemini(client, modelo, prompt)
            resultado = _extrair_json(resultado_texto)
            n_ent = len(resultado.get("entradas", []))
            n_ev = len(resultado.get("evitar", []))
            todas_entradas.extend(resultado.get("entradas", []))
            todos_evitar.extend(resultado.get("evitar", []))
            print(f"     ✓ lote {num_lote}: {n_ent} entrada(s), {n_ev} evitar")
        except Exception as e:
            print(f"     ✗ erro no lote {num_lote}: {e}")

        if num_lote < total_lotes:
            print(f"     ⏸  Aguardando 8s antes do próximo lote...")
            time.sleep(8)

    # Ordena por horário
    def horario_key(item):
        h = item.get("horario", "99:99")
        try:
            return tuple(int(x) for x in h.split(":"))
        except Exception:
            return (99, 99)

    todas_entradas.sort(key=horario_key)
    todos_evitar.sort(key=horario_key)

    return {"entradas": todas_entradas, "evitar": todos_evitar}


# ============================================================
# Fluxo principal
# ============================================================
async def fluxo_principal(config, dia: str = "hoje", data_referencia: str = None):
    DEBUG_DIR.mkdir(exist_ok=True)
    PDF_DIR.mkdir(exist_ok=True)
    if not data_referencia:
        data_referencia = datetime.now().strftime("%Y-%m-%d")
    pasta_dia = PDF_DIR / data_referencia
    pasta_dia.mkdir(exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=config.get("headless", False))
        context = await browser.new_context()
        page = await context.new_page()

        # Login
        await fazer_login(page, config)

        # Coleta partidas
        partidas = await coletar_partidas(page, dia=dia)
        await page.close()

        if not partidas:
            print("⚠ Nenhuma partida encontrada na lista do dia.")
            await browser.close()
            return [], []

        # Gera PDF de cada partida (sequencial pra não sobrecarregar o site)
        print(f"\n→ Gerando PDFs ({len(partidas)} partidas)...")
        pdfs_gerados = []
        for i, partida in enumerate(partidas, 1):
            try:
                print(f"  [{i}/{len(partidas)}] {partida['nome'][:60]}")
                caminho = await gerar_pdf_partida(context, partida, pasta_dia, i)
                pdfs_gerados.append((partida, caminho))
            except Exception as e:
                print(f"     ✗ erro: {e}")
            # Respiro entre partidas para não estressar o servidor
            await asyncio.sleep(1)

        await browser.close()
        return partidas, pdfs_gerados


def main():
    config = load_config()

    # Parse de argumentos da linha de comando: python main.py [hoje|amanha]
    dia = "hoje"
    if len(sys.argv) > 1:
        arg = sys.argv[1].lower().strip()
        if arg in ("hoje", "amanha", "amanhã"):
            dia = "amanha" if arg in ("amanha", "amanhã") else "hoje"
        else:
            print(f"⚠ Argumento desconhecido: '{sys.argv[1]}'. Usando 'hoje'.")

    # Data de referência para pasta/arquivo (hoje real ou amanhã real)
    if dia == "amanha":
        from datetime import timedelta
        data_ref = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        print(f"📅 Modo: AMANHÃ ({data_ref})\n")
    else:
        data_ref = datetime.now().strftime("%Y-%m-%d")
        print(f"📅 Modo: HOJE ({data_ref})\n")

    print("=" * 60)
    print("ETAPA 1+2: Login, coleta e geração de PDFs")
    print("=" * 60)
    partidas, pdfs_gerados = asyncio.run(
        fluxo_principal(config, dia=dia, data_referencia=data_ref)
    )

    if not pdfs_gerados:
        print("\nNenhum PDF gerado. Encerrando.")
        return

    print(f"\n✓ {len(pdfs_gerados)} PDF(s) gerado(s)")

    print("\n" + "=" * 60)
    print("ETAPA 3: Análise consolidada com Gemini")
    print("=" * 60)

    # Junta texto de todos os PDFs num blob só pra análise consolidada
    print("→ Extraindo texto dos PDFs...")
    blocos = []
    for partida, caminho in pdfs_gerados:
        texto = extrair_texto_pdf(caminho)
        if not texto.strip():
            print(f"  ⚠ sem texto: {caminho.name}")
            continue
        cabecalho = f"\n\n========================================\n"
        cabecalho += f"PARTIDA: {partida['nome']}\n"
        if partida.get("liga"):
            cabecalho += f"LIGA: {partida['liga']}\n"
        if partida.get("horario"):
            cabecalho += f"HORÁRIO: {partida['horario']}\n"
        cabecalho += f"========================================\n\n"
        blocos.append(cabecalho + texto)

    if not blocos:
        print("✗ Nenhum PDF teve texto extraível. Encerrando.")
        return

    conteudo_total = "\n".join(blocos)
    print(f"→ {len(blocos)} partidas com texto extraído ({len(conteudo_total):,} caracteres)")

    print("→ Enviando para o Gemini (análise em lotes)...")
    client = genai.Client(api_key=config["gemini_api_key"])
    modelo = config.get("modelo", "gemini-2.0-flash")
    tamanho_lote = config.get("tamanho_lote", 10)

    try:
        analise = analisar_em_lotes(client, modelo, blocos, tamanho_lote)
    except Exception as e:
        print(f"✗ Erro no Gemini: {e}")
        if enviar_erro:
            enviar_erro(config, "Falha na análise do Gemini", str(e))
        return

    OUTPUT_DIR.mkdir(exist_ok=True)
    relatorio = OUTPUT_DIR / f"relatorio_{data_ref}.json"

    import json as _json
    dados_relatorio = {
        "data": data_ref,
        "dia_consultado": dia,
        "gerado_em": datetime.now().isoformat(),
        "total_partidas_analisadas": len(pdfs_gerados),
        "entradas": analise.get("entradas", []),
        "evitar": analise.get("evitar", []),
        "pdfs": [
            {"jogo": p["nome"], "arquivo": c.relative_to(BASE_DIR).as_posix()}
            for p, c in pdfs_gerados
        ],
    }
    with open(relatorio, "w", encoding="utf-8") as f:
        _json.dump(dados_relatorio, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Relatório salvo em: {relatorio}")
    print(f"  • {len(dados_relatorio['entradas'])} entradas com valor")
    print(f"  • {len(dados_relatorio['evitar'])} jogos a evitar")
    print(f"✓ PDFs em: {PDF_DIR / data_ref}")

    # Publicação automática no site (se configurado)
    try:
        from publicar import publicar
        publicar(config, relatorio)
    except ImportError:
        pass  # publicar.py não está disponível, ignora silenciosamente
    except Exception as e:
        print(f"⚠ Falha na publicação automática: {e}")
        if enviar_erro:
            enviar_erro(config, "Falha na publicação no GitHub", str(e))

    # Notificação Telegram: relatório pronto
    if enviar_relatorio_pronto:
        # Conta métodos aplicados
        metodos_count = {
            "back_favorito": 0, "lay_zebra": 0, "over_limite_70": 0,
            "back_2x2": 0, "back_goleada": 0, "confirmacao_visual": 0,
        }
        for entrada in dados_relatorio["entradas"]:
            for m_key in metodos_count:
                obj = entrada.get(m_key)
                if obj and (obj.get("aplicavel") or obj.get("elegivel")):
                    metodos_count[m_key] += 1

        url_site = config.get(
            "site_publico_url",
            "https://analisefb.pages.dev"
        )
        try:
            enviar_relatorio_pronto(
                config,
                data=data_ref,
                total_entradas=len(dados_relatorio["entradas"]),
                total_evitar=len(dados_relatorio["evitar"]),
                metodos_count=metodos_count,
                url_site=url_site,
            )
        except Exception as e:
            print(f"⚠ Falha na notificação Telegram: {e}")


if __name__ == "__main__":
    main()
