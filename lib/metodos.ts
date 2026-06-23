// Tipos e constantes dos métodos v7.1.13.
// SEM dependências de node (fs/path) — pode ser importado por componentes client.

export type Veredito = 'CONFIRMADA' | 'POSSÍVEL' | 'POSSIVEL' | 'EVITAR' | 'REJEITADA';

export type Metodo = {
  nome?: string;
  score?: number;
  veredito?: Veredito;
  odd_estimada?: number | string;
  criterios_atingidos?: string[];
  criterios_falhados?: string[];
  status_extra?: string;
  alerta_inconsistencia?: boolean;
  fora_das_ligas_permitidas?: boolean;
};

export type StatsTime = {
  ppg?: number;
  winPct?: number;
  avgScored?: number;
  avgConceded?: number;
  btts?: number;
  over15?: number;
  over25?: number;
  failedToScore?: number;
  firstToScore?: number;
  xgFor?: number;
  xgAgainst?: number;
  cleanSheet?: number;
  form?: string;
};

export type StatsAgregado = {
  H?: StatsTime;
  A?: StatsTime;
  F?: 'H' | 'A' | string;
  avgTotal?: number;
  bttsAvg?: number;
  o25Avg?: number;
  xgComb?: number;
  ppgDiff?: number;
  sampleSize?: number;
};

export type PlacarProvavel = {
  placar?: string;
  prob?: number;
};

export type PoissonInfo = {
  lh?: number;
  la?: number;
  lambdaTotal?: number;
  pHome?: number;
  pDraw?: number;
  pAway?: number;
  pZebra?: number;
  lineCalc?: number;
  pOverLine?: number;
  placares_provaveis?: PlacarProvavel[];
};

export type MetodosV7 = {
  M1?: Metodo | null;
  M2?: Metodo | null;
  M3?: Metodo | null;
  M5?: Metodo | null;
  M6?: Metodo | null;
  M7?: Metodo | null;
  M8?: Metodo | null;
  M9?: Metodo | null;
  M15?: Metodo | null;
};

export type Odds1x2 = {
  casa?: number;
  empate?: number;
  visitante?: number;
};

// ==============================================
// Constantes
// ==============================================

export const METODOS_V7_KEYS: Array<keyof MetodosV7> = [
  'M1', 'M2', 'M3', 'M5', 'M6', 'M7', 'M8', 'M9', 'M15',
];

export const METODO_LABELS: Record<string, string> = {
  M1: 'Back Favorito',
  M2: 'Back 2×2',
  M3: 'Back Goleada',
  M5: 'Lay 1×0',
  M6: 'Lay 0×1',
  M7: 'Lay 2×0',
  M8: 'Lay 0×2',
  M9: 'Lay Zebra',
  M15: 'Over Limite +1',
  // Retrocompat (relatórios antigos)
  back_favorito: 'Back Favorito',
  lay_zebra: 'Lay Zebra',
  over_limite_70: 'Over Limite (+1 gol)',
  back_2x2: 'Back 2x2',
  back_goleada: 'Back Goleada',
  lay_1x0: 'Lay 1×0',
  lay_0x1: 'Lay 0×1',
  confirmacao_visual: 'Confirmação Visual',
};

export const METODO_HV: Record<string, boolean> = {
  M2: true, M3: true, M15: true,
};

export const METODO_TIPO: Record<string, 'BACK' | 'LAY'> = {
  M1: 'BACK', M2: 'BACK', M3: 'BACK', M15: 'BACK',
  M5: 'LAY', M6: 'LAY', M7: 'LAY', M8: 'LAY', M9: 'LAY',
};

export const METODO_MERCADO: Record<string, string> = {
  M1: 'Vitória do favorito',
  M2: 'BTTS + Over 2.5',
  M3: 'Over 3.5 (goleada)',
  M5: 'Lay placar 1×0',
  M6: 'Lay placar 0×1',
  M7: 'Lay placar 2×0',
  M8: 'Lay placar 0×2',
  M9: 'Lay vitória do azarão',
  M15: 'Over linha dinâmica (+1 gol)',
};

