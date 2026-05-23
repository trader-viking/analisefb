/**
 * Cloudflare Worker — API de trades + Auditoria automática
 *
 * Endpoints (manuais, via HTTP):
 *   GET    /trades          → lista trades atuais
 *   POST   /trades          → adiciona novo trade
 *   PUT    /trades/:id      → edita trade existente
 *   DELETE /trades/:id      → remove trade
 *   POST   /auditar         → roda auditoria manualmente (útil pra debug)
 *
 * Cron Trigger (automático):
 *   Roda a cada hora — busca placares e atualiza trades pendentes.
 *
 * Secrets/Variáveis no painel do Cloudflare:
 *   GITHUB_TOKEN        - token GitHub (Contents: Read+Write)
 *   GITHUB_OWNER        - usuário GitHub (ex: "jose-trader")
 *   GITHUB_REPO         - "analises-trader"
 *   GITHUB_BRANCH       - "main"
 *   ALLOWED_ORIGIN      - URL do site (ex: "https://analises-trader.pages.dev")
 *   API_FOOTBALL_KEY    - chave da api-sports.io
 *   TELEGRAM_BOT_TOKEN  - token do bot (opcional, pra notificações)
 *   TELEGRAM_CHAT_ID    - chat id do destinatário (opcional)
 */

const TRADES_PATH = 'relatorios/trades.json';
const ENTRADAS_PATH_PREFIX = 'relatorios/relatorio_'; // relatorio_2026-05-17.json

