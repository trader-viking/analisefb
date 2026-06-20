// Leitura de relatórios de jogadores — SOMENTE servidor (usa fs).
// Para tipos/constantes/utils, importe de @/lib/jogadores_tipos.

import fs from 'fs';
import path from 'path';
import type { RelatorioJogadores } from './jogadores_tipos';

export * from './jogadores_tipos';

const DIR_RELATORIOS_NAME = 'relatorios_jogadores';

export function listarRelatoriosJogadores(): RelatorioJogadores[] {
  const dir = path.join(process.cwd(), DIR_RELATORIOS_NAME);
  if (!fs.existsSync(dir)) return [];

  const arquivos = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('relatorio_jogadores_') && f.endsWith('.json'));

  const out: RelatorioJogadores[] = [];
  for (const arq of arquivos) {
    const dataMatch = arq.match(/^relatorio_jogadores_(\d{4}-\d{2}-\d{2})\.json$/);
    if (!dataMatch) continue;
    try {
      const raw = fs.readFileSync(path.join(dir, arq), 'utf-8');
      const json = JSON.parse(raw);
      out.push({
        slug: dataMatch[1],
        arquivo: arq,
        data: dataMatch[1],
        dia_consultado: json.dia_consultado,
        gerado_em: json.gerado_em,
        total_pdfs_analisados: json.total_pdfs_analisados,
        entradas: json.entradas || [],
        evitar: json.evitar || [],
      });
    } catch {
      // ignora arquivos quebrados
    }
  }
  return out.sort((a, b) => b.data.localeCompare(a.data));
}

export function obterRelatorioJogadores(slug: string): RelatorioJogadores | null {
  return listarRelatoriosJogadores().find((r) => r.slug === slug) || null;
}
