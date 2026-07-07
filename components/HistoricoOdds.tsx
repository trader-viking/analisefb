'use client';

/**
 * Melhoria #10 — Histórico de odds.
 * Mini sparkline mostrando como a odd variou desde o relatório até agora.
 * Ex: "Lay 1×0 abriu 11.00 → agora 10.50 (caindo ✓)"
 *
 * Fonte de dados: entrada._odds_historico, gravado pelo worker no cron
 * (snapshotOddsNosRelatorios). Formato: [{ ts, odd, origem }].
 * Sem histórico (ou só 1 ponto) → não renderiza nada.
 *
 * Interpretação da seta: pra LAY, odd CAINDO é bom (o mercado concorda
 * que o placar é improvável e fica mais barato sair). Pra BACK, odd
 * caindo significa que você deveria ter entrado antes. A legenda usa
 * o tipo do mercado principal pra decidir o ✓/✗.
 */
import type { Entrada } from '@/lib/relatorios';

type PontoOdd = { ts: string; odd: number; origem?: string };

export default function HistoricoOdds({ entrada }: { entrada: Entrada }) {
  const historico: PontoOdd[] = Array.isArray((entrada as any)._odds_historico)
    ? (entrada as any)._odds_historico.filter((p: any) => typeof p?.odd === 'number' && isFinite(p.odd))
    : [];
  if (historico.length < 2) return null;

  const abriu = historico[0].odd;
  const agora = historico[historico.length - 1].odd;
  const caindo = agora < abriu - 0.005;
  const subindo = agora > abriu + 0.005;
  const ehLay = /(^|\s)lay(\s|$)/i.test(entrada.mercado_principal || '');
  // Lay: caindo = bom. Back: subindo = bom (paga mais que a odd mínima).
  const bom = ehLay ? caindo : subindo;

  // Sparkline SVG
  const w = 96, h = 24, pad = 2;
  const odds = historico.map((p) => p.odd);
  const min = Math.min(...odds), max = Math.max(...odds);
  const range = max - min || 1;
  const pontos = historico.map((p, i) => {
    const x = pad + (i / (historico.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (p.odd - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const corLinha = caindo
    ? 'stroke-emerald-500'
    : subindo
      ? 'stroke-red-500'
      : 'stroke-ink-400';

  return (
    <div className="mt-1.5 flex items-center gap-2" data-no-export="true">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden="true">
        <polyline
          points={pontos.join(' ')}
          fill="none"
          strokeWidth="1.5"
          className={corLinha}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={pontos[pontos.length - 1].split(',')[0]}
          cy={pontos[pontos.length - 1].split(',')[1]}
          r="2"
          className={caindo ? 'fill-emerald-500' : subindo ? 'fill-red-500' : 'fill-ink-400'}
        />
      </svg>
      <div className="text-[10px] leading-tight text-ink-600 dark:text-ink-400 tabular-nums">
        <span>abriu <b>{abriu.toFixed(2)}</b> → agora <b>{agora.toFixed(2)}</b></span>{' '}
        <span className={bom ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : subindo || caindo ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
          {caindo ? `(caindo ${bom ? '✓' : '✗'})` : subindo ? `(subindo ${bom ? '✓' : '✗'})` : '(estável)'}
        </span>
      </div>
    </div>
  );
}
