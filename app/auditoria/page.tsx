import Link from 'next/link';
import {
  ArrowLeft, TrendingUp, TrendingDown, Target, Activity,
  Award, AlertTriangle, CheckCircle2, XCircle, BarChart3,
  Calendar, Trophy, Percent, FileText, Plus, Edit2,
} from 'lucide-react';
import { listarTrades, calcularEstatisticas } from '@/lib/trades';

export default function AuditoriaPage() {
  const trades = listarTrades();
  const stats = calcularEstatisticas(trades);

  if (trades.length === 0) {
    return (
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 mb-6 transition"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>

        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Auditoria</h1>
            <p className="text-ink-500 text-sm">Performance audit dos trades executados.</p>
          </div>
          <Link href="/auditoria/registrar/" className="btn btn-primary">
            <Plus size={16} />
            Registrar trade
          </Link>
        </div>

        <div className="card p-8 text-center">
          <FileText className="mx-auto mb-4 text-ink-400" size={48} />
          <h2 className="text-lg font-semibold mb-2">Nenhum trade registrado ainda</h2>
          <p className="text-sm text-ink-500 mb-6 max-w-md mx-auto">
            Clica em <strong>Registrar trade</strong> acima pra adicionar o primeiro pelo formulário.
            <br />Alternativamente, edita o arquivo <code className="text-xs bg-ink-100 dark:bg-ink-800 px-1.5 py-0.5 rounded">relatorios/trades.json</code> direto no GitHub.
          </p>
        </div>
      </div>
    );
  }

  const cor_lucro = stats.lucro_unidades >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  const Icon_lucro = stats.lucro_unidades >= 0 ? TrendingUp : TrendingDown;
  const sinal = stats.lucro_unidades >= 0 ? '+' : '';

  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 mb-6 transition"
      >
        <ArrowLeft size={16} />
        Voltar
      </Link>

      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Auditoria</h1>
          <p className="text-sm text-ink-500">
            {stats.total_trades} trade{stats.total_trades === 1 ? '' : 's'} registrado{stats.total_trades === 1 ? '' : 's'}
          </p>
        </div>
        <Link href="/auditoria/registrar/" className="btn btn-primary">
          <Plus size={16} />
          Registrar trade
        </Link>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1 flex items-center gap-1">
            <Icon_lucro size={11} />
            Lucro total
          </div>
          <div className={`text-2xl font-bold tabular-nums ${cor_lucro}`}>
            {sinal}{stats.lucro_unidades}u
          </div>
          <div className="text-xs text-ink-500 mt-1">
            ROI {sinal}{stats.roi_pct}%
          </div>
        </div>

        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1 flex items-center gap-1">
            <Target size={11} />
            Taxa de acerto
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {stats.taxa_acerto}%
          </div>
          <div className="text-xs text-ink-500 mt-1">
            {stats.total_greens}G / {stats.total_reds}R
          </div>
        </div>

        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1 flex items-center gap-1">
            <CheckCircle2 size={11} />
            Disciplina técnica
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {stats.taxa_tecnica}%
          </div>
          <div className="text-xs text-ink-500 mt-1">
            critérios atendidos
          </div>
        </div>

        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1 flex items-center gap-1">
            <TrendingDown size={11} />
            Drawdown máx.
          </div>
          <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
            -{stats.drawdown_max}u
          </div>
          <div className="text-xs text-ink-500 mt-1">
            pico {stats.pico_acumulado}u
          </div>
        </div>
      </div>

      {/* Análise técnica (False Greens / Correct Reds) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Análise técnica</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 ring-1 ring-emerald-200 dark:ring-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/10">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-sm">Correct Greens</span>
            </div>
            <div className="text-2xl font-bold">{stats.correct_greens}</div>
            <div className="text-xs text-ink-500 mt-1">
              Vitória + critérios atendidos
            </div>
          </div>

          <div className="card p-4 ring-1 ring-blue-200 dark:ring-blue-900 bg-blue-50/30 dark:bg-blue-950/10">
            <div className="flex items-center gap-2 mb-2">
              <Award size={16} className="text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-sm">Correct Reds</span>
            </div>
            <div className="text-2xl font-bold">{stats.correct_reds}</div>
            <div className="text-xs text-ink-500 mt-1">
              Derrota + critérios atendidos (sucesso técnico)
            </div>
          </div>

          <div className="card p-4 ring-1 ring-amber-200 dark:ring-amber-900 bg-amber-50/30 dark:bg-amber-950/10">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-sm">False Greens</span>
            </div>
            <div className="text-2xl font-bold">{stats.false_greens}</div>
            <div className="text-xs text-ink-500 mt-1">
              Vitória sem critérios (falha técnica disfarçada)
            </div>
          </div>

          <div className="card p-4 ring-1 ring-red-200 dark:ring-red-900 bg-red-50/30 dark:bg-red-950/10">
            <div className="flex items-center gap-2 mb-2">
              <XCircle size={16} className="text-red-600 dark:text-red-400" />
              <span className="font-semibold text-sm">False Reds</span>
            </div>
            <div className="text-2xl font-bold">{stats.false_reds}</div>
            <div className="text-xs text-ink-500 mt-1">
              Derrota sem critérios atendidos
            </div>
          </div>
        </div>
      </section>

      {/* Melhor e pior dia */}
      {(stats.melhor_dia || stats.pior_dia) && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Por dia</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {stats.melhor_dia && (
              <div className="card p-4">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1 flex items-center gap-1">
                  <TrendingUp size={11} />
                  Melhor dia
                </div>
                <div className="text-lg font-semibold">{stats.melhor_dia.data}</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +{stats.melhor_dia.lucro}u
                </div>
              </div>
            )}
            {stats.pior_dia && (
              <div className="card p-4">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1 flex items-center gap-1">
                  <TrendingDown size={11} />
                  Pior dia
                </div>
                <div className="text-lg font-semibold">{stats.pior_dia.data}</div>
                <div className={`text-2xl font-bold tabular-nums ${stats.pior_dia.lucro < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {stats.pior_dia.lucro >= 0 ? '+' : ''}{stats.pior_dia.lucro}u
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Por método */}
      {Object.keys(stats.por_metodo).length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Performance por método</h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-100 dark:bg-ink-900">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Método</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Trades</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Acerto</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.por_metodo)
                    .sort(([, a], [, b]) => b.lucro - a.lucro)
                    .map(([metodo, dados]) => (
                      <tr key={metodo} className="border-t border-ink-100 dark:border-ink-900">
                        <td className="px-4 py-2.5 font-medium">{metodo}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{dados.trades}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{dados.taxa_acerto}%</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${dados.lucro >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {dados.lucro >= 0 ? '+' : ''}{dados.lucro}u
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Tabela de trades */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Histórico de trades</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100 dark:bg-ink-900">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold">Data</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Jogo</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Método</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Odd</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Stake</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Resultado</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Critérios</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Lucro</th>
                  <th className="text-right px-3 py-2.5 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-t border-ink-100 dark:border-ink-900 hover:bg-ink-50 dark:hover:bg-ink-900/50">
                    <td className="px-3 py-2.5 text-ink-500 tabular-nums whitespace-nowrap">{t.data}</td>
                    <td className="px-3 py-2.5 font-medium">{t.jogo}</td>
                    <td className="px-3 py-2.5 text-ink-600 dark:text-ink-400 text-xs">{t.metodo}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{t.odd_entrada}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{t.stake_pct}%</td>
                    <td className="px-3 py-2.5 text-center">
                      {t.resultado === 'green' ? (
                        <span className="pill bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">G</span>
                      ) : (
                        <span className="pill bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">R</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {t.criterios_atendidos ? (
                        <CheckCircle2 size={14} className="inline text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle size={14} className="inline text-amber-600 dark:text-amber-400" />
                      )}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${t.lucro_unidades >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {t.lucro_unidades >= 0 ? '+' : ''}{Math.round(t.lucro_unidades * 100) / 100}u
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        href={`/auditoria/editar/${encodeURIComponent(t.id)}/`}
                        className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 text-xs"
                      >
                        <Edit2 size={12} />
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
