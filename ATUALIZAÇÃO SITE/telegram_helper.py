"""
Módulo de notificações via Telegram.

Uso:
    from telegram_helper import enviar
    enviar("Olá! Relatório pronto.", config)
"""
import json
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Optional


def _carregar_config(config_path: Optional[Path] = None) -> dict:
    """Carrega config.json (default: na mesma pasta)."""
    if config_path is None:
        config_path = Path(__file__).parent / "config.json"
    if not config_path.exists():
        return {}
    try:
        return json.loads(config_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def enviar(
    mensagem: str,
    config: Optional[dict] = None,
    *,
    tipo: str = "relatorio",
    silencioso: bool = False,
) -> bool:
    """
    Envia mensagem no Telegram. Retorna True se enviou, False se desativado/erro.

    Args:
        mensagem: texto da mensagem (suporta formatação HTML básica)
        config: dict com config (se None, lê config.json)
        tipo: "relatorio" | "auditoria" | "erro" | "ao_vivo"
              Cada tipo pode ser ativado/desativado no config.
        silencioso: True = sem som de notificação (envio em massa)
    """
    if config is None:
        config = _carregar_config()

    tg = config.get("telegram", {})
    if not tg.get("ativado", False):
        return False

    token = tg.get("bot_token", "")
    chat_id = tg.get("chat_id", "")
    if not token or not chat_id:
        if tg.get("ativado"):
            print("⚠ Telegram ativado mas faltam bot_token ou chat_id no config.json")
        return False

    # Verifica se este tipo está habilitado
    tipos_habilitados = tg.get("notificar", {})
    # Padrão: tudo ativado se não houver configuração específica
    if tipo and tipos_habilitados:
        if not tipos_habilitados.get(tipo, True):
            return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": mensagem,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "disable_notification": silencioso,
    }

    try:
        data = urllib.parse.urlencode(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as e:
        # Falha silenciosa — nunca quebra o script principal por falha de notificação
        print(f"⚠ Erro Telegram ({tipo}): {e}")
        return False


def enviar_relatorio_pronto(
    config: dict,
    data: str,
    total_entradas: int,
    total_evitar: int,
    metodos_count: dict,
    url_site: str,
) -> bool:
    """Mensagem padrão de relatório pronto."""
    linhas = [
        "📊 <b>Relatório de hoje pronto!</b>",
        f"📅 {data}",
        "",
        f"✅ <b>{total_entradas}</b> entradas de valor",
        f"❌ <b>{total_evitar}</b> jogos a evitar",
    ]
    if metodos_count:
        linhas.append("")
        linhas.append("<b>Por método:</b>")
        emojis = {
            "back_favorito": "🟢",
            "lay_zebra": "🔴",
            "over_limite_70": "🟣",
            "back_2x2": "🟠",
            "back_goleada": "🟡",
            "confirmacao_visual": "🔵",
        }
        labels = {
            "back_favorito": "Back Favorito",
            "lay_zebra": "Lay Zebra",
            "over_limite_70": "Over Limite 70+",
            "back_2x2": "Back 2x2",
            "back_goleada": "Back Goleada",
            "confirmacao_visual": "Confirmação Visual",
        }
        for chave, qtd in sorted(metodos_count.items(), key=lambda x: -x[1]):
            if qtd > 0:
                emoji = emojis.get(chave, "•")
                label = labels.get(chave, chave)
                linhas.append(f"{emoji} {label}: {qtd}")

    linhas.append("")
    linhas.append(f'👉 <a href="{url_site}">Ver no site</a>')
    return enviar("\n".join(linhas), config, tipo="relatorio")


def enviar_erro(config: dict, contexto: str, erro: str) -> bool:
    """Mensagem de erro no processamento."""
    msg = (
        "⚠️ <b>Erro no Análises Trader</b>\n"
        f"<i>{contexto}</i>\n\n"
        f"<code>{str(erro)[:500]}</code>"
    )
    return enviar(msg, config, tipo="erro")


def enviar_auditoria(config: dict, jogo: str, metodo: str, resultado: str,
                     placar: str, motivo: str = "") -> bool:
    """Mensagem de auditoria de trade."""
    emoji = "✅" if resultado == "green" else "❌" if resultado == "red" else "❓"
    label = "GREEN" if resultado == "green" else "RED" if resultado == "red" else resultado.upper()
    msg = (
        f"{emoji} <b>{label}</b>: {jogo}\n"
        f"🎯 {metodo} · {placar}"
    )
    if motivo:
        msg += f"\n<i>{motivo}</i>"
    return enviar(msg, config, tipo="auditoria")


def enviar_alerta_ao_vivo(config: dict, jogo: str, mensagem: str) -> bool:
    """Alerta de gatilho ao vivo (Over Limite 70+ ativado, etc)."""
    msg = (
        f"🚨 <b>GATILHO AO VIVO</b>\n"
        f"⚽ {jogo}\n"
        f"{mensagem}"
    )
    return enviar(msg, config, tipo="ao_vivo")
