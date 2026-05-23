import type { ContextoTimes } from '@/lib/relatorios';

// Mapeia o objetivo pra ícone + label + cor
const OBJETIVO_INFO: Record<string, { icone: string; label: string; cls: string }> = {
  titulo:        { icone: '🏆', label: 'Título',       cls: 'text-yellow-700 dark:text-yellow-300' },
  libertadores:  { icone: '🥇', label: 'Libertadores', cls: 'text-emerald-700 dark:text-emerald-300' },
  sul_americana: { icone: '🎖️', label: 'Continental',  cls: 'text-sky-700 dark:text-sky-300' },
  acesso:        { icone: '⬆️', label: 'Acesso',       cls: 'text-emerald-700 dark:text-emerald-300' },
  rebaixamento:  { icone: '⚠️', label: 'Rebaixamento', cls: 'text-red-700 dark:text-red-300' },
  meio_tabela:   { icone: '➖', label: 'Meio tabela',  cls: 'text-ink-500' },
  sem_objetivo:  { icone: '😴', label: 'Sem objetivo', cls: 'text-ink-400' },
};

function nomesDoJogo(jogo: string): [string, string] {
  const partes = jogo.split(/\s+x\s+|\s+vs\s+|\s+-\s+/i);
  if (partes.length >= 2) return [partes[0].trim(), partes[1].trim()];
  return ['Casa', 'Fora'];
}

function temAlgumDado(ctx?: ContextoTimes | null): boolean {
  if (!ctx) return false;
  const c = ctx.casa, f = ctx.fora;
  return Boolean(
    (c && (c.posicao || c.objetivo)) || (f && (f.posicao || f.objetivo))
  );
}

function LinhaTime({ nome, posicao, objetivo, compacto }: {
  nome: string;
  posicao?: string;
  objetivo?: string;
  compacto?: boolean;
}) {
  const info = objetivo ? OBJETIVO_INFO[objetivo] : null;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {posicao && (
        <span className="font-bold tabular-nums text-ink-700 dark:text-ink-200 shrink-0">
          {posicao}
        </span>
      )}
      {!compacto && (
        <span className="truncate text-ink-600 dark:text-ink-300">{nome}</span>
      )}
      {info && (
        <span className={`inline-flex items-center gap-0.5 shrink-0 ${info.cls}`} title={info.label}>
          <span>{info.icone}</span>
          {!compacto && <span className="text-[11px]">{info.label}</span>}
        </span>
      )}
    </div>
  );
}

// Versão compacta (cards da lista): "2º 🏆 vs 14º ⚠️"
export function ContextoTimesCompacto({ jogo, contexto }: {
  jogo: string;
  contexto?: ContextoTimes | null;
}) {
  if (!temAlgumDado(contexto)) return null;
  const [casa, fora] = nomesDoJogo(jogo);
  return (
    <div className="flex items-center gap-2 text-xs">
      <LinhaTime nome={casa} posicao={contexto?.casa?.posicao} objetivo={contexto?.casa?.objetivo} compacto />
      <span className="text-ink-400">vs</span>
      <LinhaTime nome={fora} posicao={contexto?.fora?.posicao} objetivo={contexto?.fora?.objetivo} compacto />
    </div>
  );
}

// Versão completa (página de detalhes): cada time numa linha, com nome e label
export function ContextoTimesDetalhe({ jogo, contexto }: {
  jogo: string;
  contexto?: ContextoTimes | null;
}) {
  if (!temAlgumDado(contexto)) return null;
  const [casa, fora] = nomesDoJogo(jogo);
  return (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-2">
        Tabela e motivação
      </div>
      <div className="space-y-2 text-sm">
        <LinhaTime nome={casa} posicao={contexto?.casa?.posicao} objetivo={contexto?.casa?.objetivo} />
        <LinhaTime nome={fora} posicao={contexto?.fora?.posicao} objetivo={contexto?.fora?.objetivo} />
      </div>
    </div>
  );
}
