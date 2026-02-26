# Bot-SDJ-Nivers (MVP)

Bot local de WhatsApp para avisar aniversarios em grupo com painel web e SQLite.

## Regras de envio (cron)

- O scheduler roda no horario de `CRON_SCHEDULE` (ex.: `0 8 * * *` = todos os dias as 08:00)
- Resumo mensal automatico: somente no dia **01** de cada mes
- Lembretes antecipados: enviados diariamente para os dias configurados em `REMINDER_DAYS_BEFORE` (padrao `5,3,1`)
- Aniversario do dia: enviado no proprio dia
- No painel, ha botoes para rodar apenas os lembretes manualmente (normal ou teste)

## Persistencia da sessao do WhatsApp (QR Code)

O bot salva a sessao em `WHATSAPP_AUTH_PATH` (padrao: `./data/whatsapp-auth`).
Na hospedagem, configure esse caminho em um disco/volume persistente para nao precisar escanear o QR a cada reinicio/deploy.

## Seguranca (painel web)

Hardening aplicado no app:

- Login por sessao (cookie HttpOnly) com usuario unico
- Bloqueio de tentativas de login por IP (anti-forca-bruta)
- Protecao CSRF em todos os formularios
- Headers de seguranca (CSP, frame deny, nosniff, etc.)
- Redirecionamento para HTTPS (quando `REQUIRE_HTTPS=true`)
- Rate limit basico por IP (memoria)
- `GROUP_ID` mascarado na interface

### Variaveis recomendadas para producao (Render)

Defina no painel da Render:

- `NODE_ENV=production`
- `TRUST_PROXY=1`
- `REQUIRE_HTTPS=true`
- `CSRF_CHECK_ORIGIN=true`
- `PANEL_BASIC_AUTH_ENABLED=true`
- `PANEL_LOGIN_USER=<usuario>`
- `PANEL_LOGIN_PASSWORD=<senha forte com 16+ chars>`
- `PANEL_SESSION_SECRET=<chave aleatoria com 32+ chars>`
- `PANEL_SESSION_MAX_AGE_SEC=43200` (expiracao absoluta)
- `PANEL_SESSION_IDLE_TIMEOUT_SEC=1800` (expiracao por inatividade)
- `PANEL_LOGIN_MAX_FAILURES_PER_IP=5`
- `PANEL_LOGIN_FAILURE_WINDOW_SEC=900`
- `PANEL_LOGIN_LOCKOUT_SEC=1800`
- `DB_PATH=/var/data/bot_sdj_nivers.db`
- `WHATSAPP_AUTH_PATH=/var/data/whatsapp-auth`
- `REMINDER_DAYS_BEFORE=5,3,1`

Opcional (mais restritivo):

- `PANEL_IP_ALLOWLIST=<seu_ip_publico>`

Observacao: se a senha no `.env` comecar com `#`, use aspas (ex.: `PANEL_LOGIN_PASSWORD="#senha"`).
Para desenvolvimento local, voce pode usar `CSRF_CHECK_ORIGIN=false` para evitar falso positivo de host/origem.

### Blueprint Render (`render.yaml`)

O arquivo `render.yaml` foi adicionado para facilitar deploy com:

- Web Service Node
- `Persistent Disk` montado em `/var/data`
- Variaveis de ambiente de producao
- Segredos marcados com `sync: false` / `generateValue`

### Checklist de deploy seguro na Render

1. Crie um **Persistent Disk** e monte em `/var/data`.
2. Aponte `DB_PATH` e `WHATSAPP_AUTH_PATH` para esse disco.
3. Use apenas **1 instancia** do servico (evita invalidacao da sessao do WhatsApp).
4. Configure credenciais e `PANEL_SESSION_SECRET` via Environment Variables (nunca no codigo).
5. Escaneie o QR uma unica vez apos o deploy inicial.
6. Nao apague o disco persistente em redeploys.
