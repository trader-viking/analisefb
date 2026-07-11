'use client';

/**
 * RADAR AO VIVO — widget de Attack Momentum do SofaScore embutido no
 * card, só pra jogos em andamento. Mostra a pressão dos times em tempo
 * real (o gráfico de "ondas" que sobe pro lado que está atacando).
 *
 * Fluxo:
 * 1. Card ao vivo → botão "📡 Radar ao vivo" (não carrega nada até clicar,
 *    pra não pesar a página com iframes)
 * 2. Clique → busca o ID do evento no worker (GET /sofascore?jogo=...,
 *    cache de 24h lá) → embute o iframe oficial de widget do SofaScore
 * 3. Sem ID (jogo não achado / API mudou) → mostra link de fallback pro
 *    SofaScore e nada quebra
 *
 * Atribuição: o widget é do SofaScore e o link de crédito é mantido
 * (condição de uso dos embeds deles).
 */
import { useState } from 'react';
import { Radar, X } from 'lucide-react';

export default function RadarAoVivo({ jogo }: { jogo: string }) {
  const [estado, setEstado] = useState<'fechado' | 'carregando' | 'aberto' | 'indisponivel'>('fechado');
  const [eventId, setEventId] = useState<number | null>(null);

  async function abrir() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) { setEstado('indisponivel'); return; }
    setEstado('carregando');
    try {
      const r = await fetch(`${apiUrl}/sofascore?jogo=${encodeURIComponent(jogo)}`);
      const dados = r.ok ? await r.json() : null;
      if (dados?.event_id) {
        setEventId(dados.event_id);
        setEstado('aberto');
      } else {
        setEstado('indisponivel');
      }
    } catch {
      setEstado('indisponivel');
    }
  }

  if (estado === 'fechado' || estado === 'carregando') {
    return (
      <button
        type="button"
        onClick={abrir}
        disabled={estado === 'carregando'}
        className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-900 hover:bg-red-100 dark:hover:bg-red-950/70 transition disabled:opacity-60"
      >
        <Radar size={13} className={estado === 'carregando' ? 'animate-spin' : 'animate-pulse'} />
        {estado === 'carregando' ? 'Carregando radar...' : 'Radar ao vivo'}
      </button>
    );
  }

  if (estado === 'indisponivel') {
    return (
      <a
        href={`https://www.sofascore.com/search?q=${encodeURIComponent(jogo)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-ink-500 hover:underline"
      >
        <Radar size={12} /> Radar indisponível aqui — abrir no SofaScore ↗
      </a>
    );
  }

  return (
    <div className="mt-1.5 rounded-lg overflow-hidden ring-1 ring-ink-200 dark:ring-ink-800" data-no-export="true">
      <div className="flex items-center justify-between px-2 py-1 bg-ink-50 dark:bg-ink-900 text-[10px] text-ink-500">
        <span className="inline-flex items-center gap-1 font-semibold">
          <Radar size={11} className="text-red-500 animate-pulse" /> Pressão ao vivo
        </span>
        <button
          type="button"
          onClick={() => setEstado('fechado')}
          className="p-0.5 hover:text-ink-800 dark:hover:text-ink-200"
          title="Fechar radar"
        >
          <X size={12} />
        </button>
      </div>
      <iframe
        src={`https://widgets.sofascore.com/embed/attackMomentum?id=${eventId}&widgetTheme=dark`}
        title={`Radar ao vivo — ${jogo}`}
        className="w-full border-0 bg-[#0d1117]"
        style={{ height: 200 }}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
      <div className="px-2 py-0.5 bg-ink-50 dark:bg-ink-900 text-[9px] text-ink-400 text-right">
        Widget:{' '}
        <a href="https://www.sofascore.com/" target="_blank" rel="noopener noreferrer" className="underline">
          SofaScore
        </a>
      </div>
    </div>
  );
}
