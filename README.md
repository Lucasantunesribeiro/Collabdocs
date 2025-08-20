
# CollabDocs – Plataforma de Documentos Colaborativos

## Visão Geral

CollabDocs é uma solução moderna para edição colaborativa de documentos, construída com tecnologias de ponta e arquitetura escalável.

- **Backend:** Cloudflare Workers (TypeScript)
- **Frontend:** Next.js 15, React, Tailwind CSS
- **Banco de Dados:** Cloudflare D1 (SQL)
- **Cache:** Cloudflare KV
- **Monorepo:** Turborepo
- **Deploy:** Vercel (frontend) + Cloudflare Workers (backend)

## Acesso

- **API:** [https://collab-docs.collabdocs.workers.dev/api](https://collab-docs.collabdocs.workers.dev/api)
- **Auth:** [https://collab-docs.collabdocs.workers.dev/auth/oauth](https://collab-docs.collabdocs.workers.dev/auth/oauth)
- **Frontend:** Deploy automático via Vercel

## Deploy & Configuração

- **Deploy automático:** Push para `main` → Vercel realiza build e deploy.
- **Build Command:** `cd apps/web && npm run build`
- **Output Directory:** `apps/web/.next`
- **Variáveis de ambiente (Vercel):**
   ```
   NEXT_PUBLIC_API_URL=https://collab-docs.collabdocs.workers.dev
   NEXT_PUBLIC_WS_URL=https://collab-docs.collabdocs.workers.dev
   ```

## Funcionalidades

- Edição colaborativa de documentos (modo demo)
- Autenticação OAuth (GitHub/Google)
- Dashboard estático com exemplos
- API RESTful documentada
- Persistência e isolamento de conteúdo por documento
- Salvamento automático com debounce
- CORS dinâmico e seguro
- JWT simplificado (protótipo)

## Arquitetura

- **Frontend:** Next.js App Router, React, Tailwind CSS
- **Backend:** Cloudflare Workers, API centralizada, integração com D1 e KV
- **Infraestrutura:** Deploy automatizado, logs em tempo real, scripts de migração

## Como Executar

**Backend:**
```bash
wrangler dev         # Desenvolvimento local
wrangler deploy      # Deploy para Cloudflare Workers
wrangler tail        # Logs em tempo real
```

**Frontend:**
```bash
cd apps/web
npm run dev          # Desenvolvimento local
```

**Deploy:**
```bash
git push origin main # Deploy automático na Vercel
```

**Migração de Banco:**
```bash
./scripts/apply-migration-0002.ps1
```

## Testes

- Testes automatizados com Playwright e Vitest
- Scripts para validação de endpoints e persistência

## Segurança

- CORS com whitelist dinâmica
- JWT para autenticação (reforço em produção)
- Separação clara de rotas e headers

## Roadmap

- Habilitar colaboração em tempo real (Yjs + WebSocket)
- Snapshots e histórico de versões (R2)
- Permissões avançadas e compartilhamento
- OAuth completo (GitHub/Google)

---

**CollabDocs** – Plataforma robusta, escalável e pronta para produção. Contribuições são bem-vindas!

---