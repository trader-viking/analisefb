"""
Monitor ao vivo — verifica jogos do dia e dispara notificação no Telegram
quando algum gatilho de método ao vivo bate.

GATILHO MONITORADO:
- Over Limite 70+: favorito vencendo por 2 gols após 70min nos jogos analisados

USO:
    python monitor_ao_vivo.py             # roda 1 vez (verifica e sai)
    python monitor_ao_vivo.py --loop      # roda contínuo (verifica a cada 5min)

CUIDADO COM A API:
- Plano free da API-Football: 100 chamadas/dia
- Verificação a cada 5min consome ~12 chamadas/hora
- Use --loop apenas durante janela de jogos (rodar via Agendador de Tarefas)
- Mantenha histórico em arquivo pra não notificar 2x o mesmo gatilho

DEPENDÊNCIAS:
- API_FOOTBALL_KEY e telegram.bot_token + chat_id no config.json
- Relatório do dia em relatorios/relatorio_YYYY-MM-DD.json
"""
import json
import time
import sys
import argparse
from pathlib import Path
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.parse import urlencode

BASE_DIR = Path(__file__).parent
CONFIG_PATH = BASE_DIR / "config.json"
RELATORIOS_DIR = BASE_DIR / "relatorios"
HISTORICO_PATH = BASE_DIR / "_monitor_historico.json"


def load_config():
    if not CONFIG_PATH.exists():
        print("✗ config.json não encontrado")
        sys.exit(1)
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def carregar_relatorio_hoje():
    """Carrega relatório do dia atual."""
    hoje = datetime.now().strftime("%Y-%m-%d")
    arquivo = RELATORIOS_DIR / f"relatorio_{hoje}.json"
    if not arquivo.exists():
        return None, hoje
    return json.loads(arquivo.read_text(encoding="utf-8")), hoje


