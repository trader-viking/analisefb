import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, TrendingUp, AlertTriangle } from 'lucide-react';
import { getRelatorio, listarRelatorios, entradaSlug } from '@/lib/relatorios';
import ListaEntradas from '@/components/ListaEntradas';

export function generateStaticParams() {
  return listarRelatorios().map((r) => ({ slug: r.slug }));
}

export default function RelatorioPage({ params }: { params: { slug: string } }) {
  const relatorio = getRelatorio(params.slug);
  if (!relatorio) notFound();

  // Pré-calcula o slug de cada entrada (servidor) para passar pro client component
  const entradasComSlug = relatorio.entradas.map((e, i) => ({
    ...e,
    _slug: entradaSlug(e, i),
  }));

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

      {/* Entradas com valor + filtros (componente client) */}
      {relatorio.entradas.length > 0 && (
        <div className="mb-12">
          <ListaEntradas
            relatorioSlug={relatorio.slug}
            entradas={entradasComSlug}
          />
        </div>
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
                {j.motivos_por_metodo && Object.values(j.motivos_por_metodo).some(Boolean) && (
                  <details className="mt-2">
                    <summary className="text-xs text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 cursor-pointer select-none">
                      Ver por que cada método não se aplica
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs">
                      {j.motivos_por_metodo.back_favorito && (
                        <li className="flex gap-2">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">Back Favorito:</span>
                          <span className="text-ink-600 dark:text-ink-400">{j.motivos_por_metodo.back_favorito}</span>
                        </li>
                      )}
                      {j.motivos_por_metodo.lay_zebra && (
                        <li className="flex gap-2">
                          <span className="font-semibold text-rose-700 dark:text-rose-400 shrink-0">Lay Zebra:</span>
                          <span className="text-ink-600 dark:text-ink-400">{j.motivos_por_metodo.lay_zebra}</span>
                        </li>
                      )}
                      {j.motivos_por_metodo.over_limite_70 && (
                        <li className="flex gap-2">
                          <span className="font-semibold text-purple-700 dark:text-purple-400 shrink-0">Over 70+:</span>
                          <span className="text-ink-600 dark:text-ink-400">{j.motivos_por_metodo.over_limite_70}</span>
                        </li>
                      )}
                      {j.motivos_por_metodo.back_2x2 && (
                        <li className="flex gap-2">
                          <span className="font-semibold text-blue-700 dark:text-blue-400 shrink-0">Back 2x2:</span>
                          <span className="text-ink-600 dark:text-ink-400">{j.motivos_por_metodo.back_2x2}</span>
                        </li>
                      )}
                      {j.motivos_por_metodo.back_goleada && (
                        <li className="flex gap-2">
                          <span className="font-semibold text-amber-700 dark:text-amber-400 shrink-0">Back Goleada:</span>
                          <span className="text-ink-600 dark:text-ink-400">{j.motivos_por_metodo.back_goleada}</span>
                        </li>
                      )}
                    </ul>
                  </details>
                )}
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
