"""
Análise dos PDFs já baixados.
Pula o login e o download — usa os PDFs que estão em pdfs/<data>/<liga>/.

Uso:
    python analisar.py                                # tudo de hoje
    python analisar.py 2026-05-17                     # tudo de uma data
    python analisar.py hoje --listar                  # lista PDFs e ligas
    python analisar.py hoje --ligas-listar            # lista só nomes de ligas
    python analisar.py hoje 5                         # primeiras 5 partidas
    python analisar.py hoje --nums 1,5,12             # números específicos
    python analisar.py hoje --nums 1-10               # intervalo
    python analisar.py hoje --buscar real,city        # contém termos no nome
    python analisar.py hoje --liga "Argentina Primera"   # uma liga
    python analisar.py hoje --ligas "Premier,La Liga"    # várias ligas
"""
import sys
from pathlib import Path
from datetime import datetime

from google import genai

from main import (
    load_config,
    extrair_texto_pdf,
    analisar_em_lotes,
    PDF_DIR,
    OUTPUT_DIR,
)


def parsear_nums(texto: str) -> set:
    """Converte '1,5,12-15,20' em {1,5,12,13,14,15,20}."""
    nums = set()
    for parte in texto.split(","):
        parte = parte.strip()
        if not parte:
            continue
        if "-" in parte:
            ini, fim = parte.split("-", 1)
            nums.update(range(int(ini), int(fim) + 1))
        else:
            nums.add(int(parte))
    return nums


def extrair_num_arquivo(pdf_path: Path) -> int:
    """Extrai o número do prefixo do arquivo (ex: '001_13h00_..pdf' → 1)."""
    nome = pdf_path.stem
    prefixo = nome.split("_", 1)[0]
    try:
        return int(prefixo)
    except ValueError:
        return -1


def descobrir_pdfs(pasta_dia: Path) -> list:
    """Retorna lista de PDFs. Procura em subpastas (por liga) e também na raiz
    (compatibilidade com versão antiga que salvava tudo junto)."""
    pdfs = []
    # PDFs em subpastas (estrutura nova, uma subpasta por liga)
    for subpasta in sorted(pasta_dia.iterdir()):
        if subpasta.is_dir():
            for pdf in sorted(subpasta.glob("*.pdf")):
                pdfs.append(pdf)
    # PDFs na raiz (estrutura antiga)
    for pdf in sorted(pasta_dia.glob("*.pdf")):
        pdfs.append(pdf)
    return pdfs


def liga_do_pdf(pdf: Path, pasta_dia: Path) -> str:
    """O nome da subpasta é o nome da liga. Se estiver na raiz, retorna 'Sem_Liga'."""
    rel = pdf.relative_to(pasta_dia)
    if len(rel.parts) > 1:
        return rel.parts[0].replace("_", " ")
    return "Sem_Liga"


def listar_pdfs(pdfs: list, pasta_dia: Path):
    """Imprime os PDFs agrupados por liga."""
    por_liga = {}
    for pdf in pdfs:
        liga = liga_do_pdf(pdf, pasta_dia)
        por_liga.setdefault(liga, []).append(pdf)

    print(f"\n{len(pdfs)} PDF(s) em {len(por_liga)} liga(s):\n")
    for liga in sorted(por_liga.keys()):
        items = por_liga[liga]
        print(f"━━━ {liga} ({len(items)} partidas) ━━━")
        for pdf in items:
            num = extrair_num_arquivo(pdf)
            print(f"  {num:>4}  {pdf.stem[:60]}")
        print()


def listar_ligas(pdfs: list, pasta_dia: Path):
    """Imprime apenas os nomes das ligas e quantidade de partidas."""
    por_liga = {}
    for pdf in pdfs:
        liga = liga_do_pdf(pdf, pasta_dia)
        por_liga[liga] = por_liga.get(liga, 0) + 1

    print(f"\n{len(por_liga)} liga(s) disponíveis:\n")
    for liga in sorted(por_liga.keys()):
        print(f"  • {liga}  ({por_liga[liga]} partidas)")
    print()


