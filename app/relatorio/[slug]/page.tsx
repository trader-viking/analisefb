import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft } from 'lucide-react';
import { getRelatorio, listarRelatorios } from '@/lib/relatorios';

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

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{relatorio.titulo}</h1>
        {relatorio.subtitulo && (
          <p className="text-ink-500 mt-1">{relatorio.subtitulo}</p>
        )}
      </div>

      <article className="prose-trader">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Tabela com wrapper para scroll horizontal no mobile
            table: ({ children }) => (
              <div className="table-wrap">
                <table>{children}</table>
              </div>
            ),
            // Remove h1 duplicado (já está acima)
            h1: () => null,
          }}
        >
          {relatorio.conteudo}
        </ReactMarkdown>
      </article>
    </div>
  );
}
