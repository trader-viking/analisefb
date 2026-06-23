import {
  Zap, Eye, ChevronsUp, ChevronsDown, Equal, Crown, Star, Trophy,
} from 'lucide-react';
import type { Entrada } from '@/lib/relatorios';
import { METODO_LABELS, METODO_HV, METODOS_V7_KEYS } from '@/lib/metodos';

type Metodo = {
  key: string;
  label: string;
  icone: React.ReactNode;
  cor_bg: string;
  cor_text: string;
  cor_ring: string;
};

// =====================================================================
// METODOS_INFO v7.1.13 — 9 métodos novos (M1, M2, M3, M5, M6, M7, M8, M9, M15)
// =====================================================================
export const METODOS_INFO: Record<string, Metodo> = {
  M1: {
    key: 'M1',
    label: 'Back Favorito',
    icone: <ChevronsUp size={11} />,
    cor_bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    cor_text: 'text-emerald-700 dark:text-emerald-300',
    cor_ring: 'ring-emerald-300 dark:ring-emerald-800',
  },
  M2: {
    key: 'M2',
    label: 'Back 2×2 ⭐',
    icone: <Equal size={11} />,
    cor_bg: 'bg-orange-50 dark:bg-orange-950/40',
    cor_text: 'text-orange-700 dark:text-orange-300',
    cor_ring: 'ring-orange-300 dark:ring-orange-800',
  },
  M3: {
    key: 'M3',
    label: 'Back Goleada ⭐',
    icone: <Crown size={11} />,
    cor_bg: 'bg-amber-50 dark:bg-amber-950/40',
    cor_text: 'text-amber-700 dark:text-amber-300',
    cor_ring: 'ring-amber-300 dark:ring-amber-800',
  },
  M5: {
    key: 'M5',
    label: 'Lay 1×0',
    icone: <ChevronsDown size={11} />,
    cor_bg: 'bg-pink-50 dark:bg-pink-950/40',
    cor_text: 'text-pink-700 dark:text-pink-300',
    cor_ring: 'ring-pink-300 dark:ring-pink-800',
  },
  M6: {
    key: 'M6',
    label: 'Lay 0×1',
    icone: <ChevronsDown size={11} />,
    cor_bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',
    cor_text: 'text-fuchsia-700 dark:text-fuchsia-300',
    cor_ring: 'ring-fuchsia-300 dark:ring-fuchsia-800',
  },
  M7: {
    key: 'M7',
    label: 'Lay 2×0',
    icone: <ChevronsDown size={11} />,
    cor_bg: 'bg-rose-50 dark:bg-rose-950/40',
    cor_text: 'text-rose-700 dark:text-rose-300',
    cor_ring: 'ring-rose-300 dark:ring-rose-800',
  },
  M8: {
    key: 'M8',
    label: 'Lay 0×2',
    icone: <ChevronsDown size={11} />,
    cor_bg: 'bg-pink-100 dark:bg-pink-900/40',
    cor_text: 'text-pink-900 dark:text-pink-200',
    cor_ring: 'ring-pink-400 dark:ring-pink-700',
  },
  M9: {
    key: 'M9',
    label: 'Lay Zebra',
    icone: <ChevronsDown size={11} />,
    cor_bg: 'bg-red-50 dark:bg-red-950/40',
    cor_text: 'text-red-700 dark:text-red-300',
    cor_ring: 'ring-red-300 dark:ring-red-800',
  },
  M15: {
    key: 'M15',
    label: 'Over Limite +1 ⭐',
    icone: <Zap size={11} />,
    cor_bg: 'bg-purple-50 dark:bg-purple-950/40',
    cor_text: 'text-purple-700 dark:text-purple-300',
    cor_ring: 'ring-purple-300 dark:ring-purple-800',
  },

  // ----- Retrocompat com relatórios antigos -----
  back_favorito: {
    key: 'back_favorito', label: 'Back Favorito',
    icone: <ChevronsUp size={11} />,
    cor_bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    cor_text: 'text-emerald-700 dark:text-emerald-300',
    cor_ring: 'ring-emerald-300 dark:ring-emerald-800',
  },
  lay_zebra: {
    key: 'lay_zebra', label: 'Lay Zebra',
    icone: <ChevronsDown size={11} />,
    cor_bg: 'bg-red-50 dark:bg-red-950/40',
    cor_text: 'text-red-700 dark:text-red-300',
    cor_ring: 'ring-red-300 dark:ring-red-800',
  },
  over_limite_70: {
    key: 'over_limite_70', label: 'Over Limite (+1 gol)',
    icone: <Zap size={11} />,
    cor_bg: 'bg-purple-50 dark:bg-purple-950/40',
    cor_text: 'text-purple-700 dark:text-purple-300',
    cor_ring: 'ring-purple-300 dark:ring-purple-800',
  },
  back_2x2: {
    key: 'back_2x2', label: 'Back 2x2',
    icone: <Equal size={11} />,
    cor_bg: 'bg-orange-50 dark:bg-orange-950/40',
    cor_text: 'text-orange-700 dark:text-orange-300',
    cor_ring: 'ring-orange-300 dark:ring-orange-800',
  },
  back_goleada: {
    key: 'back_goleada', label: 'Back Goleada',
    icone: <Crown size={11} />,
    cor_bg: 'bg-yellow-50 dark:bg-yellow-950/40',
    cor_text: 'text-yellow-700 dark:text-yellow-300',
    cor_ring: 'ring-yellow-300 dark:ring-yellow-800',
  },
  lay_1x0: {
    key: 'lay_1x0', label: 'Lay 1×0',
    icone: <ChevronsDown size={11} />,
    cor_bg: 'bg-pink-50 dark:bg-pink-950/40',
    cor_text: 'text-pink-700 dark:text-pink-300',
    cor_ring: 'ring-pink-300 dark:ring-pink-800',
  },
  lay_0x1: {
    key: 'lay_0x1', label: 'Lay 0×1',
    icone: <ChevronsDown size={11} />,
    cor_bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',
    cor_text: 'text-fuchsia-700 dark:text-fuchsia-300',
    cor_ring: 'ring-fuchsia-300 dark:ring-fuchsia-800',
  },
  confirmacao_visual: {
    key: 'confirmacao_visual', label: 'Confirmação Visual',
    icone: <Eye size={11} />,
    cor_bg: 'bg-sky-50 dark:bg-sky-950/40',
    cor_text: 'text-sky-700 dark:text-sky-300',
    cor_ring: 'ring-sky-300 dark:ring-sky-800',
  },
};

