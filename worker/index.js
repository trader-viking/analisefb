/**
 * Cloudflare Worker — Análises Trader v3
 * ==========================================================================
 * Sistema completo de notificações, auditoria e monitoramento.
 *
 * CRON TRIGGERS (definidos no wrangler.toml):
 *   * * * * *      - Notificação 5min antes de cada jogo + monitor ao vivo (a cada 5min)
 *   5 * * * *      - Auditoria horária (Green/Red de trades)
 *   59 23 * * *    - Resumo diário (PL + estatísticas)
 *
 * HTTP ENDPOINTS:
 *   GET    /trades         - Lista trades
 *   POST   /trades         - Cria trade
 *   PUT    /trades/:id     - Atualiza trade
 *   DELETE /trades/:id     - Remove trade
 *   POST   /auditar        - Roda auditoria manualmente
 *   POST   /monitor        - Roda monitor ao vivo manualmente
 *   POST   /resumo         - Envia resumo diário manualmente
 *   POST   /inicio-jogos   - Verifica e notifica início de jogos
 *
 * SECRETS / VARIÁVEIS:
 *   GITHUB_TOKEN          Token GitHub (Contents R/W)
 *   GITHUB_OWNER          ex: trader-viking
 *   GITHUB_REPO           ex: analisefb
 *   GITHUB_BRANCH         ex: main
 *   ALLOWED_ORIGIN        URL do site (CORS)
 *   API_FOOTBALL_KEY      Chave da api-sports.io
 *   TELEGRAM_BOT_TOKEN    Token do bot
 *   TELEGRAM_CHAT_ID      Chat ID destinatário
 *   SITE_URL              (opcional) URL pública do site, default: https://analisefb.pages.dev
 */

const TRADES_PATH = 'relatorios/trades.json';
const ESTADO_PATH = 'relatorios/_estado_worker.json';
const RELATORIO_PATH_PREFIX = 'relatorios/relatorio_';
const COTA_DIARIA_API = 100;
const COTA_LIMITE_SEGURO = 85;

// =============================================================
// ENTRADA HTTP
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

    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const userEmail =
      request.headers.get('Cf-Access-Authenticated-User-Email') ||
      request.headers.get('CF-Access-Authenticated-User-Email') ||
      'desconhecido';

    try {
      if (path === '/trades' && method === 'GET') return await listarTrades(env, corsHeaders);
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
        return resposta(await rodarAuditoria(env), 200, corsHeaders);
      }
      if (path === '/monitor' && method === 'POST') {
        return resposta(await rodarMonitorAoVivo(env), 200, corsHeaders);
      }
      if (path === '/resumo' && method === 'POST') {
        return resposta(await enviarResumoDiario(env), 200, corsHeaders);
      }
      if (path === '/inicio-jogos' && method === 'POST') {
        return resposta(await notificarInicioJogos(env), 200, corsHeaders);
      }
      if (path === '/' && method === 'GET') {
        return new Response(
          JSON.stringify({ status: 'ok', usuario: userEmail, versao: 'v3' }),
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

  // Cron triggers
  async scheduled(event, env, ctx) {
    const cron = event.cron;
    console.log(`[CRON] ${cron}`);
    try {
      if (cron === '59 23 * * *') {
        await enviarResumoDiario(env);
        return;
      }
      if (cron === '5 * * * *') {
        await rodarAuditoria(env);
        return;
      }
      if (cron === '* * * * *') {
        await notificarInicioJogos(env);
        const minAtual = new Date().getUTCMinutes();
        if (minAtual % 5 === 0) {
          await rodarMonitorAoVivo(env);
        }
        return;
      }
    } catch (err) {
      console.error('[CRON ERROR]', err.message);
      try {
        await enviarTelegram(env,
          `⚠️ <b>Erro no cron ${cron}</b>\n<code>${escapeHtml(err.message)}</code>`
        );
      } catch {}
    }
  },
};

// =============================================================
// CRUD trades
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
  if (idx === -1) return resposta({ erro: `Trade não encontrado: ${id}` }, 404, corsHeaders);
  const tradeAtualizado = { ...trades[idx], ...dadosAtualizados, id };
  validarTrade(tradeAtualizado);
  trades[idx] = tradeAtualizado;
  await salvarArquivoGithub(env, TRADES_PATH, trades, sha,
    `Edição: ${id} por ${userEmail}`);
  return resposta({ ok: true, trade: tradeAtualizado }, 200, corsHeaders);
}

async function deletarTrade(env, id, userEmail, corsHeaders) {
  const { trades, sha } = await lerArquivoGithub(env, TRADES_PATH);
  const idx = trades.findIndex((t) => t.id === id);
  if (idx === -1) return resposta({ erro: `Trade não encontrado: ${id}` }, 404, corsHeaders);
  const removido = trades.splice(idx, 1)[0];
  await salvarArquivoGithub(env, TRADES_PATH, trades, sha,
    `Remoção: ${id} por ${userEmail}`);
  return resposta({ ok: true, removido }, 200, corsHeaders);
}

