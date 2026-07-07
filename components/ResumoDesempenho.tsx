'use client';

/**
 * Melhoria #8 — Resumo de desempenho na home.
 * "Esta semana: 8 greens · 3 reds · +12% ROI" logo ao abrir o site,
 * sem precisar entrar em /desempenho.
 *
 * Auto-contido: busca GET /trades no worker e calcula aqui.
 * ROI = Σ(green: (odd-1)×stake ; red: -stake) ÷ Σ(stake) — em % da banca
 * exposta na semana. Trades pendentes/inconclusivos não entram na conta.
 *
 * COMO USAR (app/page.tsx):
 *   import ResumoDesempenho from '@/components/ResumoDesempenho';
 *   ...
 *   <ResumoDesempenho />   // logo abaixo do título da home
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown } from 'lucide-react';

type Trade = {
  data: string;
  resultado: 'green' | 'red' | 'pendente' | string;
  odd_entrada?: number;
  stake_pct?: number;
};

type Resumo = {
  greens: number;
  reds: number;
  pendentes: number;
  roiPct: number | null; // null = sem stake computável
};

function inicioDaSemana(): Date {
  // Semana começando na segunda-feira, horário local
  const agora = new Date();
  const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dia = d.getDay(); // 0=dom
  const diff = dia === 0 ? 6 : dia - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

export default function ResumoDesempenho() {
  const [resumo, setResumo] = useState<Resumo | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;
    let cancelado = false;
    fetch(`${apiUrl}/trades`)
      .then((r) => (r.ok ? r.json() : null))
      .then((trades: Trade[] | null) => {
        if (cancelado || !Array.isArray(trades)) return;
        const desde = inicioDaSemana();
        let greens = 0, reds = 0, pendentes = 0;
        let lucro = 0, exposto = 0;
        for (const t of trades) {
          if (!t.data || !/^\d{4}-\d{2}-\d{2}$/.test(t.data)) continue;
          const dt = new Date(`${t.data}T12:00:00`);
          if (dt < desde) continue;
          const stake = typeof t.stake_pct === 'number' ? t.stake_pct : 0;
          const odd = typeof t.odd_entrada === 'number' ? t.odd_entrada : 0;
          if (t.resultado === 'green') {
            greens++;
            if (stake > 0 && odd > 1) { lucro += (odd - 1) * stake; exposto += stake; }
          } else if (t.resultado === 'red') {
            reds++;
            if (stake > 0) { lucro -= stake; exposto += stake; }
          } else {
            pendentes++;
          }
        }
        const roiPct = exposto > 0 ? (lucro / exposto) * 100 : null;
        setResumo({ greens, reds, pendentes, roiPct });
      })
      .catch(() => {/* silencioso — sem resumo não quebra a home */});
    return () => { cancelado = true; };
  }, []);

  if (!resumo || (resumo.greens === 0 && resumo.reds === 0 && resumo.pendentes === 0)) {
    return null;
  }

  const { greens, reds, pendentes, roiPct } = resumo;
  const positivo = (roiPct ?? 0) >= 0;

  return (
    <Link
      href="/desempenho"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 card px-4 py-3 mb-4 hover:ring-2 hover:ring-emerald-300 dark:hover:ring-emerald-800 transition text-sm"
      title="Ver desempenho completo"
    >
      <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-400">
        Esta semana
      </span>
      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
        ✓ {greens} green{greens !== 1 ? 's' : ''}
      </span>
      <span className="inline-flex items-center gap-1 font-semibold text-red-700 dark:text-red-400 tabular-nums">
        ✗ {reds} red{reds !== 1 ? 's' : ''}
      </span>
      {pendentes > 0 && (
        <span className="text-ink-500 tabular-nums">{pendentes} pendente{pendentes !== 1 ? 's' : ''}</span>
      )}
      {roiPct !== null && (
        <span
          className={`ml-auto inline-flex items-center gap-1 font-bold tabular-nums ${
            positivo ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
          }`}
        >
          {positivo ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {positivo ? '+' : ''}{roiPct.toFixed(0)}% ROI
        </span>
      )}
    </Link>
  );
}
