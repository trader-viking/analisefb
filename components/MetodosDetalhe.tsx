// Bloco que mostra todos os 9 métodos da entrada com score, veredito e
// critérios atingidos / falhados. Os CONFIRMADOS aparecem expandidos por padrão.
import type { Entrada, Veredito } from '@/lib/metodos';
import {
  METODOS_V7_KEYS, METODO_LABELS, METODO_TIPO, METODO_MERCADO, METODO_HV,
} from '@/lib/metodos';

const VEREDITO_COR: Record<string, { bg: string; text: string; border: string; label: string }> = {
  CONFIRMADA: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-800',
    label: 'CONFIRMADA',
  },
  POSSÍVEL: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-800',
    label: 'POSSÍVEL',
  },
  POSSIVEL: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-800',
    label: 'POSSÍVEL',
  },
  EVITAR: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-300 dark:border-orange-800',
    label: 'EVITAR',
  },
  REJEITADA: {
    bg: 'bg-ink-100 dark:bg-ink-900',
    text: 'text-ink-500 dark:text-ink-400',
    border: 'border-ink-200 dark:border-ink-800',
    label: 'REJEITADA',
  },
};

function BarraScore({ score, cor }: { score: number; cor: string }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="w-full h-1.5 bg-ink-200 dark:bg-ink-800 rounded-full overflow-hidden">
      <div className={`h-full ${cor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

type CardMetodoProps = {
  metodoKey: string;
  metodo: any;
  papelEntrada?: string;  // PRINCIPAL, SECUNDÁRIA, PO
};

function CardMetodo({ metodoKey, metodo, papelEntrada }: CardMetodoProps) {
  if (!metodo) return null;
  const veredito = (metodo.veredito || 'REJEITADA') as Veredito;
  const corObj = VEREDITO_COR[veredito] || VEREDITO_COR.REJEITADA;
  const score = typeof metodo.score === 'number' ? Math.round(metodo.score) : null;
  const tipo = METODO_TIPO[metodoKey] || '';
  const hv = METODO_HV[metodoKey];
  const label = METODO_LABELS[metodoKey] || metodoKey;
  const mercado = METODO_MERCADO[metodoKey] || metodo.mercado || '';
  const atingidos = Array.isArray(metodo.criterios_atingidos) ? metodo.criterios_atingidos : [];
  const falhados = Array.isArray(metodo.criterios_falhados) ? metodo.criterios_falhados : [];

  // Barra colorida pelo veredito
  const corBarra =
    veredito === 'CONFIRMADA' ? 'bg-emerald-500'
      : veredito === 'POSSÍVEL' || veredito === 'POSSIVEL' ? 'bg-amber-500'
        : veredito === 'EVITAR' ? 'bg-orange-500'
          : 'bg-ink-400';

  return (
    <div className={`rounded-lg border ${corObj.border} ${corObj.bg} p-3`}>
      {/* Cabeçalho: papel + tipo + nome + veredito */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {papelEntrada && (
              <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-ink-800 text-white dark:bg-ink-100 dark:text-ink-900">
                {papelEntrada}
              </span>
            )}
            <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${tipo === 'BACK' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
              {tipo}
            </span>
            {hv && (
              <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-purple-600 text-white" title="High Value: sem teto de odd">
                ⭐ HV
              </span>
            )}
            {metodo.status_extra && (
              <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white">
                {metodo.status_extra}
              </span>
            )}
            {metodo.alerta_inconsistencia && (
              <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-red-600 text-white" title="O placar alvo está nos top 4 mais prováveis do Poisson">
                ⚠ inconsistência
              </span>
            )}
            {metodo.fora_das_ligas_permitidas && (
              <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-ink-500 text-white" title="Trava: liga não permitida">
                🔒 trava
              </span>
            )}
          </div>
          <div className="font-semibold text-sm mt-1">{label}</div>
          {mercado && (
            <div className="text-xs text-ink-500 dark:text-ink-400 truncate" title={mercado}>
              {mercado}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          {score !== null && (
            <div className="font-mono text-2xl font-bold leading-none">{score}</div>
          )}
          <div className={`text-[10px] uppercase tracking-wider font-bold mt-1 ${corObj.text}`}>
            {corObj.label}
          </div>
        </div>
      </div>

      {/* Barra de progresso */}
      {score !== null && (
        <div className="mb-2">
          <BarraScore score={score} cor={corBarra} />
        </div>
      )}

      {/* Odd + EV se houver */}
      {(metodo.odd_estimada || metodo.ev) && (
        <div className="flex items-center gap-3 mb-2 text-xs">
          {metodo.odd_estimada && (
            <div>
              <span className="text-ink-500">Odd:</span>
              <span className="font-mono font-semibold ml-1">{metodo.odd_estimada}</span>
            </div>
          )}
          {metodo.ev !== undefined && (
            <div>
              <span className="text-ink-500">EV:</span>
              <span className={`font-mono font-semibold ml-1 ${
                typeof metodo.ev === 'number' && metodo.ev > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {typeof metodo.ev === 'number' && metodo.ev > 0 ? '+' : ''}
                {typeof metodo.ev === 'number' ? `${(metodo.ev * 100).toFixed(1)}%` : metodo.ev}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Critérios */}
      {(atingidos.length > 0 || falhados.length > 0) && (
        <details className="text-xs" open={veredito === 'CONFIRMADA'}>
          <summary className="cursor-pointer select-none text-ink-600 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-100 mb-1">
            Critérios ({atingidos.length}/{atingidos.length + falhados.length})
          </summary>
          <div className="space-y-1 mt-1.5">
            {atingidos.map((c: string, i: number) => (
              <div key={`a${i}`} className="flex items-start gap-1.5">
                <span className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">✓</span>
                <span className="text-ink-700 dark:text-ink-300 font-mono">{c}</span>
              </div>
            ))}
            {falhados.map((c: string, i: number) => (
              <div key={`f${i}`} className="flex items-start gap-1.5">
                <span className="text-red-500 shrink-0 mt-0.5">✗</span>
                <span className="text-ink-500 dark:text-ink-500 font-mono line-through opacity-75">{c}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default function MetodosDetalhe({ entrada }: { entrada: Entrada }) {
  if (!entrada.metodos) return null;
  const metodos = entrada.metodos;
  const principal = entrada.principal;
  const secundaria = entrada.secundaria;
  const po = entrada.po;

  // Ordena: CONFIRMADA primeiro, depois POSSÍVEL, depois EVITAR, depois REJEITADA
  const ordemVeredito = (v?: Veredito) => {
    if (v === 'CONFIRMADA') return 0;
    if (v === 'POSSÍVEL' || v === 'POSSIVEL') return 1;
    if (v === 'EVITAR') return 2;
    return 3;
  };

  const chavesOrdenadas = [...METODOS_V7_KEYS].sort((a, b) => {
    const oa = ordemVeredito((metodos as any)[a]?.veredito);
    const ob = ordemVeredito((metodos as any)[b]?.veredito);
    if (oa !== ob) return oa - ob;
    const sa = (metodos as any)[a]?.score || 0;
    const sb = (metodos as any)[b]?.score || 0;
    return sb - sa;
  });

  const hasAlgum = chavesOrdenadas.some((k) => (metodos as any)[k]);
  if (!hasAlgum) return null;

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-200 mb-3">
        Métodos analisados ({chavesOrdenadas.filter((k) => (metodos as any)[k]).length})
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {chavesOrdenadas.map((k) => {
          const m = (metodos as any)[k];
          if (!m) return null;
          let papel: string | undefined;
          if (k === principal) papel = 'Principal';
          else if (k === secundaria) papel = 'Secundária';
          else if (k === po) papel = 'PO';
          return <CardMetodo key={k} metodoKey={k as string} metodo={m} papelEntrada={papel} />;
        })}
      </div>
    </div>
  );
}