// =====================================================================
// metodosAtivos — retorna métodos com veredito CONFIRMADA (ou aplicavel:true no legado)
// =====================================================================
export function metodosAtivos(entrada: Entrada): string[] {
  const result: string[] = [];
  const setVistos = new Set<string>();

  // Estrutura nova v7.1.13: entrada.metodos = { M1: { veredito }, ... }
  if (entrada.metodos) {
    for (const k of METODOS_V7_KEYS) {
      const obj = entrada.metodos[k];
      if (obj && obj.veredito === 'CONFIRMADA') {
        result.push(k as string);
        setVistos.add(k as string);
      }
    }
  }

  // Estrutura antiga: chaves diretas em entrada com aplicavel:true
  const checks: Array<[string, any]> = [
    ['back_favorito', (entrada as any).back_favorito],
    ['lay_zebra', (entrada as any).lay_zebra],
    ['over_limite_70', (entrada as any).over_limite_70],
    ['back_2x2', (entrada as any).back_2x2],
    ['back_goleada', (entrada as any).back_goleada],
    ['lay_1x0', (entrada as any).lay_1x0],
    ['lay_0x1', (entrada as any).lay_0x1],
    ['confirmacao_visual', (entrada as any).confirmacao_visual],
  ];
  for (const [key, val] of checks) {
    if (val && (val.aplicavel === true || val.elegivel === true) && !setVistos.has(key)) {
      result.push(key);
      setVistos.add(key);
    }
  }

  // Reforço legado: metodos_aplicados[]
  if (Array.isArray((entrada as any).metodos_aplicados)) {
    for (const m of (entrada as any).metodos_aplicados) {
      if (METODOS_INFO[m] && !setVistos.has(m)) {
        result.push(m);
        setVistos.add(m);
      }
    }
  }
  return result;
}