// =============================================================
// Roteamento HTTP
// =============================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, CF-Access-Jwt-Assertion',
      'Access-Control-Allow-Credentials': 'true',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const userEmail =
      request.headers.get('Cf-Access-Authenticated-User-Email') ||
      request.headers.get('CF-Access-Authenticated-User-Email') ||
      'desconhecido';

    try {
      if (path === '/trades' && method === 'GET') {
        return await listarTrades(env, corsHeaders);
      }
      if (path === '/trades' && method === 'POST') {
        const body = await request.json();
        return await criarTrade(env, body, userEmail, corsHeaders);
      }
      if (path.startsWith('/trades/') && method === 'PUT') {
        const id = decodeURIComponent(path.split('/trades/')[1]);
        const body = await request.json();
        return await editarTrade(env, id, body, userEmail, corsHeaders);
      }
      if (path.startsWith('/trades/') && method === 'DELETE') {
        const id = decodeURIComponent(path.split('/trades/')[1]);
        return await deletarTrade(env, id, userEmail, corsHeaders);
      }
      if (path === '/auditar' && method === 'POST') {
        const resultado = await rodarAuditoria(env);
        return resposta(resultado, 200, corsHeaders);
      }
      if (path === '/placares' && method === 'GET') {
        // Retorna placares do dia (usado pelo site pra mostrar jogos encerrados).
        // Cache de 10min via Cloudflare Cache API pra economizar cota da API-Football.
        const data = url.searchParams.get('data') || new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
          return resposta({ erro: 'data invalida (use AAAA-MM-DD)' }, 400, corsHeaders);
        }

        // Tenta servir do cache primeiro
        const cacheKey = new Request(`https://cache.local/placares?data=${data}`);
        const cache = caches.default;
        let cached = await cache.match(cacheKey);
        if (cached) {
          const corpo = await cached.json();
          return resposta({ ...corpo, cache: true }, 200, corsHeaders);
        }

        // Busca da API
        const placares = await buscarPlacaresDoDia(env, data);
        // Simplifica: só o necessário pro site
        const simples = placares.map((p) => ({
          casa: p.casa,
          fora: p.fora,
          gols_casa: p.gols_casa,
          gols_fora: p.gols_fora,
          status: p.status, // 'finalizado' | 'em_andamento' | 'agendado'
        }));
        const corpo = { data, placares: simples, cache: false };

        // Salva no cache por 10 minutos
        const respCache = new Response(JSON.stringify(corpo), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=600' },
        });
        await cache.put(cacheKey, respCache.clone());

        return resposta(corpo, 200, corsHeaders);
      }
      if (path === '/' && method === 'GET') {
        return new Response(
          JSON.stringify({ status: 'ok', usuario: userEmail }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      return new Response('Not found', { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(
        JSON.stringify({ erro: err.message, stack: err.stack }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  },

  // Cron trigger — roda na frequência definida em wrangler.toml (a cada hora)
  async scheduled(event, env, ctx) {
    console.log('Cron triggered:', event.cron);
    try {
      const resultado = await rodarAuditoria(env);
      console.log('Auditoria concluída:', JSON.stringify(resultado));
    } catch (err) {
      console.error('Erro na auditoria:', err.message);
    }
  },
};

// =============================================================
// CRUD de trades
// =============================================================
async function listarTrades(env, corsHeaders) {
  const { trades } = await lerArquivoGithub(env, TRADES_PATH);
  return resposta(trades, 200, corsHeaders);
}

async function criarTrade(env, novoTrade, userEmail, corsHeaders) {
  validarTrade(novoTrade);
  const { trades, sha } = await lerArquivoGithub(env, TRADES_PATH);

  if (!novoTrade.id) {
    const data = novoTrade.data || new Date().toISOString().slice(0, 10);
    const seq = String(
      trades.filter((t) => t.id?.startsWith(data)).length + 1
    ).padStart(3, '0');
    novoTrade.id = `${data}-${seq}`;
  }

  if (trades.some((t) => t.id === novoTrade.id)) {
    return resposta({ erro: `ID já existe: ${novoTrade.id}` }, 409, corsHeaders);
  }

  trades.push(novoTrade);
  await salvarArquivoGithub(env, TRADES_PATH, trades, sha,
    `Trade: ${novoTrade.jogo} (${novoTrade.resultado}) por ${userEmail}`);
  return resposta({ ok: true, trade: novoTrade }, 201, corsHeaders);
}

async function editarTrade(env, id, dadosAtualizados, userEmail, corsHeaders) {
  const { trades, sha } = await lerArquivoGithub(env, TRADES_PATH);
  const idx = trades.findIndex((t) => t.id === id);
  if (idx === -1) {
    return resposta({ erro: `Trade não encontrado: ${id}` }, 404, corsHeaders);
  }
  const tradeAtualizado = { ...trades[idx], ...dadosAtualizados, id };
  validarTrade(tradeAtualizado);
  trades[idx] = tradeAtualizado;
  await salvarArquivoGithub(env, TRADES_PATH, trades, sha,
    `Edição de trade: ${id} por ${userEmail}`);
  return resposta({ ok: true, trade: tradeAtualizado }, 200, corsHeaders);
}

async function deletarTrade(env, id, userEmail, corsHeaders) {
  const { trades, sha } = await lerArquivoGithub(env, TRADES_PATH);
  const idx = trades.findIndex((t) => t.id === id);
  if (idx === -1) {
    return resposta({ erro: `Trade não encontrado: ${id}` }, 404, corsHeaders);
  }
  const removido = trades.splice(idx, 1)[0];
  await salvarArquivoGithub(env, TRADES_PATH, trades, sha,
    `Remoção de trade: ${id} por ${userEmail}`);
  return resposta({ ok: true, removido }, 200, corsHeaders);
}

function validarTrade(t) {
  const obrigatorios = ['data','jogo','metodo','mercado','odd_entrada','stake_pct','resultado','criterios_atendidos'];
  for (const c of obrigatorios) {
    if (t[c] === undefined || t[c] === null || t[c] === '') {
      throw new Error(`Campo obrigatório ausente: ${c}`);
    }
  }
  if (!['green','red','pendente'].includes(t.resultado)) {
    throw new Error(`resultado deve ser 'green', 'red' ou 'pendente'`);
  }
  if (typeof t.criterios_atendidos !== 'boolean') {
    throw new Error(`criterios_atendidos deve ser boolean`);
  }
  if (typeof t.odd_entrada !== 'number' || t.odd_entrada <= 1) {
    throw new Error(`odd_entrada deve ser número maior que 1`);
  }
  if (typeof t.stake_pct !== 'number' || t.stake_pct <= 0) {
    throw new Error(`stake_pct deve ser número maior que 0`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.data)) {
    throw new Error(`data deve estar no formato YYYY-MM-DD`);
  }
}

// =============================================================
// AUDITORIA AUTOMÁTICA
// =============================================================

/**
 * Lê as entradas sugeridas dos relatórios + os trades existentes,
 * busca placares na API-Football, decide Green/Red, atualiza trades.json.
 */
async function rodarAuditoria(env) {
  if (!env.API_FOOTBALL_KEY) {
    return { erro: 'API_FOOTBALL_KEY não configurada' };
  }

  // 1. Carrega trades atuais
  const { trades, sha: tradesSha } = await lerArquivoGithub(env, TRADES_PATH);

  // 2. Detecta datas dos trades pendentes (sem resultado)
  const tradesPendentes = trades.filter(t => t.resultado === 'pendente' || !t.resultado);
  if (tradesPendentes.length === 0) {
    // Mesmo sem trades pendentes, grava os placares nos relatorios
    // (pro site mostrar jogos encerrados).
    let relatoriosAtualizados = 0;
    try {
      relatoriosAtualizados = await gravarPlacaresNosRelatorios(env);
    } catch (err) {
      console.error('Erro gravando placares:', err.message);
    }
    return { status: 'sem_pendentes', total_trades: trades.length, relatorios_atualizados: relatoriosAtualizados };
  }

  const datasUnicas = [...new Set(tradesPendentes.map(t => t.data))];

  // 3. Pra cada data, busca placares na API-Football
  let placaresPorData = {};
  for (const data of datasUnicas) {
    try {
      placaresPorData[data] = await buscarPlacaresDoDia(env, data);
    } catch (err) {
      console.error(`Erro buscando ${data}:`, err.message);
      placaresPorData[data] = [];
    }
  }

  // 4. Cruza cada trade com placar
  let atualizados = 0;
  let inconclusivos = 0;
  const detalhes = [];

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    if (t.resultado !== 'pendente' && t.resultado !== undefined && t.resultado !== '') continue;

    const placares = placaresPorData[t.data] || [];
    const placar = encontrarPlacar(t.jogo, placares);

    if (!placar) {
      detalhes.push({ id: t.id, status: 'sem_placar', jogo: t.jogo });
      inconclusivos++;
      continue;
    }

    if (placar.status !== 'finalizado') {
      detalhes.push({ id: t.id, status: 'jogo_em_andamento', jogo: t.jogo });
      continue;
    }

    // Aplica regra de auditoria do método
    const veredito = auditarPorMetodo(t, placar);
    if (veredito.resultado === 'inconclusivo') {
      inconclusivos++;
      detalhes.push({ id: t.id, status: 'inconclusivo', jogo: t.jogo, motivo: veredito.motivo });
      continue;
    }

    trades[i] = {
      ...t,
      resultado: veredito.resultado,
      placar_final: `${placar.gols_casa}x${placar.gols_fora}`,
      placar_ht: `${placar.gols_casa_ht}x${placar.gols_fora_ht}`,
      auditado_em: new Date().toISOString(),
      auditoria_motivo: veredito.motivo,
    };
    atualizados++;
    detalhes.push({
      id: t.id,
      status: 'atualizado',
      jogo: t.jogo,
      resultado: veredito.resultado,
      placar: `${placar.gols_casa}x${placar.gols_fora}`,
    });

    // Notificação Telegram (não bloqueia em caso de erro)
    const emoji = veredito.resultado === 'green' ? '✅' : '❌';
    const label = veredito.resultado === 'green' ? 'GREEN' : 'RED';
    const msg = (
      `${emoji} <b>${label}</b>: ${t.jogo}\n` +
      `🎯 ${t.metodo} · ${placar.gols_casa}x${placar.gols_fora}\n` +
      `<i>${veredito.motivo}</i>`
    );
    try { await enviarTelegram(env, msg); } catch {}
  }

  // 5. Salva trades no GitHub se teve mudança
  if (atualizados > 0) {
    await salvarArquivoGithub(
      env, TRADES_PATH, trades, tradesSha,
      `Auditoria automática: ${atualizados} trades atualizados`
    );
  }

  // 6. Grava placares nos relatórios do dia (pra mostrar jogos encerrados no site).
  //    Roda pra hoje e ontem — datas em que a API-Football ainda retorna no plano free.
  let relatoriosAtualizados = 0;
  try {
    relatoriosAtualizados = await gravarPlacaresNosRelatorios(env);
  } catch (err) {
    console.error('Erro gravando placares nos relatorios:', err.message);
  }

  return {
    status: 'ok',
    total_pendentes_antes: tradesPendentes.length,
    atualizados,
    inconclusivos,
    relatorios_atualizados: relatoriosAtualizados,
    detalhes,
  };
}

// =============================================================
// Grava placares nos relatorios do dia (hoje + ontem)
// Isso permite o site mostrar "Encerrado 2x1" sem depender da API
// (que no plano free nao retorna datas passadas).
// =============================================================
async function gravarPlacaresNosRelatorios(env) {
  const hoje = new Date();
  const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);
  const datas = [
    hoje.toISOString().slice(0, 10),
    ontem.toISOString().slice(0, 10),
  ];

  let totalAtualizados = 0;

  for (const data of datas) {
    const path = `${ENTRADAS_PATH_PREFIX}${data}.json`;
    let relatorioRaw, sha;
    try {
      const res = await lerArquivoGithubGenerico(env, path);
      relatorioRaw = res.conteudo;
      sha = res.sha;
    } catch {
      continue; // relatorio desse dia nao existe
    }
    if (!relatorioRaw || !sha) continue;

    let relatorio;
    try { relatorio = JSON.parse(relatorioRaw); } catch { continue; }
    if (!relatorio.entradas || !Array.isArray(relatorio.entradas)) continue;

    // Busca placares da data
    let placares;
    try {
      placares = await buscarPlacaresDoDia(env, data);
    } catch {
      continue;
    }
    if (!placares || placares.length === 0) continue;

    // Cruza cada entrada com o placar e grava
    let mudou = false;
    for (const entrada of relatorio.entradas) {
      const placar = encontrarPlacar(entrada.jogo, placares);
      if (!placar) continue;
      // So grava se mudou (evita commits desnecessarios)
      const novoStatus = placar.status;
      const novoPlacar = (placar.gols_casa !== null && placar.gols_fora !== null)
        ? `${placar.gols_casa}x${placar.gols_fora}`
        : null;
      if (entrada._placar !== novoPlacar || entrada._status !== novoStatus) {
        entrada._placar = novoPlacar;
        entrada._status = novoStatus; // 'finalizado' | 'em_andamento' | 'agendado'
        entrada._placar_atualizado_em = new Date().toISOString();
        mudou = true;
      }
    }

    if (mudou) {
      await salvarArquivoGithubGenerico(
        env, path, JSON.stringify(relatorio, null, 2), sha,
        `[auto] Placares atualizados em ${data}`
      );
      totalAtualizados++;
    }
  }

  return totalAtualizados;
}

// Leitura/escrita genérica de arquivo no GitHub (retorna conteúdo como string)
async function lerArquivoGithubGenerico(env, path) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH || 'main'}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'analises-trader-worker',
    },
  });
  if (r.status === 404) return { conteudo: null, sha: null };
  if (!r.ok) throw new Error(`GitHub leitura: ${r.status}`);
  const dados = await r.json();
  const conteudo = atob(dados.content.replace(/\s/g, ''));
  // Decodifica UTF-8 corretamente
  const bytes = Uint8Array.from(conteudo, (c) => c.charCodeAt(0));
  const texto = new TextDecoder('utf-8').decode(bytes);
  return { conteudo: texto, sha: dados.sha };
}

