'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, X, ChevronRight } from 'lucide-react';
import { type EntradaJogador, type MetodoJogador, METODOS_JOGADOR } from '@/lib/jogadores_tipos';

type Item = EntradaJogador & {
  _slug: string;
  _data: string;
  _relatorio_slug: string;
};

export default function TabelaJogadoresCliente({ itens }: { itens: Item[] }) {
  const [busca, setBusca] = useState('');
  const [metodosAtivos, setMetodosAtivos] = useState<Set<MetodoJogador>>(new Set());
  const [ligaAtiva, setLigaAtiva] = useState<string>('');
  const [dataAtiva, setDataAtiva] = useState<string>('');

  // Lista de filtros disponíveis
  const ligas = useMemo(() => {
    const s = new Set<string>();
    itens.forEach((i) => i.liga && s.add(i.liga));
    return Array.from(s).sort();
  }, [itens]);

  const datas = useMemo(() => {
    const s = new Set<string>();
    itens.forEach((i) => s.add(i._data));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [itens]);

  // Contagem por método (pros chips de filtro)
  const contagemMetodos = useMemo(() => {
    const cont: Record<string, number> = {};
    itens.forEach((i) => {
      cont[i.metodo] = (cont[i.metodo] || 0) + 1;
    });
    return cont;
  }, [itens]);

  // Aplica filtros
  const filtrados = useMemo(() => {
    return itens.filter((i) => {
      if (metodosAtivos.size > 0 && !metodosAtivos.has(i.metodo)) return false;
      if (ligaAtiva && i.liga !== ligaAtiva) return false;
      if (dataAtiva && i._data !== dataAtiva) return false;
      if (busca.trim()) {
        const b = busca.toLowerCase();
        const alvo = `${i.jogador} ${i.time} ${i.jogo} ${i.liga}`.toLowerCase();
        if (!alvo.includes(b)) return false;
      }
      return true;
    });
  }, [itens, metodosAtivos, ligaAtiva, dataAtiva, busca]);

  function toggleMetodo(m: MetodoJogador) {
    setMetodosAtivos((prev) => {
      const nova = new Set(prev);
      if (nova.has(m)) nova.delete(m);
      else nova.add(m);
      return nova;
    });
  }

  function limparFiltros() {
    setBusca('');
    setMetodosAtivos(new Set());
    setLigaAtiva('');
    setDataAtiva('');
  }

  const temFiltro = metodosAtivos.size > 0 || ligaAtiva || dataAtiva || busca.trim();

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="card p-4 space-y-3">
        {/* Busca + selects */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar jogador, time, jogo..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={ligaAtiva}
            onChange={(e) => setLigaAtiva(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todas as ligas</option>
            {ligas.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select
            value={dataAtiva}
            onChange={(e) => setDataAtiva(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todas as datas</option>
            {datas.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Chips de métodos */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(METODOS_JOGADOR) as MetodoJogador[]).map((m) => {
            const info = METODOS_JOGADOR[m];
            const ativo = metodosAtivos.has(m);
            const n = contagemMetodos[m] || 0;
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMetodo(m)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  ativo
                    ? `bg-${info.cor}-100 text-${info.cor}-800 ring-1 ring-${info.cor}-300 dark:bg-${info.cor}-950/50 dark:text-${info.cor}-300`
                    : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-900 dark:text-ink-400'
                }`}
              >
                <span>{info.emoji}</span>
                <span>{info.label}</span>
                <span className="opacity-70">({n})</span>
              </button>
            );
          })}
          {temFiltro && (
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400"
            >
              <X size={11} />
              Limpar filtros
            </button>
          )}
        </div>

        <div className="text-xs text-ink-500">
          Mostrando {filtrados.length} de {itens.length} {filtrados.length === 1 ? 'entrada' : 'entradas'}
        </div>
      </div>

      {/* Tabela */}
      {filtrados.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-500">
          Nenhuma entrada com esses filtros.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-500 border-b border-ink-200 dark:border-ink-800">
                <th className="py-2.5 px-3 font-semibold">Jogador</th>
                <th className="py-2.5 px-3 font-semibold">Time</th>
                <th className="py-2.5 px-3 font-semibold">Jogo</th>
                <th className="py-2.5 px-3 font-semibold">Método</th>
                <th className="py-2.5 px-3 font-semibold">Mercado</th>
                <th className="py-2.5 px-3 font-semibold text-right">Odd mín.</th>
                <th className="py-2.5 px-3 font-semibold">Data</th>
                <th className="py-2.5 px-3 font-semibold w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((it, idx) => {
                const info = METODOS_JOGADOR[it.metodo];
                return (
                  <tr
                    key={`${it._relatorio_slug}-${it._slug}-${idx}`}
                    className="border-b border-ink-100 dark:border-ink-800/50 hover:bg-ink-50 dark:hover:bg-ink-900/30"
                  >
                    <td className="py-2.5 px-3 font-medium">{it.jogador}</td>
                    <td className="py-2.5 px-3 text-ink-600 dark:text-ink-400">{it.time}</td>
                    <td className="py-2.5 px-3 text-ink-500 truncate max-w-[200px]" title={it.jogo}>
                      {it.jogo}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-${info.cor}-50 text-${info.cor}-700 dark:bg-${info.cor}-950/40 dark:text-${info.cor}-400`}>
                        {info.emoji} {info.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-ink-700 dark:text-ink-300">{it.mercado}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{it.odd_minima || '—'}</td>
                    <td className="py-2.5 px-3 text-ink-500 tabular-nums text-xs">{it._data}</td>
                    <td className="py-2.5 px-3 text-ink-400">
                      <Link
                        href={`/jogadores/${it._relatorio_slug}/${it._slug}/`}
                        className="hover:text-ink-700 dark:hover:text-ink-200"
                        title="Ver detalhes"
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
