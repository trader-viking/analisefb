import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, Users, Trophy } from 'lucide-react';
import {
  listarRelatoriosJogadores,
  obterRelatorioJogadores,
} from '@/lib/relatorios_jogadores';
import {
  entradaJogadorSlug,
  METODOS_JOGADOR,
  type MetodoJogador,
} from '@/lib/jogadores_tipos';
import NavegacaoPrincipal from '@/components/NavegacaoPrincipal';

export const dynamic = 'force-static';

export const dynamicParams = false;

export function generateStaticParams() {
  const params: { slug: string; entrada: string }[] = [];
  for (const r of listarRelatoriosJogadores()) {
    r.entradas.forEach((e, i) => {
      params.push({ slug: r.slug, entrada: entradaJogadorSlug(e, i) });
    });
  }
  // Garante pelo menos 1 param pra build não falhar quando não há relatórios
  if (params.length === 0) {
    params.push({ slug: 'placeholder', entrada: '0-placeholder' });
  }
  return params;
}

export default function PaginaDetalheJogador({
  params,
}: {
  params: { slug: string; entrada: string };
}) {
  const relatorio = obterRelatorioJogadores(params.slug);
  if (!relatorio) return notFound();

  const idx = relatorio.entradas.findIndex(
    (e, i) => entradaJogadorSlug(e, i) === params.entrada
  );
  if (idx === -1) return notFound();
  const entrada = relatorio.entradas[idx];
  const info = METODOS_JOGADOR[entrada.metodo as MetodoJogador];

  return (
    <div>
      <NavegacaoPrincipal />

      <div className="mb-4">
        <Link
          href="/jogadores"
          className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800 dark:hover:text-ink-200"
        >
          <ArrowLeft size={14} />
          Voltar para lista de jogadores
        </Link>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-3 text-sm text-ink-500">
          {entrada.horario && (
            <span className="inline-flex items-center gap-1">
              <Clock size={13} />
              {entrada.horario}
            </span>
          )}
          {entrada.liga && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Trophy size={13} />
                {entrada.liga}
              </span>
            </>
          )}
        </div>

        <h1 className="text-2xl font-bold mb-1">{entrada.jogador}</h1>
        <div className="text-sm text-ink-600 dark:text-ink-400 mb-4">
          <Users className="inline mr-1" size={13} />
          {entrada.time} {entrada.posicao && <span className="text-ink-400">· {entrada.posicao}</span>}
        </div>

        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-sm font-semibold bg-${info.cor}-100 text-${info.cor}-800 dark:bg-${info.cor}-950/40 dark:text-${info.cor}-300`}>
          {info.emoji} {info.label}
        </div>

        {entrada.explicacao_curta && (
          <div className="mt-4 p-3 rounded-md bg-ink-50 dark:bg-ink-900/40 text-sm text-ink-700 dark:text-ink-300 border border-ink-200/60 dark:border-ink-800">
            {entrada.explicacao_curta}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <h2 className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-3">
            Mercado e odd
          </h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-ink-500">Mercado: </span>
              <span className="font-medium">{entrada.mercado}</span>
            </div>
            <div>
              <span className="text-ink-500">Odd mínima: </span>
              <span className="font-semibold text-lg tabular-nums">{entrada.odd_minima}</span>
            </div>
            {entrada.probabilidade_estimada && (
              <div>
                <span className="text-ink-500">Probabilidade estimada: </span>
                <span className="tabular-nums">{entrada.probabilidade_estimada}</span>
              </div>
            )}
            {entrada.fair_odd && (
              <div>
                <span className="text-ink-500">Fair odd: </span>
                <span className="tabular-nums">{entrada.fair_odd}</span>
              </div>
            )}
            {entrada.stake_recomendada && (
              <div>
                <span className="text-ink-500">Stake recomendada: </span>
                <span className="font-medium">{entrada.stake_recomendada}</span>
              </div>
            )}
            {entrada.modo && (
              <div>
                <span className="text-ink-500">Modo: </span>
                <span className="font-medium">{entrada.modo === 'ao_vivo' ? 'Ao vivo' : 'Pré-jogo'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-3">
            Estatística-chave
          </h2>
          <div className="space-y-2 text-sm">
            {entrada.estatistica_chave && (
              <div>
                <span className="text-ink-500">Dado do PDF: </span>
                <span className="font-medium">{entrada.estatistica_chave}</span>
              </div>
            )}
            {typeof entrada.minutos_jogados === 'number' && (
              <div>
                <span className="text-ink-500">Minutos jogados (amostra): </span>
                <span className="tabular-nums">{entrada.minutos_jogados} min</span>
              </div>
            )}
            {typeof entrada.partidas_analisadas === 'number' && (
              <div>
                <span className="text-ink-500">Partidas analisadas: </span>
                <span className="tabular-nums">{entrada.partidas_analisadas}</span>
              </div>
            )}
            {entrada.contexto_adversario && (
              <div>
                <span className="text-ink-500">Contexto do adversário: </span>
                <span>{entrada.contexto_adversario}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {entrada.motivacao && (
        <div className="card p-4 mb-6">
          <h2 className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">
            Motivação / contexto do jogo
          </h2>
          <p className="text-sm">{entrada.motivacao}</p>
        </div>
      )}

      {entrada._placar && (
        <div className="card p-4 mb-6 border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20">
          <h2 className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold mb-2">
            Resultado
          </h2>
          <div className="text-sm space-y-1">
            <div>Placar do jogo: <strong className="tabular-nums">{entrada._placar}</strong></div>
            {entrada._resultado_jogador && (
              <div>Resultado do jogador: <strong>{entrada._resultado_jogador}</strong></div>
            )}
            {entrada._veredito && (
              <div>
                Veredito:{' '}
                <strong className={
                  entrada._veredito === 'green'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : entrada._veredito === 'red'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-ink-500'
                }>
                  {entrada._veredito.toUpperCase()}
                </strong>
              </div>
            )}
            {entrada._observacao && (
              <div className="text-ink-500 italic mt-1">"{entrada._observacao}"</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
