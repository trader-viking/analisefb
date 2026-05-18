import fs from 'node:fs';
import path from 'node:path';

export type Relatorio = {
  slug: string;          // ex: "2026-05-17"
  arquivo: string;       // ex: "relatorio_2026-05-17.md"
  data: string;          // ex: "2026-05-17"
  variante: string;      // ex: "" | "amostra5" | "liga_Premier"
  titulo: string;        // ex: "17 de maio de 2026"
  subtitulo?: string;    // ex: "Liga Premier" ou "Amostra 5"
  conteudo: string;      // Markdown bruto
  tamanho: number;       // bytes do .md
};

const RELATORIOS_DIR = path.join(process.cwd(), 'relatorios');

function formatarData(iso: string): string {
  // "2026-05-17" -> "17 de maio de 2026"
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
  // relatorio_2026-05-17.md
  // relatorio_2026-05-17_amostra5.md
  // relatorio_2026-05-17_liga_Premier.md
  // relatorio_2026-05-17_busca3.md
  // relatorio_2026-05-17_nums5.md
  const m = arquivo.match(/^relatorio_(\d{4}-\d{2}-\d{2})(?:_(.+))?\.md$/);
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
  const arquivos = fs
    .readdirSync(RELATORIOS_DIR)
    .filter((f) => f.endsWith('.md'));

  const relatorios: Relatorio[] = arquivos
    .map((arquivo) => {
      const parsed = parseFilename(arquivo);
      if (!parsed) return null;
      const fullPath = path.join(RELATORIOS_DIR, arquivo);
      const conteudo = fs.readFileSync(fullPath, 'utf-8');
      const stat = fs.statSync(fullPath);
      const slug = arquivo.replace(/^relatorio_/, '').replace(/\.md$/, '');
      return {
        slug,
        arquivo,
        data: parsed.data,
        variante: parsed.variante,
        titulo: formatarData(parsed.data),
        subtitulo: descreveVariante(parsed.variante),
        conteudo,
        tamanho: stat.size,
      } as Relatorio;
    })
    .filter((r): r is Relatorio => r !== null);

  // Mais recente primeiro; dentro da mesma data, completo antes de variantes
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