function validarTrade(t) {
  const obrig = ['data','jogo','metodo','mercado','odd_entrada','stake_pct','resultado','criterios_atendidos'];
  for (const c of obrig) {
    if (t[c] === undefined || t[c] === null || t[c] === '') {
      throw new Error(`Campo obrigatório ausente: ${c}`);
    }
  }
  if (!['green','red','pendente'].includes(t.resultado)) {
    throw new Error(`resultado: 'green', 'red' ou 'pendente'`);
  }
  if (typeof t.criterios_atendidos !== 'boolean') {
    throw new Error(`criterios_atendidos deve ser boolean`);
  }
  if (typeof t.odd_entrada !== 'number' || t.odd_entrada <= 1) {
    throw new Error(`odd_entrada deve ser > 1`);
  }
  if (typeof t.stake_pct !== 'number' || t.stake_pct <= 0) {
    throw new Error(`stake_pct deve ser > 0`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.data)) {
    throw new Error(`data deve ser YYYY-MM-DD`);
  }
}

// =============================================================
// ESTADO GLOBAL (GitHub-based)
// =============================================================
function estadoVazio() {
  return {
    dia: hojeBR(),
    cota_api_usada: 0,
    inicio_jogos_notificados: [],
    gatilhos_ao_vivo_notificados: [],
    cash_out_notificados: [],
    resumo_dia_enviado: false,
  };
}

async function carregarEstado(env) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${ESTADO_PATH}?ref=${env.GITHUB_BRANCH || 'main'}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'analises-trader-worker',
    },
  });
  if (r.status === 404) return { obj: estadoVazio(), sha: null };
  if (!r.ok) {
    console.warn(`Estado leitura: ${r.status}`);
    return { obj: estadoVazio(), sha: null };
  }
  const dados = await r.json();
  const conteudo = atob(dados.content.replace(/\s/g, ''));
  let obj;
  try { obj = JSON.parse(conteudo); } catch { obj = estadoVazio(); }
  const hoje = hojeBR();
  if (obj.dia !== hoje) {
    // Mudou o dia — reset
    obj = estadoVazio();
  }
  return { obj, sha: dados.sha };
}

async function salvarEstado(env, obj, sha) {
  obj.dia = hojeBR();
  for (const k of ['inicio_jogos_notificados','gatilhos_ao_vivo_notificados','cash_out_notificados']) {
    if (Array.isArray(obj[k]) && obj[k].length > 500) {
      obj[k] = obj[k].slice(-500);
    }
  }
  try {
    await salvarArquivoGithub(env, ESTADO_PATH, obj, sha,
      `[auto] Estado do worker`);
  } catch (err) {
    console.warn('Estado salvar:', err.message);
  }
}

// =============================================================
// DATA/HORA HELPERS (timezone BR -3)
// =============================================================
function hojeBR() {
  const agora = new Date();
  const local = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function minutosAteHora(horarioHHMM) {
  if (!horarioHHMM || !/^\d{1,2}:\d{2}$/.test(horarioHHMM)) return null;
  const [h, m] = horarioHHMM.split(':').map(Number);
  const agora = new Date();
  const agoraBR = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  const horaAtual = agoraBR.getUTCHours();
  const minAtual = agoraBR.getUTCMinutes();
  return (h * 60 + m) - (horaAtual * 60 + minAtual);
}

// =============================================================
// TELEGRAM
// =============================================================
async function enviarTelegram(env, mensagem, opcoes = {}) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.log('Telegram não configurado');
    return false;
  }
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
        disable_notification: opcoes.silencioso || false,
      }),
    });
    if (!r.ok) console.warn('Telegram resp:', r.status, await r.text());
    return r.ok;
  } catch (err) {
    console.error('Telegram erro:', err.message);
    return false;
  }
}

// =============================================================
// API-FOOTBALL
// =============================================================
async function buscarFixturesDoDia(env, data, estado) {
  if (!env.API_FOOTBALL_KEY) return [];
  if (estado.cota_api_usada >= COTA_DIARIA_API) return [];
  try {
    const url = `https://v3.football.api-sports.io/fixtures?date=${data}`;
    const r = await fetch(url, { headers: { 'x-apisports-key': env.API_FOOTBALL_KEY } });
    estado.cota_api_usada = (estado.cota_api_usada || 0) + 1;
    if (!r.ok) throw new Error(`${r.status}`);
    const dados = await r.json();
    return parseFixtures(dados.response || []);
  } catch (err) {
    console.error('API fixtures dia:', err.message);
    return [];
  }
}

