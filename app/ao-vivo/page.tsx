'use client';

// ============================================================
// PÁGINA AO VIVO — espelho online do painel local do scanner.
// Consome o endpoint /painel-vivo do worker (que o scanner alimenta
// em tempo real) e mostra as entradas/saídas e a varredura de jogos.
// Coloque este arquivo em: app/ao-vivo/page.tsx
// ============================================================

import { useEffect, useState, useCallback } from 'react';

const API = 'https://analises-trader-api.felipebenicio09.workers.dev';

type Stat = {
  chutes: number; chutesGol?: number; chutes_no_gol?: number;
  posse: number; escanteios: number; cartoes: number;
};
type Jogo = {
  jogo: string; minuto: number;
  gols_casa: number | null; gols_fora: number | null;
  casa: Stat | null; fora: Stat | null;
  alertas_enviados: number; atualizado_em: number;
};
type Alerta = { jogo: string; msg: string; tipo: string; hora: string };
type Painel = { alertas: Alerta[]; jogos: Jogo[]; online: boolean; atualizado_em: string | null };

// Divide a mensagem no formato Telegram (3 linhas) para exibição
function partesDaMsg(msg: string) {
  const linhas = (msg || '').split('\n');
  return {
    l1: (linhas[0] || '').replace(/^🚨\s*/, '').replace(/^✅\s*/, '').replace(/^⚠️\s*/, '').replace(/^🔴\s*/, '').replace(/^⚽\s*/, ''),
    l2: (linhas[1] || '').replace(/^🎯\s*/, ''),
    l3: linhas.slice(2).join(' ').replace(/^💬\s*/, ''),
  };
}

function corDoTipo(tipo: string) {
  switch (tipo) {
    case 'green': return 'var(--verde)';
    case 'favor': return 'var(--verde)';
    case 'contra':
    case 'saida': return 'var(--vermelho)';
    case 'red': return 'var(--vermelho)';
    default: return 'var(--ouro-claro)';
  }
}

