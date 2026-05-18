import fs from 'node:fs';
import path from 'node:path';

export type OverLimite70 = {
  elegivel?: boolean;
  favorito?: string;
  indice_gols_final?: string;
  condicao_entrada?: string;
  mercado_sugerido?: string;
  odd_esperada?: string;
  stake_recomendada?: string;
  observacoes?: string;
};

export type ConfirmacaoVisual = {
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

export type Entrada = {
  horario: string;
  liga: string;
  jogo: string;
  mercado_principal: string;
  odd_principal: string;
  fair_odd_calculada?: string;
  valor_esperado?: string;
  mercado_secundario?: string;
  odd_secundaria?: string;
  desempenho_1t?: string;
  desempenho_2t?: string;
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
  over_limite_70?: OverLimite70 | null;
  confirmacao_visual?: ConfirmacaoVisual | null;
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
