import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import FormularioTrade from '@/components/FormularioTrade';
import { listarTrades } from '@/lib/trades';
import { listarRelatorios } from '@/lib/relatorios';

export function generateStaticParams() {
  const trades = listarTrades();
  // Se não houver trades, retorna um placeholder pra satisfazer o build estático.
  // A página vai dar 404 normalmente quando acessada.
  if (trades.length === 0) {
    return [{ id: '_placeholder' }];
  }
  return trades.map((t) => ({ id: t.id }));
}

export default function EditarPage({ params }: { params: { id: string } }) {
  const decodedId = decodeURIComponent(params.id);
  // Página placeholder pra satisfazer o build estático quando não há trades
  if (decodedId === '_placeholder') notFound();

  const trades = listarTrades();
  const trade = trades.find((t) => t.id === decodedId);
  if (!trade) notFound();

  const relatorios = listarRelatorios().slice(0, 5);
  const sugestoes = relatorios.flatMap((r) =>
    r.entradas.map((e) => ({
      jogo: e.jogo,
      liga: e.liga,
      horario: e.horario,
      data: r.data,
      mercado_sugerido: e.mercado_principal,
      odd_sugerida: e.odd_principal,
      stake_sugerida: e.stake_recomendada,
    }))
  );

  return (
    <div>
      <Link
        href="/auditoria/"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 mb-6 transition"
      >
        <ArrowLeft size={16} />
        Voltar para Auditoria
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Editar trade</h1>
        <p className="text-sm text-ink-500 mt-1 font-mono">ID: {trade.id}</p>
      </div>

      <div className="card p-6">
        <FormularioTrade modoEdicao tradeInicial={trade} sugestoes={sugestoes} />
      </div>
    </div>
  );
}
