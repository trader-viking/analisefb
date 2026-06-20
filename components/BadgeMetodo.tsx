import { Zap, Eye, ChevronsUp, ChevronsDown, Equal, Crown, Clock, Radio, Waves } from 'lucide-react';
import type { Entrada } from '@/lib/relatorios';

// ... (mantém o código atual de METODOS_INFO etc)

type Metodo = {
  key: keyof Entrada | 'confirmacao_visual';
  label: string;
  icone: React.ReactNode;
  cor_bg: string;
  cor_text: string;
  cor_ring: string;
};

export const METODOS_INFO: Record<string, Metodo> = {
  back_favorito: {
    key: 'back_favorito',
    label: 'Back Favorito',
    icone: <ChevronsUp size={11} />,
    cor_bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    cor_text: 'text-emerald-700 dark:text-emerald-300',
    cor_ring: 'ring-emerald-300 dark:ring-emerald-800',
  },
  lay_zebra: {
    key: 'lay_zebra',
    label: 'Lay Zebra',
    icone: <ChevronsDown size={11} />,
    cor_bg: 'bg-red-50 dark:bg-red-950/40',
    cor_text: 'text-red-700 dark:text-red-300',
    cor_ring: 'ring-red-300 dark:ring-red-800',
  },
  over_limite_70: {
    key: 'over_limite_70',
    label: 'Over Limite (+1 gol)',
    icone: <Zap size={11} />,
    cor_bg: 'bg-purple-50 dark:bg-purple-950/40',
    cor_text: 'text-purple-700 dark:text-purple-300',
    cor_ring: 'ring-purple-300 dark:ring-purple-800',
  },
  back_2x2: {
    key: 'back_2x2',
    label: 'Back 2x2',
    icone: <Equal size={11} />,
    cor_bg: 'bg-orange-50 dark:bg-orange-950/40',
    cor_text: 'text-orange-700 dark:text-orange-300',
    cor_ring: 'ring-orange-300 dark:ring-orange-800',
  },
  back_goleada: {
    key: 'back_goleada',
    label: 'Back Goleada',
    icone: <Crown size={11} />,
    cor_bg: 'bg-yellow-50 dark:bg-yellow-950/40',
    cor_text: 'text-yellow-700 dark:text-yellow-300',
    cor_ring: 'ring-yellow-300 dark:ring-yellow-800',
  },
  lay_1x0: {
    key: 'lay_1x0',
    label: 'Lay 1×0',
    icone: <ChevronsDown size={11} />,
    cor_bg: 'bg-pink-50 dark:bg-pink-950/40',
    cor_text: 'text-pink-700 dark:text-pink-300',
    cor_ring: 'ring-pink-300 dark:ring-pink-800',
  },
  lay_0x1: {
    key: 'lay_0x1',
    label: 'Lay 0×1',
    icone: <ChevronsDown size={11} />,
    cor_bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',
    cor_text: 'text-fuchsia-700 dark:text-fuchsia-300',
    cor_ring: 'ring-fuchsia-300 dark:ring-fuchsia-800',
  },
  over_golos: {
    key: 'over_golos',
    label: 'Over Gols',
    icone: <Waves size={11} />,
    cor_bg: 'bg-teal-50 dark:bg-teal-950/40',
    cor_text: 'text-teal-700 dark:text-teal-300',
    cor_ring: 'ring-teal-300 dark:ring-teal-800',
  },
  mercado_gols: {
    key: 'mercado_gols',
    label: 'Mercado de Gols',
    icone: <Waves size={11} />,
    cor_bg: 'bg-teal-50 dark:bg-teal-950/40',
    cor_text: 'text-teal-700 dark:text-teal-300',
    cor_ring: 'ring-teal-300 dark:ring-teal-800',
  },
  confirmacao_visual: {
    key: 'confirmacao_visual',
    label: 'Confirmação Visual',
    icone: <Eye size={11} />,
    cor_bg: 'bg-sky-50 dark:bg-sky-950/40',
    cor_text: 'text-sky-700 dark:text-sky-300',
    cor_ring: 'ring-sky-300 dark:ring-sky-800',
  },
};

export function metodosAtivos(entrada: Entrada): string[] {
  const result: string[] = [];
  const checks: Array<[string, any]> = [
    ['back_favorito', entrada.back_favorito],
    ['lay_zebra', entrada.lay_zebra],
    ['over_limite_70', entrada.over_limite_70],
    ['back_2x2', entrada.back_2x2],
    ['back_goleada', entrada.back_goleada],
    ['lay_1x0', (entrada as any).lay_1x0],
    ['lay_0x1', (entrada as any).lay_0x1],
    ['confirmacao_visual', entrada.confirmacao_visual],
  ];
  for (const [key, val] of checks) {
    if (val && (val.aplicavel === true || val.elegivel === true)) {
      result.push(key);
    }
  }
  // Fallback: usa metodos_aplicados se vier
  if (result.length === 0 && Array.isArray(entrada.metodos_aplicados)) {
    return entrada.metodos_aplicados.filter((m) => METODOS_INFO[m]);
  }
  return result;
}

