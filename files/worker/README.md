# Worker — API de trades

Este Worker recebe requisições do site e atualiza o `trades.json` no GitHub.

## Deploy via painel do Cloudflare (recomendado, sem CLI)

### 1. Criar o Worker
1. Acesse https://dash.cloudflare.com
2. Vai em **Workers & Pages** → **Create**
3. Escolhe a aba **Workers** (não Pages dessa vez)
4. Clica em **Create Worker**
5. Nome: `analises-trader-api`
6. Clica em **Deploy** (aceita o template padrão "Hello World")

### 2. Colar o código
1. Na tela do Worker criado, clica em **Edit code** (ou **Quick edit**)
2. Apaga tudo que tiver no editor
3. Cola o conteúdo do `index.js`
4. Clica em **Save and Deploy**

### 3. Configurar variáveis (secrets e variables)
1. Volta na tela do Worker → **Settings** → **Variables and Secrets**
2. Adiciona estas variáveis:

| Nome | Valor | Tipo |
|------|-------|------|
| `GITHUB_TOKEN` | (seu token criado em github.com/settings/tokens) | **Secret** (criptografado) |
| `GITHUB_OWNER` | seu usuário do GitHub (ex: `jose-trader`) | Plaintext |
| `GITHUB_REPO` | `analises-trader` | Plaintext |
| `GITHUB_BRANCH` | `main` | Plaintext |
| `ALLOWED_ORIGIN` | URL completa do seu site (ex: `https://analises-trader.pages.dev`) | Plaintext |

> ⚠ O `GITHUB_TOKEN` DEVE ser tipo **Secret** — assim fica criptografado e ninguém consegue ler depois.

3. Clica em **Save**

### 4. Anota a URL do Worker
Após criar, o Worker tem uma URL tipo:
```
https://analises-trader-api.SEU-SUBDOMINIO.workers.dev
```
Anota essa URL — vamos colar no `config` do site.

### 5. Proteger com Cloudflare Access (opcional mas recomendado)
Sem isso, qualquer pessoa que adivinhar a URL do Worker pode mandar requisições. Pra proteger:

1. https://one.dash.cloudflare.com → **Access** → **Applications**
2. **Add an application** → **Self-hosted**
3. Configurações:
   - Application name: `Análises Trader API`
   - Session: `1 month`
   - Application domain: a URL do Worker (sem `https://`)
4. **Policies** → cria igual à do site, com os emails autorizados
5. Salva

Pronto. Agora só usuários logados no site (que também é protegido por Access) conseguem chamar o Worker.

## Deploy alternativo via CLI (avançado)

Se preferir, com Node.js instalado:
```bash
npm install -g wrangler
wrangler login
wrangler secret put GITHUB_TOKEN
wrangler deploy
```

## Testando manualmente
Depois de configurado, no navegador acessa:
```
https://analises-trader-api.SEU-SUBDOMINIO.workers.dev/trades
```
Deve retornar `[]` (lista vazia) ou seus trades em JSON.

Se aparecer tela de login do Cloudflare, é o Access protegendo — faz login e tenta de novo.
