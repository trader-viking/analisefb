# Worker v3 — Sistema Completo de Notificações

## O que esse Worker faz

| Função | Quando |
|--------|--------|
| 🔔 Notifica 5min antes de cada jogo | A cada minuto |
| 🚨 Monitor ao vivo (gatilhos Over70/Lay Zebra/Back Favorito) | A cada 5min |
| ✅ Auditoria (Green/Red) + notificação | A cada hora |
| 📊 Resumo diário (PL dia + mês) | 23:59 todo dia |
| 🔧 CRUD de trades (do site) | Sob demanda |

## Como atualizar (do v2 pro v3)

### 1. Atualizar código

1. No painel do Cloudflare → Worker `analises-trader-api`
2. Clica em **Edit code**
3. Apaga tudo
4. Cola o conteúdo do novo `index.js`
5. **Save and Deploy**

### 2. Adicionar variável `SITE_URL` (opcional)

Settings → Variables and Secrets → Add:
- Nome: `SITE_URL`
- Valor: `https://analisefb.pages.dev`
- Tipo: Plaintext

(Se não criar, usa o default que está no código)

### 3. Configurar crons

Settings → Triggers → Cron Triggers

Você precisa de **3 crons** ativos:

| Expression | Para que serve |
|------------|----------------|
| `* * * * *` | A cada minuto: notifica início + monitor ao vivo |
| `5 * * * *` | A cada hora no minuto 5: auditoria |
| `59 23 * * *` | 23:59 todo dia: resumo |

Se já tinha o `5 * * * *` configurado da versão anterior, só precisa **adicionar os outros dois**.

### 4. Testar manualmente

Antes de esperar os crons, testa cada função:

**Início de jogos:**
```
POST https://analises-trader-api.SEU-USUARIO.workers.dev/inicio-jogos
```
(Só dispara se houver jogo nos próximos 4-6 minutos)

**Monitor ao vivo:**
```
POST https://analises-trader-api.SEU-USUARIO.workers.dev/monitor
```

**Resumo diário:**
```
POST https://analises-trader-api.SEU-USUARIO.workers.dev/resumo
```

**Auditoria:**
```
POST https://analises-trader-api.SEU-USUARIO.workers.dev/auditar
```

Pra testar via PowerShell:
```powershell
curl.exe -X POST https://analises-trader-api.SEU-USUARIO.workers.dev/resumo
```

## Cota da API-Football

- Plano grátis: 100 chamadas/dia
- **Auditoria**: 1-3 chamadas/hora (depende de quantas datas tem)
- **Monitor ao vivo**: 1 chamada por execução (a cada 5min quando ativo)
- **Total esperado**: ~50-70 chamadas/dia

O Worker mantém contador em `_estado_worker.json` no GitHub e pausa monitor ao vivo se passar de 85 chamadas (margem de segurança).

## Estrutura de notificações

### 5 minutos antes do jogo
```
⏰ Jogo em 5 minutos!

⚽ Bayern x Stuttgart
📅 13:00 · Bundesliga

📋 Entradas recomendadas:

🟢 Back Favorito · 🕐 Pré-jogo
   Odd: 1.40
   Stake: 2%
   📌 Favoritismo extremo em casa...

🟡 Back Goleada · 🕐 Pré-jogo
   ...

🎯 Abordagem: forçar
🛑 Hard Stop: ...

👉 Ver no site
```

### Gatilho ao vivo
```
🚨 GATILHO: LAY ZEBRA APÓS GOL

⚽ City x Sheffield
📊 0x1 aos 25min
🎯 Zebra (Sheffield) marcou
💡 Entrar Lay Zebra ao vivo — odd inflada
📈 Stake: 2%
```

### Cash-out (Green/Red)
```
✅ GREEN · Bayern x Stuttgart
🎯 Back Favorito · Placar 3x1
💰 Stake 2% @ 1.40 · +0.8u
Bayern venceu 3x1
```

ou (jogo sem trade registrado):
```
🏁 Jogo encerrado: Bayern x Stuttgart
📊 Placar final: 3x1

✅ GREEN 🟢 Back Favorito
   Bayern venceu 3x1
✅ GREEN 🟡 Back Goleada
   Goleada (3x1)
```

### Resumo diário 23:59
```
📊 RESUMO DO DIA — 2026-05-20

📈 PL do dia: +5.2u
✅ 8 Green · ❌ 3 Red · (11 trades)
🎯 Taxa de acerto: 73%

Por método:
• Back Favorito: 5G/1R · +3.5u
• Lay Zebra: 2G/0R · +1.2u
• Back Goleada: 1G/2R · +0.5u

━━━━━━━━━━━━━━━━━━━━
📅 MÊS (2026-05):
📈 PL acumulado: +42.8u
✅ 87G · ❌ 35R · 122 trades · 🎯 71%

👉 Ver auditoria completa
```