// metodosPossiveis — retorna métodos com veredito POSSÍVEL (apenas v7.1.13)
export function metodosPossiveisLista(entrada: Entrada): string[] {
  if (!entrada.metodos) return [];
  const out: string[] = [];
  for (const k of METODOS_V7_KEYS) {
    const obj = entrada.metodos[k];
    if (obj && (obj.veredito === 'POSSÍVEL' || obj.veredito === 'POSSIVEL')) {
      out.push(k as string);
    }
  }
  return out;
}

// =====================================================================
// modoDoMetodo — pré-jogo / ao vivo (v7.1.13 só tem pré-jogo)
// =====================================================================
export function modoDoMetodo(entrada: Entrada, metodo: string): string | null {
  // Em v7.1.13 todos são pré-jogo (entrada antes da bola rolar)
  if (METODOS_INFO[metodo] && metodo.startsWith('M')) return 'pre_jogo';

  // Confirmação Visual é sempre ao vivo (não mostra tag)
  if (metodo === 'confirmacao_visual') return null;
  if (metodo === 'over_limite_70') return 'ao_vivo';

  const map: Record<string, any> = {
    back_favorito: (entrada as any).back_favorito,
    lay_zebra: (entrada as any).lay_zebra,
    back_2x2: (entrada as any).back_2x2,
    back_goleada: (entrada as any).back_goleada,
  };
  const obj = map[metodo];
  if (!obj) return null;
  const m = obj.modo;
  if (m === 'pre_jogo' || m === 'pre-jogo' || m === 'pré-jogo' || m === 'prejogo') return 'pre_jogo';
  if (m === 'ao_vivo' || m === 'ao-vivo' || m === 'aovivo' || m === 'live') return 'ao_vivo';
  return null;
}

export function BadgeMetodo({
  metodo,
  modo,
  size = 'sm',
  scoreOpcional,
}: {
  metodo: string;
  modo?: string | null;
  size?: 'sm' | 'md';
  scoreOpcional?: number | null;
}) {
  const info = METODOS_INFO[metodo];
  if (!info) return null;
  const cls = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-1 text-[11px]';
  const hv = METODO_HV[metodo];
  return (
    <div className="inline-flex items-center gap-1">
      <div
        className={`inline-flex items-center gap-1 font-medium rounded ${cls} ${info.cor_bg} ${info.cor_text}`}
        title={hv ? 'High Value (HV) — sem teto de odd' : undefined}
      >
        {info.icone}
        {info.label}
        {typeof scoreOpcional === 'number' && (
          <span className="ml-1 opacity-75 font-mono">· {scoreOpcional}</span>
        )}
      </div>
      {modo && <BadgeModo modo={modo} size={size} />}
    </div>
  );
}

export function BadgeModo({
  modo,
  size = 'sm',
}: {
  modo: string;
  size?: 'sm' | 'md';
}) {
  const cls = size === 'md' ? 'px-2 py-1 text-[10px]' : 'px-1.5 py-0.5 text-[9px]';
  if (modo === 'ao_vivo') {
    return (
      <div
        className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider rounded ${cls} bg-red-600 text-white animate-pulse`}
        title="Entrada ao vivo"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
        Ao vivo
      </div>
    );
  }
  return (
    <div
      className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider rounded ${cls} bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300`}
      title="Entrada pré-jogo"
    >
      Pré-jogo
    </div>
  );
}

// =====================================================================
// Helpers — razão, confiança (score), ordenação
// =====================================================================

