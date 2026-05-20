'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  ExternalLink, TrendingUp, Clock, Trophy, Filter, X,
} from 'lucide-react';
import { BadgeMetodo, metodosAtivos, METODOS_INFO, modoDoMetodo } from '@/components/BadgeMetodo';
import BotoesApostaMini from '@/components/BotoesApostaMini';
import type { Entrada } from '@/lib/relatorios';

type EntradaComSlug = Entrada & { _slug: string };

type Props = {
  relatorioSlug: string;
  entradas: EntradaComSlug[];
};

const STORAGE_KEY_PREFIX = 'analisefb:filtros:';
const JANELAS_HORARIO = [
  { id: 'manha',  label: 'Manhã',  range: [0, 11] as const  },
  { id: 'tarde',  label: 'Tarde',  range: [12, 17] as const },
  { id: 'noite',  label: 'Noite',  range: [18, 23] as const },
] as const;

type Janela = typeof JANELAS_HORARIO[number]['id'];

function parseHora(horario?: string): number | null {
  if (!horario) return null;
  const m = horario.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  return isNaN(h) ? null : h;
}

export default function ListaEntradas({ relatorioSlug, entradas }: Props) {
  // Estado dos filtros
  const [metodosAtivos_, setMetodosAtivos_] = useState<Set<string>>(new Set());
  const [ligasAtivas, setLigasAtivas] = useState<Set<string>>(new Set());
  const [horariosAtivos, setHorariosAtivos] = useState<Set<Janela>>(new Set());
  const [carregado, setCarregado] = useState(false);

  // Carrega filtros salvos do localStorage (por relatório)
  useEffect(() => {
    try {
      const chave = `${STORAGE_KEY_PREFIX}${relatorioSlug}`;
      const salvo = localStorage.getItem(chave);
      if (salvo) {
        const obj = JSON.parse(salvo);
        if (Array.isArray(obj.metodos)) setMetodosAtivos_(new Set(obj.metodos));
        if (Array.isArray(obj.ligas)) setLigasAtivas(new Set(obj.ligas));
        if (Array.isArray(obj.horarios)) setHorariosAtivos(new Set(obj.horarios));
      }
    } catch {}
    setCarregado(true);
  }, [relatorioSlug]);

  // Salva filtros sempre que mudarem
  useEffect(() => {
    if (!carregado) return;
    try {
      const chave = `${STORAGE_KEY_PREFIX}${relatorioSlug}`;
      localStorage.setItem(chave, JSON.stringify({
        metodos: Array.from(metodosAtivos_),
        ligas: Array.from(ligasAtivas),
        horarios: Array.from(horariosAtivos),
      }));
    } catch {}
  }, [carregado, relatorioSlug, metodosAtivos_, ligasAtivas, horariosAtivos]);

  // Métodos disponíveis (só os que aparecem em alguma entrada deste dia)
  const metodosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const e of entradas) {
      for (const m of metodosAtivos(e)) set.add(m);
    }
    return ['back_favorito','lay_zebra','over_limite_70','back_2x2','back_goleada','confirmacao_visual']
      .filter(m => set.has(m));
  }, [entradas]);

  // Ligas disponíveis (com contagem)
  const ligasDisponiveis = useMemo(() => {
    const cont = new Map<string, number>();
    for (const e of entradas) {
      const liga = e.liga?.trim();
      if (liga) cont.set(liga, (cont.get(liga) || 0) + 1);
    }
    return Array.from(cont.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [entradas]);

  // Aplica filtros
  const entradasFiltradas = useMemo(() => {
    return entradas.filter(e => {
      // Método
      if (metodosAtivos_.size > 0) {
        const mEntrada = new Set(metodosAtivos(e));
        const algum = Array.from(metodosAtivos_).some(m => mEntrada.has(m));
        if (!algum) return false;
      }
      // Liga
      if (ligasAtivas.size > 0) {
        if (!e.liga || !ligasAtivas.has(e.liga)) return false;
      }
      // Horário
      if (horariosAtivos.size > 0) {
        const h = parseHora(e.horario);
        if (h === null) return false;
        const dentro = JANELAS_HORARIO.some(j =>
          horariosAtivos.has(j.id) && h >= j.range[0] && h <= j.range[1]
        );
        if (!dentro) return false;
      }
      return true;
    });
  }, [entradas, metodosAtivos_, ligasAtivas, horariosAtivos]);

  const temFiltro = metodosAtivos_.size + ligasAtivas.size + horariosAtivos.size > 0;

  function toggle<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const novo = new Set(set);
    if (novo.has(val)) novo.delete(val);
    else novo.add(val);
    setter(novo);
  }

  function limpar() {
    setMetodosAtivos_(new Set());
    setLigasAtivas(new Set());
    setHorariosAtivos(new Set());
  }

  // Botão genérico
  function BotaoFiltro({
    ativo, onClick, children, className = '',
  }: {
    ativo: boolean;
    onClick: () => void;
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
          ativo
            ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
            : 'ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-900 text-ink-700 dark:text-ink-300'
        } ${className}`}
      >
        {children}
      </button>
    );
  }

  return (
    <section>
      {/* Barra de filtros */}
      {(metodosDisponiveis.length + ligasDisponiveis.length > 0) && (
        <div className="card p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
              <Filter size={12} />
              Filtros
            </div>
            {temFiltro && (
              <button
                type="button"
                onClick={limpar}
                className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 transition"
              >
                <X size={12} />
                Limpar
              </button>
            )}
          </div>

          {/* Métodos */}
          {metodosDisponiveis.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-1.5">Método</div>
              <div className="flex flex-wrap gap-1.5">
                {metodosDisponiveis.map(m => {
                  const info = METODOS_INFO[m];
                  if (!info) return null;
                  const ativo = metodosAtivos_.has(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggle(metodosAtivos_, m, setMetodosAtivos_)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                        ativo
                          ? `${info.cor_bg} ${info.cor_text} ring-2 ${info.cor_ring}`
                          : `ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-900 text-ink-600 dark:text-ink-400`
                      }`}
                    >
                      {info.icone}
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ligas */}
          {ligasDisponiveis.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-1.5">Liga</div>
              <div className="flex flex-wrap gap-1.5">
                {ligasDisponiveis.map(([liga, qtd]) => (
                  <BotaoFiltro
                    key={liga}
                    ativo={ligasAtivas.has(liga)}
                    onClick={() => toggle(ligasAtivas, liga, setLigasAtivas)}
                  >
                    {liga} <span className="opacity-60">({qtd})</span>
                  </BotaoFiltro>
                ))}
              </div>
            </div>
          )}

          {/* Horários */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-1.5">Horário</div>
            <div className="flex flex-wrap gap-1.5">
              {JANELAS_HORARIO.map(j => (
                <BotaoFiltro
                  key={j.id}
                  ativo={horariosAtivos.has(j.id)}
                  onClick={() => toggle(horariosAtivos, j.id, setHorariosAtivos)}
                >
                  {j.label}
                </BotaoFiltro>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lista de entradas */}
      <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
        <TrendingUp size={18} className="text-emerald-600 dark:text-emerald-400" />
        Entradas com valor
      </h2>

      {entradasFiltradas.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink-500">
          Nenhuma entrada corresponde aos filtros selecionados.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {entradasFiltradas.map((entrada) => {
            const mAtivos = metodosAtivos(entrada);
            return (
              <div key={entrada._slug} className="card p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3 text-xs text-ink-500">
                  {entrada.horario && (
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} />
                      <span className="font-mono">{entrada.horario}</span>
                    </span>
                  )}
                  {entrada.liga && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <Trophy size={12} />
                      <span className="truncate">{entrada.liga}</span>
                    </span>
                  )}
                </div>

                <div className="font-semibold leading-snug">{entrada.jogo}</div>

                {mAtivos.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {mAtivos.map(m => (
                      <BadgeMetodo
                        key={m}
                        metodo={m}
                        modo={modoDoMetodo(entrada, m)}
                      />
                    ))}
                  </div>
                )}

                <div className="text-sm">
                  <div className="text-ink-500 text-xs uppercase tracking-wider mb-0.5">
                    Mercado principal
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{entrada.mercado_principal}</span>
                    <span className="ml-auto font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {entrada.odd_principal}
                    </span>
                  </div>
                </div>

                <div className="mt-auto pt-3 border-t border-ink-100 dark:border-ink-800 space-y-2">
                  <BotoesApostaMini jogo={entrada.jogo} />
                  <Link
                    href={`/relatorio/${relatorioSlug}/${entrada._slug}/`}
                    target="_blank"
                    className="btn btn-secondary justify-center w-full"
                  >
                    Ver detalhes
                    <ExternalLink size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
