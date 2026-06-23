// Bloco de stats comparativo H (mandante) vs A (visitante) para entradas v7.1.13.
// Mostra as variáveis-chave usadas no cálculo dos scores dos 9 métodos.
import type { Entrada, StatsAgregado, StatsTime } from '@/lib/metodos';

type Lado = 'H' | 'A';

function fmtNum(v: number | undefined | null, casas = 1, sufixo = ''): string {
  if (v === undefined || v === null || isNaN(v as number)) return '—';
  return (Number(v).toFixed(casas)) + sufixo;
}

function fmtForma(forma?: string): React.ReactNode {
  if (!forma) return <span className="text-ink-400">—</span>;
  return (
    <span className="inline-flex gap-0.5 font-mono">
      {forma.split('').map((c, i) => {
        const cls = c === 'W'
          ? 'bg-emerald-500 text-white'
          : c === 'D'
            ? 'bg-amber-400 text-white'
            : c === 'L'
              ? 'bg-red-500 text-white'
              : 'bg-ink-300 text-ink-700';
        return (
          <span key={i} className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold ${cls}`}>
            {c}
          </span>
        );
      })}
    </span>
  );
}

// Compara dois valores e retorna qual é "melhor" (1 = H, -1 = A, 0 = igual).
// Tipo determina se maior é melhor (default) ou menor.
function comparar(h: number | undefined, a: number | undefined, menorEMelhor = false): -1 | 0 | 1 {
  if (h === undefined || a === undefined) return 0;
  if (h === a) return 0;
  const hMaior = h > a;
  if (menorEMelhor) return hMaior ? -1 : 1;
  return hMaior ? 1 : -1;
}

function nomesDoJogo(jogo: string): [string, string] {
  const partes = jogo.split(/\s+x\s+|\s+vs\s+|\s+-\s+/i);
  if (partes.length >= 2) return [partes[0].trim(), partes[1].trim()];
  return ['Casa', 'Fora'];
}

type LinhaProps = {
  label: string;
  h?: number;
  a?: number;
  menorEMelhor?: boolean;
  sufixo?: string;
  casas?: number;
  hint?: string;
};

function Linha({ label, h, a, menorEMelhor = false, sufixo = '', casas = 1, hint }: LinhaProps) {
  const cmp = comparar(h, a, menorEMelhor);
  const corH = cmp === 1 ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : '';
  const corA = cmp === -1 ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : '';
  return (
    <tr className="border-b border-ink-100 dark:border-ink-800 last:border-0">
      <td className={`text-right font-mono py-1.5 px-2 ${corH}`}>{fmtNum(h, casas, sufixo)}</td>
      <td className="text-center text-xs text-ink-500 py-1.5 px-2" title={hint}>
        {label}
        {hint && <span className="inline-block ml-1 cursor-help opacity-60">ⓘ</span>}
      </td>
      <td className={`text-left font-mono py-1.5 px-2 ${corA}`}>{fmtNum(a, casas, sufixo)}</td>
    </tr>
  );
}

export default function StatsTimesV7({ entrada }: { entrada: Entrada }) {
  if (!entrada.stats) return null;
  const stats: StatsAgregado = entrada.stats;
  const H: StatsTime = stats.H || {};
  const A: StatsTime = stats.A || {};
  const F = stats.F;
  const [nomeH, nomeA] = nomesDoJogo(entrada.jogo);

  // Se algum dos lados tá vazio, não mostra
  if (Object.keys(H).length === 0 && Object.keys(A).length === 0) return null;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-200">
          Estatísticas comparadas
        </h3>
        {stats.sampleSize !== undefined && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">
            amostra: {stats.sampleSize} jogos
          </span>
        )}
      </div>

      {/* Cabeçalho com nomes dos times + badge de favorito */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 mb-3 items-center">
        <div className="text-right text-sm font-semibold flex items-center justify-end gap-1.5">
          {F === 'H' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white uppercase tracking-wider font-bold">
              Fav
            </span>
          )}
          <span className="truncate">{nomeH}</span>
        </div>
        <span className="text-xs text-ink-400 px-1">vs</span>
        <div className="text-left text-sm font-semibold flex items-center gap-1.5">
          <span className="truncate">{nomeA}</span>
          {F === 'A' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white uppercase tracking-wider font-bold">
              Fav
            </span>
          )}
        </div>
      </div>

      <table className="w-full text-sm">
        <tbody>
          <Linha label="PPG" h={H.ppg} a={A.ppg} casas={2} hint="Pontos por jogo" />
          <Linha label="Win %" h={H.winPct} a={A.winPct} sufixo="%" casas={0} />
          <Linha label="Gols marcados/jogo" h={H.avgScored} a={A.avgScored} casas={2} />
          <Linha label="Gols sofridos/jogo" h={H.avgConceded} a={A.avgConceded} casas={2} menorEMelhor />
          <Linha label="xG a favor" h={H.xgFor} a={A.xgFor} casas={2} hint="Expected Goals a favor" />
          <Linha label="xG contra" h={H.xgAgainst} a={A.xgAgainst} casas={2} menorEMelhor hint="Expected Goals contra" />
          <Linha label="BTTS %" h={H.btts} a={A.btts} sufixo="%" casas={0} hint="Ambos os times marcam" />
          <Linha label="Over 2.5 %" h={H.over25} a={A.over25} sufixo="%" casas={0} />
          <Linha label="Over 0.5 %" h={H.over15} a={A.over15} sufixo="%" casas={0} hint="Pelo menos 1 gol" />
          <Linha label="Falha em marcar %" h={H.failedToScore} a={A.failedToScore} sufixo="%" casas={0} menorEMelhor />
          <Linha label="1º a marcar %" h={H.firstToScore} a={A.firstToScore} sufixo="%" casas={0} />
          <Linha label="Clean sheet %" h={H.cleanSheet} a={A.cleanSheet} sufixo="%" casas={0} hint="Jogos sem sofrer gol" />
          <tr className="border-b border-ink-100 dark:border-ink-800 last:border-0">
            <td className="text-right py-1.5 px-2">{fmtForma(H.form)}</td>
            <td className="text-center text-xs text-ink-500 py-1.5 px-2">Forma (últ. 5)</td>
            <td className="text-left py-1.5 px-2">{fmtForma(A.form)}</td>
          </tr>
        </tbody>
      </table>

      {/* Bloco de derivados (combinados) */}
      <div className="mt-3 pt-3 border-t border-ink-200 dark:border-ink-700 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.avgTotal !== undefined && (
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">Média gols</div>
            <div className="font-mono text-lg font-semibold">{fmtNum(stats.avgTotal, 2)}</div>
          </div>
        )}
        {stats.bttsAvg !== undefined && (
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">BTTS méd.</div>
            <div className="font-mono text-lg font-semibold">{fmtNum(stats.bttsAvg, 0, '%')}</div>
          </div>
        )}
        {stats.xgComb !== undefined && (
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">xG comb.</div>
            <div className="font-mono text-lg font-semibold">{fmtNum(stats.xgComb, 2)}</div>
          </div>
        )}
        {stats.ppgDiff !== undefined && (
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">PPG diff</div>
            <div className="font-mono text-lg font-semibold">{fmtNum(stats.ppgDiff, 2)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
