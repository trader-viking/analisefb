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
  pressao_casa: number | null; pressao_fora: number | null;
  alertas_enviados: number; atualizado_em: number;
};
type Alerta = { jogo: string; msg: string; tipo: string; hora: string };
type Painel = { alertas: Alerta[]; jogos: Jogo[]; online: boolean; atualizado_em: string | null };

type MetodoStat = { metodo: string; green: number; red: number; saida: number; total: number; taxa_acerto: number | null };
type Historico = {
  metodos: MetodoStat[];
  resumo: { total: number; green: number; red: number; saida: number; taxa_acerto_geral: number | null };
  resultados: { jogo: string; metodo: string; resultado: string; placar: string; data_hora: string }[];
};

// Divide a mensagem no formato Telegram (3 linhas) para exibição
function partesDaMsg(msg: string) {
  const linhas = (msg || '').split('\n').filter((x) => x.trim());
  const resto = linhas.slice(2);
  let pressao = '';
  const motivo: string[] = [];
  for (const ln of resto) {
    if (ln.trim().startsWith('⚡')) pressao = ln;
    else motivo.push(ln);
  }
  return {
    l1: (linhas[0] || '').replace(/^🚨\s*/, '').replace(/^✅\s*/, '').replace(/^⚠️\s*/, '').replace(/^🔴\s*/, '').replace(/^⚽\s*/, ''),
    l2: (linhas[1] || '').replace(/^🎯\s*/, ''),
    l3: motivo.join(' ').replace(/^💬\s*/, ''),
    pressao,
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

// Cor real (hex) pro canvas, que não entende var(--...)
function corHexDoTipo(tipo: string) {
  if (tipo === 'green' || tipo === 'favor') return '#3FB868';
  if (tipo === 'red' || tipo === 'contra' || tipo === 'saida') return '#E5484D';
  return '#F4D588';
}

function semHtml(s: string) {
  return (s || '').replace(/<[^>]+>/g, '').trim();
}

function quebrarTexto(ctx: CanvasRenderingContext2D, texto: string, maxW: number, font: string) {
  ctx.font = font;
  const palavras = texto.split(' ');
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const t = atual ? atual + ' ' + p : p;
    if (ctx.measureText(t).width > maxW && atual) { linhas.push(atual); atual = p; }
    else atual = t;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

// Gera uma imagem PNG do sinal (pra compartilhar) e dispara o download.
// Desenhado à mão no canvas — sem dependências externas no projeto.
function baixarImagemSinal(a: Alerta) {
  const L = (a.msg || '').split('\n').filter((x) => x.trim());
  const l1 = semHtml(L[0] || '').replace(/^[🚨✅⚠️🔴⚽]\s*/u, '');
  const l2 = semHtml(L[1] || '').replace(/^🎯\s*/u, '');
  const resto = L.slice(2).map(semHtml);
  const motivo = resto.filter((x) => !x.startsWith('⚡')).join(' ').replace(/^💬\s*/u, '');
  const pressao = resto.find((x) => x.startsWith('⚡')) || '';

  const W = 1000, PAD = 56;
  const cnv = document.createElement('canvas');
  const ctx = cnv.getContext('2d');
  if (!ctx) return;

  const FONTE = 'Inter, -apple-system, "Segoe UI", sans-serif';
  const TITULO = 'Oswald, Inter, sans-serif';

  // mede quantas linhas o motivo ocupa pra calcular a altura
  cnv.width = W; cnv.height = 400;
  const linhasMotivo = motivo ? quebrarTexto(ctx, motivo, W - PAD * 2, `26px ${FONTE}`) : [];
  const H = 300 + linhasMotivo.length * 36 + (pressao ? 46 : 0);
  cnv.width = W; cnv.height = H;

  const cor = corHexDoTipo(a.tipo);

  // fundo + brilho dourado no topo
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#17140F'); g.addColorStop(1, '#0D0B08');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.8);
  g2.addColorStop(0, 'rgba(201,150,46,0.16)'); g2.addColorStop(1, 'rgba(201,150,46,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, 260);
  ctx.strokeStyle = cor; ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);

  let y = PAD;
  ctx.font = `600 22px ${TITULO}`; ctx.fillStyle = '#C9962E';
  ctx.fillText('TRADER VIKING', PAD, y + 8);
  ctx.font = `400 18px ${FONTE}`; ctx.fillStyle = '#8F8778';
  ctx.textAlign = 'right'; ctx.fillText('SCANNER AO VIVO', W - PAD, y + 8); ctx.textAlign = 'left';
  y += 46;
  ctx.strokeStyle = 'rgba(201,150,46,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
  y += 58;

  ctx.font = `700 40px ${FONTE}`; ctx.fillStyle = '#EDE7D8';
  ctx.fillText(l1, PAD, y); y += 58;
  ctx.font = `700 30px ${TITULO}`; ctx.fillStyle = cor;
  ctx.fillText(l2, PAD, y); y += 50;
  if (linhasMotivo.length) {
    ctx.font = `26px ${FONTE}`; ctx.fillStyle = '#8F8778';
    for (const ln of linhasMotivo) { ctx.fillText(ln, PAD, y); y += 36; }
  }
  if (pressao) {
    y += 8;
    ctx.font = `600 25px ${FONTE}`; ctx.fillStyle = '#F4D588';
    ctx.fillText(pressao, PAD, y);
  }

  const nome = (l1.split('·')[0] || 'sinal').trim()
    .replace(/[^\wÀ-ÿ\s-]/g, '').replace(/\s+/g, '-').slice(0, 50);
  cnv.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nome || 'sinal'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

export default function AoVivoPage() {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [historico, setHistorico] = useState<Historico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [limpando, setLimpando] = useState(false);
  const [msgLimpar, setMsgLimpar] = useState<string | null>(null);

  const limparPainel = useCallback(async () => {
    const segredo = window.prompt('Digite a senha para zerar o painel:');
    if (!segredo) return;
    setLimpando(true);
    setMsgLimpar(null);
    try {
      const r = await fetch(`${API}/painel-limpar?secret=${encodeURIComponent(segredo)}`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok && d.status === 'limpo') {
        setMsgLimpar('Painel zerado.');
        setTimeout(() => setMsgLimpar(null), 4000);
      } else {
        setMsgLimpar(d.erro || 'Não foi possível limpar (senha errada?).');
        setTimeout(() => setMsgLimpar(null), 5000);
      }
    } catch (e: any) {
      setMsgLimpar('Erro de conexão.');
      setTimeout(() => setMsgLimpar(null), 4000);
    } finally {
      setLimpando(false);
    }
  }, []);

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

  const buscarHistorico = useCallback(async () => {
    try {
      const r = await fetch(`${API}/historico`, { cache: 'no-store' });
      if (r.ok) setHistorico(await r.json());
    } catch { /* histórico é secundário, silencia erro */ }
  }, []);

  useEffect(() => {
    buscar();
    buscarHistorico();
    const id = setInterval(buscar, 5000);
    const idH = setInterval(buscarHistorico, 60000); // histórico muda devagar
    return () => { clearInterval(id); clearInterval(idH); };
  }, [buscar, buscarHistorico]);

  const jogos = painel?.jogos ?? [];
  const quentes = jogos.filter((j) => j.alertas_enviados > 0);
  const alertas = painel?.alertas ?? [];
  const andamento = alertas.filter((a) => a.tipo === 'entrada');
  const resolvido = alertas.filter((a) => a.tipo === 'green' || a.tipo === 'red');
  const movimento = alertas.filter((a) => a.tipo === 'favor' || a.tipo === 'contra' || a.tipo === 'saida');

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
        .av-limpar { margin-left:6px; background:transparent; border:1px solid var(--pedra);
          color:var(--bruma); font-size:11px; padding:3px 9px; border-radius:7px; cursor:pointer;
          font-family:inherit; transition:all .15s; }
        .av-limpar:hover:not(:disabled) { border-color:var(--vermelho); color:var(--vermelho); }
        .av-limpar:disabled { opacity:.5; cursor:default; }
        .av-msg-limpar { font-size:12px; color:var(--ouro-claro); text-align:right;
          margin:-2px 0 8px; }
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
        .av-alerta .l1-dir { display:flex; align-items:center; gap:9px; white-space:nowrap; }
        .av-baixar { background:transparent; border:1px solid var(--pedra); color:var(--bruma);
          font-size:11px; font-family:inherit; padding:3px 9px; border-radius:7px; cursor:pointer;
          transition:all .15s; }
        .av-baixar:hover { border-color:var(--ouro); color:var(--ouro-claro); }
        .av-alerta .l2 { margin-top:7px; font-size:13.5px; }
        .av-alerta .l2 b:first-child { font-family:Oswald; text-transform:uppercase; font-size:12.5px; letter-spacing:.04em; }
        .av-alerta .l3 { margin-top:6px; font-size:12px; color:var(--bruma); }
        .av-alerta .l-pressao { margin-top:6px; font-size:12px; color:var(--ouro-claro); font-weight:600; }
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
        .av-barra-pressao { height:5px; border-radius:3px; background:var(--pedra); margin:8px 0 3px;
          overflow:hidden; display:flex; }
        .av-barra-pressao .c { background:linear-gradient(90deg,var(--ouro),var(--ouro-claro)); }
        .av-barra-pressao .f { background:#4a4436; }
        .av-pressao-row { display:flex; justify-content:space-between; font-size:11px; color:var(--bruma); }
        .av-pressao-row .alta { color:var(--ouro-claro); font-weight:700; }
        .av-stats b { color:var(--marfim); }
        .av-tag { margin-top:8px; display:inline-flex; font-size:10px; border-radius:20px; padding:2px 9px;
          background:rgba(63,184,104,.12); color:var(--verde); border:1px solid rgba(63,184,104,.4); font-weight:600; }
        .av-vazio { color:var(--bruma); font-size:13px; padding:30px; text-align:center;
          background:var(--noite); border:1px dashed var(--pedra); border-radius:12px; }
        .av-placar-geral { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:6px; }
        .av-kpi { flex:1; min-width:90px; background:var(--noite); border:1px solid var(--pedra);
          border-radius:11px; padding:12px 14px; text-align:center; }
        .av-kpi .num { font-family:Oswald,sans-serif; font-size:26px; font-weight:700; line-height:1; }
        .av-kpi .rot { font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:var(--bruma); margin-top:5px; }
        .av-kpi.green .num { color:var(--verde); }
        .av-kpi.red .num { color:var(--vermelho); }
        .av-kpi.taxa .num { color:var(--ouro-claro); }
        .av-metodos { display:flex; flex-direction:column; gap:7px; }
        .av-metodo { background:var(--noite); border:1px solid var(--pedra); border-radius:10px;
          padding:10px 13px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .av-metodo .nome { font-family:Oswald,sans-serif; text-transform:uppercase; font-size:12.5px;
          letter-spacing:.03em; }
        .av-metodo .barra { flex:1; height:6px; border-radius:3px; background:var(--pedra); overflow:hidden;
          max-width:180px; display:flex; }
        .av-metodo .barra .g { background:var(--verde); }
        .av-metodo .barra .r { background:var(--vermelho); }
        .av-metodo .nums { font-size:11px; color:var(--bruma); white-space:nowrap; }
        .av-metodo .nums b { color:var(--marfim); }
        .av-metodo .taxa { font-family:Oswald,sans-serif; font-size:16px; font-weight:700; min-width:44px; text-align:right; }
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
          <button className="av-limpar" onClick={limparPainel} disabled={limpando} title="Zerar as leituras e alertas acumulados">
            {limpando ? '...' : '🧹 limpar'}
          </button>
        </div>
      </div>
      {msgLimpar && <div className="av-msg-limpar">{msgLimpar}</div>}

      {historico && historico.resumo.total > 0 && (
        <>
          <div className="av-h2">📊 Placar dos métodos <span className="av-cont">{historico.resumo.total}</span></div>
          <div className="av-placar-geral">
            <div className="av-kpi green"><div className="num">{historico.resumo.green}</div><div className="rot">Greens</div></div>
            <div className="av-kpi red"><div className="num">{historico.resumo.red}</div><div className="rot">Reds</div></div>
            <div className="av-kpi taxa"><div className="num">{historico.resumo.taxa_acerto_geral ?? '—'}{historico.resumo.taxa_acerto_geral !== null ? '%' : ''}</div><div className="rot">Acerto geral</div></div>
          </div>
          <div className="av-metodos" style={{ marginBottom: 8 }}>
            {historico.metodos.map((m, i) => {
              const decididos = m.green + m.red;
              const pctG = decididos > 0 ? (100 * m.green) / decididos : 0;
              return (
                <div className="av-metodo" key={i}>
                  <span className="nome">{m.metodo}</span>
                  <div className="barra">
                    <div className="g" style={{ width: pctG + '%' }} />
                    <div className="r" style={{ width: (100 - pctG) + '%' }} />
                  </div>
                  <span className="nums"><b>{m.green}</b>G · <b>{m.red}</b>R{m.saida > 0 ? <> · {m.saida}S</> : null}</span>
                  <span className="taxa" style={{ color: m.taxa_acerto === null ? 'var(--bruma)' : m.taxa_acerto >= 50 ? 'var(--verde)' : 'var(--vermelho)' }}>
                    {m.taxa_acerto !== null ? m.taxa_acerto + '%' : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {renderSecao('🎯 Entradas em andamento', andamento, 'Nenhuma posição aberta.')}
      {renderSecao('📈 Movimentação', movimento, 'Sem gols a favor ou contra no momento.')}
      {renderSecao('🏁 Resolvidos', resolvido, 'Nenhum green ou red ainda.')}

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

// Gera uma imagem PNG do alerta (card viking) e dispara o download.
// Tudo no canvas do navegador — não depende de servidor nem de libs.
function baixarImagemAlerta(a: Alerta) {
  const { l1, l2, l3, pressao } = partesDaMsg(a.msg);
  const cor = corDoTipo(a.tipo);
  // remove tags HTML pra desenhar texto puro no canvas
  const limpa = (s: string) => (s || '').replace(/<[^>]+>/g, '').trim();
  const linha1 = limpa(l1);
  const linha2 = limpa(l2);
  const linha3 = limpa(l3);
  const linhaP = limpa(pressao);

  const W = 1080, pad = 64;
  // altura dinâmica conforme quantas linhas há
  let H = 420;
  if (!linha3) H -= 60;
  if (!linhaP) H -= 60;

  const canvas = document.createElement('canvas');
  const scale = 2; // nitidez (retina)
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(scale, scale);

  // Fundo carvão com leve brilho dourado no topo
  ctx.fillStyle = '#0D0B08';
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(W / 2, -60, 40, W / 2, -60, 700);
  grad.addColorStop(0, 'rgba(201,150,46,0.12)');
  grad.addColorStop(1, 'rgba(201,150,46,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 260);

  // Borda dourada arredondada
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  ctx.strokeStyle = cor;
  ctx.lineWidth = 2;
  rr(20, 20, W - 40, H - 40, 24);
  ctx.stroke();

  // Marca d'água / título
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#C9962E';
  ctx.font = '700 26px Oswald, Arial, sans-serif';
  ctx.fillText('TRADER VIKING', pad, 46);
  ctx.fillStyle = '#8F8778';
  ctx.font = '500 15px Inter, Arial, sans-serif';
  ctx.fillText('SINAL AO VIVO', pad, 80);

  // Linha 1 — placar (grande, branco)
  let y = 130;
  ctx.fillStyle = '#EDE7D8';
  ctx.font = '700 38px Inter, Arial, sans-serif';
  ctx.fillText(linha1, pad, y);
  y += 62;

  // Linha 2 — método + entrada (cor do tipo)
  ctx.fillStyle = cor;
  ctx.font = '700 28px Oswald, Arial, sans-serif';
  wrapText(ctx, linha2, pad, y, W - pad * 2, 36);
  y += linha2.length > 48 ? 78 : 46;

  // Linha 3 — motivo
  if (linha3) {
    ctx.fillStyle = '#8F8778';
    ctx.font = '400 20px Inter, Arial, sans-serif';
    wrapText(ctx, linha3, pad, y, W - pad * 2, 28);
    y += 56;
  }
  // Pressão
  if (linhaP) {
    ctx.fillStyle = '#F4D588';
    ctx.font = '600 20px Inter, Arial, sans-serif';
    ctx.fillText(linhaP, pad, y);
  }

  // Download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const nome = linha1.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40) || 'sinal';
    link.href = url;
    link.download = `trader_viking_${nome}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

// Quebra texto em várias linhas dentro de uma largura máxima
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const palavras = text.split(' ');
  let linha = '';
  for (const p of palavras) {
    const teste = linha ? linha + ' ' + p : p;
    if (ctx.measureText(teste).width > maxW && linha) {
      ctx.fillText(linha, x, y);
      linha = p;
      y += lh;
    } else {
      linha = teste;
    }
  }
  if (linha) ctx.fillText(linha, x, y);
}

function renderSecao(titulo: string, lista: Alerta[], vazioMsg: string) {
  return (
    <>
      <div className="av-h2">{titulo} <span className="av-cont">{lista.length}</span></div>
      {lista.length === 0 ? (
        <div className="av-vazio">{vazioMsg}</div>
      ) : (
        lista.map((a, i) => {
          const { l1, l2, l3, pressao } = partesDaMsg(a.msg);
          const cor = corDoTipo(a.tipo);
          const hora = a.hora ? new Date(a.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
          return (
            <div className="av-alerta" key={i} style={{ borderColor: cor + '66' }}>
              <div className="l1">
                <span dangerouslySetInnerHTML={{ __html: l1 }} />
                <span className="l1-dir">
                  <button
                    className="av-baixar"
                    onClick={() => baixarImagemSinal(a)}
                    title="Baixar este sinal como imagem"
                  >⬇ imagem</button>
                  <span className="hora">{hora}</span>
                </span>
              </div>
              {l2 && (
                <div className="l2">
                  <span dangerouslySetInnerHTML={{ __html: l2.replace(/<b>(.*?)<\/b>/, `<b style="color:${cor}">$1</b>`) }} />
                </div>
              )}
              {l3 && <div className="l3" dangerouslySetInnerHTML={{ __html: l3 }} />}
              {pressao && <div className="l-pressao" dangerouslySetInnerHTML={{ __html: pressao }} />}
            </div>
          );
        })
      )}
    </>
  );
}

function CardJogo({ j }: { j: Jogo }) {
  const quente = j.alertas_enviados > 0;
  const cg = j.casa?.chutes_no_gol ?? j.casa?.chutesGol;
  const fg = j.fora?.chutes_no_gol ?? j.fora?.chutesGol;
  const pc = j.pressao_casa, pf = j.pressao_fora;
  const temPressao = pc != null && pf != null;
  const soma = temPressao ? (Number(pc) + Number(pf)) || 1 : 1;
  const pctCasa = temPressao ? Math.round((100 * Number(pc)) / soma) : 50;
  const casaAlta = temPressao && Number(pc) >= Number(pf);
  return (
    <div className={'av-card' + (quente ? ' quente' : '')}>
      <div className="av-card-top">
        <div className="av-jogo">{j.jogo}</div>
        <div className="av-min">{j.minuto}&apos;</div>
      </div>
      {j.gols_casa !== null && (
        <div className="av-placar">{j.gols_casa}<span className="sep">×</span>{j.gols_fora}</div>
      )}
      {temPressao && (
        <>
          <div className="av-barra-pressao">
            <div className="c" style={{ width: pctCasa + '%' }} />
            <div className="f" style={{ width: (100 - pctCasa) + '%' }} />
          </div>
          <div className="av-pressao-row">
            <span className={casaAlta ? 'alta' : ''}>⚡ {pc}</span>
            <span className={!casaAlta ? 'alta' : ''}>{pf} ⚡</span>
          </div>
        </>
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
