# Comandos do Análises Trader

## Análise diária

```powershell
cd C:\ANALISES_TRADER

# Baixa PDFs + analisa + publica + notifica Telegram (TUDO)
python main.py

# Mesma coisa pra amanhã
python main.py amanha
```

## Reanálise (sem baixar PDFs de novo)

```powershell
# Reanalisar TODOS os PDFs já baixados de hoje
python analisar.py hoje

# Reanalisar só algumas partidas
python analisar.py hoje 10                          # primeiras 10
python analisar.py --nums 3,5,7                     # números específicos
python analisar.py --liga "Premier League"          # uma liga específica
python analisar.py --ligas "Premier League,La Liga" # várias ligas
python analisar.py --buscar "Bayern"                # busca por nome

# Listar PDFs disponíveis
python analisar.py --listar
python analisar.py --ligas-listar
```

## Monitor ao vivo (gatilhos de Over Limite 70+)

```powershell
# Verificar 1 vez (consome 1 chamada da API-Football)
python monitor_ao_vivo.py

# Modo contínuo: verifica a cada 5 minutos
python monitor_ao_vivo.py --loop

# Intervalo customizado (em segundos)
python monitor_ao_vivo.py --loop --intervalo 600    # a cada 10min
```

**Cuidado com cota API-Football:** plano grátis = 100 chamadas/dia.
- Modo loop a cada 5min = 12 chamadas/hora = ~144 em 12h
- Use só durante janelas com jogos importantes
- Para automatizar, configure no Agendador de Tarefas Windows

## Publicar manualmente um relatório

```powershell
python publicar.py relatorios/relatorio_2026-05-19.json
```

## Configuração do Telegram

1. Crie um bot no Telegram falando com @BotFather
2. Inicie conversa com seu bot
3. Acesse `https://api.telegram.org/botSEU_TOKEN/getUpdates` pra pegar seu chat_id
4. Adicione no `config.json`:

```json
"telegram": {
  "ativado": true,
  "bot_token": "1234567890:AAEhBP7Hk...",
  "chat_id": "1234567890",
  "notificar": {
    "relatorio": true,
    "auditoria": true,
    "erro": true,
    "ao_vivo": true
  }
}
```

Para desligar uma notificação específica sem mexer no código, mude o valor pra `false`.
Para desligar TUDO, troque `"ativado": true` por `false`.

## Configurar Worker (auditoria automática)

No painel do Cloudflare → Worker `analises-trader-api` → Settings → Variables and Secrets:

| Variável | Tipo |
|----------|------|
| `GITHUB_TOKEN` | Secret |
| `GITHUB_OWNER` | Plaintext |
| `GITHUB_REPO` | Plaintext |
| `GITHUB_BRANCH` | Plaintext |
| `ALLOWED_ORIGIN` | Plaintext |
| `API_FOOTBALL_KEY` | Secret |
| `TELEGRAM_BOT_TOKEN` | Secret (opcional, pra notificações de auditoria) |
| `TELEGRAM_CHAT_ID` | Plaintext (opcional) |

Cron trigger: `5 * * * *` (a cada hora, minuto 5)
