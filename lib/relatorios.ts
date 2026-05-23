import fs from 'node:fs';
import path from 'node:path';

export type OverLimite70 = {
  aplicavel?: boolean;
  elegivel?: boolean;
  sub_cenario?: string;   // "gatilho_placar" | "padrao_fim"
  modo?: string;          // "pre_jogo" | "ao_vivo"
  favorito?: string;
  indice_gols_final?: string;
  condicao_entrada?: string;
  mercado_sugerido?: string;
  odd_esperada?: string;
  stake_recomendada?: string;
  observacoes?: string;
};

export type BackFavorito = {
  aplicavel?: boolean;
  modo?: string;
  favorito?: string;
  odd_alvo?: string;
  razao?: string;
  gatilho_ao_vivo?: string;
  stake_recomendada?: string;
};

export type LayZebra = {
  aplicavel?: boolean;
  modo?: string;
  zebra?: string;
  odd_zebra_alvo?: string;
  razao?: string;
  gatilho_ao_vivo?: string;
  stake_recomendada?: string;
};

export type Back2x2 = {
  aplicavel?: boolean;
  razao?: string;
  indice_over_2_5?: string;
  indice_ambas_marcam?: string;
  indice_over_ht?: string;
  modo?: string;
  odd_alvo?: string;
  regra_saida?: string;
  gatilho_ao_vivo?: string;
  stake_recomendada?: string;
};

export type BackGoleada = {
  aplicavel?: boolean;
  candidato?: string;
  razao?: string;
  modo?: string;
  mercado_sugerido?: string;
  odd_esperada?: string;
  stake_recomendada?: string;
};

export type OverGolos = {
  aplicavel?: boolean;
  modo?: string;
  linha?: string;            // "over_1.5" | "over_2.5" | "over_0.5_ht" | "ambas_marcam"
  mercado_sugerido?: string;
  razao?: string;
  odd_alvo?: string;
  gatilho_ao_vivo?: string;
  stake_recomendada?: string;
};

export type ConfirmacaoVisual = {
  aplicavel?: boolean;
  elegivel?: boolean;
  perfil_tatico?: string;
  gatilhos_aceleracao?: string;
  alerta_armadilha?: string;
  mercado_recomendado?: string;
  momento_observacao?: string;
};

export type PlanoExecucao = {
  abordagem?: string;
  justificativa_abordagem?: string;
  gatilho_saida_parcial?: string;
  hard_stop?: string;
};

export type ContextoTime = {
  posicao?: string;
  objetivo?: string;
};

export type ContextoTimes = {
  casa?: ContextoTime;
  fora?: ContextoTime;
};

export type Entrada = {
  horario: string;
  liga: string;
  jogo: string;
  metodos_aplicados?: string[];
  mercado_principal: string;
  odd_principal: string;
  fair_odd_calculada?: string;
  valor_esperado?: string;
  mercado_secundario?: string;
  odd_secundaria?: string;
  desempenho_1t?: string;
  desempenho_2t?: string;
  contexto_times?: ContextoTimes | null;
  motivacao_tecnica?: string;
  coeficiente_regularidade?: string;
  mando_de_campo?: string;
  condicoes_campo?: string;
  desfalques_chave?: string;
  especificidades_gols?: string;
  momento_gols?: string;
  jogadores_chave?: string;
  placares_provaveis?: string;
  momento_entrada?: string;
  situacao_saida?: string;
  stake_recomendada?: string;
  plano_execucao?: PlanoExecucao | null;
  back_favorito?: BackFavorito | null;
  lay_zebra?: LayZebra | null;
  over_limite_70?: OverLimite70 | null;
  back_2x2?: Back2x2 | null;
  back_goleada?: BackGoleada | null;
  over_golos?: OverGolos | null;
  confirmacao_visual?: ConfirmacaoVisual | null;
  // Placar gravado pelo Worker na auditoria (pra mostrar jogos encerrados)
  _slug?: string;
  _placar?: string | null;          // ex: "2x1"
  _status?: string;                 // 'finalizado' | 'em_andamento' | 'agendado'
  _placar_atualizado_em?: string;
  _veredito?: string;               // 'green' | 'red' | 'inconclusivo' (do método principal)
  _vereditos?: Record<string, { resultado?: string; motivo?: string }>; // por método
};

