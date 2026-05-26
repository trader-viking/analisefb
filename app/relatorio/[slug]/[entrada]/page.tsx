import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, Clock, Trophy, TrendingUp, Zap, AlertCircle,
  Eye, Target, BarChart3, MapPin, UserMinus, ShieldAlert, Activity,
  ChevronsUp, ChevronsDown, Equal, Crown, Waves,
} from 'lucide-react';
import { getEntrada, listarRelatorios, entradaSlug } from '@/lib/relatorios';
import { BadgeMetodo, metodosAtivos, modoDoMetodo } from '@/components/BadgeMetodo';
import { ContextoTimesDetalhe } from '@/components/ContextoTimes';
import BotaoBaixarPorId from '@/components/BotaoBaixarPorId';
import BotoesAposta from '@/components/BotoesAposta';

export function generateStaticParams() {
  const params: { slug: string; entrada: string }[] = [];
  for (const r of listarRelatorios()) {
    for (let i = 0; i < r.entradas.length; i++) {
      params.push({ slug: r.slug, entrada: entradaSlug(r.entradas[i], i) });
    }
  }
  return params;
}

type Campo = {
  rotulo: string;
  valor?: unknown;
  destaque?: boolean;
  icone?: React.ReactNode;
};

// Converte qualquer coisa em string segura.
// Array de strings vira "item1, item2"; objeto vira JSON; null/undefined vira "".
function toSafeString(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  if (Array.isArray(valor)) {
    return valor
      .map((v) => toSafeString(v))
      .filter((s) => s.trim().length > 0)
      .join(', ');
  }
  if (typeof valor === 'object') {
    try {
      return JSON.stringify(valor);
    } catch {
      return '';
    }
  }
  return String(valor);
}

function CampoDetalhe({ rotulo, valor, destaque, icone }: Campo) {
  const texto = toSafeString(valor);
  if (!texto || !texto.trim()) return null;
  return (
    <div className={destaque ? 'card p-4 bg-ink-50/50 dark:bg-ink-900/50' : 'card p-4'}>
      <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium mb-1.5 flex items-center gap-1.5">
        {icone}
        {rotulo}
      </div>
      <div className="text-sm leading-relaxed text-ink-800 dark:text-ink-200 whitespace-pre-line">
        {texto}
      </div>
    </div>
  );
}

