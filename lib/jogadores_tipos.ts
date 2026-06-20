// Tipos e constantes — sem dependência de fs. Pode ser importado em
// client components.

export type MetodoJogador =
  | 'marca_gol'
  | 'cartao_amarelo'
  | 'chutes'
  | 'desarmes'
  | 'faltas_cometidas'
  | 'faltas_sofridas';

export type EntradaJogador = {
  jogador: string;
  time: string;
  posicao?: string;
  jogo: string;
  liga: string;
  horario: string;

  metodo: MetodoJogador;
  mercado: string;
  odd_minima: string;
  probabilidade_estimada?: string;
  fair_odd?: string;

  stake_recomendada?: string;
  modo?: 'pre_jogo' | 'ao_vivo';

  // Estatísticas /90min do PDF
  estatistica_chave?: string;
  minutos_jogados?: number;
  partidas_analisadas?: number;

  // Contexto
  adversario?: string;
  contexto_adversario?: string;
  motivacao?: string;
  explicacao_curta?: string;

  // Auditoria manual
  _placar?: string;
  _resultado_jogador?: string;
  _veredito?: 'green' | 'red' | 'void' | 'pending';
  _finalizado_manualmente?: boolean;
  _finalizado_em?: string;
  _observacao?: string;
};

export type RelatorioJogadores = {
  slug: string;
  arquivo: string;
  data: string;
  dia_consultado?: string;
  gerado_em?: string;
  total_pdfs_analisados?: number;
  entradas: EntradaJogador[];
  evitar?: Array<{ jogador: string; jogo: string; motivo: string }>;
};

export const METODOS_JOGADOR: Record<
  MetodoJogador,
  { label: string; cor: string; emoji: string; descricaoCurta: string }
> = {
  marca_gol: {
    label: 'Marca Gol',
    cor: 'emerald',
    emoji: '🎯',
    descricaoCurta: 'Jogador marca a qualquer momento',
  },
  cartao_amarelo: {
    label: 'Cartão Amarelo',
    cor: 'amber',
    emoji: '🟨',
    descricaoCurta: 'Jogador leva cartão amarelo',
  },
  chutes: {
    label: 'Chutes (Over)',
    cor: 'blue',
    emoji: '🎯',
    descricaoCurta: 'Over X.5 chutes do jogador',
  },
  desarmes: {
    label: 'Desarmes (Over)',
    cor: 'purple',
    emoji: '🛡',
    descricaoCurta: 'Over X.5 desarmes do jogador',
  },
  faltas_cometidas: {
    label: 'Faltas Cometidas (Over)',
    cor: 'rose',
    emoji: '⚠️',
    descricaoCurta: 'Over X.5 faltas cometidas',
  },
  faltas_sofridas: {
    label: 'Faltas Sofridas (Over)',
    cor: 'cyan',
    emoji: '🆘',
    descricaoCurta: 'Over X.5 faltas sofridas',
  },
};

export function entradaJogadorSlug(entrada: EntradaJogador, idx: number): string {
  const jogador = (entrada.jogador || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${idx}-${entrada.metodo}-${jogador}`;
}
