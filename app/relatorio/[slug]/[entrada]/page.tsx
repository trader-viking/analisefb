import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, Trophy, TrendingUp } from 'lucide-react';
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
};

function CampoDetalhe({ rotulo, valor, destaque }: Campo) {
  if (!valor || !valor.trim()) return null;
  return (
    <div className={destaque ? 'card p-4 bg-ink-50/50 dark:bg-ink-900/50' : 'card p-4'}>
      <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium mb-1.5">
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

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">{entrada.jogo}</h1>

        {/* Resumo dos mercados */}
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

        {entrada.stake_recomendada && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-ink-500">Stake recomendada:</span>
            <span className="pill bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-sm px-2.5 py-1">
              {entrada.stake_recomendada}
            </span>
          </div>
        )}
      </div>

      {/* Análise detalhada */}
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
