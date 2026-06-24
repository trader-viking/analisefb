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
  const setVistos = new Set<string>();
  for (const [key, val] of checks) {
    if (val && (val.aplicavel === true || val.elegivel === true)) {
      result.push(key);
      setVistos.add(key);
    }
  }
  // Reforço: se o Gemini listou em metodos_aplicados mas esqueceu de marcar
  // aplicavel: true no objeto, ou marcou o objeto como null, ainda consideramos.
  if (Array.isArray(entrada.metodos_aplicados)) {
    for (const m of entrada.metodos_aplicados) {
      if (METODOS_INFO[m] && !setVistos.has(m)) {
        result.push(m);
        setVistos.add(m);
      }
    }
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

// Calcula a % de confiança da análise de DADOS pra um método:
// confianca = (critérios atendidos / critérios totais) × 100
// O Gemini reporta esses valores no JSON do método (criterios_atendidos[] e criterios_total).
// Fallback: se faltarem esses campos, retorna null (não mostra a %).
export function confiancaDoMetodo(entrada: Entrada, metodo: string): number | null {
  const obj: any = (entrada as any)[metodo];
  if (!obj) return null;

  const atendidos = obj.criterios_atendidos;
  const total = obj.criterios_total;

  // Aceita só se ambos vierem corretamente
  if (!Array.isArray(atendidos) || typeof total !== 'number' || total <= 0) {
    return null;
  }

  // Filtra entradas que parecem placeholders ("lista", "de", "strings", etc.)
  const PLACEHOLDERS = new Set([
    'lista','de','strings','curtas','dos','criterios','que','esse','jogo','atende',
  ]);
  const reais = atendidos.filter((s) => {
    const norm = String(s).toLowerCase().trim();
    return norm.length > 0 && !PLACEHOLDERS.has(norm);
  });

  if (reais.length === 0) return null;

  const conf = (reais.length / total) * 100;
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