export type Evitar = {
  horario: string;
  liga: string;
  jogo: string;
  motivo: string;
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

const RELATORIOS_DIR = path.join(process.cwd(), 'relatorios');

function formatarData(iso: string): string {
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, ano, mes, dia] = m;
  return `${parseInt(dia)} de ${meses[parseInt(mes) - 1]} de ${ano}`;
}

function parseFilename(arquivo: string): { data: string; variante: string } | null {
  const m = arquivo.match(/^relatorio_(\d{4}-\d{2}-\d{2})(?:_(.+))?\.json$/);
  if (!m) return null;
  return { data: m[1], variante: m[2] || '' };
}

function descreveVariante(v: string): string | undefined {
  if (!v) return undefined;
  if (v.startsWith('amostra')) return `Amostra (${v.replace('amostra', '')} jogos)`;
  if (v.startsWith('liga_')) return `Liga: ${v.replace('liga_', '').replace(/_/g, ' ')}`;
  if (v.startsWith('ligas_')) return `Ligas: ${v.replace('ligas_', '').replace(/_/g, ' ')}`;
  if (v.startsWith('nums')) return `Seleção (${v.replace('nums', '')} jogos)`;
  if (v.startsWith('busca')) return `Busca (${v.replace('busca', '')} jogos)`;
  return v.replace(/_/g, ' ');
}

export function listarRelatorios(): Relatorio[] {
  if (!fs.existsSync(RELATORIOS_DIR)) return [];
  const arquivos = fs.readdirSync(RELATORIOS_DIR).filter((f) => f.endsWith('.json'));

  const relatorios: Relatorio[] = arquivos
    .map((arquivo) => {
      const parsed = parseFilename(arquivo);
      if (!parsed) return null;
      try {
        const fullPath = path.join(RELATORIOS_DIR, arquivo);
        const dados = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        const slug = arquivo.replace(/^relatorio_/, '').replace(/\.json$/, '');
        return {
          slug,
          arquivo,
          data: parsed.data,
          variante: parsed.variante,
          titulo: formatarData(parsed.data),
          subtitulo: descreveVariante(parsed.variante),
          gerado_em: dados.gerado_em,
          total_partidas_analisadas: dados.total_partidas_analisadas,
          entradas: Array.isArray(dados.entradas) ? dados.entradas : [],
          evitar: Array.isArray(dados.evitar) ? dados.evitar : [],
        } as Relatorio;
      } catch {
        return null;
      }
    })
    .filter((r): r is Relatorio => r !== null);

  relatorios.sort((a, b) => {
    if (a.data !== b.data) return b.data.localeCompare(a.data);
    if (!a.variante && b.variante) return -1;
    if (a.variante && !b.variante) return 1;
    return a.variante.localeCompare(b.variante);
  });

  return relatorios;
}

export function getRelatorio(slug: string): Relatorio | null {
  return listarRelatorios().find((r) => r.slug === slug) || null;
}

export function entradaSlug(entrada: Entrada, idx: number): string {
  const horario = (entrada.horario || '').replace(':', '');
  const jogo = (entrada.jogo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${idx}-${horario}-${jogo}`;
}

export function getEntrada(
  slug: string,
  entradaSlugStr: string
): { relatorio: Relatorio; entrada: Entrada; idx: number } | null {
  const relatorio = getRelatorio(slug);
  if (!relatorio) return null;
  for (let i = 0; i < relatorio.entradas.length; i++) {
    if (entradaSlug(relatorio.entradas[i], i) === entradaSlugStr) {
      return { relatorio, entrada: relatorio.entradas[i], idx: i };
    }
  }
  return null;
}