export const METODO_EMOJI: Record<string, string> = {
  M1: '🟢', M2: '🟠', M3: '🟡',
  M5: '🌸', M6: '💜', M7: '🩷', M8: '💗',
  M9: '🔴', M15: '🟣',
};

export const METODO_COR: Record<string, { bg: string; border: string; text: string }> = {
  M1: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800' },
  M2: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800' },
  M3: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800' },
  M5: { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-800' },
  M6: { bg: 'bg-fuchsia-50', border: 'border-fuchsia-300', text: 'text-fuchsia-800' },
  M7: { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-800' },
  M8: { bg: 'bg-pink-100', border: 'border-pink-400', text: 'text-pink-900' },
  M9: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800' },
  M15: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800' },
};


// =====================================================
// LEGADO (manter pra compatibilidade)
// =====================================================

export type OverLimite70 = { aplicavel?: boolean; elegivel?: boolean; [k: string]: any };
export type BackFavorito = { aplicavel?: boolean; [k: string]: any };
export type LayZebra = { aplicavel?: boolean; [k: string]: any };
export type Back2x2 = { aplicavel?: boolean; [k: string]: any };
export type BackGoleada = { aplicavel?: boolean; [k: string]: any };
export type ConfirmacaoVisual = { aplicavel?: boolean; [k: string]: any };
export type ContextoTimes = { casa?: any; fora?: any; [k: string]: any };

export type Entrada = {
  horario: string;
  liga: string;
  jogo: string;
  tipo?: 'entrada' | 'evitar';

  // ===== NOVO v7.1.13 =====
  odds_1x2?: Odds1x2 | null;
  favorito?: 'H' | 'A' | string;
  stats?: StatsAgregado | null;
  poisson?: PoissonInfo | null;
  metodos?: MetodosV7 | null;
  principal?: keyof MetodosV7 | string | null;
  secundaria?: keyof MetodosV7 | string | null;
  po?: keyof MetodosV7 | string | null;
  resumo?: string;

  // ===== LEGADO (relatórios antigos) =====
  metodos_aplicados?: string[];
  mercado_principal?: string;
  probabilidade_estimada?: string;
  fair_odd?: string;
  fair_odd_calculada?: number | string;
  valor_esperado?: number | string;
  odd_minima_entrada?: string;
  odd_principal?: string;
  odd_minima_secundaria?: string;
  odd_secundaria?: string;
  contexto_times?: string;
  media_gols_casa?: string | number | null;
  media_gols_fora?: string | number | null;
  explicacao_curta?: string;
  mercado_secundario?: string;
  motivacao_tecnica?: string;
  placares_provaveis?: string;
  stake_recomendada?: string;
  back_favorito?: BackFavorito | null;
  lay_zebra?: LayZebra | null;
  over_limite_70?: OverLimite70 | null;
  back_2x2?: Back2x2 | null;
  back_goleada?: BackGoleada | null;
  lay_1x0?: any | null;
  lay_0x1?: any | null;
  over_golos?: any | null;
  mercado_gols?: any | null;
  confirmacao_visual?: ConfirmacaoVisual | null;

  // Worker (auditoria)
  _slug?: string;
  _placar?: string | null;
  _status?: string;
  _placar_atualizado_em?: string;
  _veredito?: string;
  _vereditos?: Record<string, { resultado?: string; motivo?: string }>;

  // Tolerância pra campos legados que ainda aparecem em relatórios antigos
  // (plano_execucao, desempenho_1t/2t, contexto_times etc.). Mantém compat
  // sem precisar declarar tudo um por um.
  [key: string]: any;
};

export type Evitar = {
  horario: string;
  liga: string;
  jogo: string;
  tipo?: 'evitar';
  motivo?: string;
  motivos_principais?: string[];
  metodos_resumo?: Record<string, { score?: number; veredito?: Veredito }>;
  motivos_por_metodo?: Record<string, string>;
};

export type Relatorio = {
  slug: string;
  arquivo: string;
  data: string;
  variante: string;
  titulo: string;
  subtitulo?: string;
  gerado_em?: string;
  total_partidas_analisadas?: number;
  entradas: Entrada[];
  evitar: Evitar[];
};
