import { Zap, Eye, ChevronsUp, ChevronsDown, Equal, Crown } from 'lucide-react';
import type { Entrada } from '@/lib/relatorios';

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
    label: 'Over Limite 70+',
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

export function BadgeMetodo({ metodo, size = 'sm' }: { metodo: string; size?: 'sm' | 'md' }) {
  const info = METODOS_INFO[metodo];
  if (!info) return null;
  const cls =
    size === 'md'
      ? 'px-2.5 py-1 text-xs'
      : 'px-2 py-1 text-[11px]';
  return (
    <div
      className={`inline-flex items-center gap-1 font-medium rounded ${cls} ${info.cor_bg} ${info.cor_text}`}
    >
      {info.icone}
      {info.label}
    </div>
  );
}
