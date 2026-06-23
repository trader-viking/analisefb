import fs from 'node:fs';
import path from 'node:path';

// =====================================================
// ESTRUTURA v7.1.13 (sistema de score por pesos)
// =====================================================
// Tipos e constantes vivem em lib/metodos.ts (sem deps de node, podem ser
// importados por componentes client).
// Re-exports pra retrocompat (Entrada/Evitar/Relatorio agora moram em ./metodos)
export type {
  Entrada, Evitar, Relatorio, ContextoTimes,
  OverLimite70, BackFavorito, LayZebra, Back2x2, BackGoleada, ConfirmacaoVisual,
} from './metodos';

export {
  type Veredito, type Metodo, type StatsTime, type StatsAgregado,
  type PlacarProvavel, type PoissonInfo, type MetodosV7, type Odds1x2,
  METODOS_V7_KEYS, METODO_LABELS, METODO_HV, METODO_TIPO,
  METODO_MERCADO, METODO_EMOJI, METODO_COR,
} from './metodos';
import type { Metodo, MetodosV7, StatsAgregado, PoissonInfo, Odds1x2, Veredito, Entrada, Relatorio } from './metodos';
import { METODOS_V7_KEYS, METODO_HV } from './metodos';

// (Tipos Entrada/Evitar/Relatorio movidos pra lib/metodos.ts)

// =====================================================
// HELPERS DE MÉTODOS (usam as constantes de ./metodos)
// =====================================================

export function metodosConfirmados(entrada: Entrada): string[] {
  const out: string[] = [];
  const m = entrada.metodos || {};
  for (const k of METODOS_V7_KEYS) {
    const obj = m[k];
    if (obj && obj.veredito === 'CONFIRMADA') out.push(k as string);
  }
  return out;
}

export function metodosPossiveis(entrada: Entrada): string[] {
  const out: string[] = [];
  const m = entrada.metodos || {};
  for (const k of METODOS_V7_KEYS) {
    const obj = m[k];
    if (obj && (obj.veredito === 'POSSÍVEL' || obj.veredito === 'POSSIVEL')) out.push(k as string);
  }
  return out;
}

export function metodoPrincipal(entrada: Entrada): string | null {
  if (entrada.principal) {
    const k = entrada.principal as keyof MetodosV7;
    if (entrada.metodos?.[k]) return k as string;
  }
  const conf = metodosConfirmados(entrada);
  if (conf.length === 0) return null;
  conf.sort((a, b) => {
    const aHV = METODO_HV[a] ? 1 : 0;
    const bHV = METODO_HV[b] ? 1 : 0;
    if (aHV !== bHV) return bHV - aHV;
    const aS = entrada.metodos?.[a as keyof MetodosV7]?.score || 0;
    const bS = entrada.metodos?.[b as keyof MetodosV7]?.score || 0;
    return bS - aS;
  });
  return conf[0];
}

// Detecta se é uma entrada no formato v7.1.13 (tem `metodos` dict)
export function isV7(entrada: Entrada): boolean {
  return !!(entrada.metodos && Object.keys(entrada.metodos).length > 0);
}

// =====================================================
// LISTAGEM DE RELATÓRIOS
// =====================================================

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
