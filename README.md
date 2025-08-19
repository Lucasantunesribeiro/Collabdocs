# CollabDocs - Plataforma de Documentos Colaborativos

🎉 **Backend 100% Funcional! Frontend em Desenvolvimento**

## 🌐 Acesso ao Sistema

- **Backend API (Cloudflare Worker):** ✅ https://collab-docs.collabdocs.workers.dev/api
- **Auth (Info):** ✅ https://collab-docs.collabdocs.workers.dev/auth/oauth
- **Frontend (Cloudflare Pages):** 🔄 Em desenvolvimento - deploy estático em andamento

> **Status:** Worker API funcionando perfeitamente, frontend sendo configurado para deploy estático

## 👤 Usuários de Teste

- **Modo Demo:** disponível na UI (sem autenticação real)
- **OAuth (GitHub/Google):** endpoints prontos; fluxo completo será habilitado em seguida

## 🚀 Status do Sistema

### ✅ Backend API (Workers)
- **Rota base:** `/api`
- **Status:** Online e funcionando
- **Cold start:** ~10-20ms (edge)
- **CORS:** Configurado para múltiplos domínios

### 🔄 Frontend (Next.js / Pages)
- **Hospedagem:** Cloudflare Pages
- **Status:** Build funcionando, deploy estático em configuração
- **Build:** Next.js 15 (App Router) - OK
- **Deploy:** Ajustando para export estático

### ℹ️ Infra (Free Tier)
- **D1 (DB):** ativo
- **KV:** ativo (cache)
- **R2 (snapshots):** desabilitado por enquanto
- **Durable Objects:** desabilitado por enquanto (sem WebSocket)

## 📊 Funcionalidades Disponíveis

- ✅ **Health da API** - Endpoint `/api` com descrição dos endpoints
- ✅ **Auth endpoints** - `/auth` e `/auth/oauth` com respostas informativas
- ✅ **CORS configurado** - Para domínios Pages e local
- ✅ **Dashboard estático** - Com exemplos (UI)
- ✅ **Página de documento** - `/document/demo` com editor básico (modo demo)
- ✅ **Build Next.js** - Funcionando perfeitamente

## 🔧 Tecnologias

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Editor:** Base simplificada (modo demo), integração futura com Tiptap + Yjs
- **Backend:** Cloudflare Workers (Typescript)
- **Dados:** Cloudflare D1 (SQL), KV (cache)
- **Monorepo:** Turborepo

## 🔄 Manutenção

### Deploy
```bash
# Worker (API) - FUNCIONANDO
wrangler deploy

# Pages (Frontend) - EM CONFIGURAÇÃO
wrangler pages deploy apps/web/.next --project-name collab-docs-frontend --commit-dirty=true
```

### Logs e Diagnóstico
```bash
# Logs do Worker em tempo real
wrangler tail

# Teste de saúde (FUNCIONANDO)
curl -i https://collab-docs.collabdocs.workers.dev/api
curl -i https://collab-docs.collabdocs.workers.dev/auth/oauth
```

### Desenvolvimento
```bash
# Backend (Workers) local
wrangler dev

# Frontend (Next.js)
cd apps/web
npm run dev
```

## 🛡️ Segurança

- ✅ CORS com whitelist dinâmica (Pages + localhost)
- ✅ JWT (payload/assinatura simplificados no protótipo; reforço em produção)
- ✅ Headers padrão e separação de rotas (`/api`, `/auth`)

## 🎯 Problemas Resolvidos

- ✅ **CORS configurado** - Retornando origin correto
- ✅ **Roteamento `/api`** - Inclui raiz `/api` além de `/api/...`
- ✅ **Auth root** - `/auth` e `/auth/oauth` com respostas 200
- ✅ **Remoção de dependências** - R2 e Durable Objects para o plano Free
- ✅ **Build Next.js** - Funcionando perfeitamente

## 🔧 Problema Atual

- **Frontend deploy:** Cloudflare Pages espera arquivos estáticos (HTML, CSS, JS)
- **Next.js build:** Gera build que precisa de servidor Node.js
- **Solução:** Configurar `output: 'export'` ou usar Vercel para deploy

## 📝 Roadmap Próximo

- 🔄 **Resolver deploy frontend** - Export estático ou Vercel
- 🔄 **Habilitar OAuth completo** - GitHub/Google
- 🔄 **Reativar colaboração em tempo real** - Yjs + WebSocket em DO
- 🔄 **Snapshots em R2** - E histórico de versões
- 🔄 **Permissões e compartilhamento** - Avançado

---

**CollabDocs** – Backend funcionando perfeitamente, frontend em configuração final! 🚀

> **Nota:** A API está 100% funcional e pode ser testada. O frontend será disponibilizado assim que o deploy estático for configurado.