import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, Clock, Trophy, TrendingUp, Zap, AlertCircle,
  Eye, Target, BarChart3, MapPin, UserMinus, ShieldAlert, Activity,
} from 'lucide-react';
import { getEntrada, listarRelatorios, entradaSlug } from '@/lib/relatorios';

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
  valor?: string;
  destaque?: boolean;
  icone?: React.ReactNode;
};

function CampoDetalhe({ rotulo, valor, destaque, icone }: Campo) {
  if (!valor || !valor.trim()) return null;
  return (
    <div className={destaque ? 'card p-4 bg-ink-50/50 dark:bg-ink-900/50' : 'card p-4'}>
      <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium mb-1.5 flex items-center gap-1.5">
        {icone}
        {rotulo}
      </div>
      <div className="text-sm leading-relaxed text-ink-800 dark:text-ink-200 whitespace-pre-line">
        {valor}
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
      <Link
        href={`/relatorio/${relatorio.slug}/`}
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 mb-6 transition"
      >
        <ArrowLeft size={16} />
        Voltar para {relatorio.titulo}
      </Link>

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

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
          {entrada.jogo}
        </h1>

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
              <span className="font-bold text-2xl text-emerald-600 dark:text-emerald-400 tabular-nums">
                {entrada.odd_principal}
              </span>
            </div>
          </div>

          {entrada.mercado_secundario && (
            <div className="bg-ink-100 dark:bg-ink-800/50 ring-1 ring-ink-200 dark:ring-ink-700 rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium mb-1">
                Mercado secundário
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{entrada.mercado_secundario}</span>
                {entrada.odd_secundaria && (
                  <span className="font-bold text-xl text-ink-700 dark:text-ink-200 tabular-nums">
                    {entrada.odd_secundaria}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Fair Odd e Valor Esperado */}
        {(entrada.fair_odd_calculada || entrada.valor_esperado) && (
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {entrada.fair_odd_calculada && (
              <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-200 dark:ring-blue-900">
                <div className="text-[11px] uppercase tracking-wider text-blue-700 dark:text-blue-400 font-semibold mb-1 flex items-center gap-1">
                  <BarChart3 size={11} />
                  Fair Odd calculada
                </div>
                <div className="text-lg font-bold tabular-nums">
                  {entrada.fair_odd_calculada}
                </div>
              </div>
            )}
            {entrada.valor_esperado && (
              <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-200 dark:ring-blue-900">
                <div className="text-[11px] uppercase tracking-wider text-blue-700 dark:text-blue-400 font-semibold mb-1 flex items-center gap-1">
                  <Target size={11} />
                  Valor esperado
                </div>
                <div className="text-sm font-medium leading-relaxed">
                  {entrada.valor_esperado}
                </div>
              </div>
            )}
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
      </div>

      {/* Over Limite 70+ */}
      {entrada.over_limite_70?.elegivel && (
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
      {entrada.confirmacao_visual?.elegivel && (
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
  );
}
