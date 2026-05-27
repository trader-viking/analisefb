'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ExternalLink, TrendingUp, Clock, Trophy, X, SlidersHorizontal, Radio,
} from 'lucide-react';
import { BadgeMetodo, metodosAtivos, metodosRankeados, METODOS_INFO, modoDoMetodo } from '@/components/BadgeMetodo';
import { ContextoTimesCompacto } from '@/components/ContextoTimes';
import BotoesApostaMini from '@/components/BotoesApostaMini';
import BotaoBaixarImagem from '@/components/BotaoBaixarImagem';
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

// Tipo do placar retornado pelo Worker
type Placar = {
  casa: string;
  fora: string;
  gols_casa: number | null;
  gols_fora: number | null;
  status: 'finalizado' | 'em_andamento' | 'agendado';
};

function normalizarNome(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Casa o nome do jogo do relatório ("Casa x Fora") com um placar da API
function placarCombina(jogoStr: string, placar: Placar): boolean {
  const partes = normalizarNome(jogoStr).split(/ x | vs | - /);
  if (partes.length !== 2) return false;
  const [b1, b2] = partes.map((s) => s.trim());
  const c = normalizarNome(placar.casa);
  const f = normalizarNome(placar.fora);
  const match = (busca: string, real: string) => {
    const palavras = busca.split(' ').filter((p) => p.length >= 4);
    if (palavras.length === 0) return real.includes(busca);
    return palavras.some((p) => real.includes(p));
  };
  return (match(b1, c) && match(b2, f)) || (match(b1, f) && match(b2, c));
}

export default function ListaEntradas({ relatorioSlug, entradas }: Props) {
  // Estado dos filtros
  const [metodosAtivos_, setMetodosAtivos_] = useState<Set<string>>(new Set());
  const [ligasAtivas, setLigasAtivas] = useState<Set<string>>(new Set());
  const [horariosAtivos, setHorariosAtivos] = useState<Set<Janela>>(new Set());
  const [modosAtivos, setModosAtivos] = useState<Set<string>>(new Set());
  const [soRolando, setSoRolando] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [placares, setPlacares] = useState<Placar[]>([]);
  const [gavetaAberta, setGavetaAberta] = useState(false);

  // Busca placares do dia no Worker (pra mostrar jogos encerrados)
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;
    // relatorioSlug pode ter sufixo (ex: "2026-05-20_under") — extrai só a data
    const m = relatorioSlug.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!m) return;
    const data = m[1];

    let cancelado = false;
    fetch(`${apiUrl}/placares?data=${data}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((dados) => {
        if (!cancelado && dados && Array.isArray(dados.placares)) {
          setPlacares(dados.placares);
        }
      })
      .catch(() => {/* silencioso — sem placar não quebra o site */});
    return () => { cancelado = true; };
  }, [relatorioSlug]);

  // Função que retorna o placar de uma entrada (ou null).
  // Prioridade: placar gravado no relatorio (_placar) > placar buscado na API.
  function placarDe(entrada: Entrada): Placar | null {
    // 1. Placar gravado pelo Worker (funciona pra qualquer data)
    if (entrada._placar || entrada._status) {
      let gc: number | null = null;
      let gf: number | null = null;
      if (entrada._placar && /^\d+x\d+$/.test(entrada._placar)) {
        const [a, b] = entrada._placar.split('x').map((n) => parseInt(n, 10));
        gc = a; gf = b;
      }
      return {
        casa: '', fora: '',
        gols_casa: gc, gols_fora: gf,
        status: (entrada._status as Placar['status']) || 'finalizado',
      };
    }
    // 2. Placar buscado na API (jogos de hoje em tempo real)
    for (const p of placares) {
      if (placarCombina(entrada.jogo, p)) return p;
    }
    return null;
  }

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
  // Conta quantas entradas usam cada método (pra mostrar sempre os 5 com contador)
  const TODOS_METODOS = ['back_favorito','lay_zebra','over_limite_70','back_2x2','back_goleada','confirmacao_visual'];
  const contagemMetodos = useMemo(() => {
    const cont: Record<string, number> = {};
    for (const m of TODOS_METODOS) cont[m] = 0;
    for (const e of entradas) {
      for (const m of metodosAtivos(e)) {
        if (cont[m] !== undefined) cont[m]++;
      }
    }
    return cont;
  }, [entradas]);

  // Métodos disponíveis = sempre os 5 principais (Confirmação Visual só se houver)
  const metodosDisponiveis = useMemo(() => {
    const base = ['back_favorito','lay_zebra','over_limite_70','back_2x2','back_goleada'];
    // Adiciona confirmacao_visual só se existir em alguma entrada
    if (contagemMetodos['confirmacao_visual'] > 0) base.push('confirmacao_visual');
    return base;
  }, [contagemMetodos]);

  // Retorna os modos (ao_vivo/pre_jogo) de uma entrada.
  // REGRA: Over Limite 70+ sempre conta como ao_vivo, independente do sub-cenário.
  function modosDaEntrada(e: Entrada): Set<string> {
    const ativos = metodosAtivos(e);
    const modos = new Set<string>();
    for (const m of ativos) {
      if (m === 'over_limite_70') {
        modos.add('ao_vivo'); // Over 70 é sempre ao vivo
        continue;
      }
      const mo = modoDoMetodo(e, m);
      if (mo) modos.add(mo);
    }
    return modos;
  }

  // Conta quantas entradas têm método ao vivo / pré-jogo
  const contagemModos = useMemo(() => {
    const cont = { ao_vivo: 0, pre_jogo: 0 };
    for (const e of entradas) {
      const modos = modosDaEntrada(e);
      if (modos.has('ao_vivo')) cont.ao_vivo++;
      if (modos.has('pre_jogo')) cont.pre_jogo++;
    }
    return cont;
  }, [entradas]);

  // Conta quantos jogos estão rolando agora (placar em andamento)
  const contagemRolando = useMemo(() => {
    let n = 0;
    for (const e of entradas) {
      const p = placarDe(e);
      if (p?.status === 'em_andamento') n++;
    }
    return n;
  }, [entradas, placares]);

  // Ligas disponíveis (com contagem)
  const ligasDisponiveis = useMemo(() => {
    const cont = new Map<string, number>();
    for (const e of entradas) {
      // Defesa: liga pode vir como array, número, etc. — converte pra string segura
      const ligaBruta = e.liga as any;
      let liga = '';
      if (typeof ligaBruta === 'string') liga = ligaBruta.trim();
      else if (Array.isArray(ligaBruta)) liga = ligaBruta.join(', ').trim();
      else if (ligaBruta !== null && ligaBruta !== undefined) liga = String(ligaBruta).trim();
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
      // Modo (ao vivo / pré-jogo) — entrada passa se TEM algum método no(s) modo(s) selecionado(s)
      if (modosAtivos.size > 0) {
        const modosDaE = modosDaEntrada(e);
        const algum = Array.from(modosAtivos).some(mo => modosDaE.has(mo));
        if (!algum) return false;
      }
      // Só jogos rolando agora (placar em andamento)
      if (soRolando) {
        const p = placarDe(e);
        if (p?.status !== 'em_andamento') return false;
      }
      return true;
    });
  }, [entradas, metodosAtivos_, ligasAtivas, horariosAtivos, modosAtivos, soRolando, placares]);

  // A lista exibida são as entradas filtradas
  const entradasExibidas = entradasFiltradas;

  const temFiltro = metodosAtivos_.size + ligasAtivas.size + horariosAtivos.size + modosAtivos.size > 0 || soRolando;

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
    setModosAtivos(new Set());
    setSoRolando(false);
  }

  // Conteúdo dos filtros (reutilizado na lateral desktop e na gaveta mobile)
  const conteudoFiltros = (
    <div className="space-y-5">
      {/* Métodos */}
      {metodosDisponiveis.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-2 font-semibold">Método</div>
          <div className="flex flex-col gap-1.5">
            {metodosDisponiveis.map(m => {
              const info = METODOS_INFO[m];
              if (!info) return null;
              const ativo = metodosAtivos_.has(m);
              const qtd = contagemMetodos[m] || 0;
              const vazio = qtd === 0;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={vazio}
                  onClick={() => toggle(metodosAtivos_, m, setMetodosAtivos_)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition w-full ${
                    ativo
                      ? `${info.cor_bg} ${info.cor_text} ring-2 ${info.cor_ring}`
                      : vazio
                        ? `ring-1 ring-ink-100 dark:ring-ink-800 text-ink-300 dark:text-ink-700 cursor-not-allowed opacity-60`
                        : `ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-900 text-ink-600 dark:text-ink-400`
                  }`}
                >
                  {info.icone}
                  <span className="flex-1 text-left">{info.label}</span>
                  <span className={`tabular-nums ${vazio ? 'opacity-50' : 'opacity-70'}`}>{qtd}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Modo (ao vivo / pré-jogo) */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-2 font-semibold">Modo</div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled={contagemModos.ao_vivo === 0}
            onClick={() => toggle(modosAtivos, 'ao_vivo', setModosAtivos)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition w-full ${
              modosAtivos.has('ao_vivo')
                ? 'bg-red-600 text-white ring-2 ring-red-400'
                : contagemModos.ao_vivo === 0
                  ? 'ring-1 ring-ink-100 dark:ring-ink-800 text-ink-300 dark:text-ink-700 cursor-not-allowed opacity-60'
                  : 'ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-900 text-ink-600 dark:text-ink-400'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${modosAtivos.has('ao_vivo') ? 'bg-white' : 'bg-red-500'}`}></span>
            <span className="flex-1 text-left">Ao Vivo</span>
            <span className={`tabular-nums ${contagemModos.ao_vivo === 0 ? 'opacity-50' : 'opacity-70'}`}>{contagemModos.ao_vivo}</span>
          </button>
          <button
            type="button"
            disabled={contagemModos.pre_jogo === 0}
            onClick={() => toggle(modosAtivos, 'pre_jogo', setModosAtivos)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition w-full ${
              modosAtivos.has('pre_jogo')
                ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900 ring-2 ring-ink-400'
                : contagemModos.pre_jogo === 0
                  ? 'ring-1 ring-ink-100 dark:ring-ink-800 text-ink-300 dark:text-ink-700 cursor-not-allowed opacity-60'
                  : 'ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-900 text-ink-600 dark:text-ink-400'
            }`}
          >
            <Clock size={12} />
            <span className="flex-1 text-left">Pré-jogo</span>
            <span className={`tabular-nums ${contagemModos.pre_jogo === 0 ? 'opacity-50' : 'opacity-70'}`}>{contagemModos.pre_jogo}</span>
          </button>
        </div>
      </div>

      {/* Ligas */}
      {ligasDisponiveis.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-2 font-semibold">Liga</div>
          <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
            {ligasDisponiveis.map(([liga, qtd]) => (
              <button
                key={liga}
                type="button"
                onClick={() => toggle(ligasAtivas, liga, setLigasAtivas)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition w-full text-left ${
                  ligasAtivas.has(liga)
                    ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
                    : 'ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-900 text-ink-700 dark:text-ink-300'
                }`}
              >
                <span className="truncate">{liga}</span>
                <span className="opacity-60 ml-1 shrink-0">{qtd}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Horários */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-2 font-semibold">Horário</div>
        <div className="flex flex-col gap-1.5">
          {JANELAS_HORARIO.map(j => (
            <button
              key={j.id}
              type="button"
              onClick={() => toggle(horariosAtivos, j.id, setHorariosAtivos)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition w-full text-left ${
                horariosAtivos.has(j.id)
                  ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
                  : 'ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-900 text-ink-700 dark:text-ink-300'
              }`}
            >
              {j.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const temFiltrosDisponiveis = metodosDisponiveis.length + ligasDisponiveis.length > 0;

  return (
    <section>
      <div className="flex gap-6 items-start">
        {/* ===== BARRA LATERAL (desktop) ===== */}
        {temFiltrosDisponiveis && (
          <aside className="hidden lg:block w-56 shrink-0 sticky top-4">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
                  <SlidersHorizontal size={13} />
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
              {conteudoFiltros}
            </div>
          </aside>
        )}

        {/* ===== CONTEÚDO PRINCIPAL ===== */}
        <div className="flex-1 min-w-0">
          {/* Cabeçalho com botão de filtros (mobile) */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-600 dark:text-emerald-400" />
              Entradas com valor
            </h2>
            {temFiltrosDisponiveis && (
              <button
                type="button"
                onClick={() => setGavetaAberta(true)}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-900 transition relative"
              >
                <SlidersHorizontal size={14} />
                Filtros
                {temFiltro && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">
                    {metodosAtivos_.size + ligasAtivas.size + horariosAtivos.size + modosAtivos.size}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Botões de destaque: Rolando agora + Sugestão de entrada ao vivo */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setSoRolando(v => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition shrink-0 ${
                soRolando
                  ? 'bg-red-600 text-white ring-1 ring-red-400'
                  : 'ring-1 ring-red-200 dark:ring-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              Rolando agora
              <span className="tabular-nums opacity-70">{contagemRolando}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const novo = new Set(modosAtivos);
                if (novo.has('ao_vivo')) novo.delete('ao_vivo'); else novo.add('ao_vivo');
                setModosAtivos(novo);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition shrink-0 ${
                modosAtivos.has('ao_vivo')
                  ? 'bg-purple-600 text-white ring-1 ring-purple-400'
                  : 'ring-1 ring-purple-200 dark:ring-purple-900 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30'
              }`}
            >
              <Radio size={13} />
              Sugestão de entrada ao vivo
              <span className="tabular-nums opacity-70">{contagemModos.ao_vivo}</span>
            </button>
          </div>

          {entradasExibidas.length === 0 ? (
            <div className="card p-6 text-center text-sm text-ink-500">
              Nenhuma entrada corresponde aos filtros selecionados.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {entradasExibidas.map((entrada) => {
                // Métodos ordenados por confiança (maior primeiro)
                const ranking = metodosRankeados(entrada);

                // Decide quais métodos mostrar no card:
                // - Se há filtro de método ativo: mostra só os métodos filtrados
                // - Senão: mostra o principal + secundário (top 2 por confiança)
                let mAtivos: string[];
                if (metodosAtivos_.size > 0) {
                  mAtivos = ranking.filter((m) => metodosAtivos_.has(m));
                } else {
                  mAtivos = ranking.slice(0, 2);
                }

                // Placar do jogo (se disponível)
                const placar = placarDe(entrada);
                const encerrado = placar?.status === 'finalizado';
                const aoVivo = placar?.status === 'em_andamento';

                return (
                  <CardEntrada
                    key={entrada._slug}
                    entrada={entrada}
                    mAtivos={mAtivos}
                    placar={placar}
                    encerrado={encerrado}
                    aoVivo={aoVivo}
                    relatorioSlug={relatorioSlug}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===== GAVETA DE FILTROS (mobile) ===== */}
      {gavetaAberta && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setGavetaAberta(false)}
          />
          {/* Painel */}
          <div className="relative ml-auto w-72 max-w-[80vw] h-full bg-white dark:bg-ink-950 shadow-xl p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-ink-600 dark:text-ink-300">
                <SlidersHorizontal size={15} />
                Filtros
              </div>
              <button
                type="button"
                onClick={() => setGavetaAberta(false)}
                className="p-1 rounded hover:bg-ink-100 dark:hover:bg-ink-800 transition"
              >
                <X size={18} />
              </button>
            </div>
            {conteudoFiltros}
            {temFiltro && (
              <button
                type="button"
                onClick={limpar}
                className="mt-5 w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-md text-xs font-medium ring-1 ring-ink-200 dark:ring-ink-700 hover:bg-ink-50 dark:hover:bg-ink-900 transition"
              >
                <X size={12} />
                Limpar filtros
              </button>
            )}
            <button
              type="button"
              onClick={() => setGavetaAberta(false)}
              className="mt-2 w-full btn btn-primary justify-center"
            >
              Ver resultados ({entradasFiltradas.length})
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// =====================================================================
// Card individual de entrada (com ref própria pra exportar como imagem)
// =====================================================================
type Placar2 = {
  casa: string; fora: string;
  gols_casa: number | null; gols_fora: number | null;
  status: 'finalizado' | 'em_andamento' | 'agendado';
};

function CardEntrada({ entrada, mAtivos, placar, encerrado, aoVivo, relatorioSlug }: {
  entrada: Entrada;
  mAtivos: string[];
  placar: Placar2 | null;
  encerrado: boolean;
  aoVivo: boolean;
  relatorioSlug: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={cardRef} className={`card p-4 flex flex-col gap-3 ${encerrado ? 'opacity-90' : ''}`}>
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
        <span className="ml-auto inline-flex items-center gap-1">
          {encerrado && entrada._veredito === 'green' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white font-semibold">
              ✓ GREEN
            </span>
          )}
          {encerrado && entrada._veredito === 'red' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white font-semibold">
              ✗ RED
            </span>
          )}
          {encerrado && entrada._veredito !== 'green' && entrada._veredito !== 'red' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-ink-200 text-ink-700 dark:bg-ink-700 dark:text-ink-200 font-semibold">
              Encerrado
            </span>
          )}
          {aoVivo && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              Ao vivo
            </span>
          )}
          <BotaoBaixarImagem alvoRef={cardRef} nomeArquivo={entrada.jogo} variante="icone" />
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold leading-snug">{entrada.jogo}</div>
        {placar && (placar.gols_casa !== null && placar.gols_fora !== null) && (
          <div className={`shrink-0 font-bold tabular-nums text-lg ${encerrado ? 'text-ink-700 dark:text-ink-200' : 'text-red-600 dark:text-red-400'}`}>
            {placar.gols_casa}<span className="text-ink-400 mx-0.5">x</span>{placar.gols_fora}
          </div>
        )}
      </div>

      <ContextoTimesCompacto jogo={entrada.jogo} contexto={entrada.contexto_times} />

      {mAtivos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {mAtivos.map(m => (
            <BadgeMetodo key={m} metodo={m} modo={modoDoMetodo(entrada, m)} />
          ))}
        </div>
      )}

      <div className="text-sm">
        <div className="text-ink-500 text-xs uppercase tracking-wider mb-0.5">
          Mercado principal
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{entrada.mercado_principal}</span>
          {(entrada.odd_minima_entrada || entrada.odd_principal) && (
            <span className="ml-auto text-right">
              <span className="block text-[9px] uppercase tracking-wider text-ink-400 leading-none">Odd mín.</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {entrada.odd_minima_entrada || entrada.odd_principal}
              </span>
            </span>
          )}
        </div>
        {entrada.probabilidade_estimada && (
          <div className="text-[11px] text-ink-400 mt-1">
            Prob. estimada {entrada.probabilidade_estimada}
            {entrada.fair_odd && ` · fair ${entrada.fair_odd}`}
          </div>
        )}
      </div>

      <div className="mt-auto pt-3 border-t border-ink-100 dark:border-ink-800 space-y-2" data-no-export="true">
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
}
