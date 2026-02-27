# Bot-SDJ-Nivers

Bot local de WhatsApp para avisar aniversários em grupo, com painel web em Express + EJS e persistência em SQLite.

## Stack

- Node.js
- Express
- EJS
- better-sqlite3
- whatsapp-web.js
- node-cron

## Funcionalidades

- Cadastro de aniversariantes
- Templates de mensagem (aniversário e lembretes D-5/D-3/D-1)
- Envio automático via cron
- Resumo mensal automático (dia 01)
- Painel web com logs de envio e auditoria
- Proteções de segurança (auth, CSRF, rate limit, headers)

## Como executar localmente

1. Instale dependências:
   `npm ci`
2. Crie seu arquivo de ambiente:
   `copy .env.example .env`
3. Inicialize o banco:
   `npm run db:init`
4. Inicie em desenvolvimento:
   `npm run dev`

Painel: `http://localhost:3000/login`

## Variáveis de ambiente

Consulte `.env.example` para todas as chaves.

Principais:

- `GROUP_ID`
- `CRON_SCHEDULE`
- `DB_PATH`
- `WHATSAPP_AUTH_PATH`
- `PANEL_LOGIN_USER`
- `PANEL_LOGIN_PASSWORD`
- `PANEL_SESSION_SECRET`

## Segurança

Hardening já aplicado:

- Login por sessão (cookie `HttpOnly` + `SameSite=Strict`)
- Bloqueio por tentativas de login por IP
- CSRF em formulários
- Headers de segurança (CSP, frame deny, nosniff etc.)
- Redirect para HTTPS (quando habilitado)
- Rate limit básico por IP
- Mask de `GROUP_ID` na interface

Para produção:

- `NODE_ENV=production`
- `TRUST_PROXY=1`
- `REQUIRE_HTTPS=true`
- `CSRF_CHECK_ORIGIN=true`
- Senha forte em `PANEL_LOGIN_PASSWORD` (16+ chars)
- Segredo forte em `PANEL_SESSION_SECRET` (32+ chars)

Detalhes em [SECURITY.md](SECURITY.md).

## Deploy na Render

O projeto inclui `render.yaml` com:

- Web Service Node
- Disk persistente em `/var/data`
- Variáveis recomendadas de produção

## Open Source

Arquivos recomendados já incluídos:

- `LICENSE` (MIT)
- `CONTRIBUTING.md`
- `SECURITY.md`
- `.env.example`

## Observações importantes

- Nunca publique `.env`, `data/`, `.wwebjs_auth` ou `.wwebjs_cache`.
- O projeto usa sessão local do WhatsApp; mantenha o storage em volume persistente.
