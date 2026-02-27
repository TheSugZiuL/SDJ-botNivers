# Security Policy

## Versões suportadas

Este projeto é mantido no branch principal (`main`).
Correções de segurança são aplicadas na versão mais recente.

## Reportando vulnerabilidades

Se você identificar uma falha de segurança:

1. Não abra issue pública com detalhes exploráveis.
2. Envie um relato privado para o mantenedor do repositório.
3. Inclua:
   - descrição da falha;
   - impacto;
   - passos de reprodução;
   - sugestão de correção (opcional).

## Boas práticas para deploy

- Use `NODE_ENV=production`.
- Defina `PANEL_LOGIN_PASSWORD` forte (16+).
- Defina `PANEL_SESSION_SECRET` com 32+ caracteres aleatórios.
- Mantenha `REQUIRE_HTTPS=true` em produção.
- Não exponha `.env`, banco SQLite e sessão do WhatsApp em repositórios públicos.