// Retorna a razão (resumo/justificativa) do método
export function razaoDoMetodo(entrada: Entrada, metodo: string): string {
  // v7.1.13: pega criterios_atingidos como descrição
  if (metodo.startsWith('M') && entrada.metodos) {
    const obj: any = (entrada.metodos as any)[metodo];
    if (obj && Array.isArray(obj.criterios_atingidos) && obj.criterios_atingidos.length > 0) {
      return obj.criterios_atingidos.slice(0, 3).join(' · ');
    }
    if (obj && obj.resumo) return obj.resumo;
  }
  // Legado
  const obj: any = (entrada as any)[metodo];
  if (!obj) return '';
  return obj.razao || obj.justificativa || obj.motivo || obj.descricao || '';
}

// Retorna o SCORE numérico do método (v7.1.13) ou null se for legado
export function scoreDoMetodo(entrada: Entrada, metodo: string): number | null {
  if (metodo.startsWith('M') && entrada.metodos) {
    const obj: any = (entrada.metodos as any)[metodo];
    if (obj && typeof obj.score === 'number') return Math.round(obj.score);
  }
  return null;
}

// Confiança: usa SCORE direto se for v7.1.13; senão calcula via critérios_atendidos
export function confiancaDoMetodo(entrada: Entrada, metodo: string): number | null {
  const score = scoreDoMetodo(entrada, metodo);
  if (score !== null) return score;

  // Legado
  const obj: any = (entrada as any)[metodo];
  if (!obj) return null;
  const atendidos = obj.criterios_atendidos;
  const total = obj.criterios_total;
  if (!Array.isArray(atendidos) || typeof total !== 'number' || total <= 0) return null;
  const PLACEHOLDERS = new Set([
    'lista', 'de', 'strings', 'curtas', 'dos', 'criterios', 'que', 'esse', 'jogo', 'atende',
  ]);
  const reais = atendidos.filter((s) => {
    const norm = String(s).toLowerCase().trim();
    return norm.length > 0 && !PLACEHOLDERS.has(norm);
  });
  if (reais.length === 0) return null;
  const conf = (reais.length / total) * 100;
  return Math.max(0, Math.min(100, Math.round(conf)));
}

// Ordem de prioridade dos métodos quando há vários CONFIRMADOS
// HV (M2, M3, M15) primeiro; depois score
const ORDEM_FIXA_NOVA: Record<string, number> = {
  M2: 90, M15: 89, M3: 88,        // HVs primeiro
  M1: 80, M9: 75,                  // 1X2
  M5: 70, M6: 69, M7: 68, M8: 67,  // Lays placar
};
const ORDEM_FIXA_LEGADO: Record<string, number> = {
  back_favorito: 8, over_limite_70: 7, back_2x2: 6, lay_zebra: 5,
  lay_1x0: 4, lay_0x1: 3, back_goleada: 2, confirmacao_visual: 1,
};

// metodos ranqueados pra exibição (1º é o "principal")
export function metodosRankeados(entrada: Entrada): string[] {
  // Se entrada tem campo "principal" definido, ele vem primeiro
  const principal = entrada.principal as string | null | undefined;
  const ativos = metodosAtivos(entrada);
  if (ativos.length === 0) return [];

  ativos.sort((a, b) => {
    if (a === principal) return -1;
    if (b === principal) return 1;
    // Tenta score primeiro (v7.1.13)
    const sa = scoreDoMetodo(entrada, a);
    const sb = scoreDoMetodo(entrada, b);
    if (sa !== null && sb !== null && sa !== sb) return sb - sa;
    // Fallback: ordem fixa
    const oa = (ORDEM_FIXA_NOVA[a] || 0) + (ORDEM_FIXA_LEGADO[a] || 0);
    const ob = (ORDEM_FIXA_NOVA[b] || 0) + (ORDEM_FIXA_LEGADO[b] || 0);
    return ob - oa;
  });
  return ativos;
}