def main():
    config = load_config()

    # --- Parsing ---
    data = datetime.now().strftime("%Y-%m-%d")
    limite = None
    nums_escolhidos = None
    termos_busca = None
    ligas_filtradas = None
    listar = False
    listar_so_ligas = False

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        arg = args[i]
        if arg.lower() == "hoje":
            data = datetime.now().strftime("%Y-%m-%d")
        elif arg == "--listar":
            listar = True
        elif arg == "--ligas-listar":
            listar_so_ligas = True
        elif arg == "--nums":
            i += 1
            nums_escolhidos = parsear_nums(args[i])
        elif arg == "--buscar":
            i += 1
            termos_busca = [t.strip().lower() for t in args[i].split(",") if t.strip()]
        elif arg in ("--liga", "--ligas"):
            i += 1
            ligas_filtradas = [l.strip().lower() for l in args[i].split(",") if l.strip()]
        elif arg.isdigit():
            limite = int(arg)
        else:
            data = arg
        i += 1

    pasta = PDF_DIR / data
    if not pasta.exists():
        print(f"✗ Pasta não existe: {pasta}")
        print(f"  Pastas disponíveis em {PDF_DIR}:")
        if PDF_DIR.exists():
            for p in sorted(PDF_DIR.iterdir()):
                if p.is_dir():
                    n = len(list(p.rglob("*.pdf")))
                    print(f"    • {p.name}  ({n} PDFs)")
        sys.exit(1)

    todos_pdfs = descobrir_pdfs(pasta)
    if not todos_pdfs:
        print(f"✗ Nenhum PDF em {pasta}")
        sys.exit(1)

    if listar:
        listar_pdfs(todos_pdfs, pasta)
        print("Para analisar partidas específicas, use:")
        print(f"  python analisar.py {data} --nums 1,5,12")
        print(f"  python analisar.py {data} --liga \"Argentina Primera División\"")
        print(f"  python analisar.py {data} --ligas \"Premier League,La Liga\"")
        sys.exit(0)

    if listar_so_ligas:
        listar_ligas(todos_pdfs, pasta)
        sys.exit(0)

    # --- Filtros ---
    total_disponivel = len(todos_pdfs)
    pdfs = todos_pdfs
    sufixo = ""

    if ligas_filtradas:
        pdfs = [
            p for p in pdfs
            if any(lf in liga_do_pdf(p, pasta).lower() for lf in ligas_filtradas)
        ]
        if not pdfs:
            print(f"✗ Nenhuma partida nas ligas: {ligas_filtradas}")
            print("  Para ver as ligas disponíveis:")
            print(f"  python analisar.py {data} --ligas-listar")
            sys.exit(1)
        # Sufixo: primeira liga + qtd (evita nomes longos demais no arquivo)
        primeira = ligas_filtradas[0].replace(" ", "_")[:25]
        sufixo = f"_liga_{primeira}"

    if nums_escolhidos:
        pdfs = [p for p in pdfs if extrair_num_arquivo(p) in nums_escolhidos]
        if not pdfs:
            print(f"✗ Nenhum PDF com os números {sorted(nums_escolhidos)}")
            sys.exit(1)
        sufixo = f"_nums{len(pdfs)}"

    if termos_busca:
        pdfs = [
            p for p in pdfs
            if any(t in p.stem.lower() for t in termos_busca)
        ]
        if not pdfs:
            print(f"✗ Nenhum PDF contém os termos: {termos_busca}")
            sys.exit(1)
        sufixo = f"_busca{len(pdfs)}"

    if limite:
        pdfs = pdfs[:limite]
        sufixo = f"_amostra{limite}"

    print("=" * 60)
    print(f"Análise dos PDFs de {data}")
    print("=" * 60)
    print(f"→ {len(pdfs)} partida(s) selecionada(s) de {total_disponivel} disponíveis")

    if len(pdfs) <= 40:
        print("\nPartidas escolhidas:")
        for pdf in pdfs:
            num = extrair_num_arquivo(pdf)
            liga = liga_do_pdf(pdf, pasta)
            print(f"  {num:>4}  [{liga[:25]:<25}]  {pdf.stem[:50]}")
        print()

    # --- Extração ---
    print("→ Extraindo texto dos PDFs...")
    blocos = []
    for idx, pdf in enumerate(pdfs, 1):
        texto = extrair_texto_pdf(pdf)
        if not texto.strip():
            print(f"  [{idx}/{len(pdfs)}] ⚠ sem texto: {pdf.name}")
            continue
        liga = liga_do_pdf(pdf, pasta)
        identificador = pdf.stem.replace("_", " ")
        cabecalho = (
            f"\n\n========================================\n"
            f"LIGA: {liga}\n"
            f"PARTIDA: {identificador}\n"
            f"========================================\n\n"
        )
        blocos.append(cabecalho + texto)
        if idx % 20 == 0:
            print(f"  ... {idx}/{len(pdfs)} processados")

    if not blocos:
        print("✗ Nenhum PDF teve texto extraível.")
        sys.exit(1)

    print(f"→ {len(blocos)} partidas com texto extraído")
    total_chars = sum(len(b) for b in blocos)
    print(f"→ Total: {total_chars:,} caracteres")

    # --- Gemini ---
    print("\n→ Enviando para o Gemini (análise em lotes)...")
    client = genai.Client(api_key=config["gemini_api_key"])
    modelo = config.get("modelo", "gemini-2.5-flash")
    tamanho_lote = config.get("tamanho_lote", 10)

    try:
        analise = analisar_em_lotes(client, modelo, blocos, tamanho_lote)
    except Exception as e:
        print(f"✗ Erro no Gemini: {e}")
        sys.exit(1)

    OUTPUT_DIR.mkdir(exist_ok=True)
    relatorio = OUTPUT_DIR / f"relatorio_{data}{sufixo}.json"

    import json as _json
    dados_relatorio = {
        "data": data,
        "variante": sufixo.lstrip("_"),
        "gerado_em": datetime.now().isoformat(),
        "total_partidas_analisadas": len(blocos),
        "total_partidas_disponiveis": total_disponivel,
        "entradas": analise.get("entradas", []),
        "evitar": analise.get("evitar", []),
    }
    with open(relatorio, "w", encoding="utf-8") as f:
        _json.dump(dados_relatorio, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Relatório salvo em: {relatorio}")
    print(f"  • {len(dados_relatorio['entradas'])} entradas com valor")
    print(f"  • {len(dados_relatorio['evitar'])} jogos a evitar")

    # Publicação automática no site (se configurado)
    try:
        from publicar import publicar
        publicar(config, relatorio)
    except ImportError:
        pass
    except Exception as e:
        print(f"⚠ Falha na publicação automática: {e}")

    # Notificação Telegram
    try:
        from telegram_helper import enviar_relatorio_pronto
        metodos_count = {
            "back_favorito": 0, "lay_zebra": 0, "over_limite_70": 0,
            "back_2x2": 0, "back_goleada": 0, "confirmacao_visual": 0,
        }
        for entrada in dados_relatorio["entradas"]:
            for m_key in metodos_count:
                obj = entrada.get(m_key)
                if obj and (obj.get("aplicavel") or obj.get("elegivel")):
                    metodos_count[m_key] += 1
        url_site = config.get("site_publico_url", "https://analisefb.pages.dev")
        enviar_relatorio_pronto(
            config,
            data=dados_relatorio["data"],
            total_entradas=len(dados_relatorio["entradas"]),
            total_evitar=len(dados_relatorio["evitar"]),
            metodos_count=metodos_count,
            url_site=url_site,
        )
    except ImportError:
        pass
    except Exception as e:
        print(f"⚠ Falha na notificação Telegram: {e}")


if __name__ == "__main__":
    main()