// Retorna o "modo" de um método específico (pre_jogo / ao_vivo) ou null
export function modoDoMetodo(entrada: Entrada, metodo: string): string | null {
  const map: Record<string, any> = {
    back_favorito: entrada.back_favorito,
    lay_zebra: entrada.lay_zebra,
    over_limite_70: entrada.over_limite_70,
    back_2x2: entrada.back_2x2,
    back_goleada: entrada.back_goleada,
    over_golos: entrada.over_golos,
    mercado_gols: entrada.mercado_gols,
  };
  // Confirmação Visual é sempre ao vivo (não mostra tag)
  if (metodo === 'confirmacao_visual') return null;
  // Over Limite 70+ é sempre tratado como ao vivo (regra do usuário)
  if (metodo === 'over_limite_70') return 'ao_vivo';
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
}: {
  metodo: string;
  modo?: string | null;
  size?: 'sm' | 'md';
}) {
  const info = METODOS_INFO[metodo];
  if (!info) return null;
  const cls =
    size === 'md'
      ? 'px-2.5 py-1 text-xs'
      : 'px-2 py-1 text-[11px]';
  return (
    <div className="inline-flex items-center gap-1">
      <div
        className={`inline-flex items-center gap-1 font-medium rounded ${cls} ${info.cor_bg} ${info.cor_text}`}
      >
        {info.icone}
        {info.label}
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
// Helpers de MODO (pré-jogo / ao vivo) por entrada

// =====================================================================
// Ranking de métodos por confiança (stake recomendada como proxy)
// =====================================================================

// Extrai número de uma string de stake (ex: "2%" -> 2, "1.5u" -> 1.5)
function parseStake(valor: unknown): number {
  if (typeof valor === 'number') return valor;
  if (typeof valor !== 'string') return 0;
  const m = valor.match(/(\d+([.,]\d+)?)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(',', '.'));
}

// Ordem da regra de desempate (maior número = maior prioridade)
// Back Favorito > Over Limite > Back 2x2 > Lay Zebra > Lay 1×0 > Lay 0×1 > Back Goleada
const ORDEM_FIXA: Record<string, number> = {
  back_favorito: 8,
  over_limite_70: 7,
  back_2x2: 6,
  lay_zebra: 5,
  lay_1x0: 4,
  lay_0x1: 3,
  back_goleada: 2,
  confirmacao_visual: 1,
};

// Retorna a razão (motivo) escrita pelo Gemini pra um método específico
export function razaoDoMetodo(entrada: Entrada, metodo: string): string {
  const obj: any = (entrada as any)[metodo];
  if (!obj) return '';
  // Tenta os campos mais comuns onde o Gemini coloca a justificativa
  return obj.razao || obj.justificativa || obj.motivo || obj.descricao || '';
}

// Calcula a % de confiança de cada método a partir da odd implícita do JSON
// - BACK methods (vence se evento acontecer): confiança = 100 / odd
// - LAY methods (vence se evento NÃO acontecer): confiança = 100 - 100/odd
// Retorna número de 0-100, ou null se não conseguir calcular
export function confiancaDoMetodo(entrada: Entrada, metodo: string): number | null {
  const obj: any = (entrada as any)[metodo];
  if (!obj) return null;

  // Campos onde a odd costuma aparecer em cada método
  const camposOdd: Record<string, string[]> = {
    back_favorito: ['odd_minima_entrada', 'odd_esperada', 'odd_alvo'],
    over_limite_70: ['odd_esperada', 'odd_minima_entrada', 'odd_alvo'],
    back_2x2: ['odd_esperada', 'odd_minima_entrada', 'odd_alvo'],
    back_goleada: ['odd_esperada', 'odd_minima_entrada', 'odd_alvo'],
    lay_zebra: ['odd_zebra_alvo', 'odd_alvo', 'odd_esperada'],
    lay_1x0: ['odd_alvo', 'odd_esperada'],
    lay_0x1: ['odd_alvo', 'odd_esperada'],
    confirmacao_visual: [],
  };

  const campos = camposOdd[metodo] || [];
  let odd: number | null = null;
  for (const campo of campos) {
    const valor = obj[campo];
    if (valor == null) continue;
    // Aceita string "1.50" ou número 1.50, ou range "3.50 a 7.00" (pega o primeiro)
    const match = String(valor).match(/(\d+([.,]\d+)?)/);
    if (match) {
      const parsed = parseFloat(match[1].replace(',', '.'));
      if (parsed > 1) { odd = parsed; break; }
    }
  }

  // Fallback: usa probabilidade_estimada da entrada (só pro método principal)
  if (odd == null && entrada.probabilidade_estimada) {
    const m = String(entrada.probabilidade_estimada).match(/(\d+([.,]\d+)?)/);
    if (m) return Math.round(parseFloat(m[1].replace(',', '.')));
  }

  if (odd == null) return null;

  // Métodos LAY ganham se evento NÃO acontecer → confiança alta com odd alta
  const ehLay = metodo === 'lay_zebra' || metodo === 'lay_1x0' || metodo === 'lay_0x1';
  const conf = ehLay ? (100 - 100 / odd) : (100 / odd);
  return Math.max(0, Math.min(100, Math.round(conf)));
}

// Retorna os métodos ativos de uma entrada, ordenados pela regra de desempate.
// O primeiro é o "principal" (vai ter destaque no card).
export function metodosRankeados(entrada: Entrada): string[] {
  const ativos = metodosAtivos(entrada);
  // Confirmação Visual nunca é principal — fica sempre por último
  return ativos
    .map((key) => ({ key, ordem: ORDEM_FIXA[key] || 0 }))
    .sort((a, b) => b.ordem - a.ordem)
    .map((x) => x.key);
}
