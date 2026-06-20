import { Users, FileText } from 'lucide-react';
import { listarRelatoriosJogadores } from '@/lib/relatorios_jogadores';
import { entradaJogadorSlug } from '@/lib/jogadores_tipos';
import NavegacaoPrincipal from '@/components/NavegacaoPrincipal';
import TabelaJogadoresCliente from '@/components/TabelaJogadoresCliente';

export const dynamic = 'force-static';

export default function PaginaJogadores() {
  const relatorios = listarRelatoriosJogadores();

  // Achata todas as entradas em uma lista única, anotando o slug
  const itens: any[] = [];
  for (const r of relatorios) {
    r.entradas.forEach((e, idx) => {
      itens.push({
        ...e,
        _slug: entradaJogadorSlug(e, idx),
        _data: r.data,
        _relatorio_slug: r.slug,
      });
    });
  }

  return (
    <div>
      <NavegacaoPrincipal />

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Análise de Jogadores</h1>
        <p className="text-sm text-ink-500">
          {relatorios.length === 0
            ? 'Nenhum relatório de jogadores ainda.'
            : `${itens.length} ${itens.length === 1 ? 'entrada' : 'entradas'} em ${relatorios.length} ${relatorios.length === 1 ? 'dia' : 'dias'}`}
        </p>
      </div>

      {relatorios.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="mx-auto mb-3 text-ink-400" size={40} />
          <h2 className="font-semibold mb-1">Sem relatórios de jogadores</h2>
          <p className="text-sm text-ink-500 max-w-md mx-auto">
            Quando você rodar <code className="px-1.5 py-0.5 rounded bg-ink-100 dark:bg-ink-900 text-xs">python main_jogadores.py</code>, as análises aparecerão aqui.
          </p>
        </div>
      ) : itens.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-500">
          <FileText className="mx-auto mb-2 text-ink-400" size={32} />
          Os relatórios foram gerados, mas não há entradas (jogos sem candidatos).
        </div>
      ) : (
        <TabelaJogadoresCliente itens={itens} />
      )}
    </div>
  );
}