async function buscarFixturesAoVivo(env, estado) {
  if (!env.API_FOOTBALL_KEY) return [];
  if (estado.cota_api_usada >= COTA_LIMITE_SEGURO) {
    console.warn(`Cota próxima do limite (${estado.cota_api_usada}/${COTA_DIARIA_API})`);
    return null;
  }
  try {
    const url = `https://v3.football.api-sports.io/fixtures?live=all`;
    const r = await fetch(url, { headers: { 'x-apisports-key': env.API_FOOTBALL_KEY } });
    estado.cota_api_usada = (estado.cota_api_usada || 0) + 1;
    if (!r.ok) throw new Error(`${r.status}`);
    const dados = await r.json();
    return dados.response || [];
  } catch (err) {
    console.error('API live:', err.message);
    return [];
  }
}

function parseFixtures(rawList) {
  return rawList.map(item => {
    const status = item.fixture?.status?.short;
    return {
      casa: item.teams?.home?.name || '',
      fora: item.teams?.away?.name || '',
      gols_casa: item.goals?.home ?? null,
      gols_fora: item.goals?.away ?? null,
      gols_casa_ht: item.score?.halftime?.home ?? null,
      gols_fora_ht: item.score?.halftime?.away ?? null,
      status: ['FT','AET','PEN'].includes(status) ? 'finalizado' : 'em_andamento',
      liga: item.league?.name || '',
    };
  });
}

