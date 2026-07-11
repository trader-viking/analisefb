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
      if (path === '/live' && method === 'POST') {
        // Roda a checagem de gatilhos live manualmente (debug/teste)
        const resultado = await verificarGatilhosLive(env);
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
          minuto: p.minuto, // minuto atual do jogo (só em_andamento)
          fixture_id: p.fixture_id, // pra /eventos e /odds
        }));
        const corpo = { data, placares: simples, cache: false };

        // Salva no cache por 10 minutos
        const respCache = new Response(JSON.stringify(corpo), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=600' },
        });
        await cache.put(cacheKey, respCache.clone());

        return resposta(corpo, 200, corsHeaders);
      }
      if (path === '/sofascore' && method === 'GET') {
        // RADAR AO VIVO: resolve o ID da partida no SofaScore pelo nome
        // do jogo, pro site embutir o widget de Attack Momentum.
        // GET /sofascore?jogo=Time+A+x+Time+B → { event_id } | { event_id: null }
        // Cache de 24h (o ID não muda). Obs: usa a API pública não
        // documentada do SofaScore — se mudar, o radar some do card mas
        // nada mais quebra.
        const jogo = url.searchParams.get('jogo') || '';
        if (!jogo || jogo.length < 5) {
          return resposta({ erro: 'jogo invalido' }, 400, corsHeaders);
        }
        const cacheKey = new Request(`https://cache.local/sofascore?jogo=${encodeURIComponent(jogo.toLowerCase())}`);
        const cacheSS = caches.default;
        const cachedSS = await cacheSS.match(cacheKey);
        if (cachedSS) {
          return resposta(await cachedSS.json(), 200, corsHeaders);
        }
        let eventId = null;
        try {
          eventId = await buscarEventoSofascore(jogo);
        } catch (e) {
          console.log('sofascore falhou:', e.message);
        }
        const corpo = { jogo, event_id: eventId };
        await cacheSS.put(cacheKey, new Response(JSON.stringify(corpo), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=86400' },
        }));
        return resposta(corpo, 200, corsHeaders);
      }
      if (path === '/eventos' && method === 'GET') {
        // Melhoria #5: linha do tempo dos gols de uma partida.
        // GET /eventos?fixture_id=12345 → { gols: [{minuto, time, jogador}] }
        // Cache de 5min (o suficiente pra acompanhar Over Limite ao vivo
        // sem estourar a cota da API-Football).
        const fixtureId = url.searchParams.get('fixture_id');
        if (!fixtureId || !/^\d+$/.test(fixtureId)) {
          return resposta({ erro: 'fixture_id invalido' }, 400, corsHeaders);
        }
        const cacheKey = new Request(`https://cache.local/eventos?fixture_id=${fixtureId}`);
        const cache = caches.default;
        const cached = await cache.match(cacheKey);
        if (cached) {
          const corpo = await cached.json();
          return resposta({ ...corpo, cache: true }, 200, corsHeaders);
        }
        const gols = await buscarGolsDaPartida(env, fixtureId);
        const corpo = { fixture_id: Number(fixtureId), gols, cache: false };
        const respCache = new Response(JSON.stringify(corpo), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' },
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

  // Cron triggers (wrangler.toml):
  //   "0 * * * *"    → auditoria + snapshot de odds (como antes)
  //   "*/10 * * * *" → gatilhos LIVE (leve: 1 req de placares com cache
  //                    + até MAX_STATS_CALLS_POR_RUN de estatísticas)
  async scheduled(event, env, ctx) {
    console.log('Cron triggered:', event.cron);

    // Cron de 10min → só a checagem live (rápida e barata)
    if (event.cron === '*/10 * * * *') {
      try {
        const r = await verificarGatilhosLive(env);
        console.log('Gatilhos live:', JSON.stringify(r));
      } catch (err) {
        console.error('Erro nos gatilhos live:', err.message);
      }
      return;
    }

    // Cron horário → auditoria completa + snapshot de odds
    try {
      const resultado = await rodarAuditoria(env);
      console.log('Auditoria concluída:', JSON.stringify(resultado));
    } catch (err) {
      console.error('Erro na auditoria:', err.message);
    }
    // Melhoria #10: snapshot da odd atual das entradas de hoje
    // (gera o mini-gráfico "abriu 11.00 → agora 10.50" no site)
    try {
      const n = await snapshotOddsNosRelatorios(env);
      console.log('Snapshot de odds:', n ? 'relatorio atualizado' : 'sem mudanças');
    } catch (err) {
      console.error('Erro no snapshot de odds:', err.message);
    }
    // Gatilhos live também na virada da hora (cobre o caso de o cron de
    // 10min não estar configurado no wrangler.toml)
    try {
      const r = await verificarGatilhosLive(env);
      console.log('Gatilhos live (hora cheia):', JSON.stringify(r));
    } catch (err) {
      console.error('Erro nos gatilhos live:', err.message);
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

    // Melhoria #1 (rede de segurança): bloqueia lays que contradizem
    // Poisson caso algum tenha sido publicado sem passar pela trava do
    // main.py (relatório antigo, edição manual, etc).
    let mudou = false;
    try {
      if (bloquearLaysContraPoisson(relatorio)) mudou = true;
    } catch (err) {
      console.error('Erro no bloqueio Poisson:', err.message);
    }

    // Cruza cada entrada com o placar e grava
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

      // AUDITORIA AUTOMÁTICA DO VEREDITO: quando o jogo finaliza,
      // marca green/red na entrada direto no JSON do relatório
      // (pro card do site mostrar ✅/❌ sem depender do endpoint /trades).
      if (novoStatus === 'finalizado' && novoPlacar && !entrada._veredito) {
        const gc = placar.gols_casa;
        const gf = placar.gols_fora;
        const metodos = entrada.metodos_aplicados || [];
        // Pega o método principal (primeiro da lista rankeada)
        const principal = metodos[0] || '';
        let veredito = null;
        let motivo = null;

        // LAY 1×0: qualquer placar ≠ 1×0 = green
        if (principal === 'lay_1x0') {
          if (gc === 1 && gf === 0) {
            veredito = 'red'; motivo = `Placar final 1×0 — lay perdido`;
          } else {
            veredito = 'green'; motivo = `Placar final ${gc}×${gf} (não foi 1×0) — green`;
          }
        }
        // LAY 0×1: qualquer placar ≠ 0×1 = green
        else if (principal === 'lay_0x1') {
          if (gc === 0 && gf === 1) {
            veredito = 'red'; motivo = `Placar final 0×1 — lay perdido`;
          } else {
            veredito = 'green'; motivo = `Placar final ${gc}×${gf} (não foi 0×1) — green`;
          }
        }
        // OVER LIMITE: total de gols > linha apostada = green
        else if (principal === 'over_limite_70') {
          const merc = (entrada.mercado_principal || '').toLowerCase();
          const m = merc.match(/mais\s*(\d+)[.,]?5/);
          if (m) {
            const linha = parseInt(m[1]);
            if (gc + gf > linha) {
              veredito = 'green'; motivo = `${gc + gf} gols (Mais ${linha}.5 batido)`;
            } else {
              veredito = 'red'; motivo = `${gc + gf} gols (Mais ${linha}.5 não batido)`;
            }
          }
        }
        // BACK FAVORITO: favorito venceu = green
        else if (principal === 'back_favorito') {
          const merc = (entrada.mercado_principal || '').toLowerCase();
          const casaNorm = (placar.casa || '').toLowerCase().split(' ')[0];
          const foraNorm = (placar.fora || '').toLowerCase().split(' ')[0];
          if (casaNorm && merc.includes(casaNorm)) {
            veredito = gc > gf ? 'green' : 'red';
            motivo = gc > gf ? `Casa venceu ${gc}×${gf}` : `Casa não venceu (${gc}×${gf})`;
          } else if (foraNorm && merc.includes(foraNorm)) {
            veredito = gf > gc ? 'green' : 'red';
            motivo = gf > gc ? `Fora venceu ${gc}×${gf}` : `Fora não venceu (${gc}×${gf})`;
          }
        }
        // LAY ZEBRA: zebra NÃO venceu = green
        else if (principal === 'lay_zebra') {
          const merc = (entrada.mercado_principal || '').toLowerCase();
          const casaNorm = (placar.casa || '').toLowerCase().split(' ')[0];
          const foraNorm = (placar.fora || '').toLowerCase().split(' ')[0];
          if (casaNorm && merc.includes(casaNorm)) {
            veredito = gc > gf ? 'red' : 'green';
            motivo = gc > gf ? `Casa (zebra) venceu ${gc}×${gf}` : `Casa não venceu (${gc}×${gf})`;
          } else if (foraNorm && merc.includes(foraNorm)) {
            veredito = gf > gc ? 'red' : 'green';
            motivo = gf > gc ? `Fora (zebra) venceu ${gc}×${gf}` : `Fora não venceu (${gc}×${gf})`;
          }
        }
        // BACK 2x2: ambos marcaram = green (passaram por 1x1 → cash-out)
        else if (principal === 'back_2x2') {
          veredito = (gc >= 1 && gf >= 1) ? 'green' : 'red';
          motivo = (gc >= 1 && gf >= 1)
            ? `Passou por 1×1 (final ${gc}×${gf}) — cash-out`
            : `Não passou por 1×1 (final ${gc}×${gf})`;
        }
        // BACK GOLEADA: 4+ gols de um lado = green
        else if (principal === 'back_goleada') {
          const goleada = (gc >= 4 && gc > gf) || (gf >= 4 && gf > gc);
          veredito = goleada ? 'green' : 'red';
          motivo = goleada ? `Goleada ${gc}×${gf}` : `Sem goleada (${gc}×${gf})`;
        }

        if (veredito) {
          entrada._veredito = veredito;
          entrada._veredito_motivo = motivo;
          entrada._veredito_em = new Date().toISOString();
          mudou = true;
          console.log(`Veredito: ${entrada.jogo} — ${principal} → ${veredito.toUpperCase()} (${motivo})`);
        }
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
      // Melhoria #3: minuto atual do jogo (pra badge "2-1 · 67'")
      minuto: item.fixture?.status?.elapsed ?? null,
      // Melhoria #5/#10: id do fixture na API-Football (pra buscar
      // eventos de gols e odds atuais desse jogo específico)
      fixture_id: item.fixture?.id ?? null,
    });
  }
  return placares;
}

// =============================================================
// Melhoria #5 — Eventos de gols de uma partida (linha do tempo)
// =============================================================
async function buscarGolsDaPartida(env, fixtureId) {
  const url = `https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`;
  const r = await fetch(url, { headers: { 'x-apisports-key': env.API_FOOTBALL_KEY } });
  if (!r.ok) throw new Error(`API-Football eventos: ${r.status}`);
  const dados = await r.json();
  const gols = [];
  for (const ev of dados.response || []) {
    if (ev.type !== 'Goal') continue;
    // Ignora gols anulados (VAR)
    if ((ev.detail || '').toLowerCase().includes('cancelled')) continue;
    gols.push({
      minuto: (ev.time?.elapsed ?? 0) + (ev.time?.extra ? ev.time.extra : 0),
      minuto_base: ev.time?.elapsed ?? 0,
      acrescimo: ev.time?.extra ?? 0,
      time: ev.team?.name || '',
      jogador: ev.player?.name || '',
      tipo: ev.detail || 'Normal Goal', // Normal Goal | Own Goal | Penalty
    });
  }
  gols.sort((a, b) => a.minuto - b.minuto);
  return gols;
}

// =============================================================
// Melhoria #1 — Rede de segurança: bloqueia Lay 1×0/0×1 já
// publicados que contradizem Poisson (mesma conta do site).
// O main.py bloqueia ANTES de publicar; isto aqui pega qualquer
// relatório que tenha passado (versão antiga, edição manual, etc).
// =============================================================
function poissonTopPlacares(mc, mf, n = 4, maxGols = 5) {
  const fat = [1, 1, 2, 6, 24, 120];
  const grid = [];
  for (let gc = 0; gc <= maxGols; gc++) {
    const pc = Math.pow(mc, gc) * Math.exp(-mc) / fat[gc];
    for (let gf = 0; gf <= maxGols; gf++) {
      const pf = Math.pow(mf, gf) * Math.exp(-mf) / fat[gf];
      grid.push({ gc, gf, prob_pct: pc * pf * 100 });
    }
  }
  grid.sort((a, b) => b.prob_pct - a.prob_pct);
  return grid.slice(0, n);
}

function parseNumero(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return null;
  const m = String(v).match(/(-?\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

function bloquearLaysContraPoisson(relatorio) {
  const LIMIAR = 12; // %
  let mudou = false;
  for (const entrada of relatorio.entradas || []) {
    const mc = parseNumero(entrada.media_gols_casa);
    const mf = parseNumero(entrada.media_gols_fora);
    if (mc === null || mf === null || mc < 0 || mf < 0) continue;
    const top4 = poissonTopPlacares(mc, mf, 4);
    for (const metodo of ['lay_1x0', 'lay_0x1']) {
      const sub = entrada[metodo];
      if (!sub || typeof sub !== 'object' || !sub.aplicavel || sub._bloqueado_poisson) continue;
      const alvo = metodo === 'lay_1x0' ? { gc: 1, gf: 0 } : { gc: 0, gf: 1 };
      const hit = top4.find((p) => p.gc === alvo.gc && p.gf === alvo.gf && p.prob_pct > LIMIAR);
      if (!hit) continue;
      const placar = `${alvo.gc}x${alvo.gf}`;
      sub.aplicavel = false;
      sub._bloqueado_poisson = true;
      sub._prob_poisson_pct = Math.round(hit.prob_pct * 10) / 10;
      sub.razao_reprovacao = `BLOQUEADO pelo worker: ${placar} está entre os 4 placares ` +
        `mais prováveis por Poisson (${hit.prob_pct.toFixed(0)}% > ${LIMIAR}%)`;
      if (Array.isArray(entrada.metodos_aplicados)) {
        entrada.metodos_aplicados = entrada.metodos_aplicados.filter((m) => m !== metodo);
      }
      console.log(`Bloqueio Poisson: ${entrada.jogo} — ${metodo} (${hit.prob_pct.toFixed(0)}%)`);
      mudou = true;
    }
  }
  return mudou;
}

// =============================================================
// Melhoria #10 — Snapshot de odds (histórico de odds por entrada)
// Roda no cron: pra cada entrada de HOJE ainda não finalizada com
// fixture identificado, busca a odd atual do mercado do método
// principal na API-Football e anexa em entrada._odds_historico.
// Limite de chamadas por execução pra proteger a cota do plano free.
// =============================================================
const MAX_ODDS_CALLS_POR_RUN = 8;
const MAX_PONTOS_HISTORICO = 24;

async function buscarOddAtual(env, fixtureId, mercadoPrincipal) {
  // /odds?fixture=ID retorna bookmakers -> bets -> values
  const url = `https://v3.football.api-sports.io/odds?fixture=${fixtureId}`;
  const r = await fetch(url, { headers: { 'x-apisports-key': env.API_FOOTBALL_KEY } });
  if (!r.ok) return null;
  const dados = await r.json();
  const resp = dados.response?.[0];
  if (!resp) return null;

  const merc = (mercadoPrincipal || '').toLowerCase();
  // Que bet procurar e qual value dentro dela?
  // Lay 1x0 / Lay 0x1 → "Exact Score" value "1:0"/"0:1" (odd de BACK do
  // placar; é a referência usada pra decidir o lay).
  // Vitória X → "Match Winner" Home/Away (aproximação: Home).
  // Over/Mais X.5 → "Goals Over/Under" value "Over X.5".
  let betNome = null, valorAlvo = null;
  let mLay = merc.match(/lay\s*(\d)\s*[x×]\s*(\d)/);
  let mOver = merc.match(/(?:over|mais)\s*(\d+)[.,]5/);
  if (mLay) {
    betNome = /exact score|correct score/i;
    valorAlvo = `${mLay[1]}:${mLay[2]}`;
  } else if (mOver) {
    betNome = /goals over\/under/i;
    valorAlvo = `Over ${mOver[1]}.5`;
  } else if (merc.startsWith('vit') || merc.includes('vitoria') || merc.includes('vitória')) {
    betNome = /match winner/i;
    valorAlvo = 'Home'; // aproximação; o favorito costuma ser o mandante
  } else {
    return null; // mercado sem mapeamento — não gasta cota à toa
  }

  for (const bk of resp.bookmakers || []) {
    for (const bet of bk.bets || []) {
      if (!betNome.test(bet.name || '')) continue;
      const v = (bet.values || []).find((x) => String(x.value) === valorAlvo);
      if (v && v.odd) return parseFloat(v.odd);
    }
  }
  return null;
}

async function snapshotOddsNosRelatorios(env) {
  const hoje = new Date().toISOString().slice(0, 10);
  const path = `${ENTRADAS_PATH_PREFIX}${hoje}.json`;
  let relatorioRaw, sha;
  try {
    const res = await lerArquivoGithubGenerico(env, path);
    relatorioRaw = res.conteudo;
    sha = res.sha;
  } catch { return 0; }
  if (!relatorioRaw || !sha) return 0;

  let relatorio;
  try { relatorio = JSON.parse(relatorioRaw); } catch { return 0; }
  if (!Array.isArray(relatorio.entradas)) return 0;

  // Precisa dos fixtures do dia pra casar jogo → fixture_id
  let placares;
  try { placares = await buscarPlacaresDoDia(env, hoje); } catch { return 0; }

  let chamadas = 0;
  let mudou = false;
  const agora = new Date().toISOString();

  for (const entrada of relatorio.entradas) {
    if (chamadas >= MAX_ODDS_CALLS_POR_RUN) break;
    const placar = encontrarPlacar(entrada.jogo, placares);
    if (!placar || !placar.fixture_id) continue;
    if (placar.status === 'finalizado') continue; // odd de jogo acabado não interessa

    const odd = await buscarOddAtual(env, placar.fixture_id, entrada.mercado_principal);
    chamadas++;
    if (odd === null || !isFinite(odd)) continue;

    if (!Array.isArray(entrada._odds_historico)) {
      entrada._odds_historico = [];
      // Primeiro ponto = odd de abertura do relatório (a odd_minima_entrada
      // já publicada), pra dar a referência "abriu X".
      const abertura = parseNumero(entrada.odd_minima_entrada || entrada.odd_principal);
      if (abertura) {
        entrada._odds_historico.push({ ts: relatorio.gerado_em || agora, odd: abertura, origem: 'relatorio' });
      }
    }
    const ultimo = entrada._odds_historico[entrada._odds_historico.length - 1];
    if (ultimo && Math.abs(ultimo.odd - odd) < 0.01) continue; // sem mudança → sem commit

    entrada._odds_historico.push({ ts: agora, odd, origem: 'api' });
    if (entrada._odds_historico.length > MAX_PONTOS_HISTORICO) {
      // mantém o primeiro (abertura) + os mais recentes
      entrada._odds_historico = [entrada._odds_historico[0]]
        .concat(entrada._odds_historico.slice(-(MAX_PONTOS_HISTORICO - 1)));
    }
    mudou = true;
  }

  if (mudou) {
    await salvarArquivoGithubGenerico(
      env, path, JSON.stringify(relatorio, null, 2), sha,
      `[auto] Snapshot de odds em ${hoje}`
    );
    return 1;
  }
  return 0;
}

// =============================================================
// ALERTAS LIVE — "quando fazer a entrada"
// Cron de 10min (janela de jogos): pra cada entrada do relatório de
// HOJE com jogo rolando, busca estatísticas AO VIVO (finalizações,
// chutes no gol, posse, escanteios) e avisa no Telegram quando o
// gatilho do método confirma — incluindo o contexto de pressão
// ("favorito pressionando, criando chances").
//
// Estado (anti-duplicação + snapshot de stats pra calcular o delta
// "últimos 10min") fica no Cache API do Cloudflare — não gera commit
// no GitHub a cada 10min. Obs: cache pode ser despejado em caso raro
// → no pior caso um alerta repete; se incomodar, migrar pra KV.
// =============================================================
const MAX_STATS_CALLS_POR_RUN = 5; // proteção de cota da API-Football

async function buscarStatsLive(env, fixtureId) {
  const url = `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`;
  const r = await fetch(url, { headers: { 'x-apisports-key': env.API_FOOTBALL_KEY } });
  if (!r.ok) return null;
  const dados = await r.json();
  if (!Array.isArray(dados.response) || dados.response.length < 2) return null;

  const extrair = (bloco) => {
    const mapa = {};
    for (const s of bloco.statistics || []) mapa[(s.type || '').toLowerCase()] = s.value;
    const num = (v) => {
      if (v === null || v === undefined) return 0;
      const m = String(v).match(/\d+(?:\.\d+)?/);
      return m ? parseFloat(m[0]) : 0;
    };
    return {
      time: bloco.team?.name || '',
      chutes: num(mapa['total shots']),
      chutesGol: num(mapa['shots on goal']),
      posse: num(mapa['ball possession']), // "65%" → 65
      escanteios: num(mapa['corner kicks']),
    };
  };
  // response[0]=casa, response[1]=fora (ordem da API)
  return { casa: extrair(dados.response[0]), fora: extrair(dados.response[1]) };
}

// De que lado (casa/fora) está um time citado no relatório? (ex: o
// "favorito" do back_favorito). Matching flexível igual ao dos placares.
function ladoDoTime(nomeBusca, placar) {
  const norm = (s) => (s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const busca = norm(nomeBusca);
  if (!busca) return null;
  const bate = (real) => {
    const a = norm(real);
    const palavras = busca.split(' ').filter((p) => p.length >= 4);
    if (palavras.length === 0) return a.includes(busca) || busca.includes(a);
    return palavras.some((p) => a.includes(p));
  };
  const ehCasa = bate(placar.casa);
  const ehFora = bate(placar.fora);
  if (ehCasa === ehFora) return null; // ambíguo → não arrisca
  return ehCasa ? 'casa' : 'fora';
}

// "Está pressionando?" — heurística sobre stats live + delta desde o
// último cron: posse >= 58% E (3+ chutes no gol OU +4 finalizações OU
// +3 escanteios nos últimos ~10min). Sem snapshot anterior, usa o
// ritmo acumulado (finalizações por minuto).
function avaliarPressao(statsTime, statsAntes, minutoAtual, minutoAntes) {
  const dominioPos = statsTime.posse >= 58;
  const chutesGolOk = statsTime.chutesGol >= 3;
  let deltaTxt = '';
  let volumeOk = false;
  if (statsAntes && minutoAntes != null && minutoAtual > minutoAntes) {
    const dChutes = statsTime.chutes - (statsAntes.chutes || 0);
    const dEsc = statsTime.escanteios - (statsAntes.escanteios || 0);
    volumeOk = dChutes >= 4 || dEsc >= 3;
    if (dChutes > 0 || dEsc > 0) {
      deltaTxt = ` · +${dChutes} finalizações e +${dEsc} escanteios nos últimos ${minutoAtual - minutoAntes}min`;
    }
  } else if (minutoAtual >= 10) {
    volumeOk = statsTime.chutes / minutoAtual >= 0.35; // ~1 finalização a cada 3min
  }
  const pressionando = dominioPos && (chutesGolOk || volumeOk);
  const resumo = `${statsTime.chutes} finalizações (${statsTime.chutesGol} no gol) · ` +
    `${statsTime.posse.toFixed(0)}% posse · ${statsTime.escanteios} escanteios${deltaTxt}`;
  return { pressionando, resumo };
}

// Odd/stake de referência do método (mesma lógica do site)
function planoDoMetodoWorker(entrada, metodo) {
  const obj = entrada[metodo] || {};
  const num = (v) => {
    if (v === null || v === undefined) return null;
    const m = String(v).match(/\d+(?:[.,]\d+)?(\s*a\s*\d+(?:[.,]\d+)?)?/);
    return m ? m[0].replace(',', '.') : null;
  };
  const odd = num(obj.odd_alvo || obj.odd_zebra_alvo || obj.odd_esperada || entrada.odd_minima_entrada);
  const stakeN = num(obj.stake_recomendada || entrada.stake_recomendada);
  return { odd, stake: stakeN ? `${stakeN}%` : null };
}

// Avalia TODOS os gatilhos de uma entrada. Retorna [{chave, msg}].
// `stats` pode ser null (sem cota/sem dado) — os gatilhos de placar
// funcionam mesmo assim; só o contexto de pressão fica de fora.
function avaliarGatilhosEntrada(entrada, placar, stats, statsAntes) {
  const alertas = [];
  const gc = placar.gols_casa ?? 0;
  const gf = placar.gols_fora ?? 0;
  const min = placar.minuto ?? 0;
  const cab = `⚽ ${entrada.jogo} · <b>${gc}-${gf}</b> · ${min}'`;
  const aplicado = (m) => Array.isArray(entrada.metodos_aplicados) &&
    entrada.metodos_aplicados.includes(m) && entrada[m] && entrada[m].aplicavel;

  // ---- OVER LIMITE (+1 gol): gatilho 65min ----
  if (aplicado('over_limite_70') && min >= 63 && min <= 82) {
    const dif = Math.abs(gc - gf);
    const empatado = gc === gf;
    const goleada = dif >= 3;
    if (!empatado && !goleada) {
      const linha = gc + gf; // Mais X.5 onde X = total atual
      const { odd, stake } = planoDoMetodoWorker(entrada, 'over_limite_70');
      let pressao = '';
      if (stats) {
        // Pro over, pressão de QUALQUER um dos dois lados conta
        const pc = avaliarPressao(stats.casa, statsAntes?.casa, min, statsAntes?._minuto);
        const pf = avaliarPressao(stats.fora, statsAntes?.fora, min, statsAntes?._minuto);
        const lado = pc.pressionando ? { n: placar.casa, r: pc.resumo }
                   : pf.pressionando ? { n: placar.fora, r: pf.resumo } : null;
        pressao = lado
          ? `\n📈 <b>${lado.n} pressionando</b>: ${lado.r}`
          : `\n📊 Jogo: casa ${pc.resumo} | fora ${pf.resumo}`;
      }
      alertas.push({
        chave: `over65:${entrada.jogo}`,
        msg: `⚡ <b>ENTRADA — Over Limite (+1 gol)</b>\n${cab}\n` +
             `Mercado: <b>Mais ${linha}.5 gols</b>` +
             (odd ? ` · Odd ${odd}` : '') + (stake ? ` · Stake ${stake}` : '') +
             pressao +
             `\n✅ Condições: não empatado, sem goleada, sem expulsão (confira!)`,
      });
    }
  }

  // ---- BACK FAVORITO ao vivo: favorito pressionando ----
  const bf = entrada.back_favorito;
  if (aplicado('back_favorito') && bf.modo === 'ao_vivo' && stats && min >= 10 && min <= 75) {
    const lado = ladoDoTime(bf.favorito, placar);
    if (lado) {
      const golsFav = lado === 'casa' ? gc : gf;
      const golsAdv = lado === 'casa' ? gf : gc;
      const p = avaliarPressao(stats[lado], statsAntes?.[lado], min, statsAntes?._minuto);
      // Só faz sentido entrar se o favorito ainda não resolveu o jogo
      if (p.pressionando && golsFav <= golsAdv) {
        const { odd, stake } = planoDoMetodoWorker(entrada, 'back_favorito');
        alertas.push({
          chave: `bf_pressao:${entrada.jogo}`,
          msg: `🎯 <b>GATILHO CONFIRMADO — Back Favorito (ao vivo)</b>\n${cab}\n` +
               `📈 <b>${bf.favorito} pressionando, criando chances</b>: ${p.resumo}\n` +
               `Plano: entrar` + (odd ? ` odd ≥ ${odd}` : '') + (stake ? ` · stake ${stake}` : '') +
               (bf.gatilho_ao_vivo ? `\n📋 Gatilho do relatório: "${bf.gatilho_ao_vivo}"` : ''),
        });
      }
    }
  }

  // ---- LAY ZEBRA ao vivo: zebra marcou primeiro ----
  const lz = entrada.lay_zebra;
  if (aplicado('lay_zebra') && lz.modo === 'ao_vivo' && (gc + gf) === 1) {
    const ladoZebra = ladoDoTime(lz.zebra, placar);
    if (ladoZebra && ((ladoZebra === 'casa' && gc === 1) || (ladoZebra === 'fora' && gf === 1))) {
      const { odd, stake } = planoDoMetodoWorker(entrada, 'lay_zebra');
      let pressao = '';
      if (stats) {
        const ladoFav = ladoZebra === 'casa' ? 'fora' : 'casa';
        const p = avaliarPressao(stats[ladoFav], statsAntes?.[ladoFav], min, statsAntes?._minuto);
        pressao = p.pressionando
          ? `\n📈 Favorito reagindo: ${p.resumo}`
          : `\n📊 Favorito: ${p.resumo}`;
      }
      alertas.push({
        chave: `lz_zebra_marcou:${entrada.jogo}`,
        msg: `🎯 <b>GATILHO — Lay Zebra (ao vivo)</b>\n${cab}\n` +
             `Zebra (${lz.zebra}) marcou primeiro — condição de entrada do lay confirmada` +
             (odd ? `\nOdd zebra alvo ≥ ${odd}` : '') + (stake ? ` · stake ${stake}` : '') + pressao,
      });
    }
  }

  // ---- BACK 2x2: regras de cash-out ----
  if (aplicado('back_2x2')) {
    if (gc === 1 && gf === 1) {
      alertas.push({
        chave: `b22_1x1:${entrada.jogo}`,
        msg: `💰 <b>CASH-OUT TOTAL — Back 2x2</b>\n${cab}\nChegou em 1x1 — regra do método: sair AGORA. Nunca segurar.`,
      });
    } else if ((gc === 2 && gf === 1) || (gc === 1 && gf === 2)) {
      alertas.push({
        chave: `b22_2x1:${entrada.jogo}`,
        msg: `💰 <b>CASH-OUT PARCIAL — Back 2x2</b>\n${cab}\nPlacar ${gc}x${gf} — reduzir exposição conforme a regra.`,
      });
    }
  }

  // ---- LAY 1×0 / LAY 0×1: alertas de risco e de saída ----
  for (const [metodo, alvo] of [['lay_1x0', [1, 0]], ['lay_0x1', [0, 1]]]) {
    if (!aplicado(metodo)) continue;
    const nomePlacar = `${alvo[0]}×${alvo[1]}`;
    if (gc === alvo[0] && gf === alvo[1]) {
      let pressao = '';
      if (stats) {
        // Quem precisa marcar pra desfazer o placar? No lay 1x0 é o
        // visitante (ou o mandante ampliar); mostramos os dois lados.
        const ladoPerdendo = metodo === 'lay_1x0' ? 'fora' : 'casa';
        const p = avaliarPressao(stats[ladoPerdendo], statsAntes?.[ladoPerdendo], min, statsAntes?._minuto);
        pressao = p.pressionando
          ? `\n📈 Quem precisa do gol está pressionando: ${p.resumo} — dá pra segurar com atenção`
          : `\n📉 Sem pressão de quem precisa do gol (${p.resumo})`;
      }
      alertas.push({
        chave: `${metodo}_placar_risco:${entrada.jogo}:${min >= 75 ? 'final' : 'meio'}`,
        msg: `🚨 <b>RISCO — Lay ${nomePlacar}</b>\n${cab}\n` +
             `O placar está EXATAMENTE no ${nomePlacar}. Regra: ${entrada[metodo].regra_saida || 'cash-out conforme o plano'}` +
             pressao,
      });
    }
    if (gc === 0 && gf === 0 && min >= 58 && min <= 70) {
      alertas.push({
        chave: `${metodo}_60min:${entrada.jogo}`,
        msg: `⏰ <b>SAÍDA — Lay ${nomePlacar}</b>\n${cab}\n0-0 chegando aos 60min — regra do método: cash-out.`,
      });
    }
  }

  return alertas;
}

async function verificarGatilhosLive(env) {
  if (!env.API_FOOTBALL_KEY) return { erro: 'API_FOOTBALL_KEY não configurada' };
  const hoje = new Date().toISOString().slice(0, 10);

  // Relatório de hoje
  let relatorio;
  try {
    const { conteudo } = await lerArquivoGithubGenerico(env, `${ENTRADAS_PATH_PREFIX}${hoje}.json`);
    if (!conteudo) return { status: 'sem_relatorio_hoje' };
    relatorio = JSON.parse(conteudo);
  } catch { return { status: 'sem_relatorio_hoje' }; }
  if (!Array.isArray(relatorio.entradas) || relatorio.entradas.length === 0) {
    return { status: 'sem_entradas' };
  }

  // ECONOMIA DE COTA #1 — JANELA DE JOGOS: só consulta a API-Football se
  // AGORA estiver dentro da janela de algum jogo do relatório (do horário
  // de início até +2h40). Fora disso: zero chamadas — o cron de 10min
  // roda o dia todo mas a cota gratuita (100/dia) só é gasta quando há
  // jogo analisado potencialmente rolando. Horários do relatório são BRT
  // (UTC-3, sem horário de verão desde 2019).
  const agoraBRT = new Date(Date.now() - 3 * 3600 * 1000);
  const minAgora = agoraBRT.getUTCHours() * 60 + agoraBRT.getUTCMinutes();
  let algumaJanela = false;
  for (const e of relatorio.entradas) {
    const m = (e.horario || '').match(/(\d{1,2}):(\d{2})/);
    if (!m) { algumaJanela = true; break; } // sem horário = não dá pra saber → checa
    const inicio = parseInt(m[1]) * 60 + parseInt(m[2]);
    if (minAgora >= inicio - 10 && minAgora <= inicio + 160) {
      algumaJanela = true;
      break;
    }
  }
  if (!algumaJanela) {
    return { status: 'fora_da_janela_de_jogos', chamadas_api: 0 };
  }

  // Placares (aproveita o mesmo cache de 10min do /placares)
  let placares;
  try { placares = await buscarPlacaresDoDia(env, hoje); } catch (e) { return { erro: e.message }; }

  const cache = caches.default;
  let statsCalls = 0;
  let enviados = 0;
  const detalhes = [];

  for (const entrada of relatorio.entradas) {
    const placar = encontrarPlacar(entrada.jogo, placares);
    if (!placar || placar.status !== 'em_andamento') continue;

    // ECONOMIA DE COTA #2 — stats de pressão só na JANELA DE DECISÃO de
    // cada método (fora dela, os gatilhos de placar funcionam sem stats):
    //   Over Limite  → minuto 55-85 (gatilho é 65')
    //   Back Fav ao vivo → minuto 10-75
    //   Lay 1×0/0×1  → só quando o placar ESTÁ no placar do lay, ou 0-0 aos 50'+
    //   Lay Zebra    → só quando saiu exatamente 1 gol (zebra pode ter marcado)
    const min = placar.minuto ?? 0;
    const gc = placar.gols_casa ?? 0;
    const gf = placar.gols_fora ?? 0;
    const precisaStats =
      (entrada.over_limite_70?.aplicavel && min >= 55 && min <= 85) ||
      (entrada.back_favorito?.aplicavel && entrada.back_favorito.modo === 'ao_vivo' && min >= 10 && min <= 75) ||
      (entrada.lay_1x0?.aplicavel && ((gc === 1 && gf === 0) || (gc === 0 && gf === 0 && min >= 50))) ||
      (entrada.lay_0x1?.aplicavel && ((gc === 0 && gf === 1) || (gc === 0 && gf === 0 && min >= 50))) ||
      (entrada.lay_zebra?.aplicavel && gc + gf === 1);

    let stats = null, statsAntes = null;
    if (precisaStats && placar.fixture_id && statsCalls < MAX_STATS_CALLS_POR_RUN) {
      // Snapshot anterior (pro delta "últimos 10min")
      const kSnap = new Request(`https://cache.local/live-stats?fixture=${placar.fixture_id}`);
      try {
        const c = await cache.match(kSnap);
        if (c) statsAntes = await c.json();
      } catch {}
      try {
        stats = await buscarStatsLive(env, placar.fixture_id);
        statsCalls++;
      } catch {}
      if (stats) {
        const snap = { casa: stats.casa, fora: stats.fora, _minuto: placar.minuto ?? null };
        await cache.put(kSnap, new Response(JSON.stringify(snap), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' },
        }));
      }
    }

    const alertas = avaliarGatilhosEntrada(entrada, placar, stats, statsAntes);
    for (const a of alertas) {
      // Anti-duplicação: 1 disparo por chave a cada 12h
      const kAlerta = new Request(`https://cache.local/live-alerta?k=${encodeURIComponent(a.chave)}`);
      const jaFoi = await cache.match(kAlerta);
      if (jaFoi) continue;
      const ok = await enviarTelegram(env, a.msg);
      if (ok) {
        enviados++;
        detalhes.push(a.chave);
        await cache.put(kAlerta, new Response('1', {
          headers: { 'Cache-Control': 'max-age=43200' },
        }));
      }
    }
  }

  return { status: 'ok', jogos_ao_vivo_checados: statsCalls, alertas_enviados: enviados, detalhes };
}

// =============================================================
// RADAR AO VIVO — busca o ID do evento no SofaScore pelo nome
// do jogo ("Time A x Time B"). Matching: os dois times precisam
// aparecer (por token) e o jogo precisa ser de HOJE (±1 dia).
// =============================================================
async function buscarEventoSofascore(jogo) {
  const partes = jogo.split(/\s+x\s+/i).map((s) => s.trim()).filter(Boolean);
  if (partes.length !== 2) return null;

  const norm = (s) => (s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const tokens = (s) => norm(s).split(' ').filter((t) => t.length >= 4);

  // Busca pelo time da casa (menos ambíguo que a frase inteira)
  const q = encodeURIComponent(partes[0]);
  const r = await fetch(`https://api.sofascore.com/api/v1/search/all?q=${q}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json',
    },
  });
  if (!r.ok) return null;
  const dados = await r.json();

  const agora = Date.now() / 1000;
  const UM_DIA = 86400;
  const tokCasa = tokens(partes[0]);
  const tokFora = tokens(partes[1]);

  let melhor = null;
  for (const res of dados.results || []) {
    if (res.type !== 'event' || !res.entity) continue;
    const ev = res.entity;
    const nomeCasa = norm(ev.homeTeam?.name || '');
    const nomeFora = norm(ev.awayTeam?.name || '');
    const casaBate = tokCasa.some((t) => nomeCasa.includes(t)) ||
      tokens(ev.homeTeam?.name || '').some((t) => norm(partes[0]).includes(t));
    const foraBate = tokFora.some((t) => nomeFora.includes(t)) ||
      tokens(ev.awayTeam?.name || '').some((t) => norm(partes[1]).includes(t));
    if (!casaBate || !foraBate) continue;
    const ts = ev.startTimestamp || 0;
    if (Math.abs(ts - agora) > UM_DIA) continue; // só jogo de hoje (±1 dia)
    // Preferência pro mais próximo do agora
    if (!melhor || Math.abs(ts - agora) < Math.abs(melhor.ts - agora)) {
      melhor = { id: ev.id, ts };
    }
  }
  return melhor ? melhor.id : null;
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

  // LAY 1×0 — green se o placar final NÃO for 1×0
  // (apostou CONTRA o placar 1×0; qualquer outro resultado = ganhou)
  if (metodo.includes('lay 1') && metodo.includes('0') && !metodo.includes('0x1') && !metodo.includes('0×1')) {
    return (gc === 1 && gf === 0)
      ? { resultado: 'red', motivo: `Placar final 1×0 — lay perdido` }
      : { resultado: 'green', motivo: `Placar final ${gc}×${gf} (não foi 1×0) — lay ganho` };
  }

  // LAY 0×1 — green se o placar final NÃO for 0×1
  if (metodo.includes('lay 0') && metodo.includes('1') && (metodo.includes('0x1') || metodo.includes('0×1'))) {
    return (gc === 0 && gf === 1)
      ? { resultado: 'red', motivo: `Placar final 0×1 — lay perdido` }
      : { resultado: 'green', motivo: `Placar final ${gc}×${gf} (não foi 0×1) — lay ganho` };
  }

  // OVER LIMITE 70+ — green se a linha "Mais X.5" foi atingida
  // Quando o gol sai, já é green 100% (não importa o que acontece depois).
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
