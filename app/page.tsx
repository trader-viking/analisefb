import Link from 'next/link';
import { listarRelatorios } from '@/lib/relatorios';
import { Calendar, FileText, ChevronRight, Filter } from 'lucide-react';

export default function HomePage() {
  const relatorios = listarRelatorios();

  // Agrupa por data
  const porData = new Map<string, typeof relatorios>();
  for (const r of relatorios) {
    if (!porData.has(r.data)) porData.set(r.data, []);
    porData.get(r.data)!.push(r);
  }
  const datas = Array.from(porData.keys()).sort((a, b) => b.localeCompare(a));

  if (relatorios.length === 0) {
    return (
      <div className="text-center py-20">
        <FileText className="mx-auto mb-4 text-ink-400" size={48} />
        <h1 className="text-2xl font-bold mb-2">Nenhum relatório ainda</h1>
        <p className="text-ink-500">
          Quando você rodar <code>python main.py</code>, os relatórios aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 tracking-tight">Relatórios</h1>
        <p className="text-ink-500 text-sm">
          {relatorios.length} relatório{relatorios.length === 1 ? '' : 's'} em {datas.length} dia
          {datas.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="space-y-6">
        {datas.map((data) => {
          const itens = porData.get(data)!;
          const completo = itens.find((r) => !r.variante);
          const variantes = itens.filter((r) => r.variante);
          return (
            <section key={data}>
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-ink-500 uppercase tracking-wider">
                <Calendar size={14} />
                {itens[0].titulo}
              </div>
              <div className="rounded-xl ring-1 ring-ink-200 dark:ring-ink-800 overflow-hidden bg-white dark:bg-ink-900">
                {completo && (
                  <Link
                    href={`/relatorio/${completo.slug}/`}
                    className="block px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-800/50 transition border-b border-ink-100 dark:border-ink-800 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText size={18} className="text-blue-600 dark:text-blue-400" />
                        <div>
                          <div className="font-semibold">Relatório completo</div>
                          <div className="text-xs text-ink-500">
                            {(completo.tamanho / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-ink-400" />
                    </div>
                  </Link>
                )}
                {variantes.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/relatorio/${r.slug}/`}
                    className="block px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-800/50 transition border-b border-ink-100 dark:border-ink-800 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Filter size={18} className="text-ink-400" />
                        <div>
                          <div className="font-medium text-sm">{r.subtitulo}</div>
                          <div className="text-xs text-ink-500">
                            {(r.tamanho / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-ink-400" />
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
