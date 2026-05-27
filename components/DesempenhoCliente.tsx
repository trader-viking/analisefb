'use client';

import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Award, AlertTriangle, BarChart3, Flame } from 'lucide-react';
import {
  type EntradaCalc,
  agregarPorMetodo,
  agregarPorLiga,
  evolucaoBankroll,
  calcularStreaks,
  calcularDrawdown,
  filtrarUltimosDias,
} from '@/lib/desempenho';
import { METODOS_INFO } from '@/components/BadgeMetodo';

type Periodo = 7 | 30 | 90 | 0; // 0 = tudo

const PERIODOS: { label: string; valor: Periodo }[] = [
  { label: '7 dias', valor: 7 },
  { label: '30 dias', valor: 30 },
  { label: '90 dias', valor: 90 },
  { label: 'Tudo', valor: 0 },
];

function fmtPct(n: number, casas = 1): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(casas)}%`;
}

function corLucro(n: number): string {
  if (n > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (n < 0) return 'text-red-600 dark:text-red-400';
  return 'text-ink-500';
}

export default function DesempenhoCliente({ itens }: { itens: EntradaCalc[] }) {
  const [periodo, setPeriodo] = useState<Periodo>(30);

  const filtrados = useMemo(() => (periodo === 0 ? itens : filtrarUltimosDias(itens, periodo)), [itens, periodo]);
  const porMetodo = useMemo(() => agregarPorMetodo(filtrados), [filtrados]);
  const porLiga = useMemo(() => agregarPorLiga(filtrados), [filtrados]);
  const evolucao = useMemo(() => evolucaoBankroll(filtrados), [filtrados]);
  const streaks = useMemo(() => calcularStreaks(filtrados), [filtrados]);
  const ddMax = useMemo(() => calcularDrawdown(evolucao), [evolucao]);

  const greens = filtrados.filter(i => i.veredito === 'green').length;
  const reds = filtrados.filter(i => i.veredito === 'red').length;
  const voids = filtrados.filter(i => i.veredito === 'void').length;
  const total = filtrados.length;
  const validos = greens + reds;
  const acerto = validos > 0 ? (greens / validos) * 100 : 0;
  const lucroTotal = filtrados.reduce((s, i) => s + i.lucro_unidades, 0);
  const stakeTotal = filtrados.reduce((s, i) => s + i.stake_pct, 0);
  const roi = stakeTotal > 0 ? (lucroTotal / stakeTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Filtro de período */}
      <div className="flex flex-wrap gap-2">
        {PERIODOS.map(p => (
          <button
            key={p.valor}
            type="button"
            onClick={() => setPeriodo(p.valor)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              periodo === p.valor
                ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
                : 'ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-900 text-ink-600 dark:text-ink-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Resumo geral */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card titulo="Entradas auditadas" valor={total.toString()} sub={`${greens}G · ${reds}R${voids ? ` · ${voids}V` : ''}`} />
        <Card titulo="Taxa de acerto" valor={`${acerto.toFixed(1)}%`} sub={validos > 0 ? `${greens}/${validos}` : '—'} icone={<Award size={14} />} corValor={acerto >= 55 ? 'emerald' : acerto >= 45 ? 'amber' : 'red'} />
        <Card titulo="Lucro acumulado" valor={fmtPct(lucroTotal, 2)} sub={`Stake total: ${stakeTotal.toFixed(1)}%`} icone={lucroTotal >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} corValor={lucroTotal >= 0 ? 'emerald' : 'red'} />
        <Card titulo="ROI" valor={fmtPct(roi, 2)} sub="Lucro / Stake total" icone={<BarChart3 size={14} />} corValor={roi >= 0 ? 'emerald' : 'red'} />
      </div>

      {/* Sequências e drawdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card titulo="Maior streak GREEN" valor={`${streaks.maiorGreen}`} sub="seguidos" icone={<Flame size={14} />} corValor="emerald" />
        <Card titulo="Maior streak RED" valor={`${streaks.maiorRed}`} sub="seguidos" icone={<AlertTriangle size={14} />} corValor="red" />
        <Card titulo="Streak atual" valor={`${streaks.atual.n}`} sub={streaks.atual.tipo ? streaks.atual.tipo.toUpperCase() : '—'} corValor={streaks.atual.tipo === 'green' ? 'emerald' : streaks.atual.tipo === 'red' ? 'red' : 'neutral'} />
        <Card titulo="Drawdown máx." valor={fmtPct(-ddMax, 2)} sub="queda do pico" corValor="red" />
      </div>

      {/* Gráfico de evolução do bankroll */}
      {evolucao.length > 1 && (
        <div className="card p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-semibold">Evolução do bankroll teórico</h2>
            <span className="text-xs text-ink-500">{evolucao.length} dias</span>
          </div>
          <GraficoEvolucao dados={evolucao} />
        </div>
      )}

      {/* Por método */}
      <div className="card p-5">
        <h2 className="font-semibold mb-3">Desempenho por método</h2>
        {porMetodo.length === 0 ? (
          <div className="text-sm text-ink-500 text-center py-4">Sem dados no período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-500 uppercase tracking-wider border-b border-ink-200 dark:border-ink-800">
                  <th className="py-2 pr-3">Método</th>
                  <th className="py-2 px-3 text-right">Entradas</th>
                  <th className="py-2 px-3 text-right">G/R/V</th>
                  <th className="py-2 px-3 text-right">Acerto</th>
                  <th className="py-2 px-3 text-right">Lucro (u)</th>
                  <th className="py-2 px-3 text-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {porMetodo.map(m => (
                  <tr key={m.metodo} className="border-b border-ink-100 dark:border-ink-800/50">
                    <td className="py-2 pr-3 font-medium">{METODOS_INFO[m.metodo]?.label || m.metodo}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{m.total}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400">{m.greens}</span>
                      <span className="text-ink-400">/</span>
                      <span className="text-red-600 dark:text-red-400">{m.reds}</span>
                      {m.voids > 0 && <><span className="text-ink-400">/</span><span className="text-ink-500">{m.voids}</span></>}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{m.acerto.toFixed(1)}%</td>
                    <td className={`py-2 px-3 text-right tabular-nums font-medium ${corLucro(m.lucro)}`}>{fmtPct(m.lucro, 2)}</td>
                    <td className={`py-2 px-3 text-right tabular-nums font-medium ${corLucro(m.roi)}`}>{fmtPct(m.roi, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Por liga */}
      <div className="card p-5">
        <h2 className="font-semibold mb-3">Desempenho por liga</h2>
        {porLiga.length === 0 ? (
          <div className="text-sm text-ink-500 text-center py-4">Sem dados no período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-500 uppercase tracking-wider border-b border-ink-200 dark:border-ink-800">
                  <th className="py-2 pr-3">Liga</th>
                  <th className="py-2 px-3 text-right">Entradas</th>
                  <th className="py-2 px-3 text-right">Acerto</th>
                  <th className="py-2 px-3 text-right">Lucro (u)</th>
                  <th className="py-2 px-3 text-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {porLiga.slice(0, 20).map(l => (
                  <tr key={l.liga} className="border-b border-ink-100 dark:border-ink-800/50">
                    <td className="py-2 pr-3 truncate max-w-[200px]" title={l.liga}>{l.liga}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{l.total}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{l.acerto.toFixed(1)}%</td>
                    <td className={`py-2 px-3 text-right tabular-nums font-medium ${corLucro(l.lucro)}`}>{fmtPct(l.lucro, 2)}</td>
                    <td className={`py-2 px-3 text-right tabular-nums font-medium ${corLucro(l.roi)}`}>{fmtPct(l.roi, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {porLiga.length > 20 && (
              <div className="text-xs text-ink-500 text-center mt-2">
                Mostrando 20 de {porLiga.length} ligas.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-ink-400 px-1">
        ⓘ Cálculos teóricos baseados na odd mínima estimada e na stake recomendada por método.
        Como os PDFs não trazem odds reais, esses números são uma referência de performance,
        não o lucro/prejuízo real da sua operação.
      </div>
    </div>
  );
}

// ====================================================================
// Subcomponentes
// ====================================================================

function Card({ titulo, valor, sub, icone, corValor }: {
  titulo: string;
  valor: string;
  sub?: string;
  icone?: React.ReactNode;
  corValor?: 'emerald' | 'red' | 'amber' | 'neutral';
}) {
  const cores: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    neutral: 'text-ink-700 dark:text-ink-200',
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1.5">
        {icone}
        {titulo}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${cores[corValor || 'neutral']}`}>{valor}</div>
      {sub && <div className="text-xs text-ink-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function GraficoEvolucao({ dados }: { dados: { data: string; bankroll: number; lucro_dia: number; jogos_dia: number }[] }) {
  const w = 800, h = 200, padL = 40, padR = 10, padT = 10, padB = 25;
  const inW = w - padL - padR;
  const inH = h - padT - padB;

  const min = Math.min(0, ...dados.map(d => d.bankroll));
  const max = Math.max(0, ...dados.map(d => d.bankroll));
  const range = max - min || 1;

  const xPos = (i: number) => padL + (dados.length === 1 ? inW / 2 : (i / (dados.length - 1)) * inW);
  const yPos = (v: number) => padT + inH - ((v - min) / range) * inH;
  const yZero = yPos(0);

  // Path da linha
  const linha = dados.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i)} ${yPos(d.bankroll)}`).join(' ');
  // Path da área sob a linha
  const area = `${linha} L ${xPos(dados.length - 1)} ${yZero} L ${xPos(0)} ${yZero} Z`;

  const ultimoBR = dados[dados.length - 1]?.bankroll ?? 0;
  const corLinha = ultimoBR >= 0 ? 'rgb(16,185,129)' : 'rgb(239,68,68)';

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="none">
        {/* Grid e eixo Y */}
        <line x1={padL} y1={yZero} x2={w - padR} y2={yZero} stroke="currentColor" strokeOpacity="0.15" strokeDasharray="2 3" />
        <text x={padL - 5} y={yZero + 3} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.5">0%</text>
        <text x={padL - 5} y={padT + 6} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.5">{max.toFixed(1)}%</text>
        {min < 0 && <text x={padL - 5} y={h - padB + 3} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.5">{min.toFixed(1)}%</text>}

        {/* Área */}
        <path d={area} fill={corLinha} fillOpacity="0.12" />
        {/* Linha */}
        <path d={linha} fill="none" stroke={corLinha} strokeWidth="2" />
        {/* Pontos */}
        {dados.map((d, i) => (
          <circle key={i} cx={xPos(i)} cy={yPos(d.bankroll)} r="2.5" fill={corLinha}>
            <title>{`${d.data}: ${d.bankroll >= 0 ? '+' : ''}${d.bankroll.toFixed(2)}% (dia: ${d.lucro_dia >= 0 ? '+' : ''}${d.lucro_dia.toFixed(2)}%, ${d.jogos_dia} jogos)`}</title>
          </circle>
        ))}

        {/* Eixo X — primeira e última data */}
        <text x={xPos(0)} y={h - 8} textAnchor="start" fontSize="9" fill="currentColor" fillOpacity="0.5">{dados[0]?.data.slice(5) || ''}</text>
        {dados.length > 1 && (
          <text x={xPos(dados.length - 1)} y={h - 8} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.5">{dados[dados.length - 1]?.data.slice(5) || ''}</text>
        )}
      </svg>
    </div>
  );
}