async function salvarArquivoGithubGenerico(env, path, conteudoStr, sha, mensagem) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  // Codifica UTF-8 -> base64
  const bytes = new TextEncoder().encode(conteudoStr);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  const body = { message: mensagem, content: b64, branch: env.GITHUB_BRANCH || 'main' };
  if (sha) body.sha = sha;
  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'analises-trader-worker',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GitHub escrita: ${r.status}: ${await r.text()}`);
  return await r.json();
}

// =============================================================
// Busca placares na API-Football
// =============================================================
async function buscarPlacaresDoDia(env, data) {
  // Endpoint: /fixtures?date=YYYY-MM-DD
  // Doc: https://www.api-football.com/documentation-v3#tag/Fixtures
  const url = `https://v3.football.api-sports.io/fixtures?date=${data}`;
  const r = await fetch(url, {
    headers: {
      'x-apisports-key': env.API_FOOTBALL_KEY,
    },
  });
  if (!r.ok) {
    throw new Error(`API-Football retornou ${r.status}: ${await r.text()}`);
  }
  const dados = await r.json();
  const placares = [];
  for (const item of dados.response || []) {
    const status = item.fixture?.status?.short; // FT, AET, PEN, NS, 1H, HT, 2H...
    const isFinal = ['FT', 'AET', 'PEN'].includes(status);
    const isAgendado = ['NS', 'TBD', 'PST', 'CANC', 'SUSP'].includes(status);

    placares.push({
      casa: item.teams?.home?.name || '',
      fora: item.teams?.away?.name || '',
      gols_casa: item.goals?.home ?? null,
      gols_fora: item.goals?.away ?? null,
      gols_casa_ht: item.score?.halftime?.home ?? null,
      gols_fora_ht: item.score?.halftime?.away ?? null,
      status: isFinal ? 'finalizado' : (isAgendado ? 'agendado' : 'em_andamento'),
      liga: item.league?.name || '',
    });
  }
  return placares;
}

