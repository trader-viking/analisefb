/**
 * Cloudflare Worker — API de trades
 *
 * Recebe requisições do site e atualiza trades.json no GitHub.
 * Protegido por Cloudflare Access — só quem está autenticado pode chamar.
 *
 * Endpoints:
 *   GET    /trades          → lista trades atuais
 *   POST   /trades          → adiciona novo trade
 *   PUT    /trades/:id      → edita trade existente
 *   DELETE /trades/:id      → remove trade
 *
 * Secrets configurados no painel do Cloudflare:
 *   GITHUB_TOKEN     - token pessoal do GitHub (Contents: Read+Write)
 *   GITHUB_OWNER     - seu usuário do GitHub (ex: "jose-trader")
 *   GITHUB_REPO      - nome do repo (ex: "analises-trader")
 *   GITHUB_BRANCH    - branch (geralmente "main")
 *   ALLOWED_ORIGIN   - URL do site (ex: "https://analises-trader.pages.dev")
 */

const TRADES_PATH = 'relatorios/trades.json';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS — permitir requisições do site
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, CF-Access-Jwt-Assertion',
      'Access-Control-Allow-Credentials': 'true',
    };

    // Preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Cabeçalho da pessoa logada via Cloudflare Access (se ativo)
    const userEmail =
      request.headers.get('Cf-Access-Authenticated-User-Email') ||
      request.headers.get('CF-Access-Authenticated-User-Email') ||
      'desconhecido';

    try {
      // Roteamento
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
};

// =============================================================
// Operações
// =============================================================

async function listarTrades(env, corsHeaders) {
  const { trades } = await lerArquivoGithub(env);
  return resposta(trades, 200, corsHeaders);
}

async function criarTrade(env, novoTrade, userEmail, corsHeaders) {
  validarTrade(novoTrade);

  const { trades, sha } = await lerArquivoGithub(env);

  // Gerar ID único se não vier
  if (!novoTrade.id) {
    const data = novoTrade.data || new Date().toISOString().slice(0, 10);
    const seq = String(
      trades.filter((t) => t.id?.startsWith(data)).length + 1
    ).padStart(3, '0');
    novoTrade.id = `${data}-${seq}`;
  }

  // Verifica duplicidade de ID
  if (trades.some((t) => t.id === novoTrade.id)) {
    return resposta(
      { erro: `ID já existe: ${novoTrade.id}` },
      409,
      corsHeaders
    );
  }

  trades.push(novoTrade);

  await salvarArquivoGithub(
    env,
    trades,
    sha,
    `Trade: ${novoTrade.jogo} (${novoTrade.resultado}) por ${userEmail}`
  );

  return resposta({ ok: true, trade: novoTrade }, 201, corsHeaders);
}

async function editarTrade(env, id, dadosAtualizados, userEmail, corsHeaders) {
  const { trades, sha } = await lerArquivoGithub(env);
  const idx = trades.findIndex((t) => t.id === id);
  if (idx === -1) {
    return resposta({ erro: `Trade não encontrado: ${id}` }, 404, corsHeaders);
  }

  // Mantém o ID e mescla os dados
  const tradeAtualizado = { ...trades[idx], ...dadosAtualizados, id };
  validarTrade(tradeAtualizado);
  trades[idx] = tradeAtualizado;

  await salvarArquivoGithub(
    env,
    trades,
    sha,
    `Edição de trade: ${id} por ${userEmail}`
  );

  return resposta({ ok: true, trade: tradeAtualizado }, 200, corsHeaders);
}

async function deletarTrade(env, id, userEmail, corsHeaders) {
  const { trades, sha } = await lerArquivoGithub(env);
  const idx = trades.findIndex((t) => t.id === id);
  if (idx === -1) {
    return resposta({ erro: `Trade não encontrado: ${id}` }, 404, corsHeaders);
  }

  const removido = trades.splice(idx, 1)[0];
  await salvarArquivoGithub(
    env,
    trades,
    sha,
    `Remoção de trade: ${id} por ${userEmail}`
  );

  return resposta({ ok: true, removido }, 200, corsHeaders);
}

// =============================================================
// Validação
// =============================================================
function validarTrade(t) {
  const obrigatorios = [
    'data', 'jogo', 'metodo', 'mercado', 'odd_entrada', 'stake_pct',
    'resultado', 'criterios_atendidos',
  ];
  for (const c of obrigatorios) {
    if (t[c] === undefined || t[c] === null || t[c] === '') {
      throw new Error(`Campo obrigatório ausente: ${c}`);
    }
  }
  if (!['green', 'red'].includes(t.resultado)) {
    throw new Error(`resultado deve ser 'green' ou 'red'`);
  }
  if (typeof t.criterios_atendidos !== 'boolean') {
    throw new Error(`criterios_atendidos deve ser boolean (true/false)`);
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
// GitHub API
// =============================================================
async function lerArquivoGithub(env) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${TRADES_PATH}?ref=${env.GITHUB_BRANCH || 'main'}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'analises-trader-worker',
    },
  });

  if (r.status === 404) {
    // Arquivo ainda não existe — retorna lista vazia
    return { trades: [], sha: null };
  }
  if (!r.ok) {
    throw new Error(`GitHub leitura falhou: ${r.status} ${await r.text()}`);
  }

  const dados = await r.json();
  const conteudo = atob(dados.content.replace(/\s/g, ''));
  let trades = [];
  try {
    const parsed = JSON.parse(conteudo);
    trades = Array.isArray(parsed) ? parsed : parsed.trades || [];
  } catch {
    trades = [];
  }
  return { trades, sha: dados.sha };
}

async function salvarArquivoGithub(env, trades, sha, mensagem) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${TRADES_PATH}`;
  const conteudo = JSON.stringify(trades, null, 2);
  const conteudoBase64 = btoa(unescape(encodeURIComponent(conteudo)));

  const body = {
    message: mensagem,
    content: conteudoBase64,
    branch: env.GITHUB_BRANCH || 'main',
  };
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

  if (!r.ok) {
    throw new Error(`GitHub escrita falhou: ${r.status} ${await r.text()}`);
  }
  return await r.json();
}

// =============================================================
// Helpers
// =============================================================
function resposta(corpo, status, corsHeaders) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
