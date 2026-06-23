// Cálculos de desempenho/performance a partir dos relatórios auditados.
// Premissas (v7.1.13):
// - ODD usada: odd_estimada do método principal (do bloco metodos). Fallback: odd_minima_entrada.
// - STAKE: % recomendada pelo método (M1=1.5%, M2=2%, M3=1%, M5/M6/M7/M8=2%, M9=2%, M15=1.5%).
// - VEREDITO: _veredito = "green" | "red" | "void" | null.

import type { Relatorio, Entrada } from './relatorios';
import { METODOS_V7_KEYS } from './relatorios';

export const STAKE_DEFAULT: Record<string, number> = {
  // v7.1.13 (do documento operacional)
  M1: 1.5,    // Back Favorito
  M2: 2,      // Back 2x2 HV
  M3: 1,      // Back Goleada HV
  M5: 2,      // Lay 1x0
  M6: 2,      // Lay 0x1
  M7: 2,      // Lay 2x0
  M8: 2,      // Lay 0x2
  M9: 2,      // Lay Zebra
  M15: 1.5,   // Over Limite HV
  // Legado
  back_favorito: 2,
  lay_zebra: 2,
  over_limite_70: 1,
  back_2x2: 0.5,
  back_goleada: 1,
};

export type AnyEntrada = Entrada & {
  _veredito?: 'green' | 'red' | 'void' | string;
  _vereditos?: Record<string, { resultado?: string }>;
  _placar?: string;
  _status?: string;
};

// Pega a primeira odd útil (do método principal v7.1.13 > odd_minima_entrada legada).
export function oddDe(e: AnyEntrada): number | null {
  // v7.1.13: pega odd do método principal
  if (e.metodos && e.principal) {
    const obj: any = (e.metodos as any)[e.principal];
    if (obj && obj.odd_estimada) {
      const m = String(obj.odd_estimada).replace(',', '.').match(/(\d+(?:\.\d+)?)/);
      if (m) {
        const n = parseFloat(m[1]);
        if (n > 1) return n;
      }
    }
  }
  // Legado
  const cand = (e as any).odd_minima_entrada || (e as any).odd_principal || '';
  const m = String(cand).replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return n > 1 ? n : null;
}

// Pega a stake recomendada do método principal (em %).
export function stakeDe(e: AnyEntrada, metodoPrincipal: string): number {
  // v7.1.13: tenta ler de entrada.metodos[M*].stake_recomendada
  if (e.metodos && metodoPrincipal in (e.metodos as any)) {
    const obj: any = (e.metodos as any)[metodoPrincipal];
    if (obj && typeof obj.stake_recomendada === 'string') {
      const m = obj.stake_recomendada.match(/(\d+(?:[.,]\d+)?)/);
      if (m) {
        const n = parseFloat(m[1].replace(',', '.'));
        if (n > 0 && n <= 10) return n;
      }
    }
  }
  // Legado: e.back_favorito.stake_recomendada
  const obj = (e as any)[metodoPrincipal];
  if (obj && typeof obj.stake_recomendada === 'string') {
    const m = obj.stake_recomendada.match(/(\d+(?:[.,]\d+)?)/);
    if (m) {
      const n = parseFloat(m[1].replace(',', '.'));
      if (n > 0 && n <= 10) return n;
    }
  }
  return STAKE_DEFAULT[metodoPrincipal] ?? 1;
}

// Ordem de prioridade pra escolher método principal quando há vários
// HV primeiro (M2, M3, M15), depois 1X2 (M1, M9), depois Lays placar (M5-M8)
const ORDEM_DESEMPATE_NOVA = ['M2', 'M15', 'M3', 'M1', 'M9', 'M5', 'M6', 'M7', 'M8'];
const ORDEM_DESEMPATE_LEGADO = [
  'back_favorito', 'over_limite_70', 'back_2x2', 'lay_zebra', 'back_goleada',
];

export function metodoPrincipal(e: AnyEntrada): string | null {
  // v7.1.13: prioriza campo "principal" se existir
  if (e.principal && typeof e.principal === 'string') {
    return e.principal;
  }
  // v7.1.13: procura método com veredito CONFIRMADA
  if (e.metodos) {
    for (const k of ORDEM_DESEMPATE_NOVA) {
      const obj: any = (e.metodos as any)[k];
      if (obj && obj.veredito === 'CONFIRMADA') return k;
    }
  }
  // Legado
  const ativos = ((e as any).metodos_aplicados || []).filter(Boolean);
  for (const m of ORDEM_DESEMPATE_LEGADO) {
    if (ativos.includes(m)) return m;
  }
  return ativos[0] || null;
}

// Veredito normalizado da entrada (do método principal).
export function vereditoDe(e: AnyEntrada): 'green' | 'red' | 'void' | null {
  const v = (e._veredito || '').toLowerCase();
  if (v === 'green' || v === 'red' || v === 'void') return v as any;
  // Tenta inferir do dicionário de vereditos por método
  const mp = metodoPrincipal(e);
  if (mp && e._vereditos && e._vereditos[mp]?.resultado) {
    const r = String(e._vereditos[mp].resultado).toLowerCase();
    if (r === 'green' || r === 'red' || r === 'void') return r as any;
  }
  return null;
}

export type EntradaCalc = {
  entrada: AnyEntrada;
  data: string;
  metodo: string;
  liga: string;
  odd: number | null;
  stake_pct: number;
  veredito: 'green' | 'red' | 'void' | null;
  lucro_unidades: number; // lucro/prejuízo em unidades % (positivo = green, negativo = red)
};

