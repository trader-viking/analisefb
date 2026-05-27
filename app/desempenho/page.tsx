import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listarRelatorios } from '@/lib/relatorios';
import { entradasCalculaveis } from '@/lib/desempenho';
import DesempenhoCliente from '@/components/DesempenhoCliente';

export const dynamic = 'force-static';

export default function PaginaDesempenho() {
  const relatorios = listarRelatorios();
  const itens = entradasCalculaveis(relatorios);

  return (
    <main className="container mx-auto px-3 py-4 max-w-7xl">
      <div className="mb-4 flex items-center gap-2 text-sm text-ink-500">
        <Link
          href="/"
          className="inline-flex items-center gap-1 hover:text-ink-800 dark:hover:text-ink-200"
        >
          <ArrowLeft size={14} />
          Voltar
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-1">Desempenho</h1>
      <p className="text-sm text-ink-500 mb-6">
        Métricas calculadas a partir dos jogos auditados (com placar e veredito).
        ROI usa a odd mínima estimada e a stake recomendada por método.
      </p>

      {itens.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink-500">
          Ainda não há jogos auditados com veredito. Quando a auditoria automática
          gravar os placares e GREEN/RED, as métricas aparecem aqui.
        </div>
      ) : (
        <DesempenhoCliente itens={itens} />
      )}
    </main>
  );
}
