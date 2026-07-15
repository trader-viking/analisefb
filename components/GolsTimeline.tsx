'use client';

/**
 * Melhoria #5 — Linha do tempo dos gols no card (para Over Limite).
 * Mostra em qual minuto saíram os gols da partida, pra saber se o Over
 * ainda está ativo (gatilho do método é 65min).
 *
 * Busca no worker: GET /eventos?fixture_id=N (cache de 5min lá).
 * Só renderiza se receber fixtureId (vem do /placares, melhoria #3) e o
 * jogo estiver rolando ou encerrado.
 */
import { useEffect, useState } from 'react';

type Gol = {
  minuto: number;
  minuto_base: number;
  acrescimo: number;
  time: string;
  jogador: string;
  tipo: string;
};

export default function GolsTimeline({
  fixtureId,
  minutoAtual,
  encerrado,
  mostrarGatilho65 = false,
}: {
  fixtureId: number | null | undefined;
  minutoAtual?: number | null;
  encerrado?: boolean;
  mostrarGatilho65?: boolean;
}) {
  const [gols, setGols] = useState<Gol[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl || !fixtureId) return;
    let cancelado = false;
    const buscar = () => {
      // final=1: jogo encerrado → o worker cacheia 24h (gols não mudam)
      fetch(`${apiUrl}/eventos?fixture_id=${fixtureId}${encerrado ? '&final=1' : ''}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((dados) => {
          if (!cancelado && dados && Array.isArray(dados.gols)) setGols(dados.gols);
          else if (!cancelado && !dados) setErro(true);
        })
        .catch(() => { if (!cancelado) setErro(true); });
    };
    buscar();
    // Jogo rolando: atualiza a cada 5min (mesmo TTL do cache do worker)
    const id = !encerrado ? setInterval(buscar, 5 * 60_000) : undefined;
    return () => { cancelado = true; if (id) clearInterval(id); };
  }, [fixtureId, encerrado]);

  if (!fixtureId || erro || gols === null) return null;

  const min = Math.min(90, Math.max(0, minutoAtual ?? (encerrado ? 90 : 0)));
  const pctJogado = encerrado ? 100 : (min / 90) * 100;

  return (
    <div className="mt-1.5" data-no-export="true">
      <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-ink-400 mb-1">
        <span>Gols da partida</span>
        <span className="tabular-nums normal-case">
          {gols.length === 0 ? 'sem gols' : `${gols.length} gol${gols.length > 1 ? 's' : ''}`}
          {!encerrado && minutoAtual != null && ` · ${minutoAtual}'`}
        </span>
      </div>
      {/* Barra 0–90 com marcador do gatilho (65') e bolinhas nos gols */}
      <div className="relative h-4">
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
          <div
            className={`h-full ${encerrado ? 'bg-ink-300 dark:bg-ink-600' : 'bg-red-400/70'}`}
            style={{ width: `${pctJogado}%` }}
          />
        </div>
        {/* Marcador do gatilho do Over Limite (65min) — só quando o método se aplica */}
        {mostrarGatilho65 && (
          <>
            <div
              className="absolute top-0 bottom-0 w-px bg-purple-500"
              style={{ left: `${(65 / 90) * 100}%` }}
              title="Gatilho do Over Limite: 65min"
            />
            <div
              className="absolute -top-0.5 text-[8px] font-bold text-purple-600 dark:text-purple-400 -translate-x-1/2"
              style={{ left: `${(65 / 90) * 100}%` }}
            >
              65&apos;
            </div>
          </>
        )}
        {gols.map((g, i) => (
          <span
            key={i}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-2 ring-white dark:ring-ink-950"
            style={{ left: `${(Math.min(g.minuto_base, 90) / 90) * 100}%` }}
            title={`${g.minuto_base}'${g.acrescimo ? `+${g.acrescimo}` : ''} — ${g.jogador} (${g.time})${g.tipo !== 'Normal Goal' ? ` · ${g.tipo}` : ''}`}
          />
        ))}
      </div>
      {gols.length > 0 && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[10px] text-ink-600 dark:text-ink-400 tabular-nums">
          {gols.map((g, i) => (
            <span key={i}>
              ⚽ {g.minuto_base}&apos;{g.acrescimo ? `+${g.acrescimo}` : ''} {g.time.split(' ')[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