// Calcula o lucro em "unidades %" (ex: stake 2% e odd 1.80 → green = +1.6%, red = -2%).
export function lucroDe(odd: number | null, stake_pct: number, veredito: string | null): number {
  if (!veredito || !odd) return 0;
  if (veredito === 'void') return 0;
  if (veredito === 'green') return stake_pct * (odd - 1);
  if (veredito === 'red') return -stake_pct;
  return 0;
}

// Extrai todas as entradas auditáveis de uma lista de relatórios.
export function entradasCalculaveis(relatorios: Relatorio[]): EntradaCalc[] {
  const out: EntradaCalc[] = [];
  for (const r of relatorios) {
    const data = (r as any).data || r.slug;
    for (const e of (r.entradas || []) as AnyEntrada[]) {
      const mp = metodoPrincipal(e);
      const v = vereditoDe(e);
      if (!mp || !v) continue; // só conta entradas com método e veredito
      const odd = oddDe(e);
      const stake = stakeDe(e, mp);
      out.push({
        entrada: e,
        data,
        metodo: mp,
        liga: e.liga || 'sem liga',
        odd,
        stake_pct: stake,
        veredito: v,
        lucro_unidades: lucroDe(odd, stake, v),
      });
    }
  }
  // ordena por data crescente (pra cálculo de evolução / streaks)
  out.sort((a, b) => a.data.localeCompare(b.data));
  return out;
}

// Agrega por método.
export function agregarPorMetodo(items: EntradaCalc[]) {
  const map: Record<string, { metodo: string; total: number; greens: number; reds: number; voids: number; lucro: number; stake_total: number }> = {};
  for (const it of items) {
    if (!map[it.metodo]) map[it.metodo] = { metodo: it.metodo, total: 0, greens: 0, reds: 0, voids: 0, lucro: 0, stake_total: 0 };
    const m = map[it.metodo];
    m.total++;
    if (it.veredito === 'green') m.greens++;
    if (it.veredito === 'red') m.reds++;
    if (it.veredito === 'void') m.voids++;
    m.lucro += it.lucro_unidades;
    m.stake_total += it.stake_pct;
  }
  return Object.values(map).map(m => ({
    ...m,
    acerto: m.greens + m.reds > 0 ? (m.greens / (m.greens + m.reds)) * 100 : 0,
    roi: m.stake_total > 0 ? (m.lucro / m.stake_total) * 100 : 0,
  })).sort((a, b) => b.lucro - a.lucro);
}

// Agrega por liga.
export function agregarPorLiga(items: EntradaCalc[]) {
  const map: Record<string, { liga: string; total: number; greens: number; reds: number; lucro: number; stake_total: number }> = {};
  for (const it of items) {
    if (it.veredito === 'void') continue;
    if (!map[it.liga]) map[it.liga] = { liga: it.liga, total: 0, greens: 0, reds: 0, lucro: 0, stake_total: 0 };
    const m = map[it.liga];
    m.total++;
    if (it.veredito === 'green') m.greens++;
    if (it.veredito === 'red') m.reds++;
    m.lucro += it.lucro_unidades;
    m.stake_total += it.stake_pct;
  }
  return Object.values(map).map(m => ({
    ...m,
    acerto: m.total > 0 ? (m.greens / m.total) * 100 : 0,
    roi: m.stake_total > 0 ? (m.lucro / m.stake_total) * 100 : 0,
  })).sort((a, b) => b.lucro - a.lucro);
}

// Evolução do bankroll teórico (em %).
export function evolucaoBankroll(items: EntradaCalc[]): { data: string; bankroll: number; lucro_dia: number; jogos_dia: number }[] {
  const porData: Record<string, { lucro: number; jogos: number }> = {};
  for (const it of items) {
    if (!porData[it.data]) porData[it.data] = { lucro: 0, jogos: 0 };
    porData[it.data].lucro += it.lucro_unidades;
    porData[it.data].jogos++;
  }
  const datas = Object.keys(porData).sort();
  let acc = 0;
  return datas.map(d => {
    acc += porData[d].lucro;
    return { data: d, bankroll: acc, lucro_dia: porData[d].lucro, jogos_dia: porData[d].jogos };
  });
}

// Sequências (streaks) green/red consecutivas.
export function calcularStreaks(items: EntradaCalc[]): { maiorGreen: number; maiorRed: number; atual: { tipo: string; n: number } } {
  let maiorGreen = 0, maiorRed = 0;
  let atualTipo = '', atualN = 0;
  for (const it of items) {
    if (it.veredito === 'void') continue;
    if (it.veredito === atualTipo) {
      atualN++;
    } else {
      atualTipo = it.veredito as string;
      atualN = 1;
    }
    if (atualTipo === 'green' && atualN > maiorGreen) maiorGreen = atualN;
    if (atualTipo === 'red' && atualN > maiorRed) maiorRed = atualN;
  }
  return { maiorGreen, maiorRed, atual: { tipo: atualTipo, n: atualN } };
}

// Drawdown máximo do bankroll (em %).
export function calcularDrawdown(evolucao: { bankroll: number }[]): number {
  let pico = 0, ddMax = 0;
  for (const e of evolucao) {
    if (e.bankroll > pico) pico = e.bankroll;
    const dd = pico - e.bankroll;
    if (dd > ddMax) ddMax = dd;
  }
  return ddMax;
}

// Filtra entradas por janela de dias (n dias atrás até hoje).
export function filtrarUltimosDias(items: EntradaCalc[], dias: number): EntradaCalc[] {
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);
  const limiteStr = limite.toISOString().slice(0, 10);
  return items.filter(it => it.data >= limiteStr);
}
