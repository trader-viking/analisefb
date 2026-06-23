// Bloco com informações do modelo Poisson v7.1.13:
// - λ (taxas) dos 2 times
// - Probabilidades 1X2 calculadas
// - Top placares mais prováveis
// - Linha dinâmica do M15 (Over +1)
import type { Entrada, PoissonInfo, PlacarProvavel } from '@/lib/metodos';

function fmtPct(v: number | undefined, casas = 1): string {
  if (v === undefined || v === null) return '—';
  return (v * 100).toFixed(casas) + '%';
}

function fmtPctAbs(v: number | undefined, casas = 1): string {
  if (v === undefined || v === null) return '—';
  return v.toFixed(casas) + '%';
}

function nomesDoJogo(jogo: string): [string, string] {
  const partes = jogo.split(/\s+x\s+|\s+vs\s+|\s+-\s+/i);
  if (partes.length >= 2) return [partes[0].trim(), partes[1].trim()];
  return ['Casa', 'Fora'];
}

function BarraProb({ pct, cor }: { pct: number; cor: string }) {
  const w = Math.max(0, Math.min(100, pct * 100));
  return (
    <div className="w-full h-1.5 bg-ink-200 dark:bg-ink-800 rounded-full overflow-hidden">
      <div className={`h-full ${cor} rounded-full`} style={{ width: `${w}%` }} />
    </div>
  );
}

export default function PoissonInfoCard({ entrada }: { entrada: Entrada }) {
  if (!entrada.poisson) return null;
  const p: PoissonInfo = entrada.poisson;
  const [nomeH, nomeA] = nomesDoJogo(entrada.jogo);

  const placares: PlacarProvavel[] = Array.isArray(p.placares_provaveis) ? p.placares_provaveis.slice(0, 6) : [];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-200">
          Modelo Poisson
        </h3>
        {p.lambdaTotal !== undefined && (
          <div className="text-xs text-ink-500">
            λ total: <span className="font-mono font-semibold">{p.lambdaTotal.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* λ por time */}
      {(p.lh !== undefined || p.la !== undefined) && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center bg-ink-50 dark:bg-ink-900/50 rounded p-2">
            <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold truncate" title={nomeH}>
              {nomeH}
            </div>
            <div className="font-mono text-xl font-bold mt-1">{p.lh?.toFixed(2) ?? '—'}</div>
            <div className="text-[10px] text-ink-500 mt-0.5">λ esperado</div>
          </div>
          <div className="text-center bg-ink-50 dark:bg-ink-900/50 rounded p-2">
            <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold truncate" title={nomeA}>
              {nomeA}
            </div>
            <div className="font-mono text-xl font-bold mt-1">{p.la?.toFixed(2) ?? '—'}</div>
            <div className="text-[10px] text-ink-500 mt-0.5">λ esperado</div>
          </div>
        </div>
      )}

      {/* Probabilidades 1X2 */}
      {(p.pHome !== undefined || p.pDraw !== undefined || p.pAway !== undefined) && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-2">
            Resultado 1X2
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="truncate font-medium">1 · {nomeH}</span>
                <span className="font-mono font-semibold ml-2">{fmtPct(p.pHome)}</span>
              </div>
              <BarraProb pct={p.pHome ?? 0} cor="bg-emerald-500" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">X · Empate</span>
                <span className="font-mono font-semibold ml-2">{fmtPct(p.pDraw)}</span>
              </div>
              <BarraProb pct={p.pDraw ?? 0} cor="bg-amber-500" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="truncate font-medium">2 · {nomeA}</span>
                <span className="font-mono font-semibold ml-2">{fmtPct(p.pAway)}</span>
              </div>
              <BarraProb pct={p.pAway ?? 0} cor="bg-sky-500" />
            </div>
          </div>
        </div>
      )}

      {/* Top placares */}
      {placares.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-2">
            Top {placares.length} placares prováveis
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {placares.map((pl, i) => {
              const intensidade = (pl.prob || 0) * 100;
              const opacity = Math.max(0.3, intensidade / 20);  // mais provável = mais opaco
              return (
                <div
                  key={i}
                  className="text-center rounded border-2 border-emerald-300 dark:border-emerald-700 p-1.5 bg-emerald-50 dark:bg-emerald-950/30"
                  style={{ opacity }}
                  title={`${pl.placar}: ${fmtPct(pl.prob, 1)}`}
                >
                  <div className="font-mono text-base font-bold">{pl.placar}</div>
                  <div className="text-[10px] text-ink-600 dark:text-ink-400 font-mono">{fmtPct(pl.prob, 1)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Linha dinâmica do M15 */}
      {p.lineCalc !== undefined && (
        <div className="border-t border-ink-200 dark:border-ink-800 pt-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
            Linha dinâmica (M15 — Over +1)
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <span className="text-ink-500 text-xs">Over</span>
              <span className="font-mono text-2xl font-bold ml-1">{p.lineCalc}</span>
            </div>
            {p.pOverLine !== undefined && (
              <div>
                <span className="text-ink-500 text-xs">P(Over):</span>
                <span className="font-mono text-base font-semibold ml-1">{fmtPct(p.pOverLine)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Probabilidade Zebra */}
      {p.pZebra !== undefined && (
        <div className="border-t border-ink-200 dark:border-ink-800 pt-3 mt-3 text-xs">
          <span className="text-ink-500">P(vitória do azarão):</span>
          <span className="font-mono font-semibold ml-2">{fmtPct(p.pZebra)}</span>
        </div>
      )}
    </div>
  );
}