export default function EntradaPage({
  params,
}: {
  params: { slug: string; entrada: string };
}) {
  const res = getEntrada(params.slug, params.entrada);
  if (!res) notFound();
  const { relatorio, entrada } = res;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6" data-no-export="true">
        <Link
          href={`/relatorio/${relatorio.slug}/`}
          className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 transition"
        >
          <ArrowLeft size={16} />
          Voltar para {relatorio.titulo}
        </Link>
        <BotaoBaixarPorId alvoId="conteudo-analise" nomeArquivo={entrada.jogo} className="text-xs px-3 py-1.5" />
      </div>

      <div id="conteudo-analise">
      {/* Cabeçalho */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-3 text-sm">
          {entrada.horario && (
            <span className="inline-flex items-center gap-1.5 text-ink-500">
              <Clock size={14} />
              <span className="font-mono font-medium">{entrada.horario}</span>
            </span>
          )}
          {entrada.liga && (
            <span className="inline-flex items-center gap-1.5 text-ink-500">
              <Trophy size={14} />
              {entrada.liga}
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
          {entrada.jogo}
        </h1>

        {(() => {
          const metodos = metodosAtivos(entrada);
          if (metodos.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {metodos.map((m) => (
                <BadgeMetodo
                  key={m}
                  metodo={m}
                  modo={modoDoMetodo(entrada, m)}
                  size="md"
                />
              ))}
            </div>
          );
        })()}

        {/* Mercados */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200 dark:ring-emerald-900 rounded-lg p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-medium mb-1">
              <TrendingUp size={12} />
              Mercado principal
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold text-ink-900 dark:text-ink-100">
                {entrada.mercado_principal}
              </span>
              {(entrada.odd_minima_entrada || entrada.odd_principal) && (
                <span className="text-right shrink-0">
                  <span className="block text-[9px] uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70 leading-none mb-0.5">Odd mín. entrada</span>
                  <span className="font-bold text-2xl text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {entrada.odd_minima_entrada || entrada.odd_principal}
                  </span>
                </span>
              )}
            </div>
          </div>

          {entrada.mercado_secundario && (
            <div className="bg-ink-100 dark:bg-ink-800/50 ring-1 ring-ink-200 dark:ring-ink-700 rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium mb-1">
                Mercado secundário
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{entrada.mercado_secundario}</span>
                {(entrada.odd_minima_secundaria || entrada.odd_secundaria) && (
                  <span className="text-right shrink-0">
                    <span className="block text-[9px] uppercase tracking-wider text-ink-400 leading-none mb-0.5">Odd mín.</span>
                    <span className="font-bold text-xl text-ink-700 dark:text-ink-200 tabular-nums">
                      {entrada.odd_minima_secundaria || entrada.odd_secundaria}
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tabela e motivação dos times */}
        {entrada.contexto_times && (
          <div className="mt-4">
            <ContextoTimesDetalhe jogo={entrada.jogo} contexto={entrada.contexto_times} />
          </div>
        )}

        {/* Probabilidade, Fair Odd e Odd Mínima */}
        {(entrada.probabilidade_estimada || entrada.fair_odd || entrada.fair_odd_calculada || entrada.valor_esperado) && (
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-200 dark:ring-blue-900 text-center">
                <div className="text-[10px] uppercase tracking-wider text-blue-700 dark:text-blue-400 font-semibold mb-1">
                  Probabilidade
                </div>
                <div className="text-lg font-bold tabular-nums">
                  {entrada.probabilidade_estimada || '—'}
                </div>
              </div>
              <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-200 dark:ring-blue-900 text-center">
                <div className="text-[10px] uppercase tracking-wider text-blue-700 dark:text-blue-400 font-semibold mb-1">
                  Fair Odd
                </div>
                <div className="text-lg font-bold tabular-nums">
                  {entrada.fair_odd || entrada.fair_odd_calculada || '—'}
                </div>
              </div>
              <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-300 dark:ring-emerald-800 text-center">
                <div className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold mb-1">
                  Odd mínima
                </div>
                <div className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {entrada.odd_minima_entrada || '—'}
                </div>
              </div>
            </div>
            {entrada.valor_esperado && (
              <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-200 dark:ring-blue-900">
                <div className="text-[11px] uppercase tracking-wider text-blue-700 dark:text-blue-400 font-semibold mb-1 flex items-center gap-1">
                  <Target size={11} />
                  Racional
                </div>
                <div className="text-sm font-medium leading-relaxed">
                  {entrada.valor_esperado}
                </div>
              </div>
            )}
            <div className="text-[11px] text-ink-400 mt-2 flex items-start gap-1">
              <span>ⓘ</span>
              <span>Odds estimadas a partir das estatísticas (os PDFs não trazem odds reais). Use como referência de risco: só entre se a casa pagar igual ou acima da odd mínima.</span>
            </div>
          </div>
        )}

        {entrada.stake_recomendada && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-ink-500">Stake recomendada:</span>
            <span className="pill bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-sm px-2.5 py-1">
              {entrada.stake_recomendada}
            </span>
          </div>
        )}

        <div className="mt-5 pt-5 border-t border-ink-200 dark:border-ink-800">
          <BotoesAposta jogo={entrada.jogo} />
        </div>
      </div>

      {/* Back Favorito */}
      {entrada.back_favorito?.aplicavel && (
        <div className="card p-6 mb-6 ring-2 ring-emerald-300 dark:ring-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 dark:bg-emerald-700 flex items-center justify-center">
              <ChevronsUp size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Back Favorito</h2>
              <div className="text-xs text-emerald-700 dark:text-emerald-300">
                {entrada.back_favorito.modo === 'ao_vivo' ? 'Entrada ao vivo' : 'Entrada pré-jogo'}
              </div>
            </div>
          </div>

          {entrada.back_favorito.favorito && (
            <div className="mb-3 text-sm">
              <span className="text-ink-500">Favorito:</span>{' '}
              <strong>{entrada.back_favorito.favorito}</strong>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            {entrada.back_favorito.odd_alvo && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  ODD alvo
                </div>
                <div className="text-sm font-medium tabular-nums">{entrada.back_favorito.odd_alvo}</div>
              </div>
            )}
            {entrada.back_favorito.stake_recomendada && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  Stake recomendada
                </div>
                <div className="text-sm font-medium">{entrada.back_favorito.stake_recomendada}</div>
              </div>
            )}
          </div>

          {entrada.back_favorito.razao && (
            <div className="mb-3 p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-emerald-200 dark:ring-emerald-900">
              <div className="text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold mb-1">
                Razão
              </div>
              <div className="text-sm leading-relaxed">{entrada.back_favorito.razao}</div>
            </div>
          )}

          {entrada.back_favorito.gatilho_ao_vivo && entrada.back_favorito.modo === 'ao_vivo' && (
            <div className="p-3 rounded-md bg-sky-50 dark:bg-sky-950/30 ring-1 ring-sky-200 dark:ring-sky-900">
              <div className="text-[11px] uppercase tracking-wider text-sky-700 dark:text-sky-400 font-semibold mb-1 flex items-center gap-1">
                <AlertCircle size={11} />
                Gatilho ao vivo
              </div>
              <div className="text-sm leading-relaxed">{entrada.back_favorito.gatilho_ao_vivo}</div>
            </div>
          )}
        </div>
      )}

      {/* Lay Zebra */}
      {entrada.lay_zebra?.aplicavel && (
        <div className="card p-6 mb-6 ring-2 ring-red-300 dark:ring-red-800 bg-red-50/40 dark:bg-red-950/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-600 dark:bg-red-700 flex items-center justify-center">
              <ChevronsDown size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Lay Zebra</h2>
              <div className="text-xs text-red-700 dark:text-red-300">
                {entrada.lay_zebra.modo === 'ao_vivo' ? 'Entrada ao vivo' : 'Entrada pré-jogo'}
              </div>
            </div>
          </div>

          {entrada.lay_zebra.zebra && (
            <div className="mb-3 text-sm">
              <span className="text-ink-500">Apostando contra:</span>{' '}
              <strong>{entrada.lay_zebra.zebra}</strong>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            {entrada.lay_zebra.odd_zebra_alvo && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  ODD da zebra
                </div>
                <div className="text-sm font-medium tabular-nums">{entrada.lay_zebra.odd_zebra_alvo}</div>
              </div>
            )}
            {entrada.lay_zebra.stake_recomendada && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  Stake recomendada
                </div>
                <div className="text-sm font-medium">{entrada.lay_zebra.stake_recomendada}</div>
              </div>
            )}
          </div>

          {entrada.lay_zebra.razao && (
            <div className="mb-3 p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-red-200 dark:ring-red-900">
              <div className="text-[11px] uppercase tracking-wider text-red-700 dark:text-red-400 font-semibold mb-1">
                Razão
              </div>
              <div className="text-sm leading-relaxed">{entrada.lay_zebra.razao}</div>
            </div>
          )}

          {entrada.lay_zebra.gatilho_ao_vivo && entrada.lay_zebra.modo === 'ao_vivo' && (
            <div className="p-3 rounded-md bg-sky-50 dark:bg-sky-950/30 ring-1 ring-sky-200 dark:ring-sky-900">
              <div className="text-[11px] uppercase tracking-wider text-sky-700 dark:text-sky-400 font-semibold mb-1 flex items-center gap-1">
                <AlertCircle size={11} />
                Gatilho ao vivo
              </div>
              <div className="text-sm leading-relaxed">{entrada.lay_zebra.gatilho_ao_vivo}</div>
            </div>
          )}
        </div>
      )}

      {/* Back 2x2 */}
      {entrada.back_2x2?.aplicavel && (
        <div className="card p-6 mb-6 ring-2 ring-orange-300 dark:ring-orange-800 bg-orange-50/40 dark:bg-orange-950/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-orange-600 dark:bg-orange-700 flex items-center justify-center">
              <Equal size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Back 2x2</h2>
              <div className="text-xs text-orange-700 dark:text-orange-300">
                Placar exato — pré-jogo
              </div>
            </div>
          </div>

          {/* Índices estatísticos — destaque visual */}
          {(entrada.back_2x2.indice_over_2_5 ||
            entrada.back_2x2.indice_ambas_marcam ||
            entrada.back_2x2.indice_over_ht) && (
            <div className="mb-4">
              <div className="text-[11px] uppercase tracking-wider text-orange-700 dark:text-orange-400 font-semibold mb-2">
                Critérios estatísticos
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                {entrada.back_2x2.indice_over_2_5 && (
                  <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-orange-200 dark:ring-orange-900">
                    <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                      Over 2.5
                    </div>
                    <div className="text-sm font-medium leading-tight">
                      {entrada.back_2x2.indice_over_2_5}
                    </div>
                  </div>
                )}
                {entrada.back_2x2.indice_ambas_marcam && (
                  <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-orange-200 dark:ring-orange-900">
                    <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                      Ambas marcam
                    </div>
                    <div className="text-sm font-medium leading-tight">
                      {entrada.back_2x2.indice_ambas_marcam}
                    </div>
                  </div>
                )}
                {entrada.back_2x2.indice_over_ht && (
                  <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-orange-200 dark:ring-orange-900">
                    <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                      Over 0.5 HT
                    </div>
                    <div className="text-sm font-medium leading-tight">
                      {entrada.back_2x2.indice_over_ht}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            {entrada.back_2x2.odd_alvo && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  ODD alvo
                </div>
                <div className="text-sm font-medium tabular-nums">{entrada.back_2x2.odd_alvo}</div>
              </div>
            )}
            {entrada.back_2x2.stake_recomendada && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  Stake recomendada
                </div>
                <div className="text-sm font-medium">{entrada.back_2x2.stake_recomendada}</div>
              </div>
            )}
          </div>

          {entrada.back_2x2.razao && (
            <div className="mb-3 p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-orange-200 dark:ring-orange-900">
              <div className="text-[11px] uppercase tracking-wider text-orange-700 dark:text-orange-400 font-semibold mb-1">
                Razão da entrada
              </div>
              <div className="text-sm leading-relaxed">{entrada.back_2x2.razao}</div>
            </div>
          )}

          {/* Regra de saída — destaque vermelho */}
          {entrada.back_2x2.regra_saida && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-900">
              <div className="text-[11px] uppercase tracking-wider text-red-700 dark:text-red-400 font-semibold mb-1 flex items-center gap-1">
                <AlertCircle size={11} />
                Regra de saída obrigatória
              </div>
              <div className="text-sm leading-relaxed font-medium">
                {entrada.back_2x2.regra_saida}
              </div>
            </div>
          )}

          {entrada.back_2x2.gatilho_ao_vivo && entrada.back_2x2.modo === 'ao_vivo' && (
            <div className="mt-3 p-3 rounded-md bg-sky-50 dark:bg-sky-950/30 ring-1 ring-sky-200 dark:ring-sky-900">
              <div className="text-[11px] uppercase tracking-wider text-sky-700 dark:text-sky-400 font-semibold mb-1 flex items-center gap-1">
                <AlertCircle size={11} />
                Gatilho ao vivo
              </div>
              <div className="text-sm leading-relaxed">{entrada.back_2x2.gatilho_ao_vivo}</div>
            </div>
          )}
        </div>
      )}

      {/* Back Goleada */}
      {entrada.back_goleada?.aplicavel && (
        <div className="card p-6 mb-6 ring-2 ring-yellow-300 dark:ring-yellow-800 bg-yellow-50/40 dark:bg-yellow-950/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-yellow-500 dark:bg-yellow-600 flex items-center justify-center">
              <Crown size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Back Goleada</h2>
              <div className="text-xs text-yellow-700 dark:text-yellow-300">
                Time marca 4+ e vence — {entrada.back_goleada.modo === 'ao_vivo' ? 'ao vivo' : 'pré-jogo'}
              </div>
            </div>
          </div>

          {entrada.back_goleada.candidato && (
            <div className="mb-3 text-sm">
              <span className="text-ink-500">Candidato à goleada:</span>{' '}
              <strong>{entrada.back_goleada.candidato}</strong>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            {entrada.back_goleada.mercado_sugerido && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  Mercado sugerido
                </div>
                <div className="text-sm font-medium">{entrada.back_goleada.mercado_sugerido}</div>
              </div>
            )}
            {entrada.back_goleada.odd_esperada && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  ODD esperada
                </div>
                <div className="text-sm font-medium tabular-nums">{entrada.back_goleada.odd_esperada}</div>
              </div>
            )}
          </div>

          {entrada.back_goleada.razao && (
            <div className="mb-3 p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-yellow-200 dark:ring-yellow-900">
              <div className="text-[11px] uppercase tracking-wider text-yellow-700 dark:text-yellow-400 font-semibold mb-1">
                Razão
              </div>
              <div className="text-sm leading-relaxed">{entrada.back_goleada.razao}</div>
            </div>
          )}

          {entrada.back_goleada.stake_recomendada && (
            <div className="flex items-center gap-2 text-sm pt-2 border-t border-yellow-200 dark:border-yellow-900">
              <span className="text-ink-500">Stake recomendada:</span>
              <span className="pill bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200 text-sm px-2.5 py-1">
                {entrada.back_goleada.stake_recomendada}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Over Gols Pré/Live */}
      {entrada.over_golos?.aplicavel && (
        <div className="card p-6 mb-6 ring-2 ring-teal-300 dark:ring-teal-800 bg-teal-50/40 dark:bg-teal-950/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-teal-500 dark:bg-teal-600 flex items-center justify-center">
              <Waves size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Over Gols Pré/Live</h2>
              <div className="text-xs text-teal-700 dark:text-teal-300">
                Mercado de gols — {entrada.over_golos.modo === 'ao_vivo' ? 'ao vivo' : 'pré-jogo'}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            {entrada.over_golos.mercado_sugerido && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  Mercado sugerido
                </div>
                <div className="text-sm font-medium">{entrada.over_golos.mercado_sugerido}</div>
              </div>
            )}
            {entrada.over_golos.odd_alvo && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  ODD alvo
                </div>
                <div className="text-sm font-medium tabular-nums">{entrada.over_golos.odd_alvo}</div>
              </div>
            )}
          </div>

          {entrada.over_golos.razao && (
            <div className="mb-3 p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-teal-200 dark:ring-teal-900">
              <div className="text-[11px] uppercase tracking-wider text-teal-700 dark:text-teal-400 font-semibold mb-1">
                Razão
              </div>
              <div className="text-sm leading-relaxed">{entrada.over_golos.razao}</div>
            </div>
          )}

          {entrada.over_golos.gatilho_ao_vivo && entrada.over_golos.modo === 'ao_vivo' && (
            <div className="mb-3 p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-red-200 dark:ring-red-900">
              <div className="text-[11px] uppercase tracking-wider text-red-700 dark:text-red-400 font-semibold mb-1">
                Gatilho ao vivo
              </div>
              <div className="text-sm leading-relaxed">{entrada.over_golos.gatilho_ao_vivo}</div>
            </div>
          )}

          {entrada.over_golos.stake_recomendada && (
            <div className="flex items-center gap-2 text-sm pt-2 border-t border-teal-200 dark:border-teal-900">
              <span className="text-ink-500">Stake recomendada:</span>
              <span className="pill bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200 text-sm px-2.5 py-1">
                {entrada.over_golos.stake_recomendada}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Mercado de Gols */}
      {entrada.mercado_gols?.aplicavel && (
        <div className="card p-6 mb-6 ring-2 ring-teal-300 dark:ring-teal-800 bg-teal-50/40 dark:bg-teal-950/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-teal-500 dark:bg-teal-600 flex items-center justify-center">
              <Waves size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Mercado de Gols</h2>
              <div className="text-xs text-teal-700 dark:text-teal-300">
                {entrada.mercado_gols.sub_tipo === 'gols_ht' && 'Gols no 1º tempo'}
                {entrada.mercado_gols.sub_tipo === 'ambas_marcam' && 'Ambas marcam (BTTS)'}
                {entrada.mercado_gols.sub_tipo === 'over_a_frente' && 'Over a frente (+2 gols)'}
                {entrada.mercado_gols.modo === 'ao_vivo' ? ' · ao vivo' : ' · pré-jogo'}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            {entrada.mercado_gols.mercado_sugerido && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  Mercado sugerido
                </div>
                <div className="text-sm font-medium">{entrada.mercado_gols.mercado_sugerido}</div>
              </div>
            )}
            {entrada.mercado_gols.odd_alvo && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  ODD alvo
                </div>
                <div className="text-sm font-medium tabular-nums">{entrada.mercado_gols.odd_alvo}</div>
              </div>
            )}
          </div>

          {entrada.mercado_gols.razao && (
            <div className="mb-3 p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-teal-200 dark:ring-teal-900">
              <div className="text-[11px] uppercase tracking-wider text-teal-700 dark:text-teal-400 font-semibold mb-1">
                Razão
              </div>
              <div className="text-sm leading-relaxed">{entrada.mercado_gols.razao}</div>
            </div>
          )}

          {entrada.mercado_gols.gatilho_ao_vivo && entrada.mercado_gols.modo === 'ao_vivo' && (
            <div className="mb-3 p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-red-200 dark:ring-red-900">
              <div className="text-[11px] uppercase tracking-wider text-red-700 dark:text-red-400 font-semibold mb-1">
                Gatilho ao vivo
              </div>
              <div className="text-sm leading-relaxed">{entrada.mercado_gols.gatilho_ao_vivo}</div>
            </div>
          )}

          {entrada.mercado_gols.stake_recomendada && (
            <div className="flex items-center gap-2 text-sm pt-2 border-t border-teal-200 dark:border-teal-900">
              <span className="text-ink-500">Stake recomendada:</span>
              <span className="pill bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200 text-sm px-2.5 py-1">
                {entrada.mercado_gols.stake_recomendada}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Over Limite 70+ */}
      {(entrada.over_limite_70?.aplicavel || entrada.over_limite_70?.elegivel) && (
        <div className="card p-6 mb-6 ring-2 ring-purple-300 dark:ring-purple-800 bg-purple-50/40 dark:bg-purple-950/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-600 dark:bg-purple-700 flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Over Limite 70+</h2>
              <div className="text-xs text-purple-700 dark:text-purple-300">
                Entrada ao vivo
              </div>
            </div>
          </div>

          {entrada.over_limite_70.favorito && (
            <div className="mb-3 text-sm">
              <span className="text-ink-500">Favorito:</span>{' '}
              <strong>{entrada.over_limite_70.favorito}</strong>
            </div>
          )}

          {entrada.over_limite_70.condicao_entrada && (
            <div className="mb-3 p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-purple-200 dark:ring-purple-900">
              <div className="text-[11px] uppercase tracking-wider text-purple-600 dark:text-purple-400 font-semibold mb-1 flex items-center gap-1">
                <AlertCircle size={11} />
                Gatilho de entrada
              </div>
              <div className="text-sm leading-relaxed">
                {entrada.over_limite_70.condicao_entrada}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            {entrada.over_limite_70.mercado_sugerido && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  Mercado sugerido
                </div>
                <div className="text-sm font-medium">
                  {entrada.over_limite_70.mercado_sugerido}
                </div>
              </div>
            )}
            {entrada.over_limite_70.odd_esperada && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  ODD esperada
                </div>
                <div className="text-sm font-medium tabular-nums">
                  {entrada.over_limite_70.odd_esperada}
                </div>
              </div>
            )}
          </div>

          {entrada.over_limite_70.indice_gols_final && (
            <div className="mb-3 p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
              <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                Índice de gols no final
              </div>
              <div className="text-sm leading-relaxed">
                {entrada.over_limite_70.indice_gols_final}
              </div>
            </div>
          )}

          {entrada.over_limite_70.observacoes && (
            <div className="mb-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-900">
              <div className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold mb-1">
                Observações
              </div>
              <div className="text-sm leading-relaxed">
                {entrada.over_limite_70.observacoes}
              </div>
            </div>
          )}

          {entrada.over_limite_70.stake_recomendada && (
            <div className="flex items-center gap-2 text-sm pt-2 border-t border-purple-200 dark:border-purple-900">
              <span className="text-ink-500">Stake recomendada:</span>
              <span className="pill bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200 text-sm px-2.5 py-1">
                {entrada.over_limite_70.stake_recomendada}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Confirmação Visual */}
      {(entrada.confirmacao_visual?.aplicavel || entrada.confirmacao_visual?.elegivel) && (
        <div className="card p-6 mb-6 ring-2 ring-orange-300 dark:ring-orange-800 bg-orange-50/40 dark:bg-orange-950/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-orange-600 dark:bg-orange-700 flex items-center justify-center">
              <Eye size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Confirmação Visual</h2>
              <div className="text-xs text-orange-700 dark:text-orange-300">
                Gatilhos táticos ao vivo
              </div>
            </div>
          </div>

          {entrada.confirmacao_visual.perfil_tatico && (
            <div className="mb-3 p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-orange-200 dark:ring-orange-900">
              <div className="text-[11px] uppercase tracking-wider text-orange-600 dark:text-orange-400 font-semibold mb-1">
                Perfil tático esperado
              </div>
              <div className="text-sm leading-relaxed">
                {entrada.confirmacao_visual.perfil_tatico}
              </div>
            </div>
          )}

          {entrada.confirmacao_visual.gatilhos_aceleracao && (
            <div className="mb-3 p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-emerald-200 dark:ring-emerald-900">
              <div className="text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold mb-1 flex items-center gap-1">
                <Activity size={11} />
                Gatilhos de aceleração (Back)
              </div>
              <div className="text-sm leading-relaxed">
                {entrada.confirmacao_visual.gatilhos_aceleracao}
              </div>
            </div>
          )}

          {entrada.confirmacao_visual.alerta_armadilha && (
            <div className="mb-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-900">
              <div className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold mb-1 flex items-center gap-1">
                <ShieldAlert size={11} />
                Alerta de armadilha
              </div>
              <div className="text-sm leading-relaxed">
                {entrada.confirmacao_visual.alerta_armadilha}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {entrada.confirmacao_visual.mercado_recomendado && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  Mercado recomendado
                </div>
                <div className="text-sm font-medium">
                  {entrada.confirmacao_visual.mercado_recomendado}
                </div>
              </div>
            )}
            {entrada.confirmacao_visual.momento_observacao && (
              <div className="p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-800">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
                  Janela de observação
                </div>
                <div className="text-sm font-medium">
                  {entrada.confirmacao_visual.momento_observacao}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plano de Execução */}
      {entrada.plano_execucao && (
        entrada.plano_execucao.abordagem ||
        entrada.plano_execucao.gatilho_saida_parcial ||
        entrada.plano_execucao.hard_stop
      ) && (
        <div className="card p-6 mb-6 ring-2 ring-rose-300 dark:ring-rose-800 bg-rose-50/40 dark:bg-rose-950/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-rose-600 dark:bg-rose-700 flex items-center justify-center">
              <Target size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Plano de Execução</h2>
              <div className="text-xs text-rose-700 dark:text-rose-300">
                Regras de entrada e saída
              </div>
            </div>
          </div>

          {entrada.plano_execucao.abordagem && (
            <div className="mb-3 p-3 rounded-md bg-white dark:bg-ink-900 ring-1 ring-rose-200 dark:ring-rose-900">
              <div className="text-[11px] uppercase tracking-wider text-rose-600 dark:text-rose-400 font-semibold mb-1">
                Abordagem
              </div>
              <div className="text-sm font-semibold uppercase">
                {entrada.plano_execucao.abordagem}
              </div>
              {entrada.plano_execucao.justificativa_abordagem && (
                <div className="text-sm leading-relaxed mt-1 text-ink-600 dark:text-ink-400">
                  {entrada.plano_execucao.justificativa_abordagem}
                </div>
              )}
            </div>
          )}

          {entrada.plano_execucao.gatilho_saida_parcial && (
            <div className="mb-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-900">
              <div className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold mb-1">
                Saída parcial
              </div>
              <div className="text-sm leading-relaxed">
                {entrada.plano_execucao.gatilho_saida_parcial}
              </div>
            </div>
          )}

          {entrada.plano_execucao.hard_stop && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-900">
              <div className="text-[11px] uppercase tracking-wider text-red-700 dark:text-red-400 font-semibold mb-1 flex items-center gap-1">
                <AlertCircle size={11} />
                Hard Stop (saída obrigatória)
              </div>
              <div className="text-sm leading-relaxed font-medium">
                {entrada.plano_execucao.hard_stop}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Análise Pré-jogo Detalhada */}
      <div className="space-y-3">
        <CampoDetalhe
          rotulo="Motivação técnica"
          valor={entrada.motivacao_tecnica}
          destaque
        />

        <div className="grid sm:grid-cols-2 gap-3">
          <CampoDetalhe rotulo="Desempenho 1º tempo" valor={entrada.desempenho_1t} />
          <CampoDetalhe rotulo="Desempenho 2º tempo" valor={entrada.desempenho_2t} />
        </div>

        <CampoDetalhe
          rotulo="Coeficiente de Regularidade (CV)"
          valor={entrada.coeficiente_regularidade}
          icone={<BarChart3 size={11} />}
        />

        <div className="grid sm:grid-cols-2 gap-3">
          <CampoDetalhe
            rotulo="Mando de campo"
            valor={entrada.mando_de_campo}
            icone={<MapPin size={11} />}
          />
          <CampoDetalhe
            rotulo="Condições de campo"
            valor={entrada.condicoes_campo}
          />
        </div>

        <CampoDetalhe
          rotulo="Desfalques-chave"
          valor={entrada.desfalques_chave}
          icone={<UserMinus size={11} />}
        />

        <CampoDetalhe
          rotulo="Especificidades dos gols"
          valor={entrada.especificidades_gols}
        />
        <CampoDetalhe rotulo="Momento dos gols" valor={entrada.momento_gols} />
        <CampoDetalhe rotulo="Jogadores-chave" valor={entrada.jogadores_chave} />
        <CampoDetalhe rotulo="Placares prováveis" valor={entrada.placares_provaveis} />

        <div className="grid sm:grid-cols-2 gap-3">
          <CampoDetalhe rotulo="Momento de entrada" valor={entrada.momento_entrada} />
          <CampoDetalhe rotulo="Situação de saída" valor={entrada.situacao_saida} />
        </div>
      </div>
      </div>
    </div>
  );
}
