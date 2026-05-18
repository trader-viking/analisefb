import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, TrendingUp, AlertTriangle, Clock, Trophy, Zap } from 'lucide-react';
import { getRelatorio, listarRelatorios, entradaSlug } from '@/lib/relatorios';

export function generateStaticParams() {
  return listarRelatorios().map((r) => ({ slug: r.slug }));
}

export default function RelatorioPage({ params }: { params: { slug: string } }) {
  const relatorio = getRelatorio(params.slug);
  if (!relatorio) notFound();

  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 mb-6 transition"
      >
        <ArrowLeft size={16} />
        Voltar
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{relatorio.titulo}</h1>
        {relatorio.subtitulo && (
          <p className="text-ink-500 mt-1">{relatorio.subtitulo}</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-sm">
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <TrendingUp size={16} />
            <strong>{relatorio.entradas.length}</strong> entrada{relatorio.entradas.length === 1 ? '' : 's'} com valor
          </span>
          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle size={16} />
            <strong>{relatorio.evitar.length}</strong> jogo{relatorio.evitar.length === 1 ? '' : 's'} a evitar
          </span>
        </div>
      </div>

      {/* Entradas com valor */}
      {relatorio.entradas.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-600 dark:text-emerald-400" />
            Entradas com valor
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relatorio.entradas.map((entrada, idx) => {
              const eSlug = entradaSlug(entrada, idx);
              return (
                <div key={eSlug} className="card card-hover p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs text-ink-500">
                      <Clock size={12} />
                      <span className="font-mono">{entrada.horario || '--:--'}</span>
                    </div>
                    {entrada.stake_recomendada && (
                      <span className="pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        Stake {entrada.stake_recomendada}
                      </span>
                    )}
                  </div>

                  <div className="font-semibold text-base mb-1 line-clamp-2">{entrada.jogo}</div>

                  {entrada.liga && (
                    <div className="flex items-center gap-1 text-xs text-ink-500 mb-2">
                      <Trophy size={11} />
                      <span className="truncate">{entrada.liga}</span>
                    </div>
                  )}

                  {entrada.over_limite_70?.elegivel && (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 rounded px-2 py-1 mb-3 w-fit">
                      <Zap size={11} />
                      Over Limite 70+
                    </div>
                  )}

                  <div className="bg-ink-50 dark:bg-ink-950/50 rounded-md p-3 mb-3">
                    <div className="text-[11px] uppercase tracking-wider text-ink-500 mb-1 font-medium">
                      Mercado principal
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium line-clamp-2">
                        {entrada.mercado_principal}
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg shrink-0 tabular-nums">
                        {entrada.odd_principal}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/relatorio/${relatorio.slug}/${eSlug}/`}
                    target="_blank"
                    className="btn btn-secondary justify-center mt-auto"
                  >
                    Ver detalhes
                    <ExternalLink size={14} />
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Jogos a evitar */}
      {relatorio.evitar.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
            Jogos para evitar
          </h2>
          <div className="space-y-2">
            {relatorio.evitar.map((j, idx) => (
              <div key={idx} className="card p-4">
                <div className="flex items-center gap-3 mb-1.5">
                  {j.horario && (
                    <span className="text-xs text-ink-500 font-mono">{j.horario}</span>
                  )}
                  <span className="font-semibold">{j.jogo}</span>
                  {j.liga && (
                    <span className="text-xs text-ink-500 ml-auto truncate">{j.liga}</span>
                  )}
                </div>
                <p className="text-sm text-ink-600 dark:text-ink-400">{j.motivo}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {relatorio.entradas.length === 0 && relatorio.evitar.length === 0 && (
        <div className="text-center py-12 text-ink-500">
          Nenhuma análise disponível neste relatório.
        </div>
      )}
    </div>
  );
}
