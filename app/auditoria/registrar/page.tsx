import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import FormularioTrade from '@/components/FormularioTrade';
import { listarRelatorios } from '@/lib/relatorios';

export default function RegistrarPage() {
  // Coleta sugestões dos relatórios mais recentes
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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Registrar trade</h1>
        <p className="text-sm text-ink-500 mt-1">
          Os dados são salvos no GitHub e o site atualiza em ~1 minuto.
        </p>
      </div>

      <div className="card p-6">
        <FormularioTrade sugestoes={sugestoes} />
      </div>
    </div>
  );
}
