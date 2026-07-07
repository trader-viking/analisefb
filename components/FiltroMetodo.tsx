'use client';

/**
 * Melhoria #4 — Filtro rápido por método na página principal.
 * Botões "Todos · Back Favorito · Lay Zebra · ..." em linha horizontal,
 * visíveis sem abrir a gaveta de filtros. Reusa o MESMO estado de filtro
 * da barra lateral (recebe o Set e o setter do ListaEntradas), então os
 * dois lugares ficam sempre sincronizados.
 */
import { METODOS_INFO } from '@/components/BadgeMetodo';

type Props = {
  metodosDisponiveis: string[];
  contagem: Record<string, number>;
  ativos: Set<string>;
  onChange: (novos: Set<string>) => void;
};

export default function FiltroMetodo({ metodosDisponiveis, contagem, ativos, onChange }: Props) {
  function toggle(m: string) {
    const novo = new Set(ativos);
    if (novo.has(m)) novo.delete(m);
    else novo.add(m);
    onChange(novo);
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 mb-3 [scrollbar-width:thin]">
      <button
        type="button"
        onClick={() => onChange(new Set())}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition shrink-0 ${
          ativos.size === 0
            ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
            : 'ring-1 ring-ink-200 dark:ring-ink-700 text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-900'
        }`}
      >
        Todos
      </button>
      {metodosDisponiveis.map((m) => {
        const info = METODOS_INFO[m];
        if (!info) return null;
        const qtd = contagem[m] || 0;
        const ativo = ativos.has(m);
        const vazio = qtd === 0;
        return (
          <button
            key={m}
            type="button"
            disabled={vazio}
            onClick={() => toggle(m)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition shrink-0 ${
              ativo
                ? `${info.cor_bg} ${info.cor_text} ring-2 ${info.cor_ring}`
                : vazio
                  ? 'ring-1 ring-ink-100 dark:ring-ink-800 text-ink-300 dark:text-ink-700 cursor-not-allowed opacity-60'
                  : 'ring-1 ring-ink-200 dark:ring-ink-700 text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-900'
            }`}
          >
            {info.icone}
            {info.label}
            <span className="tabular-nums opacity-70">{qtd}</span>
          </button>
        );
      })}
    </div>
  );
}
