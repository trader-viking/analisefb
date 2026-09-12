"""
ponte_trader.py — liga o bot local (radarfutebol) ao sistema Trader Viking.

O bot lê a tela ao vivo; este módulo manda a leitura pro worker, que casa
com a entrada do relatório do dia, roda os gatilhos dos 8 métodos e dispara
o alerta no Telegram (com anti-duplicação). O site também passa a mostrar
a pressão medida pelo bot.

COMO USAR no seu bot:

    from ponte_trader import PonteTrader

    ponte = PonteTrader(
        url_worker="https://analises-trader-api.felipebenicio09.workers.dev",
        segredo="o-mesmo-valor-do-BOT_SECRET",
    )

    # a cada varredura de uma partida:
    ponte.enviar(
        jogo="Sport Recife x Operário PR",
        minuto=67,
        gols_casa=2, gols_fora=1,
        casa={"chutes": 14, "chutes_no_gol": 6, "posse": 62,
              "escanteios": 8, "cartoes": 1},
        fora={"chutes": 5, "chutes_no_gol": 1, "posse": 38,
              "escanteios": 2, "cartoes": 3},
        # OPCIONAL mas recomendado: a leitura de ~10min atrás que o seu bot
        # já calcula. Com ela o delta de pressão é MEDIDO, não estimado.
        casa_antes={"chutes": 9, "chutes_no_gol": 3, "posse": 58,
                    "escanteios": 5, "cartoes": 1},
        fora_antes={"chutes": 4, "chutes_no_gol": 1, "posse": 42,
                    "escanteios": 2, "cartoes": 2},
        minuto_antes=57,
        odds={"casa": 1.72, "empate": 3.40, "fora": 5.50},
    )

O método `enviar` NUNCA levanta exceção: se a rede cair ou o worker
responder erro, ele só devolve um dict com o problema — seu bot continua
rodando normalmente.
"""

import json
import time
import urllib.error
import urllib.request


class PonteTrader:
    def __init__(self, url_worker: str, segredo: str,
                 intervalo_minimo_s: int = 45, timeout_s: int = 12,
                 verbose: bool = True):
        """
        url_worker  — URL base do worker (sem barra no fim)
        segredo     — mesmo valor do secret BOT_SECRET no Cloudflare
        intervalo_minimo_s — throttle POR JOGO: evita mandar leitura a cada
                      segundo. 45s é suficiente (os gatilhos são por minuto
                      de jogo, não por segundo).
        """
        self.url = url_worker.rstrip("/")
        self.segredo = segredo
        self.intervalo = intervalo_minimo_s
        self.timeout = timeout_s
        self.verbose = verbose
        self._ultimo_envio = {}   # jogo -> timestamp
        self._ultimo_minuto = {}  # jogo -> minuto do jogo já enviado

    # ------------------------------------------------------------------
    def enviar(self, jogo: str, minuto: int, gols_casa: int, gols_fora: int,
               casa: dict = None, fora: dict = None,
               casa_antes: dict = None, fora_antes: dict = None,
               minuto_antes: int = None,
               gols_casa_ht: int = None, gols_fora_ht: int = None,
               odds: dict = None, forcar: bool = False) -> dict:
        """Manda uma leitura ao vivo pro worker. Retorna o dict de resposta
        (ou {'erro': ...}). Nunca levanta exceção."""

        # Throttle: não repete o mesmo minuto nem envia mais que 1x por
        # intervalo. Economiza banda e evita ruído sem perder gatilho —
        # os gatilhos avaliam janelas de minutos, não de segundos.
        agora = time.time()
        if not forcar:
            if self._ultimo_minuto.get(jogo) == minuto:
                return {"status": "ignorado_mesmo_minuto", "minuto": minuto}
            ultimo = self._ultimo_envio.get(jogo, 0)
            if agora - ultimo < self.intervalo:
                return {"status": "ignorado_throttle",
                        "faltam_s": round(self.intervalo - (agora - ultimo))}

        payload = {
            "jogo": jogo,
            "minuto": int(minuto),
            "gols_casa": int(gols_casa),
            "gols_fora": int(gols_fora),
        }
        if gols_casa_ht is not None:
            payload["gols_casa_ht"] = int(gols_casa_ht)
        if gols_fora_ht is not None:
            payload["gols_fora_ht"] = int(gols_fora_ht)
        if casa and fora:
            payload["casa"] = casa
            payload["fora"] = fora
        if casa_antes and fora_antes:
            payload["casa_antes"] = casa_antes
            payload["fora_antes"] = fora_antes
            if minuto_antes is not None:
                payload["minuto_antes"] = int(minuto_antes)
        if odds:
            payload["odds"] = odds

        req = urllib.request.Request(
            f"{self.url}/stats-live",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-Bot-Secret": self.segredo,
                # User-Agent de navegador é OBRIGATÓRIO: o Cloudflare bloqueia
                # o UA padrão do urllib ("Python-urllib/3.x") com erro 1010
                # (browser integrity check) antes mesmo de chegar no worker.
                "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                               "AppleWebKit/537.36 (KHTML, like Gecko) "
                               "Chrome/126.0.0.0 Safari/537.36"),
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                resposta = json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            corpo = ""
            try:
                corpo = e.read().decode("utf-8")[:200]
            except Exception:
                pass
            resposta = {"erro": f"HTTP {e.code}", "detalhe": corpo}
        except Exception as e:
            resposta = {"erro": str(e)}

        self._ultimo_envio[jogo] = agora
        self._ultimo_minuto[jogo] = minuto

        if self.verbose:
            if resposta.get("alertas_enviados"):
                print(f"  🔔 {jogo} {minuto}' — {resposta['alertas_enviados']} "
                      f"alerta(s) no Telegram: {', '.join(resposta.get('detalhes', []))}")
            elif resposta.get("status") == "jogo_nao_esta_no_relatorio":
                print(f"  · {jogo} não está no relatório de hoje (sem análise) — ignorado")
            elif resposta.get("erro"):
                print(f"  ⚠ ponte: {resposta['erro']}")
        return resposta

    # ------------------------------------------------------------------
    def testar(self) -> bool:
        """Testa a conexão e a autenticação com o worker."""
        r = self.enviar(jogo="Teste x Teste", minuto=1, gols_casa=0,
                        gols_fora=0, forcar=True)
        if r.get("erro"):
            print(f"✗ Ponte com problema: {r}")
            return False
        print(f"✓ Ponte OK — worker respondeu: {r.get('status')}")
        return True
