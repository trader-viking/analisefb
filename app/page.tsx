import Link from 'next/link';
import { listarRelatorios } from '@/lib/relatorios';
import { Calendar, TrendingUp, AlertTriangle, ChevronRight, FileText, BarChart3 } from 'lucide-react';
import NavegacaoPrincipal from '@/components/NavegacaoPrincipal';

export default function HomePage() {
  const relatorios = listarRelatorios();

  if (relatorios.length === 0) {
    return (
      <div>
        <NavegacaoPrincipal />
        <div className="text-center py-20">
          <FileText className="mx-auto mb-4 text-ink-400" size={48} />
          <h1 className="text-2xl font-bold mb-2">Nenhum relatório ainda</h1>
          <p className="text-ink-500">
            Quando você rodar <code>python main.py</code>, os relatórios aparecerão aqui.
          </p>
        </div>
      </div>
    );
  }

  const porData = new Map<string, typeof relatorios>();
  for (const r of relatorios) {
    if (!porData.has(r.data)) porData.set(r.data, []);
    porData.get(r.data)!.push(r);
  }
  const datas = Array.from(porData.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <NavegacaoPrincipal />
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Relatórios</h1>
          <p className="text-sm text-ink-500">
            {relatorios.length} relatório{relatorios.length === 1 ? '' : 's'} em {datas.length} dia
            {datas.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link
          href="/desempenho"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-ink-900 text-white dark:bg-white dark:text-ink-900 hover:opacity-90 transition"
        >
          <BarChart3 size={15} />
          Desempenho
        </Link>
      </div>

      <div className="space-y-6">
        {datas.map((data) => {
          const itens = porData.get(data)!;
          return (
            <section key={data}>
              <div className="flex items-center gap-2 mb-3 text-xs font-medium text-ink-500 uppercase tracking-wider">
                <Calendar size={14} />
                {itens[0].titulo}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {itens.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/relatorio/${r.slug}/`}
                    className="card card-hover p-4 group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {r.subtitulo || 'Relatório completo'}
                        </div>
                        {r.total_partidas_analisadas != null && (
                          <div className="text-xs text-ink-500 mt-0.5">
                            {r.total_partidas_analisadas} partida{r.total_partidas_analisadas === 1 ? '' : 's'} analisada{r.total_partidas_analisadas === 1 ? '' : 's'}
                          </div>
                        )}
                      </div>
                      <ChevronRight
                        size={20}
                        className="shrink-0 text-ink-400 group-hover:translate-x-0.5 transition"
                      />
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <TrendingUp size={16} />
                        <span className="font-medium">{r.entradas.length}</span>
                        <span className="text-ink-500 dark:text-ink-400">entradas</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <AlertTriangle size={16} />
                        <span className="font-medium">{r.evitar.length}</span>
                        <span className="text-ink-500 dark:text-ink-400">evitar</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
