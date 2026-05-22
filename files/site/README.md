# Análises Trader — Site

Site estático que mostra os relatórios `.md` gerados pelo programa de análises.

## Estrutura

- `app/` — páginas (Next.js App Router)
- `components/` — componentes React reutilizáveis
- `lib/` — funções de leitura dos relatórios
- `relatorios/` — **os arquivos `.md` gerados pelo programa** (colocados aqui pelo script de sync)
- `public/` — assets estáticos
- `next.config.js`, `tailwind.config.js` — configurações

## Como rodar localmente (opcional, só pra testar)

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## Como funciona em produção

1. Você roda `python main.py` no PC → gera relatório em `relatorios/`
2. O programa faz `git push` para o GitHub
3. Cloudflare Pages detecta o push, builda o site, publica
4. Em 30-60s o relatório aparece em https://seu-site.pages.dev

## Build manual (caso queira testar)

```bash
npm run build
```

Saída: pasta `out/` com o site estático pronto.
