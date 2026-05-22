# Worker v2 — API de trades + Auditoria Automática

Esta versão adiciona auditoria automática que cruza placares reais (via API-Football)
com as entradas dos métodos e atualiza o status (green/red) sozinha, a cada hora.

## O que mudou em relação ao Worker original

- ✅ Cron trigger: roda a cada hora (5min após o início)
- ✅ Endpoint `POST /auditar` pra rodar manualmente
- ✅ Lógica de checagem específica por método (Back Favorito, Lay Zebra, Over Limite 70+, Back 2x2, Back Goleada)
- ✅ Salva placar final + placar HT no trade pra você ter histórico

## Como atualizar o Worker existente

### 1. Adicionar nova variável: chave da API-Football

1. https://www.api-football.com/ → cria conta grátis
2. Dashboard → copia a **API Key**
3. No painel do Cloudflare, no Worker `analises-trader-api`:
   - **Settings** → **Variables and Secrets** → **Add variable**
   - Nome: `API_FOOTBALL_KEY`
   - Valor: (cola a chave)
   - Tipo: **Secret** 🔐
4. Salva

### 2. Atualizar o código do Worker

1. No Worker `analises-trader-api`, clica em **Edit code**
2. **Apaga TUDO** que está no editor
3. Cola o conteúdo do novo `index.js`
4. Clica em **Save and Deploy**

### 3. Configurar o Cron Trigger

1. No Worker, vai em **Settings** → **Triggers**
2. Procura a seção **Cron Triggers**
3. Clica em **Add Cron Trigger**
4. Cron expression: `5 * * * *` (a cada hora, no minuto 5)
5. Save

Pronto! O Worker vai rodar a auditoria automaticamente a cada hora.

## Rodar auditoria manual (pra testar)

Acessa no navegador (logado no Cloudflare Access do site):
```
https://analises-trader-api.SEU-SUBDOMINIO.workers.dev/auditar
```

**Atenção:** isso é um POST, navegador faz GET. Pra testar manualmente, use o
botão "Rodar auditoria agora" que vamos adicionar no site (próxima atualização).

Ou via PowerShell:
```powershell
curl -X POST https://analises-trader-api.SEU-SUBDOMINIO.workers.dev/auditar
```

## Como funciona a auditoria

Pra cada trade com `resultado: "pendente"`:

1. Busca placares do dia na API-Football (1 chamada por data)
2. Tenta casar o jogo do trade com algum jogo da API (matching parcial dos nomes)
3. Se o jogo está finalizado, aplica regra do método pra decidir Green/Red:
   - **Back Favorito**: green se o time mencionado no mercado venceu
   - **Lay Zebra**: green se a zebra mencionada não venceu
   - **Over Limite 70+**: green se total de gols > linha da aposta
   - **Back 2x2**: green se placar 2x2 ou se ambos times marcaram (passou por 1x1)
   - **Back Goleada**: green se algum time marcou 4+ E venceu
   - **Confirmação Visual**: inconclusivo (depende do mercado real apostado)
4. Atualiza `trades.json` no GitHub com o resultado + placar final + placar HT

## Custo da API-Football

- Plano grátis: **100 chamadas/dia**
- Usamos **1 chamada por data diferente** (não por trade)
- Se você tem 10 trades pendentes de 3 datas diferentes → 3 chamadas
- Auditoria rodando a cada hora = ~24 chamadas/dia (se sempre tiver pendentes)
- Cabe folgado no plano grátis ✅

## Lógica do Back 2x2 (importante!)

Conforme você definiu, marca **Green** se você seguiu o método à risca, ou seja,
se o jogo **passou por placar 1x1** (que é onde você faz cash-out total).

A heurística no código:
- Placar final 2x2 → Green (alvo bateu)
- Ambos os times marcaram (gc >= 1 E gf >= 1) → Green (assumimos que passou por 1x1)
- Caso contrário → Red

Pode ter um caso raro de "false green": jogo terminou 3x1 mas o time só marcou
depois de empatar em 1x1. Pra cobrir esses casos com precisão, seria preciso
buscar a timeline completa de gols na API-Football (gasta mais chamadas).
Se quiser essa precisão, é só pedir e eu implemento.