function normalizar(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jogoCombina(jogoStr, casa, fora) {
  const partes = normalizar(jogoStr).split(/ x | vs | - /);
  if (partes.length !== 2) return false;
  const [b1, b2] = partes.map(s => s.trim());
  const cN = normalizar(casa), fN = normalizar(fora);
  const match = (busca, real) => {
    const palavras = busca.split(' ').filter(p => p.length >= 4);
    if (palavras.length === 0) return real.includes(busca);
    return palavras.some(p => real.includes(p));
  };
  return (match(b1, cN) && match(b2, fN)) || (match(b1, fN) && match(b2, cN));
}

function timeContemNome(timeReal, nomeBusca) {
  if (!timeReal || !nomeBusca) return false;
  const real = normalizar(timeReal);
  const busca = normalizar(nomeBusca);
  const palavras = busca.split(' ').filter(p => p.length >= 4);
  if (palavras.length === 0) return real.includes(busca);
  return palavras.some(p => real.includes(p));
}

function encontrarPlacar(jogoStr, fixtures) {
  for (const p of fixtures) {
    if (jogoCombina(jogoStr, p.casa, p.fora)) return p;
  }
  return null;
}

async function carregarRelatorio(env, data) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${RELATORIO_PATH_PREFIX}${data}.json?ref=${env.GITHUB_BRANCH || 'main'}`;
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'analises-trader-worker',
      },
    });
    if (!r.ok) return null;
    const d = await r.json();
    return JSON.parse(atob(d.content.replace(/\s/g, '')));
  } catch {
    return null;
  }
}

function detectarMetodos(entrada) {
  const METODOS = [
    { key: 'back_favorito', label: 'Back Favorito', emoji: '🟢' },
    { key: 'lay_zebra', label: 'Lay Zebra', emoji: '🔴' },
    { key: 'over_limite_70', label: 'Over Limite 70+', emoji: '🟣' },
    { key: 'back_2x2', label: 'Back 2x2', emoji: '🟠' },
    { key: 'back_goleada', label: 'Back Goleada', emoji: '🟡' },
    { key: 'confirmacao_visual', label: 'Confirmação Visual', emoji: '🔵' },
  ];
  return METODOS.filter(m => {
    const obj = entrada[m.key];
    return obj && (obj.aplicavel === true || obj.elegivel === true);
  });
}

// =============================================================
// 1) NOTIFICAR INÍCIO DE JOGO (5min antes)
// =============================================================
async function notificarInicioJogos(env) {
  const { obj: estado, sha: estadoSha } = await carregarEstado(env);
  const hoje = hojeBR();
  const relatorio = await carregarRelatorio(env, hoje);
  if (!relatorio) return { status: 'sem_relatorio' };

  let notificados = 0;
  for (const entrada of relatorio.entradas || []) {
    if (!entrada.horario) continue;
    const min = minutosAteHora(entrada.horario);
    if (min === null || min < 4 || min > 6) continue;

    const chave = `${hoje}::${entrada.jogo}::inicio`;
    if (estado.inicio_jogos_notificados.includes(chave)) continue;

    const linhas = [
      `⏰ <b>Jogo em 5 minutos!</b>`,
      ``,
      `⚽ <b>${escapeHtml(entrada.jogo)}</b>`,
      `📅 ${entrada.horario} · ${escapeHtml(entrada.liga || '')}`,
      ``,
    ];

    const metodos = detectarMetodos(entrada);
    if (metodos.length > 0) {
      linhas.push(`<b>📋 Entradas recomendadas:</b>`);
      for (const m of metodos) {
        const d = entrada[m.key] || {};
        const modo = (d.modo || '').toLowerCase();
        const modoLabel = modo.includes('vivo') ? '🔴 AO VIVO' : '🕐 Pré-jogo';
        linhas.push(``);
        linhas.push(`${m.emoji} <b>${m.label}</b> · ${modoLabel}`);
        if (d.odd_alvo) linhas.push(`   Odd: <b>${d.odd_alvo}</b>`);
        if (d.odd_esperada) linhas.push(`   Odd esperada: <b>${d.odd_esperada}</b>`);
        if (d.stake_recomendada) linhas.push(`   Stake: <b>${d.stake_recomendada}</b>`);
        if (d.gatilho_ao_vivo) linhas.push(`   🎯 Gatilho: <i>${escapeHtml(truncar(d.gatilho_ao_vivo, 150))}</i>`);
        if (d.razao) linhas.push(`   📌 ${escapeHtml(truncar(d.razao, 200))}`);
        if (m.key === 'back_2x2' && d.regra_saida) {
          linhas.push(`   ⚠️ Saída: ${escapeHtml(truncar(d.regra_saida, 150))}`);
        }
      }
    } else if (entrada.mercado_principal) {
      linhas.push(`💡 <b>${escapeHtml(entrada.mercado_principal)}</b> @ ${entrada.odd_principal || '?'}`);
    }

    const plano = entrada.plano_execucao;
    if (plano) {
      linhas.push(``);
      if (plano.abordagem) linhas.push(`🎯 Abordagem: <b>${escapeHtml(plano.abordagem)}</b>`);
      if (plano.hard_stop) linhas.push(`🛑 Hard Stop: ${escapeHtml(truncar(plano.hard_stop, 200))}`);
    }

    const urlSite = env.SITE_URL || 'https://analisefb.pages.dev';
    linhas.push(``);
    linhas.push(`👉 <a href="${urlSite}/relatorio/${hoje}/">Ver no site</a>`);

    await enviarTelegram(env, linhas.join('\n'));
    estado.inicio_jogos_notificados.push(chave);
    notificados++;
  }

  if (notificados > 0) {
    await salvarEstado(env, estado, estadoSha);
  }
  return { status: 'ok', notificados };
}

// =============================================================
// 2) MONITOR AO VIVO (gatilhos)
// =============================================================
async function rodarMonitorAoVivo(env) {
  const { obj: estado, sha: estadoSha } = await carregarEstado(env);
  const hoje = hojeBR();
  const relatorio = await carregarRelatorio(env, hoje);
  if (!relatorio) return { status: 'sem_relatorio' };

  const monitoraveis = (relatorio.entradas || []).filter(e =>
    (e.over_limite_70 && (e.over_limite_70.aplicavel || e.over_limite_70.elegivel)) ||
    (e.lay_zebra && (e.lay_zebra.aplicavel || e.lay_zebra.elegivel)) ||
    (e.back_favorito && (e.back_favorito.aplicavel || e.back_favorito.elegivel))
  );
  if (monitoraveis.length === 0) return { status: 'sem_jogos_monitoraveis' };

  const aoVivo = await buscarFixturesAoVivo(env, estado);
  if (aoVivo === null) return { status: 'cota_esgotada', cota: estado.cota_api_usada };
  if (aoVivo.length === 0) {
    await salvarEstado(env, estado, estadoSha);
    return { status: 'nenhum_jogo_ao_vivo', cota: estado.cota_api_usada };
  }

  let alertas = 0;

  for (const entrada of monitoraveis) {
    const match = aoVivo.find(j => {
      try {
        return jogoCombina(entrada.jogo, j.teams.home.name, j.teams.away.name);
      } catch { return false; }
    });
    if (!match) continue;

    const elapsed = match.fixture?.status?.elapsed || 0;
    const status = match.fixture?.status?.short || '';
    const gc = match.goals?.home || 0;
    const gf = match.goals?.away || 0;
    const casa = match.teams.home.name;
    const fora = match.teams.away.name;
    const placar = `${gc}x${gf}`;

    if (!['1H','2H','LIVE','ET','HT'].includes(status)) continue;

    // GATILHO 1: Over Limite 70+ (favorito 2 gols após 70min)
    if (entrada.over_limite_70 && (entrada.over_limite_70.aplicavel || entrada.over_limite_70.elegivel)) {
      const chave = `${hoje}::${entrada.jogo}::over_limite_70`;
      if (!estado.gatilhos_ao_vivo_notificados.includes(chave)) {
        if (elapsed >= 70 && status === '2H' && Math.abs(gc - gf) >= 2) {
          const favorito = gc > gf ? casa : fora;
          const linhaMin = Math.max(gc + gf, 2);
          await enviarTelegram(env,
            `🚨 <b>GATILHO: OVER LIMITE 70+</b>\n` +
            `⚽ ${escapeHtml(entrada.jogo)}\n` +
            `📊 ${placar} aos ${elapsed}min\n` +
            `🏆 ${escapeHtml(favorito)} vencendo por 2\n` +
            `💡 <b>Apostar: Mais ${linhaMin}.5 gols</b>\n` +
            `📈 Odd esperada: 1.60-2.20`
          );
          estado.gatilhos_ao_vivo_notificados.push(chave);
          alertas++;
        }
      }
    }

    // GATILHO 2: Lay Zebra após gol da zebra
    if (entrada.lay_zebra && (entrada.lay_zebra.aplicavel || entrada.lay_zebra.elegivel)) {
      const chave = `${hoje}::${entrada.jogo}::lay_zebra_apos_gol`;
      if (!estado.gatilhos_ao_vivo_notificados.includes(chave)) {
        const nomeZebra = entrada.lay_zebra.zebra || '';
        const zebraEhCasa = timeContemNome(casa, nomeZebra);
        const zebraEhFora = timeContemNome(fora, nomeZebra);
        const zebraComGol = (zebraEhCasa && gc > 0) || (zebraEhFora && gf > 0);
        // Disparar antes dos 70min pra ter tempo de reação
        if (zebraComGol && elapsed >= 5 && elapsed < 70) {
          await enviarTelegram(env,
            `🚨 <b>GATILHO: LAY ZEBRA APÓS GOL</b>\n` +
            `⚽ ${escapeHtml(entrada.jogo)}\n` +
            `📊 ${placar} aos ${elapsed}min\n` +
            `🎯 Zebra (${escapeHtml(nomeZebra)}) marcou\n` +
            `💡 <b>Entrar Lay Zebra ao vivo</b> — odd inflada\n` +
            `📈 Stake: ${escapeHtml(entrada.lay_zebra.stake_recomendada || '2%')}`
          );
          estado.gatilhos_ao_vivo_notificados.push(chave);
          alertas++;
        }
      }
    }

    // GATILHO 3: Back Favorito após gol contra o favorito
    if (entrada.back_favorito && (entrada.back_favorito.aplicavel || entrada.back_favorito.elegivel)) {
      const chave = `${hoje}::${entrada.jogo}::back_favorito_apos_gol_contra`;
      if (!estado.gatilhos_ao_vivo_notificados.includes(chave)) {
        const nomeFav = entrada.back_favorito.favorito || '';
        const favEhCasa = timeContemNome(casa, nomeFav);
        const favEhFora = timeContemNome(fora, nomeFav);
        // Favorito perdendo ou empatado APÓS o adversário marcar
        const favPerdendo = (favEhCasa && gc < gf) || (favEhFora && gf < gc);
        const favEmpatadoComGol = (favEhCasa || favEhFora) && gc === gf && (gc + gf) >= 2;
        const cenario = favPerdendo || favEmpatadoComGol;
        if (cenario && elapsed >= 10 && elapsed < 65) {
          await enviarTelegram(env,
            `🚨 <b>GATILHO: BACK FAVORITO APÓS GOL CONTRA</b>\n` +
            `⚽ ${escapeHtml(entrada.jogo)}\n` +
            `📊 ${placar} aos ${elapsed}min\n` +
            `🎯 Favorito (${escapeHtml(nomeFav)}) em desvantagem\n` +
            `💡 <b>Entrada barata em Back Favorito</b> — odd subiu\n` +
            `📈 Stake: ${escapeHtml(entrada.back_favorito.stake_recomendada || '2%')}`
          );
          estado.gatilhos_ao_vivo_notificados.push(chave);
          alertas++;
        }
      }
    }
  }

  await salvarEstado(env, estado, estadoSha);
  return { status: 'ok', alertas, cota: estado.cota_api_usada };
}

// =============================================================
// 3) AUDITORIA (Green/Red de trades + jogos do dia)
// =============================================================
async function rodarAuditoria(env) {
  if (!env.API_FOOTBALL_KEY) return { erro: 'API_FOOTBALL_KEY ausente' };

  const { obj: estado, sha: estadoSha } = await carregarEstado(env);
  const hoje = hojeBR();

  const { trades, sha: tradesSha } = await lerArquivoGithub(env, TRADES_PATH);
  const tradesPendentes = trades.filter(t => !t.resultado || t.resultado === 'pendente');

  const relatorio = await carregarRelatorio(env, hoje);
  const entradasJogos = relatorio ? (relatorio.entradas || []) : [];

  // Datas únicas
  const datas = new Set();
  for (const t of tradesPendentes) datas.add(t.data);
  if (entradasJogos.length > 0) datas.add(hoje);

  if (datas.size === 0) return { status: 'nada_a_auditar' };

  // Busca placares
  let placaresPorData = {};
  for (const data of datas) {
    placaresPorData[data] = await buscarFixturesDoDia(env, data, estado);
  }

  // 1. Auditar trades registrados
  let tradesAtualizados = 0;
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    if (t.resultado && t.resultado !== 'pendente') continue;
    const placar = encontrarPlacar(t.jogo, placaresPorData[t.data] || []);
    if (!placar || placar.status !== 'finalizado') continue;

    const veredito = auditarPorMetodoTrade(t, placar);
    if (veredito.resultado === 'inconclusivo') continue;

    trades[i] = {
      ...t,
      resultado: veredito.resultado,
      placar_final: `${placar.gols_casa}x${placar.gols_fora}`,
      placar_ht: `${placar.gols_casa_ht}x${placar.gols_fora_ht}`,
      auditado_em: new Date().toISOString(),
      auditoria_motivo: veredito.motivo,
    };
    tradesAtualizados++;

    const emoji = veredito.resultado === 'green' ? '✅' : '❌';
    const label = veredito.resultado === 'green' ? 'GREEN' : 'RED';
    const lucroEst = veredito.resultado === 'green'
      ? t.stake_pct * (t.odd_entrada - 1)
      : -t.stake_pct;
    const lucroStr = (lucroEst >= 0 ? '+' : '') + (Math.round(lucroEst * 100) / 100) + 'u';
    await enviarTelegram(env,
      `${emoji} <b>${label}</b> · ${escapeHtml(t.jogo)}\n` +
      `🎯 ${escapeHtml(t.metodo)} · Placar ${placar.gols_casa}x${placar.gols_fora}\n` +
      `💰 Stake ${t.stake_pct}% @ ${t.odd_entrada} · <b>${lucroStr}</b>\n` +
      `<i>${escapeHtml(veredito.motivo)}</i>`
    );
  }

  // 2. Auditar jogos do relatório que NÃO têm trade registrado
  let cashOutsJogos = 0;
  for (const entrada of entradasJogos) {
    const chaveJogo = `${hoje}::${entrada.jogo}`;
    if (estado.cash_out_notificados.includes(chaveJogo)) continue;

    const placar = encontrarPlacar(entrada.jogo, placaresPorData[hoje] || []);
    if (!placar || placar.status !== 'finalizado') continue;

    const jaTemTrade = trades.some(t =>
      t.data === hoje && normalizar(t.jogo) === normalizar(entrada.jogo)
    );
    if (jaTemTrade) {
      estado.cash_out_notificados.push(chaveJogo);
      continue;
    }

    const metodos = detectarMetodos(entrada);
    if (metodos.length === 0) continue;

    const resultados = metodos
      .map(m => ({ ...m, ...auditarMetodoNominal(m.key, entrada, placar) }))
      .filter(r => r.resultado !== 'inconclusivo');
    if (resultados.length === 0) continue;

    const linhas = [
      `🏁 <b>Jogo encerrado:</b> ${escapeHtml(entrada.jogo)}`,
      `📊 Placar final: <b>${placar.gols_casa}x${placar.gols_fora}</b>`,
      ``,
    ];
    for (const r of resultados) {
      const emoji = r.resultado === 'green' ? '✅' : '❌';
      const label = r.resultado === 'green' ? 'GREEN' : 'RED';
      linhas.push(`${emoji} <b>${label}</b> ${r.emoji} ${escapeHtml(r.label)}`);
      linhas.push(`   <i>${escapeHtml(r.motivo)}</i>`);
    }
    await enviarTelegram(env, linhas.join('\n'));
    estado.cash_out_notificados.push(chaveJogo);
    cashOutsJogos++;
  }

  // Salva
  if (tradesAtualizados > 0) {
    await salvarArquivoGithub(env, TRADES_PATH, trades, tradesSha,
      `Auditoria: ${tradesAtualizados} trade(s)`);
  }
  await salvarEstado(env, estado, estadoSha);

  return {
    status: 'ok',
    trades_atualizados: tradesAtualizados,
    cash_outs_jogos: cashOutsJogos,
    cota: estado.cota_api_usada,
  };
}

// Auditoria pra um trade registrado (faz lookup nos campos do trade)
function auditarPorMetodoTrade(trade, placar) {
  const metodo = (trade.metodo || '').toLowerCase();
  if (placar.gols_casa === null || placar.gols_fora === null) {
    return { resultado: 'inconclusivo', motivo: 'sem placar finalizado' };
  }
  // Mapeia método do trade pra função nominal
  if (metodo.includes('back favorito')) {
    // Tenta inferir favorito do mercado (ex: "Vitória Bayern")
    const fav = extrairTimeDoMercado(trade.mercado) || placar.casa;
    return auditarMetodoNominal('back_favorito', { back_favorito: { favorito: fav } }, placar);
  }
  if (metodo.includes('lay zebra')) {
    const zebra = extrairTimeDoMercado(trade.mercado) || placar.fora;
    return auditarMetodoNominal('lay_zebra', { lay_zebra: { zebra } }, placar);
  }
  if (metodo.includes('over limite') || metodo.includes('over 70')) {
    return auditarMetodoNominal('over_limite_70', {}, placar, trade.mercado);
  }
  if (metodo.includes('2x2')) {
    return auditarMetodoNominal('back_2x2', {}, placar);
  }
  if (metodo.includes('goleada')) {
    return auditarMetodoNominal('back_goleada', {}, placar);
  }
  if (metodo.includes('confirmação visual') || metodo.includes('confirmacao visual')) {
    return { resultado: 'inconclusivo', motivo: 'Confirmação Visual: marcar manualmente' };
  }
  return { resultado: 'inconclusivo', motivo: `método '${trade.metodo}' sem regra` };
}

function extrairTimeDoMercado(mercado) {
  if (!mercado) return null;
  const m = mercado.match(/(?:vit[óo]ria|back|lay)\s+([\w\sçãáàâéêíóôõú-]+)/i);
  return m ? m[1].trim() : null;
}

// Auditoria genérica por nome do método
function auditarMetodoNominal(key, entrada, placar, mercadoStr = '') {
  const gc = placar.gols_casa, gf = placar.gols_fora;
  const casa = placar.casa, fora = placar.fora;

  switch (key) {
    case 'back_favorito': {
      const fav = entrada.back_favorito?.favorito;
      if (!fav) return { resultado: 'inconclusivo', motivo: 'favorito não identificado' };
      if (timeContemNome(casa, fav)) {
        return gc > gf
          ? { resultado: 'green', motivo: `${casa} venceu ${gc}x${gf}` }
          : { resultado: 'red', motivo: `${casa} não venceu (${gc}x${gf})` };
      }
      if (timeContemNome(fora, fav)) {
        return gf > gc
          ? { resultado: 'green', motivo: `${fora} venceu ${gc}x${gf}` }
          : { resultado: 'red', motivo: `${fora} não venceu (${gc}x${gf})` };
      }
      return { resultado: 'inconclusivo', motivo: 'favorito não casou com nomes' };
    }
    case 'lay_zebra': {
      const zebra = entrada.lay_zebra?.zebra;
      if (!zebra) return { resultado: 'inconclusivo', motivo: 'zebra não identificada' };
      if (timeContemNome(casa, zebra)) {
        return gc > gf
          ? { resultado: 'red', motivo: `Zebra ${casa} venceu (${gc}x${gf})` }
          : { resultado: 'green', motivo: `Zebra ${casa} não venceu (${gc}x${gf})` };
      }
      if (timeContemNome(fora, zebra)) {
        return gf > gc
          ? { resultado: 'red', motivo: `Zebra ${fora} venceu (${gc}x${gf})` }
          : { resultado: 'green', motivo: `Zebra ${fora} não venceu (${gc}x${gf})` };
      }
      return { resultado: 'inconclusivo', motivo: 'zebra não casou' };
    }
    case 'over_limite_70': {
      const m = (mercadoStr || '').toLowerCase().match(/mais\s*(\d+)[.,]?5/);
      const linha = m ? parseInt(m[1]) : 2;
      const total = gc + gf;
      return total > linha
        ? { resultado: 'green', motivo: `${total} gols (Mais ${linha}.5)` }
        : { resultado: 'red', motivo: `${total} gols (Mais ${linha}.5)` };
    }
    case 'back_2x2': {
      if (gc === 2 && gf === 2) {
        return { resultado: 'green', motivo: 'Placar 2x2 (alvo bateu)' };
      }
      if (gc >= 1 && gf >= 1) {
        return { resultado: 'green', motivo: `Passou por 1x1 (final ${gc}x${gf}) — cash-out` };
      }
      return { resultado: 'red', motivo: `Não passou por 1x1 (final ${gc}x${gf})` };
    }
    case 'back_goleada': {
      const venceuCom4 = (gc >= 4 && gc > gf) || (gf >= 4 && gf > gc);
      return venceuCom4
        ? { resultado: 'green', motivo: `Goleada (${gc}x${gf})` }
        : { resultado: 'red', motivo: `Sem goleada (${gc}x${gf})` };
    }
    default:
      return { resultado: 'inconclusivo', motivo: 'método não auditável' };
  }
}

// =============================================================
// 4) RESUMO DIÁRIO (23:59)
// =============================================================
async function enviarResumoDiario(env) {
  const { obj: estado, sha: estadoSha } = await carregarEstado(env);
  const hoje = hojeBR();

  const { trades } = await lerArquivoGithub(env, TRADES_PATH);
  const tradesDia = trades.filter(t => t.data === hoje && (t.resultado === 'green' || t.resultado === 'red'));

  const plDia = tradesDia.reduce((acc, t) => {
    return t.resultado === 'green'
      ? acc + (t.stake_pct * (t.odd_entrada - 1))
      : acc - t.stake_pct;
  }, 0);
  const greensDia = tradesDia.filter(t => t.resultado === 'green').length;
  const redsDia = tradesDia.length - greensDia;

  const mesAtual = hoje.slice(0, 7);
  const tradesMes = trades.filter(t => t.data.startsWith(mesAtual) && (t.resultado === 'green' || t.resultado === 'red'));
  const plMes = tradesMes.reduce((acc, t) => {
    return t.resultado === 'green'
      ? acc + (t.stake_pct * (t.odd_entrada - 1))
      : acc - t.stake_pct;
  }, 0);
  const greensMes = tradesMes.filter(t => t.resultado === 'green').length;
  const redsMes = tradesMes.length - greensMes;

  // Por método (dia)
  const porMetodoDia = {};
  for (const t of tradesDia) {
    if (!porMetodoDia[t.metodo]) porMetodoDia[t.metodo] = { g: 0, r: 0, pl: 0 };
    if (t.resultado === 'green') {
      porMetodoDia[t.metodo].g++;
      porMetodoDia[t.metodo].pl += t.stake_pct * (t.odd_entrada - 1);
    } else {
      porMetodoDia[t.metodo].r++;
      porMetodoDia[t.metodo].pl -= t.stake_pct;
    }
  }

  const fmtPl = v => (v >= 0 ? '+' : '') + (Math.round(v * 100) / 100) + 'u';
  const emojiPl = v => v > 0 ? '📈' : v < 0 ? '📉' : '➡️';

  const linhas = [
    `📊 <b>RESUMO DO DIA — ${hoje}</b>`,
    ``,
    `${emojiPl(plDia)} <b>PL do dia:</b> ${fmtPl(plDia)}`,
  ];

  if (tradesDia.length === 0) {
    linhas.push(`<i>Nenhum trade registrado hoje.</i>`);
  } else {
    linhas.push(`✅ <b>${greensDia}</b> Green · ❌ <b>${redsDia}</b> Red · (${tradesDia.length} trades)`);
    const taxa = Math.round((greensDia / tradesDia.length) * 100);
    linhas.push(`🎯 Taxa de acerto: ${taxa}%`);

    if (Object.keys(porMetodoDia).length > 0) {
      linhas.push(``);
      linhas.push(`<b>Por método:</b>`);
      for (const [met, d] of Object.entries(porMetodoDia).sort((a, b) => b[1].pl - a[1].pl)) {
        linhas.push(`• ${escapeHtml(met)}: ${d.g}G/${d.r}R · ${fmtPl(d.pl)}`);
      }
    }
  }

  linhas.push(``);
  linhas.push(`━━━━━━━━━━━━━━━━━━━━`);
  linhas.push(`<b>📅 MÊS (${mesAtual}):</b>`);
  linhas.push(`${emojiPl(plMes)} <b>PL acumulado:</b> ${fmtPl(plMes)}`);
  if (tradesMes.length > 0) {
    const taxaMes = Math.round((greensMes / tradesMes.length) * 100);
    linhas.push(`✅ ${greensMes}G · ❌ ${redsMes}R · ${tradesMes.length} trades · 🎯 ${taxaMes}%`);
  }

  linhas.push(``);
  const urlSite = env.SITE_URL || 'https://analisefb.pages.dev';
  linhas.push(`👉 <a href="${urlSite}/auditoria/">Ver auditoria completa</a>`);

  await enviarTelegram(env, linhas.join('\n'));
  estado.resumo_dia_enviado = true;
  await salvarEstado(env, estado, estadoSha);
  return { status: 'ok', pl_dia: plDia, pl_mes: plMes, trades_dia: tradesDia.length };
}

// =============================================================
// HELPERS
// =============================================================
function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncar(s, max) {
  if (!s) return '';
  s = String(s);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
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
  if (!r.ok) throw new Error(`GitHub leitura: ${r.status}`);
  const dados = await r.json();
  const conteudo = atob(dados.content.replace(/\s/g, ''));
  let trades = [];
  try {
    const parsed = JSON.parse(conteudo);
    trades = Array.isArray(parsed) ? parsed : (parsed.trades || []);
  } catch { trades = []; }
  return { trades, sha: dados.sha };
}

async function salvarArquivoGithub(env, path, conteudo, sha, mensagem) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const json = JSON.stringify(conteudo, null, 2);
  const b64 = btoa(unescape(encodeURIComponent(json)));
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

function resposta(corpo, status, corsHeaders) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