// Tenta encontrar placar de um jogo pelo nome (matching flexível)
function encontrarPlacar(jogoStr, placares) {
  // Normaliza: minúsculas, sem acentos
  const norm = (s) => (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const jogoNorm = norm(jogoStr);
  // Tenta extrair os 2 times
  const sepRegex = / x | vs | - /;
  const partes = jogoNorm.split(sepRegex);
  if (partes.length !== 2) return null;
  const [timeCasaBusca, timeForaBusca] = partes.map(s => s.trim());

  // Função: o nome do time tá contido na string (parcial)?
  const match = (timeBusca, timeReal) => {
    const a = norm(timeReal);
    if (!a || !timeBusca) return false;
    // Match se uma palavra grande do nome de busca está contida
    const palavras = timeBusca.split(' ').filter(p => p.length >= 4);
    if (palavras.length === 0) return a.includes(timeBusca);
    return palavras.some(p => a.includes(p));
  };

  // Procura placar onde os 2 times batem
  for (const p of placares) {
    if (match(timeCasaBusca, p.casa) && match(timeForaBusca, p.fora)) return p;
    // Tenta invertido também (caso o usuário tenha invertido casa/fora)
    if (match(timeCasaBusca, p.fora) && match(timeForaBusca, p.casa)) {
      return { ...p, _invertido: true };
    }
  }
  return null;
}

// =============================================================
// LÓGICA DE AUDITORIA POR MÉTODO
// =============================================================
function auditarPorMetodo(trade, placar) {
  const metodo = (trade.metodo || '').toLowerCase();
  const gc = placar.gols_casa;
  const gf = placar.gols_fora;
  const gcHt = placar.gols_casa_ht ?? 0;
  const gfHt = placar.gols_fora_ht ?? 0;

  if (gc === null || gf === null) {
    return { resultado: 'inconclusivo', motivo: 'sem placar finalizado' };
  }

  // BACK FAVORITO — green se o favorito venceu
  if (metodo.includes('back favorito')) {
    // Por padrão: assumimos que a "casa" é favorita, exceto se mercado disser claro
    // O mais seguro é checar o mercado. Aqui usamos uma heurística simples:
    // Se mercado mencionar nome do time, comparamos com placar.
    const merc = (trade.mercado || '').toLowerCase();
    const venceuCasa = gc > gf;
    const venceuFora = gf > gc;
    if (merc.includes(placar.casa.toLowerCase().split(' ')[0])) {
      return venceuCasa
        ? { resultado: 'green', motivo: `Casa venceu ${gc}x${gf}` }
        : { resultado: 'red', motivo: `Casa não venceu (${gc}x${gf})` };
    }
    if (merc.includes(placar.fora.toLowerCase().split(' ')[0])) {
      return venceuFora
        ? { resultado: 'green', motivo: `Fora venceu ${gc}x${gf}` }
        : { resultado: 'red', motivo: `Fora não venceu (${gc}x${gf})` };
    }
    // Sem identificação clara: usa odd como pista (favorito tem odd menor)
    return { resultado: 'inconclusivo', motivo: 'Mercado não identifica claramente o favorito' };
  }

  // LAY ZEBRA — green se a zebra NÃO venceu (i.e., favorito venceu ou empatou)
  if (metodo.includes('lay zebra')) {
    const merc = (trade.mercado || '').toLowerCase();
    // Se mercado menciona a zebra, lay nela = green se ela não venceu
    if (merc.includes(placar.casa.toLowerCase().split(' ')[0])) {
      return gc > gf
        ? { resultado: 'red', motivo: `Casa (zebra) venceu ${gc}x${gf}` }
        : { resultado: 'green', motivo: `Casa não venceu (${gc}x${gf})` };
    }
    if (merc.includes(placar.fora.toLowerCase().split(' ')[0])) {
      return gf > gc
        ? { resultado: 'red', motivo: `Fora (zebra) venceu ${gc}x${gf}` }
        : { resultado: 'green', motivo: `Fora não venceu (${gc}x${gf})` };
    }
    return { resultado: 'inconclusivo', motivo: 'Mercado não identifica claramente a zebra' };
  }

  // OVER LIMITE 70+ — green se a linha "Mais X.5" foi atingida
  // Como o método é ao vivo e a linha varia, fazemos checagem flexível:
  // se mercado for "Mais 2.5" e total gols >= 3, green; "Mais 3.5" e >= 4, etc
  if (metodo.includes('over limite') || metodo.includes('over 70')) {
    const merc = (trade.mercado || '').toLowerCase();
    const m = merc.match(/mais\s*(\d+)[.,]?5/);
    if (!m) return { resultado: 'inconclusivo', motivo: 'Mercado sem linha clara' };
    const linha = parseInt(m[1]);
    const totalGols = gc + gf;
    return totalGols > linha
      ? { resultado: 'green', motivo: `${totalGols} gols (linha Mais ${linha}.5)` }
      : { resultado: 'red', motivo: `${totalGols} gols (linha Mais ${linha}.5)` };
  }

  // BACK 2x2 — green se o método foi seguido à risca (cash-out em 1x1)
  // Regra: passou por 1x1 OU 2x1/1x2 OU placar final foi 2x2 → green
  if (metodo.includes('2x2') || metodo.includes('back 2x2')) {
    // Sabemos placar final mas não a sequência. Aproximação:
    // - Se placar final 2x2 → green (alvo bateu)
    // - Se placar final passou por 1x1 (i.e. gc>=1 e gf>=1 e total>=2): provavelmente passou por 1x1 → green
    // - Se placar final tem mais gols mas chegou a 2x2 ou foi por 1x1: green
    // - Se placar foi tipo 3x0, 0x0, 0x1: não passou por 1x1 → red
    if (gc === 2 && gf === 2) {
      return { resultado: 'green', motivo: 'Placar final 2x2 (alvo)' };
    }
    // Heurística: se ambos marcaram pelo menos 1 e o jogo teve 2+ gols totais, é altamente provável ter passado por 1x1
    if (gc >= 1 && gf >= 1) {
      return { resultado: 'green', motivo: `Passou por 1x1 (final ${gc}x${gf}) — cash-out aplicado` };
    }
    return { resultado: 'red', motivo: `Não passou por 1x1 (final ${gc}x${gf})` };
  }

  // BACK GOLEADA — green se algum time marcou 4+ E venceu
  if (metodo.includes('goleada')) {
    const venceuCom4 = (gc >= 4 && gc > gf) || (gf >= 4 && gf > gc);
    return venceuCom4
      ? { resultado: 'green', motivo: `Goleada confirmada (${gc}x${gf})` }
      : { resultado: 'red', motivo: `Sem goleada (${gc}x${gf})` };
  }

  // OVER GOLS PRÉ/LIVE — green se a linha indicada bater
  // Tenta extrair a linha do campo mercado/metodo do trade.
  if (metodo.includes('over gols') || metodo.includes('over golos') ||
      metodo.includes('over 1.5') || metodo.includes('over 2.5') ||
      metodo.includes('ambas marcam') || metodo.includes('over ht') ||
      metodo.includes('over 0.5 ht')) {
    const total = gc + gf;
    const mercadoTxt = `${metodo} ${(trade.mercado || '').toLowerCase()}`;

    // Ambas Marcam
    if (mercadoTxt.includes('ambas')) {
      return (gc >= 1 && gf >= 1)
        ? { resultado: 'green', motivo: `Ambas marcaram (${gc}x${gf})` }
        : { resultado: 'red', motivo: `Nem ambas marcaram (${gc}x${gf})` };
    }
    // Over HT (0.5 no primeiro tempo)
    if (mercadoTxt.includes('ht') || mercadoTxt.includes('1o tempo') || mercadoTxt.includes('primeiro tempo')) {
      const totalHt = (placar.gols_casa_ht ?? 0) + (placar.gols_fora_ht ?? 0);
      return totalHt >= 1
        ? { resultado: 'green', motivo: `Over 0.5 HT batido (HT ${placar.gols_casa_ht ?? 0}x${placar.gols_fora_ht ?? 0})` }
        : { resultado: 'red', motivo: `Sem gol no 1o tempo (HT 0x0)` };
    }
    // Over com linha numérica (busca "1.5", "2.5", "3.5"...)
    const mLinha = mercadoTxt.match(/(\d+)[.,]5/);
    const linha = mLinha ? parseFloat(mLinha[1] + '.5') : 1.5; // default Over 1.5
    return total > linha
      ? { resultado: 'green', motivo: `${total} gols (Over ${linha} batido)` }
      : { resultado: 'red', motivo: `${total} gols (Over ${linha} não batido)` };
  }

  // CONFIRMAÇÃO VISUAL — depende do mercado real apostado, então deixamos inconclusivo
  if (metodo.includes('confirmação visual') || metodo.includes('confirmacao visual')) {
    return { resultado: 'inconclusivo', motivo: 'Confirmação Visual: marcar manualmente (depende do mercado escolhido na hora)' };
  }

  return { resultado: 'inconclusivo', motivo: `Método '${trade.metodo}' sem regra automática` };
}

// =============================================================
// GitHub API
// =============================================================
async function lerArquivoGithub(env, path) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH || 'main'}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'analises-trader-worker',
    },
  });
  if (r.status === 404) return { trades: [], sha: null };
  if (!r.ok) throw new Error(`GitHub leitura: ${r.status} ${await r.text()}`);
  const dados = await r.json();
  const conteudo = atob(dados.content.replace(/\s/g, ''));
  let trades = [];
  try {
    const parsed = JSON.parse(conteudo);
    trades = Array.isArray(parsed) ? parsed : parsed.trades || [];
  } catch { trades = []; }
  return { trades, sha: dados.sha };
}

async function salvarArquivoGithub(env, path, trades, sha, mensagem) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const conteudo = JSON.stringify(trades, null, 2);
  const conteudoBase64 = btoa(unescape(encodeURIComponent(conteudo)));
  const body = { message: mensagem, content: conteudoBase64, branch: env.GITHUB_BRANCH || 'main' };
  if (sha) body.sha = sha;
  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'analises-trader-worker',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GitHub escrita: ${r.status} ${await r.text()}`);
  return await r.json();
}

function resposta(corpo, status, corsHeaders) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// =============================================================
// Telegram (notificações)
// =============================================================
async function enviarTelegram(env, mensagem) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return false;
  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: mensagem,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    return r.ok;
  } catch (err) {
    console.error('Erro Telegram:', err.message);
    return false;
  }
}
