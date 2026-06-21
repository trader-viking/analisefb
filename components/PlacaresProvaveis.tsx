import type { PlacarProvavel } from '@/lib/poisson';

type Props = {
  placares: PlacarProvavel[];
};

/**
 * Renderiza um grid 2x2 com os 4 placares mais prováveis.
 * Cada célula tem:
 *  - placar grande (ex: "2-1")
 *  - barra de progresso horizontal com %
 *  - label da % à direita
 *
 * Visualmente discreto pra caber dentro do card "Mercado principal".
 */
export default function PlacaresProvaveis({ placares }: Props) {
  if (!placares || placares.length === 0) return null;

  // Pega só os 4 primeiros (devem ser top 4) e calcula a % relativa pra normalizar a barra
  const top4 = placares.slice(0, 4);
  const maxProb = Math.max(...top4.map((p) => p.prob));
  if (maxProb <= 0) return null;

  return (
    <div className="mt-3 pt-2.5 border-t border-ink-200/50 dark:border-ink-700/50">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-1.5">
        Placares mais prováveis
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {top4.map((p, i) => {
          // Barra proporcional à maior probabilidade do grupo (visual destacado)
          const barraPct = Math.max(8, Math.round((p.prob / maxProb) * 100));
          return (
            <div
              key={`${p.placar}-${i}`}
              className="flex items-center gap-2 rounded bg-white/60 dark:bg-ink-950/40 px-2 py-1"
            >
              <span className="font-bold tabular-nums text-sm shrink-0 w-9">
                {p.gols_casa}<span className="text-ink-400 mx-0.5">×</span>{p.gols_fora}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-ink-200 dark:bg-ink-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all"
                  style={{ width: `${barraPct}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-ink-700 dark:text-ink-300 shrink-0 w-9 text-right">
                {p.prob_pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