def carregar_historico() -> dict:
    """Carrega histórico de gatilhos já notificados (pra evitar duplicação)."""
    if not HISTORICO_PATH.exists():
        return {}
    try:
        return json.loads(HISTORICO_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def salvar_historico(historico: dict):
    HISTORICO_PATH.write_text(
        json.dumps(historico, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def buscar_jogos_ao_vivo(api_key: str) -> list:
    """Busca todos os jogos ao vivo agora na API-Football."""
    url = "https://v3.football.api-sports.io/fixtures?live=all"
    req = Request(url, headers={"x-apisports-key": api_key})
    try:
        with urlopen(req, timeout=15) as resp:
            dados = json.loads(resp.read().decode("utf-8"))
        return dados.get("response", [])
    except Exception as e:
        print(f"⚠ Erro ao buscar jogos ao vivo: {e}")
        return []


def normalizar_nome(s: str) -> str:
    """Normaliza nome de time para comparação."""
    import unicodedata
    s = s.lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return "".join(c if c.isalnum() else " " for c in s).strip()


def jogos_combinam(jogo_relatorio: str, casa_api: str, fora_api: str) -> bool:
    """Verifica se um jogo do relatório bate com o jogo da API."""
    jogo_norm = normalizar_nome(jogo_relatorio)
    sep_idx = max(
        jogo_norm.find(" x "),
        jogo_norm.find(" vs "),
        jogo_norm.find(" - "),
    )
    if sep_idx == -1:
        return False
    times_relatorio = jogo_norm.replace(" vs ", " x ").replace(" - ", " x ").split(" x ")
    if len(times_relatorio) != 2:
        return False
    casa_norm = normalizar_nome(casa_api)
    fora_norm = normalizar_nome(fora_api)

    def match(busca: str, real: str) -> bool:
        palavras = [p for p in busca.split() if len(p) >= 4]
        if not palavras:
            return busca in real
        return any(p in real for p in palavras)

    casa_busca, fora_busca = times_relatorio[0].strip(), times_relatorio[1].strip()
    return (
        (match(casa_busca, casa_norm) and match(fora_busca, fora_norm)) or
        (match(casa_busca, fora_norm) and match(fora_busca, casa_norm))
    )


def verificar_gatilhos(config: dict, relatorio: dict, jogos_ao_vivo: list,
                       historico: dict, data: str) -> int:
    """Verifica gatilhos e dispara notificações. Retorna número de alertas enviados."""
    from telegram_helper import enviar_alerta_ao_vivo

    alertas = 0
    entradas = relatorio.get("entradas", [])

    for entrada in entradas:
        # Foco no método Over Limite 70+
        over_lim = entrada.get("over_limite_70")
        if not over_lim or not (over_lim.get("aplicavel") or over_lim.get("elegivel")):
            continue

        jogo = entrada.get("jogo", "")
        if not jogo:
            continue

        chave_historico = f"{data}::{jogo}::over_limite_70"
        if historico.get(chave_historico):
            continue  # já notificado

        # Encontra jogo correspondente nos ao vivo
        for j in jogos_ao_vivo:
            try:
                casa = j["teams"]["home"]["name"]
                fora = j["teams"]["away"]["name"]
                if not jogos_combinam(jogo, casa, fora):
                    continue

                # Lê dados ao vivo
                elapsed = j["fixture"]["status"]["elapsed"] or 0
                gols_casa = j["goals"]["home"] or 0
                gols_fora = j["goals"]["away"] or 0
                short_status = j["fixture"]["status"]["short"]

                # Gatilho: jogo está em andamento, passou de 70min,
                # e algum time vence por 2 gols
                if short_status not in ("2H", "LIVE", "ET"):
                    continue
                if elapsed < 70:
                    continue

                diff = gols_casa - gols_fora
                if abs(diff) < 2:
                    continue

                # Disparar gatilho
                favorito_vencendo = casa if diff > 0 else fora
                placar = f"{gols_casa}x{gols_fora}"
                linha_minima = max(gols_casa + gols_fora, 2)
                mercado_sugerido = f"Mais {linha_minima}.5 gols"

                mensagem = (
                    f"🎯 OVER LIMITE 70+ ativado\n"
                    f"⚽ {placar} aos {elapsed}min\n"
                    f"📈 {favorito_vencendo} vencendo por 2\n"
                    f"💡 Sugestão: {mercado_sugerido}"
                )
                enviar_alerta_ao_vivo(config, f"{casa} x {fora}", mensagem)
                historico[chave_historico] = {
                    "notificado_em": datetime.now().isoformat(),
                    "placar": placar,
                    "minuto": elapsed,
                }
                alertas += 1
                print(f"  🚨 GATILHO: {jogo} | {placar} aos {elapsed}min")
                break
            except (KeyError, TypeError):
                continue

    return alertas


def rodar_verificacao(config: dict):
    """Roda 1 verificação."""
    relatorio, data = carregar_relatorio_hoje()
    if not relatorio:
        print(f"⚠ Sem relatório de hoje ({data}) — nada a monitorar")
        return

    entradas_over70 = [
        e for e in relatorio.get("entradas", [])
        if e.get("over_limite_70") and (
            e["over_limite_70"].get("aplicavel") or
            e["over_limite_70"].get("elegivel")
        )
    ]
    if not entradas_over70:
        print(f"→ {data}: nenhum jogo com Over Limite 70+ elegível hoje")
        return

    print(f"→ {data}: monitorando {len(entradas_over70)} jogo(s) com Over Limite 70+...")

    api_key = config.get("api_football_key")
    if not api_key:
        print("✗ api_football_key não configurada no config.json")
        return

    jogos_ao_vivo = buscar_jogos_ao_vivo(api_key)
    print(f"  {len(jogos_ao_vivo)} jogo(s) ao vivo no mundo agora")

    historico = carregar_historico()
    alertas = verificar_gatilhos(config, relatorio, jogos_ao_vivo, historico, data)
    salvar_historico(historico)

    print(f"  {alertas} alerta(s) novo(s) enviado(s)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--loop", action="store_true",
                        help="Roda contínuo a cada 5 minutos")
    parser.add_argument("--intervalo", type=int, default=300,
                        help="Segundos entre verificações no modo loop (default: 300=5min)")
    args = parser.parse_args()

    config = load_config()

    if not args.loop:
        rodar_verificacao(config)
        return

    print(f"🔄 Monitor em loop (intervalo: {args.intervalo}s)")
    print("   Pressione Ctrl+C pra parar.\n")
    try:
        while True:
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Verificando...")
            rodar_verificacao(config)
            time.sleep(args.intervalo)
    except KeyboardInterrupt:
        print("\n🛑 Monitor encerrado.")


if __name__ == "__main__":
    main()