export default function AoVivoPage() {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const buscar = useCallback(async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(`${API}/painel-vivo`, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setPainel(await r.json());
      setErro(null);
    } catch (e: any) {
      setErro(e.message || 'falha ao carregar');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar();
    const id = setInterval(buscar, 5000);
    return () => clearInterval(id);
  }, [buscar]);

  const jogos = painel?.jogos ?? [];
  const quentes = jogos.filter((j) => j.alertas_enviados > 0);
  const alertas = painel?.alertas ?? [];

  return (
    <div className="ao-vivo">
      <style>{`
        .ao-vivo {
          --ouro:#C9962E; --ouro-claro:#F4D588; --carvao:#0D0B08;
          --noite:#17140F; --pedra:#2A2620; --marfim:#EDE7D8; --bruma:#8F8778;
          --verde:#3FB868; --vermelho:#E5484D;
          max-width: 900px; margin: 0 auto; padding: 20px 16px 60px;
          color: var(--marfim); font-family: Inter, -apple-system, sans-serif;
        }
        .av-topo { display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px; }
        .av-titulo { font-family:Oswald,sans-serif; text-transform:uppercase; letter-spacing:.03em;
          font-size:20px; background:linear-gradient(135deg,var(--ouro-claro),var(--ouro));
          -webkit-background-clip:text; background-clip:text; color:transparent; }
        .av-status { display:flex; align-items:center; gap:7px; font-size:12px; color:var(--bruma); }
        .av-dot { width:9px;height:9px;border-radius:50%;background:var(--bruma); }
        .av-dot.on { background:var(--verde); box-shadow:0 0 9px var(--verde); animation:avpulse 2s infinite; }
        @keyframes avpulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .av-h2 { font-family:Oswald,sans-serif; text-transform:uppercase; font-size:12px;
          letter-spacing:.13em; color:var(--bruma); margin:26px 0 12px; display:flex; gap:8px; align-items:center; }
        .av-cont { background:rgba(201,150,46,.12); color:var(--ouro-claro); border-radius:20px;
          padding:1px 9px; font-size:11px; }
        .av-alerta { border-radius:13px; padding:14px 16px; margin-bottom:10px; background:var(--noite);
          border:1px solid rgba(201,150,46,.4); }
        .av-alerta .l1 { font-weight:700; font-size:15px; display:flex; justify-content:space-between; gap:10px; }
        .av-alerta .l1 .hora { font-size:11px; color:var(--bruma); font-weight:500; white-space:nowrap; }
        .av-alerta .l2 { margin-top:7px; font-size:13.5px; }
        .av-alerta .l2 b:first-child { font-family:Oswald; text-transform:uppercase; font-size:12.5px; letter-spacing:.04em; }
        .av-alerta .l3 { margin-top:6px; font-size:12px; color:var(--bruma); }
        .av-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:11px; }
        .av-card { background:var(--noite); border:1px solid var(--pedra); border-radius:11px; padding:13px 14px; }
        .av-card.quente { border-color:rgba(201,150,46,.5); }
        .av-card-top { display:flex; justify-content:space-between; gap:8px; align-items:start; }
        .av-jogo { font-weight:600; font-size:13px; line-height:1.35; }
        .av-min { color:var(--carvao); font-size:11px; font-weight:700; white-space:nowrap;
          background:linear-gradient(135deg,var(--ouro-claro),var(--ouro)); border-radius:6px; padding:2px 7px; }
        .av-placar { font-size:21px; font-weight:700; margin:7px 0 3px; font-variant-numeric:tabular-nums; }
        .av-placar .sep { color:var(--bruma); margin:0 5px; font-weight:400; font-size:15px; }
        .av-stats { display:flex; gap:12px; margin-top:7px; font-size:11px; color:var(--bruma); flex-wrap:wrap; }
        .av-stats b { color:var(--marfim); }
        .av-tag { margin-top:8px; display:inline-flex; font-size:10px; border-radius:20px; padding:2px 9px;
          background:rgba(63,184,104,.12); color:var(--verde); border:1px solid rgba(63,184,104,.4); font-weight:600; }
        .av-vazio { color:var(--bruma); font-size:13px; padding:30px; text-align:center;
          background:var(--noite); border:1px dashed var(--pedra); border-radius:12px; }
      `}</style>

      <div className="av-topo">
        <div className="av-titulo">🛡️ Scanner ao vivo</div>
        <div className="av-status">
          <span className={'av-dot' + (painel?.online ? ' on' : '')} />
          <span>
            {carregando ? 'carregando...'
              : erro ? `sem conexão (${erro})`
              : painel?.online ? 'ao vivo'
              : 'scanner offline'}
          </span>
        </div>
      </div>

      <div className="av-h2">🔔 Entradas e saídas <span className="av-cont">{alertas.length}</span></div>
      {alertas.length === 0 ? (
        <div className="av-vazio">Nenhum sinal recente.<br />Entradas, greens e avisos de saída aparecem aqui.</div>
      ) : (
        alertas.map((a, i) => {
          const { l1, l2, l3 } = partesDaMsg(a.msg);
          const cor = corDoTipo(a.tipo);
          const hora = a.hora ? new Date(a.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
          return (
            <div className="av-alerta" key={i} style={{ borderColor: cor + '66' }}>
              <div className="l1"><span dangerouslySetInnerHTML={{ __html: l1 }} /><span className="hora">{hora}</span></div>
              {l2 && <div className="l2" style={{ ['--c' as any]: cor }}>
                <span dangerouslySetInnerHTML={{ __html: l2.replace(/<b>(.*?)<\/b>/, `<b style="color:${cor}">$1</b>`) }} />
              </div>}
              {l3 && <div className="l3" dangerouslySetInnerHTML={{ __html: l3 }} />}
            </div>
          );
        })
      )}

      <div className="av-h2">🔥 Partidas quentes <span className="av-cont">{quentes.length}</span></div>
      <div className="av-grid">
        {quentes.length === 0
          ? <div className="av-vazio">Nenhuma partida com sinal neste momento.</div>
          : quentes.map((j, i) => <CardJogo j={j} key={i} />)}
      </div>

      <div className="av-h2">📋 Varredura completa <span className="av-cont">{jogos.length}</span></div>
      <div className="av-grid">
        {jogos.length === 0
          ? <div className="av-vazio">Aguardando o scanner enviar leituras...</div>
          : jogos.map((j, i) => <CardJogo j={j} key={i} />)}
      </div>
    </div>
  );
}

function CardJogo({ j }: { j: Jogo }) {
  const quente = j.alertas_enviados > 0;
  const cg = j.casa?.chutes_no_gol ?? j.casa?.chutesGol;
  const fg = j.fora?.chutes_no_gol ?? j.fora?.chutesGol;
  return (
    <div className={'av-card' + (quente ? ' quente' : '')}>
      <div className="av-card-top">
        <div className="av-jogo">{j.jogo}</div>
        <div className="av-min">{j.minuto}&apos;</div>
      </div>
      {j.gols_casa !== null && (
        <div className="av-placar">{j.gols_casa}<span className="sep">×</span>{j.gols_fora}</div>
      )}
      {j.casa && j.fora && (
        <div className="av-stats">
          <span>🎯 <b>{cg}</b>–<b>{fg}</b> no alvo</span>
          <span>⚙️ <b>{j.casa.posse}</b>%–<b>{j.fora.posse}</b>%</span>
          <span>🚩 <b>{j.casa.escanteios}</b>–<b>{j.fora.escanteios}</b></span>
        </div>
      )}
      {quente && <div className="av-tag">🔔 {j.alertas_enviados} sinal(is)</div>}
    </div>
  );
}
