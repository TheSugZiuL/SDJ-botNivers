# Contribuindo

Obrigado por considerar contribuir com o Bot-SDJ-Nivers.

## Como colaborar

1. Faça um fork do projeto.
2. Crie uma branch de feature/correção: `git checkout -b feat/minha-melhoria`.
3. Faça commits pequenos e com mensagem clara.
4. Abra um Pull Request descrevendo:
   - problema resolvido;
   - abordagem técnica;
   - impacto esperado.

## Boas práticas

- Não commite dados locais (`data/`, `.env`, sessões do WhatsApp).
- Nunca publique credenciais reais em issues/PRs.
- Mantenha compatibilidade com Node.js LTS.
- Preserve as proteções existentes de segurança (CSRF, auth, rate-limit, headers).

## Ambiente local

1. Copie `.env.example` para `.env`.
2. Configure as variáveis obrigatórias.
3. Instale dependências: `npm ci`
4. Inicialize o banco: `npm run db:init`
5. Inicie o projeto: `npm run dev`

## Escopo de PR

- Prefira PRs pequenos.
- Mudanças de segurança devem incluir explicação de risco e mitigação.
- Se alterar comportamento de rotas/telas, inclua evidências (captura ou passo a passo).
