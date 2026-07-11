'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ExternalLink, TrendingUp, Clock, Trophy, X, SlidersHorizontal, Radio,
} from 'lucide-react';
import { BadgeMetodo, metodosAtivos, metodosRankeados, METODOS_INFO, modoDoMetodo, razaoDoMetodo, confiancaDoMetodo, LinhaPlanoMetodo } from '@/components/BadgeMetodo';
import PlacaresProvaveis from '@/components/PlacaresProvaveis';
import { calcularPlacaresMaisProvaveis, parseMediaGols } from '@/lib/poisson';
import { ContextoTimesCompacto } from '@/components/ContextoTimes';
import BotoesApostaMini from '@/components/BotoesApostaMini';
import BotaoBaixarImagem from '@/components/BotaoBaixarImagem';
import BotaoFinalizar from '@/components/BotaoFinalizar';
import CountdownPartida from '@/components/CountdownPartida';
import GolsTimeline from '@/components/GolsTimeline';
import BotaoCopiarTelegram from '@/components/BotaoCopiarTelegram';
import HistoricoOdds from '@/components/HistoricoOdds';
import RadarAoVivo from '@/components/RadarAoVivo';
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
  minuto?: number | null;      // melhoria #3: minuto atual do jogo
  fixture_id?: number | null;  // melhoria #5: id na API-Football (eventos)
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
  const [abaAtiva, setAbaAtiva] = useState<'ativos' | 'encerrados'>('ativos');
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
  // Conta quantas entradas usam cada método (pra mostrar sempre todos com contador)
  const TODOS_METODOS = ['back_favorito','lay_zebra','over_limite_70','back_2x2','back_goleada','lay_1x0','lay_0x1','confirmacao_visual'];
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

  // Métodos disponíveis = sempre os 7 principais (Confirmação Visual só se houver)
  const metodosDisponiveis = useMemo(() => {
    const base = ['back_favorito','lay_zebra','over_limite_70','back_2x2','back_goleada','lay_1x0','lay_0x1'];
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
  // Separa as entradas filtradas em ativas (não encerradas) e encerradas,
  // usando o status do placar (gravado automaticamente pela auditoria).
  const entradasAtivas = useMemo(
    () => entradasFiltradas.filter((e) => placarDe(e)?.status !== 'finalizado'),
    [entradasFiltradas, placares]
  );
  const entradasEncerradas = useMemo(
    () => entradasFiltradas.filter((e) => placarDe(e)?.status === 'finalizado'),
    [entradasFiltradas, placares]
  );

  // A lista exibida depende da aba ativa
  const entradasExibidas = abaAtiva === 'encerrados' ? entradasEncerradas : entradasAtivas;

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

          {/* RESUMO DO DIA: foto instantânea sem precisar rolar a lista */}
          {(() => {
            let aoVivoN = 0, greens = 0, reds = 0, pendentes = 0;
            let lucro = 0, exposto = 0;
            for (const e of entradas) {
              const p = placarDe(e);
              if (p?.status === 'em_andamento') aoVivoN++;
              const v = (e as any)._veredito;
              if (v === 'green' || v === 'red') {
                if (v === 'green') greens++; else reds++;
                // ROI estimado com stake/odd recomendados
                const stakeM = String((e as any).stake_recomendada || '').match(/\d+(?:[.,]\d+)?/);
                const oddM = String((e as any).odd_minima_entrada || '').match(/\d+(?:[.,]\d+)?/);
                const stake = stakeM ? parseFloat(stakeM[0].replace(',', '.')) : 0;
                const odd = oddM ? parseFloat(oddM[0].replace(',', '.')) : 0;
                if (stake > 0) {
                  exposto += stake;
                  lucro += v === 'green' ? (odd > 1 ? (odd - 1) * stake : stake) : -stake;
                }
              } else if (p?.status === 'finalizado') {
                pendentes++;
              }
            }
            const roi = exposto > 0 ? (lucro / exposto) * 100 : null;
            return (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 px-3 py-2 rounded-lg bg-ink-50 dark:bg-ink-900/60 ring-1 ring-ink-200/60 dark:ring-ink-800 text-xs">
                <span className="font-semibold tabular-nums">{entradas.length} entrada{entradas.length !== 1 ? 's' : ''}</span>
                {aoVivoN > 0 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400 tabular-nums">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    {aoVivoN} ao vivo
                  </span>
                )}
                {(greens > 0 || reds > 0) && (
                  <>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">✅ {greens}</span>
                    <span className="text-red-700 dark:text-red-400 font-semibold tabular-nums">❌ {reds}</span>
                  </>
                )}
                {pendentes > 0 && (
                  <span className="text-ink-500 tabular-nums">{pendentes} aguardando veredito</span>
                )}
                {roi !== null && (
                  <span className={`ml-auto font-bold tabular-nums ${roi >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                    ROI {roi >= 0 ? '+' : ''}{roi.toFixed(0)}%
                  </span>
                )}
              </div>
            );
          })()}

          {/* Filtro por método/liga: fica só no botão "Filtros" (gaveta no
              mobile, lateral no desktop). Os chips rápidos foram removidos
              por redundância — faziam o mesmo que a gaveta. */}

          {/* Abas: Ativos / Encerrados (separação automática pelo placar) */}
          <div className="flex items-center gap-1 mb-4 border-b border-ink-200 dark:border-ink-800">
            <button
              type="button"
              onClick={() => setAbaAtiva('ativos')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                abaAtiva === 'ativos'
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-ink-500 hover:text-ink-800 dark:hover:text-ink-200'
              }`}
            >
              Ativos ({entradasAtivas.length})
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva('encerrados')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                abaAtiva === 'encerrados'
                  ? 'border-ink-700 text-ink-800 dark:border-ink-300 dark:text-ink-100'
                  : 'border-transparent text-ink-500 hover:text-ink-800 dark:hover:text-ink-200'
              }`}
            >
              Encerrados ({entradasEncerradas.length})
            </button>
          </div>

          {entradasExibidas.length === 0 ? (
            <div className="card p-6 text-center text-sm text-ink-500">
              {abaAtiva === 'encerrados'
                ? 'Nenhum jogo encerrado ainda. Os jogos aparecem aqui automaticamente quando terminam.'
                : 'Nenhuma entrada corresponde aos filtros selecionados.'}
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
  minuto?: number | null;
  fixture_id?: number | null;
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
            {/* Melhoria #6: contador regressivo até o início (some quando
                o jogo está rolando/encerrado — o placar assume) */}
            {!aoVivo && !encerrado && (
              <CountdownPartida
                data={(relatorioSlug.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || ''}
                horario={entrada.horario}
              />
            )}
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
          <BotaoFinalizar
            jogo={entrada.jogo}
            data={(relatorioSlug.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || ''}
            jaFinalizado={(entrada as any)._finalizado_manualmente}
            placarAtual={(entrada as any)._placar}
            temOverLimite={!!(entrada.over_limite_70 && (entrada.over_limite_70 as any).aplicavel)}
            variante="icone"
          />
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold leading-snug">{entrada.jogo}</div>
        {placar && (placar.gols_casa !== null && placar.gols_fora !== null) && (
          <div className={`shrink-0 font-bold tabular-nums text-lg ${encerrado ? 'text-ink-700 dark:text-ink-200' : 'text-red-600 dark:text-red-400'}`}>
            {placar.gols_casa}<span className="text-ink-400 mx-0.5">x</span>{placar.gols_fora}
            {/* Melhoria #3: minuto do jogo ao lado do placar ("2-1 · 67'") */}
            {aoVivo && placar.minuto != null && (
              <span className="ml-1 text-xs font-semibold align-middle text-red-500">
                · {placar.minuto}&apos;
              </span>
            )}
          </div>
        )}
      </div>

      <ContextoTimesCompacto jogo={entrada.jogo} contexto={entrada.contexto_times} />
      {/* CLASSIFICAÇÃO GERAL: complementa a posição por mando (casa/fora)
          que o ContextoTimesCompacto já mostra. Divergência entre geral e
          mando é sinal relevante (ex: 5º geral mas 15º fora = viaja mal). */}
      {(() => {
        const ctx: any = (entrada as any).contexto_times;
        const gc = ctx?.casa?.posicao_geral;
        const gf = ctx?.fora?.posicao_geral;
        if (!gc && !gf) return null;
        const partes = (entrada.jogo || '').split(/\s+x\s+/i);
        return (
          <div className="flex items-center gap-2 text-[11px] text-ink-600 dark:text-ink-400 tabular-nums">
            <span className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold">
              🏆 Geral
            </span>
            {gc && (
              <span>
                <b className="text-ink-800 dark:text-ink-200">{partes[0] || 'Casa'}</b> {gc}
              </span>
            )}
            {gc && gf && <span className="text-ink-300">·</span>}
            {gf && (
              <span>
                <b className="text-ink-800 dark:text-ink-200">{partes[1] || 'Fora'}</b> {gf}
              </span>
            )}
          </div>
        );
      })()}

      {/* Lista compacta de badges (todos os métodos aplicáveis) */}
      {mAtivos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {mAtivos.map(m => (
            <BadgeMetodo key={m} metodo={m} modo={modoDoMetodo(entrada, m)} />
          ))}
        </div>
      )}

      {/* Melhoria #5: linha do tempo dos gols — só em entradas com Over
          Limite e quando o worker identificou o fixture (jogo rolando ou
          encerrado). Mostra o gatilho de 65min e cada gol no minuto real. */}
      {!!(entrada.over_limite_70 && (entrada.over_limite_70 as any).aplicavel) &&
        placar?.fixture_id != null && (aoVivo || encerrado) && (
        <GolsTimeline
          fixtureId={placar.fixture_id}
          minutoAtual={placar.minuto}
          encerrado={encerrado}
        />
      )}

      {/* RADAR AO VIVO: widget de pressão do SofaScore (attack momentum),
          só em jogos rolando, carregado sob demanda (clique) */}
      {aoVivo && <RadarAoVivo jogo={entrada.jogo} />}

      {/* PRINCIPAL — destaque grande, fundo colorido pela cor do método */}
      {(() => {
        const rank = metodosRankeados(entrada);
        // Remove "confirmacao_visual" do ranking principal/secundário
        // (sempre fica como acessório, não como mercado principal)
        const principais = rank.filter(m => m !== 'confirmacao_visual');
        const principal = principais[0];
        const secundarios = principais.slice(1, 3); // máx 2 secundários

        if (!principal) return null;
        const infoP = METODOS_INFO[principal];
        const razaoP = razaoDoMetodo(entrada, principal);
        const confP = confiancaDoMetodo(entrada, principal);

        return (
          <>
            <div className={`rounded-lg border ${infoP?.cor_ring || 'ring-ink-300'} ${infoP?.cor_bg || 'bg-ink-50'} p-3 ring-1 ring-inset`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">
                    Mercado principal
                  </span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold ${infoP?.cor_text || 'text-ink-700'}`}>
                    {infoP?.icone}
                    {infoP?.label || principal}
                    {confP !== null && (() => {
                      const obj: any = (entrada as any)[principal] || {};
                      const atend = Array.isArray(obj.criterios_atendidos) ? obj.criterios_atendidos.length : null;
                      const total = typeof obj.criterios_total === 'number' ? obj.criterios_total : null;
                      const lista = Array.isArray(obj.criterios_atendidos)
                        ? obj.criterios_atendidos.join(' · ') : '';
                      return (
                        <span
                          className="ml-1 opacity-75 tabular-nums"
                          title={lista ? `Critérios atendidos: ${lista}` : undefined}
                        >
                          · {confP}%{atend !== null && total !== null ? ` (${atend}/${total})` : ''}
                        </span>
                      );
                    })()}
                  </span>
                </div>
                {(entrada.odd_minima_entrada || entrada.odd_principal) && (
                  <span className="text-right shrink-0 inline-flex items-start gap-2">
                    {/* EV calculado em código: prob da IA × odd real do mercado */}
                    {typeof (entrada as any)._ev_pct === 'number' && (
                      <span className="text-right">
                        <span className="block text-[9px] uppercase tracking-wider text-ink-400 leading-none">EV</span>
                        <span
                          className={`font-bold tabular-nums ${
                            (entrada as any)._ev_pct >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                          title={`Valor esperado por unidade apostada (odd ${(entrada as any)._ev_odd ?? '—'}, base ${(entrada as any)._ev_base === 'mercado' ? 'odd real do mercado' : 'odd mínima'})`}
                        >
                          {(entrada as any)._ev_pct >= 0 ? '+' : ''}{(entrada as any)._ev_pct}%
                        </span>
                      </span>
                    )}
                    <span className="text-right">
                      <span className="block text-[9px] uppercase tracking-wider text-ink-400 leading-none">Odd mín.</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {entrada.odd_minima_entrada || entrada.odd_principal}
                      </span>
                    </span>
                  </span>
                )}
              </div>
              <div className="text-sm font-medium text-ink-800 dark:text-ink-200 mb-1">
                {entrada.mercado_principal}
              </div>
              {/* Melhoria #2: O QUE FAZER — odd ideal + stake + modo de saída */}
              <LinhaPlanoMetodo entrada={entrada} metodo={principal} />
              {/* PONDERAÇÃO DE MERCADO: como as odds reais e o H2H pesaram
                  (escrito pela IA método a método) */}
              {(() => {
                const pond = (entrada as any)[principal]?.ponderacao_odds;
                if (!pond || typeof pond !== 'string') return null;
                return (
                  <div className="mt-1.5 text-[11px] leading-snug text-ink-600 dark:text-ink-400 flex gap-1.5 items-start">
                    <span className="shrink-0" aria-hidden="true">📊</span>
                    <span><b className="text-ink-700 dark:text-ink-300">Mercado:</b> {pond}</span>
                  </div>
                );
              })()}
              {/* RISCO PRINCIPAL: o maior risco real desta operação */}
              {(() => {
                const risco = (entrada as any)[principal]?.risco_principal;
                if (!risco || typeof risco !== 'string') return null;
                return (
                  <div className="mt-1 text-[11px] leading-snug text-red-700 dark:text-red-400 flex gap-1.5 items-start">
                    <span className="shrink-0" aria-hidden="true">⚠</span>
                    <span><b>Risco:</b> {risco}</span>
                  </div>
                );
              })()}
              {/* ALERTA DE ODD: histórico do time na faixa de odd de hoje
                  (ex: "Náutico costuma tropeçar como favorito: 1V 1E 3D").
                  Vem do Gemini (H2H com odds) ou do fallback do main.py. */}
              {(() => {
                const ao: any = (entrada as any).alerta_odds;
                if (!ao || typeof ao !== 'object' || !ao.texto) return null;
                const tipo = ao.tipo === 'alerta' || ao.tipo === 'positivo' ? ao.tipo : 'neutro';
                // AVISO REFORÇADO: Back Favorito + histórico de TROPEÇO na
                // faixa de odd = o pior cenário do método. Banner vermelho
                // forte, não o âmbar genérico.
                const tropecoNoBack = principal === 'back_favorito' && tipo === 'alerta';
                if (tropecoNoBack) {
                  return (
                    <div className="mt-1.5 px-2.5 py-2 rounded-md text-[11px] font-semibold bg-red-600 text-white flex gap-1.5 items-start shadow-sm">
                      <span aria-hidden="true">🚨</span>
                      <span>
                        <span className="uppercase tracking-wider block mb-0.5">
                          Favorito tropeça nesta faixa de odd
                        </span>
                        {ao.texto} — reduza a stake ou aguarde confirmação ao vivo.
                      </span>
                    </div>
                  );
                }
                const estilos: Record<string, string> = {
                  alerta: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
                  positivo: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
                  neutro: 'bg-ink-50 dark:bg-ink-900 text-ink-600 dark:text-ink-400 border-ink-200 dark:border-ink-700',
                };
                const icone = tipo === 'alerta' ? '⚠' : tipo === 'positivo' ? '✓' : 'ℹ';
                return (
                  <div className={`mt-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium border flex gap-1.5 items-start ${estilos[tipo]}`}>
                    <span aria-hidden="true" className="shrink-0">{icone}</span>
                    <span>
                      <span className="uppercase tracking-wider text-[9px] font-bold block opacity-70">
                        Histórico na odd
                      </span>
                      {ao.texto}
                    </span>
                  </div>
                );
              })()}
              {/* Melhoria #10: histórico de odds (abriu X → agora Y) */}
              <HistoricoOdds entrada={entrada} />
              {/* JOGADORES DECISIVOS + AUSÊNCIAS: quem faz diferença em campo
                  e quem desfalca (impacto nos métodos) */}
              {(() => {
                const jog: any = (entrada as any).jogadores;
                if (!jog) return null;
                const nomeSo = (s: any) =>
                  typeof s === 'string' ? s.split('—')[0].split(' - ')[0].trim() : '';
                const dCasa: string[] = Array.isArray(jog.destaques_casa)
                  ? jog.destaques_casa.map(nomeSo).filter(Boolean) : [];
                const dFora: string[] = Array.isArray(jog.destaques_fora)
                  ? jog.destaques_fora.map(nomeSo).filter(Boolean) : [];
                const partes = (entrada.jogo || '').split(/\s+x\s+/i);
                const temDecisivos = dCasa.length > 0 || dFora.length > 0;
                const ausencias: any[] = Array.isArray(jog.ausencias_impacto)
                  ? jog.ausencias_impacto : [];
                if (!temDecisivos && ausencias.length === 0) return null;
                return (
                  <div className="mt-1.5 space-y-1">
                    {temDecisivos && (
                      <div className="px-2.5 py-1.5 rounded text-[11px] bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-900">
                        <span className="text-[9px] uppercase tracking-wider font-bold block opacity-70">
                          ⭐ Jogadores decisivos
                        </span>
                        {dCasa.length > 0 && (
                          <span>
                            <b>{partes[0] || 'Casa'}:</b> {dCasa.slice(0, 4).join(', ')}
                          </span>
                        )}
                        {dCasa.length > 0 && dFora.length > 0 && <span className="mx-1 opacity-50">·</span>}
                        {dFora.length > 0 && (
                          <span>
                            <b>{partes[1] || 'Fora'}:</b> {dFora.slice(0, 4).join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                    {ausencias.map((a: any, i: number) => {
                      if (!a || !a.jogador || !a.impacto) return null;
                      const statusIcon = a.status === 'ausente' || a.status === 'suspenso'
                        ? '🚫' : a.status === 'lesionado' ? '🏥' : '❓';
                      const statusLabel = a.status === 'ausente' ? 'Ausente'
                        : a.status === 'suspenso' ? 'Suspenso'
                        : a.status === 'lesionado' ? 'Lesionado' : 'Dúvida';
                      return (
                        <div
                          key={i}
                          className="px-2.5 py-1.5 rounded text-[11px] font-medium bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800 flex gap-1.5 items-start"
                        >
                          <span aria-hidden="true" className="shrink-0">{statusIcon}</span>
                          <span>
                            <span className="font-bold">{a.jogador}</span>
                            <span className="text-[9px] uppercase tracking-wider ml-1 opacity-70">
                              ({a.time} · {statusLabel})
                            </span>
                            <span className="block mt-0.5">{a.impacto}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {razaoP && (
                <div className="text-[11px] leading-relaxed text-ink-700 dark:text-ink-300">
                  {razaoP}
                </div>
              )}
              {entrada.probabilidade_estimada && (
                <div className="text-[10px] text-ink-500 mt-1.5">
                  Prob. estimada {entrada.probabilidade_estimada}
                  {entrada.fair_odd && ` · fair ${entrada.fair_odd}`}
                </div>
              )}
              {(() => {
                const mc = parseMediaGols(entrada.media_gols_casa);
                const mf = parseMediaGols(entrada.media_gols_fora);
                if (mc === null || mf === null) return null;
                const top4 = calcularPlacaresMaisProvaveis(mc, mf, 4);
                if (top4.length === 0) return null;

                // 🚫 MELHORIA #1 — BLOQUEIO (não mais só alerta):
                // Se o método principal é Lay X-Y e esse placar aparece nos
                // top 4 prováveis com prob > 12%, a entrada é BLOQUEADA.
                // (A trava do main.py e do worker já impedem publicar; isto
                // aqui é a 3ª camada, pra relatórios antigos já no ar.)
                const LIMIAR_BLOQUEIO = 12;
                let bloqueio: string | null = null;
                let alertaInconsistencia: string | null = null;
                if (principal === 'lay_1x0') {
                  const p10 = top4.find(p => p.gols_casa === 1 && p.gols_fora === 0);
                  if (p10 && p10.prob_pct > LIMIAR_BLOQUEIO) {
                    bloqueio = `1×0 está entre os placares mais prováveis (${p10.prob_pct}%). Lay 1×0 contradiz a análise — NÃO OPERAR esta entrada.`;
                  } else if (p10) {
                    alertaInconsistencia = `Atenção: 1×0 aparece entre os placares mais prováveis (${p10.prob_pct}%). Revise antes de operar.`;
                  }
                } else if (principal === 'lay_0x1') {
                  const p01 = top4.find(p => p.gols_casa === 0 && p.gols_fora === 1);
                  if (p01 && p01.prob_pct > LIMIAR_BLOQUEIO) {
                    bloqueio = `0×1 está entre os placares mais prováveis (${p01.prob_pct}%). Lay 0×1 contradiz a análise — NÃO OPERAR esta entrada.`;
                  } else if (p01) {
                    alertaInconsistencia = `Atenção: 0×1 aparece entre os placares mais prováveis (${p01.prob_pct}%). Revise antes de operar.`;
                  }
                }

                return (
                  <>
                    <PlacaresProvaveis placares={top4} />
                    {bloqueio && (
                      <div className="mt-2 px-2.5 py-2 rounded-md text-[11px] font-semibold bg-red-600 text-white flex gap-1.5 items-start shadow-sm">
                        <span aria-hidden="true">🚫</span>
                        <span>
                          <span className="uppercase tracking-wider block mb-0.5">Entrada bloqueada</span>
                          {bloqueio}
                        </span>
                      </div>
                    )}
                    {!bloqueio && alertaInconsistencia && (
                      <div className="mt-2 px-2.5 py-1.5 rounded text-[11px] font-medium bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 flex gap-1.5 items-start">
                        <span aria-hidden="true">⚠</span>
                        <span>{alertaInconsistencia}</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* SECUNDÁRIOS — até 2, mais discretos */}
            {secundarios.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold flex items-center gap-1">
                  <span>Secundário{secundarios.length > 1 ? 's' : ''}</span>
                  <span className="text-ink-400">· {secundarios.length}</span>
                </div>
                {secundarios.map((m) => {
                  const info = METODOS_INFO[m];
                  const razao = razaoDoMetodo(entrada, m);
                  const conf = confiancaDoMetodo(entrada, m);
                  return (
                    <div key={m} className="rounded-md border border-ink-200 dark:border-ink-800 bg-white/40 dark:bg-ink-900/30 px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${info?.cor_text || 'text-ink-700'}`}>
                          {info?.icone}
                          {info?.label || m}
                          {conf !== null && (
                            <span className="ml-1 opacity-75">· {conf}%</span>
                          )}
                        </span>
                      </div>
                      {razao && (
                        <div className="text-[11px] leading-snug text-ink-600 dark:text-ink-400">
                          {razao}
                        </div>
                      )}
                      {/* Melhoria #2: odd/stake/saída também nos secundários */}
                      <LinhaPlanoMetodo entrada={entrada} metodo={m} compacto />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}

      {entrada.explicacao_curta && (
        <div className="text-xs leading-relaxed text-ink-700 dark:text-ink-300 bg-ink-50 dark:bg-ink-900/40 rounded-md px-3 py-2 border border-ink-200/60 dark:border-ink-800">
          {entrada.explicacao_curta}
        </div>
      )}

      {entrada.alerta_geral && (entrada.metodos_aplicados || []).includes('over_limite_70') && (
        <div className="flex gap-1.5 items-start text-[11px] leading-snug text-amber-700 dark:text-amber-400">
          <span aria-hidden="true">⚠</span>
          <span>{entrada.alerta_geral}</span>
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-ink-100 dark:border-ink-800 space-y-2" data-no-export="true">
        {/* LINK DE ESTATÍSTICAS: página da partida na fonte (clube), com as
            abas completas de Jogadores, Cartões e Escanteios. Fallback:
            busca no SofaScore quando o relatório não tem a URL. */}
        {(() => {
          const urlFonte = (entrada as any)._url_fonte;
          const urlSofa = `https://www.sofascore.com/search?q=${encodeURIComponent(entrada.jogo || '')}`;
          return (
            <a
              href={urlFonte || urlSofa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline"
            >
              📊 Estatísticas completas
              <span className="text-ink-400 font-normal">jogadores · cartões · escanteios</span>
              <span aria-hidden="true">↗</span>
            </a>
          );
        })()}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <BotoesApostaMini jogo={entrada.jogo} />
          </div>
          {/* Melhoria #9: copiar entrada formatada pro Telegram */}
          <BotaoCopiarTelegram
            entrada={entrada}
            metodoPrincipal={
              metodosRankeados(entrada).filter(m => m !== 'confirmacao_visual')[0] || null
            }
          />
        </div>
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
