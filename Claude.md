# CollabDocs — Guia estratégico (para Claude Code)

**Objetivo:** Instruções completas, passo a passo, para implementar, testar e *deployar 100% grátis* o MVP do **CollabDocs** — editor colaborativo com sincronização em tempo real, workflows multi-etapas, histórico de versões e assistente de escrita opcional (IA). **Este documento foi atualizado para evitar dependência em Supabase** (usuário relatou ter atingido limites do free tier). O guia agora prioriza um stack Cloudflare‑native totalmente compatível com deploy gratuito e preparado para execução automática por Claude Code.

---

## Sumário (rápido)

1. Visão geral do produto
2. Requisitos do MVP (essenciais vs opcionais)
3. Stack recomendada (100% grátis, sem Supabase)
4. Arquitetura e fluxos de dados
5. Modelos de dados / schema (D1/SQLite)
6. Estratégia de colaboração em tempo real (CRDT) — implementação detalhada
7. APIs e contratos — endpoints Workers
8. Autenticação e segurança (sem Supabase)
9. Frontend — estrutura do app e componentes-chave
10. Backend — Workers, Durable Objects, D1, R2 e KV
11. Persistência, backups e versionamento de documentos (D1 + R2)
12. IA (opcional)
13. Testes automatizados e QA
14. Deploy 100% gratuito — passo a passo (Cloudflare-first)
15. Observabilidade, logs e limites das soluções gratuitas (Cloudflare)
16. Roadmap de entrega (sprints e milestones)
17. Checklist final para release do MVP

---

## 1. Visão geral do produto

**CollabDocs** é um editor de documentos colaborativo em tempo real (tipo Notion/Google Docs lite) com:

* Edição simultânea com resolução automática de conflitos (CRDT)
* Comentários e chat por documento
* Kanban de tarefas vinculado aos documentos (fluxo multi-etapas)
* Histórico de versões e permissões (owner/editor/viewer)
* Assistente de escrita (opcional) que sugere resumos/alterações

O MVP foca em colaborar em texto rico (Markdown + blocos simples). A meta é um MVP 100% funcional e hospedado com tecnologias e planos gratuitos — sem depender do Supabase.

---

## 2. Requisitos do MVP

### Essenciais (para lançamento 100% grátis)

* Autenticação de usuários (OAuth providers: GitHub / Google) — evita necessidade de serviço de auth separado
* Criação, edição e salvamento de documentos
* Sincronização em tempo real (múltiplos usuários visualizam/editem simultaneamente)
* Comentários simples e menções
* Histórico de versões (snapshot por N mudanças)
* Interface responsiva (desktop + mobile)
* Deploy gratuito do frontend e backend (Cloudflare Pages + Workers)

### Opcionais (podem ficar para Fase 2)

* Editor WYSIWYG avançado (pode começar com Markdown)
* Videochat integrado (WebRTC)
* Assistente de escrita com LLM (poderá depender de serviços externos)
* Integração com Drive/Dropbox

---

## 3. Stack recomendada (100% grátis, sem Supabase)

**Frontend**

* Next.js (app router) + TypeScript — deploy em **Cloudflare Pages** (free)
* Yjs (CRDT) para sincronização do documento no cliente
* `y-webrtc` para P2P (opcional) + provider custom para Durable Objects
* UI: Tailwind CSS

**Realtime / Orchestration**

* **Cloudflare Workers + Durable Objects** — coordenação de sessão CRDT, presença e repasse de updates

**Database / Auth / Storage (Cloudflare-native)**

* **D1 (Cloudflare)** — banco SQLite compatível para persistência relacional (documents, snapshots, users, permissions)
* **R2 (Cloudflare)** — armazenamento de blobs / snapshots binários (compressão do Yjs state) e assets
* **Workers KV** — armazenar metadados de cache e pointers de sessão (opcional)
* **Auth:** OAuth via GitHub / Google implementado por Workers (exchange + JWT issuance) **(MVP: OAuth only to avoid external auth providers limits)**

  * Alternativa (opcional): Clerk / Auth0 (se preferir uma solução gerenciada; Claude Code pode adicionar integração)

**CI/CD / Git**

* GitHub + GitHub Actions para builds e deploy (wrangler publish)

**Observabilidade / Logs**

* Cloudflare logging & analytics (Workers logs). Para erros, Sentry free tier (opcional).

---

## 4. Arquitetura e fluxos de dados (Cloudflare-first)

1. **Client (Next.js)** monta o documento com editor (Yjs Doc) e conecta via provider a:

   * **Durable Object** (Cloudflare) — cada documento tem seu DO que mantém o estado Yjs em memória e coordena updates; DO faz persistência periódica em **D1** e R2.
2. **D1** armazena tabelas relacionais (users, documents metadata, snapshots meta, permissions).
3. **R2** armazena blobs binários (snapshots compactados do Yjs/Uint8Array) e possíveis attachments.
4. **Workers** expõem endpoints autenticados (JWT) para CRUD, invites e snapshots.
5. **Optional AI**: chamadas a serviços externos via Worker (proxy) para proteger chaves.

---

## 5. Modelos de dados / schema (D1 — SQLite compatible)

> Observação: D1 usa SQL compatível com SQLite; mantenha tipos simples (INTEGER, TEXT, DATETIME, BLOB). Abaixo está um esquema pronto para migrations que Claude Code deve aplicar via `wrangler d1`.

### users

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  provider TEXT,
  provider_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### documents

```sql
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  title TEXT,
  content_json TEXT, -- snapshot JSON small
  visibility TEXT DEFAULT 'private',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_snapshot_id TEXT
);
```

### snapshots

```sql
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  content_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  author_id TEXT,
  version_number INTEGER
);
```

### permissions

```sql
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  user_id TEXT,
  role TEXT CHECK(role IN ('owner','editor','viewer'))
);
```

### comments

```sql
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  user_id TEXT,
  parent_comment_id TEXT,
  content TEXT,
  position_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

> **Blobs (Yjs compressed state):** Claude Code deve gravar o binário comprimido (Uint8Array/encoded) em **R2** e salvar o pointer `r2_key` em `snapshots` ou `documents`.

---

## 6. Estratégia de colaboração em tempo real (CRDT)

### Por quê CRDT?

Yjs continua sendo a melhor opção: offline-first, battle-tested e com bindings para muitos editores.

### Provedores (Cloudflare setup)

* **Primary (recomendado): Durable Objects** — cada documento tem um DO que mantém a Y.Doc em memória. O DO atua como relay entre clientes conectados (via WebSocket-like connections exposed by Workers). DO periodicamente serializa estado e grava em R2/D1.
* **Fallback / Hybrid:** use `y-webrtc` (P2P) quando possível; para persistência e reconexão, backup via DO -> R2.

### Implementação técnica (fluxo)

1. Cliente abre documento: fetch meta `GET /api/documents/:id` -> recebe last snapshot pointer
2. Cliente solicita conexão `GET /ws/:docId` -> Worker roteia para Durable Object
3. DO gerencia lista de conexões; ao receber update Yjs aplica no Y.Doc e broadcast para demais peers
4. DO cria snapshots periódicos (por tempo / número de updates) e grava:

   * compressed binary -> **R2**
   * metadata -> **D1** (snapshots table)
5. Em reconnect: client solicita snapshot R2 -> aplica e depois sincroniza updates ao vivo

### Protocolos / mensagens

* `init` — cliente solicita metadata e última snapshot pointer
* `sync` — stream binário de updates Yjs (base64/Uint8Array) via WebSocket binary frames
* `presence` — mensagens JSON de presença (userId, cursor)
* `comment` — novo comentário broadcasted

### Segurança

* Cada conexão valida JWT (emitido após OAuth worker flow) antes de se conectar ao DO; DO rejeita conexões não autenticadas.

---

## 7. APIs e contratos — endpoints Workers

**REST endpoints (Cloudflare Workers)**

* `POST /api/documents` — criar doc
* `GET /api/documents/:id` — meta + latest snapshot pointer (R2 key)
* `POST /api/documents/:id/snapshot` — upload pointer (DO também chamará internamente)
* `GET /api/documents/:id/history` — listar snapshots (D1)
* `POST /api/documents/:id/comment` — criar comentário
* `POST /api/invite` — criar convite (gera token e envia link via email provider if configured)

**WebSocket-like**

* `GET /ws/:docId` — handshake -> upgrade -> route to Durable Object (binary frames for Yjs updates)

**Payloads**

* Use compact JSON for commands; use binary frames for Yjs updates to avoid base64 overhead.

---

## 8. Autenticação e segurança (sem Supabase)

**MVP approach (recommended): OAuth-only (GitHub + Google)**

* Implement OAuth handshake in a Worker route (`/api/auth/:provider/callback`) that exchanges code for access token, fetches user profile, and issues a signed JWT (HS256) to the client.
* Store minimal user profile in **D1** (id = `provider:provider_id`) to allow permissions checks.
* For sessions, the client stores JWT in httpOnly cookie (via Worker set-cookie) or in memory (for SPA). Prefer cookie for security.

**Alternative (managed)**

* Integrate Clerk or Auth0 if prefer offloading complexity. Claude Code can include optional integration hooks.

**Secrets & env**

* Claude Code must store secrets in Cloudflare (wrangler secrets) or Pages environment: `OAUTH_GITHUB_ID`, `OAUTH_GITHUB_SECRET`, `JWT_SIGNING_KEY`, `CLOUDFLARE_D1_BINDING`, `R2_BUCKET`.

**RLS / Authorization**

* Implement permission checks in Workers/Durable Objects: verify user role in `permissions` table before allowing writes/reads.

---

## 9. Frontend — estrutura e componentes-chave

(Mantém as mesmas orientações do anterior, mas com autenticação via OAuth e leitura de snapshot via R2 pointer)

**Monorepo sugerido**: /apps/web (Next.js) + /packages/ui + /packages/lib (yjs providers)

**Fluxo de inicialização do editor**

* `GET /api/documents/:id` -> recebe metadata + r2\_key
* Se houver r2\_key: fetch `https://<r2-endpoint>/<r2_key>` (signed URL if private) para carregar snapshot binário
* Create Y.Doc, apply snapshot, connect to `GET /ws/:docId` (Worker -> DO)

---

## 10. Backend — Workers / Durable Objects + D1, R2, KV

**Durable Object behavior**

* In-memory Yjs document
* Connections map
* Authentication check on connect
* Persist snapshots to R2 and write metadata in D1

**Workers endpoints**

* `GET /ws/:docId` — upgrade for binary frames
* `POST /api/documents` — create doc (write D1)
* `GET /api/documents/:id` — read D1 and return R2 pointer
* `POST /api/documents/:id/snapshot` — store pointer & metadata in D1
* `POST /api/auth/:provider/callback` — OAuth exchange + JWT creation

**Bindings required (Wrangler)**

* `bindings: { D1: 'COLLAP_DOCS_DB', R2: 'COLLAP_R2', KV: 'COLLAP_KV', DO_NAMESPACE: 'DOC_DO' }`

---

## 11. Persistência, backups e versionamento de documentos (D1 + R2)

* **Snapshots**: DO compressa Yjs state (e.g., `Y.encodeStateAsUpdate`) -> gzip -> store as object in **R2** under `snapshots/<documentId>/<timestamp>.bin`.
* **Metadata**: In `snapshots` table in **D1** store `r2_key`, `version_number`, `author_id`.
* **Retention**: keep last N snapshots (configurável). DO can garbage-collect old R2 keys and delete D1 rows.
* **Backup/Export**: Use Cloudflare API to export D1 (wrangler d1 commands) and `r2` list/copy to local. Claude Code should include a `maintenance/export.sh` that uses Cloudflare API to download snapshots metadata and objects.

---

## 12. IA (opcional)

Mesmo raciocínio anterior: manter AI opcional e por feature-flag. Claude Code deve implementar a infra para chamadas a APIs externas a partir do Worker (proxy) e só ativar se credenciais forem fornecidas.

**Mode free**: client-side grammar checks or LanguageTool public endpoints (rate-limited).

**Mode paid**: Hugging Face or OpenAI via Worker proxy.

---

## 13. Testes automatizados e QA

Mesma recomendação: unit tests (vitest/jest), e2e com Playwright. Incluir testes de integração multi-tab simulando WebSocket frames ao DO.

---

## 14. Deploy 100% gratuito — passo a passo (Cloudflare-first)

### Pré-requisitos (contas grátis)

* GitHub account (repo)
* Cloudflare account (Pages, Workers, D1, R2 — free tier) *— essencial*
* Wrangler CLI (`npm i -g wrangler`)

### Passos (deploy)

1. **Repo**: push code to GitHub. Configure GitHub Actions to run builds.
2. **Cloudflare D1**: criar database via Cloudflare Dashboard / wrangler d1. Rodar migrations (schema acima) via `wrangler d1 migrations apply`.
3. **R2**: criar bucket para snapshots. Configure permissões.
4. **Workers & DO**: criar Durable Objects bindings e publicar via `wrangler publish`.
5. **Pages (frontend)**: conectar repo ao Cloudflare Pages para publicar Next.js app; configure Functions/Pages integration se precisar SSR.
6. **Env / Secrets**: usar `wrangler secret put` para `JWT_SIGNING_KEY`, OAuth secrets.
7. **CI**: GitHub Actions: build frontend, `wrangler publish` para worker, and `wrangler d1 migrations apply` for schema updates.

**Observação:** este fluxo evita criação de serviços externos (como Supabase) e centraliza tudo no Cloudflare free tier.

---

## 15. Observabilidade e limites (Cloudflare free tiers)

* Cloudflare: tem limites de CPU time para Workers, D1 storage e R2 egress; revisar quotas na Dashboard antes de cargas reais.
* Design do DO deve ser eficiente: agrupe updates e evite persistir a cada pequeno evento (use debounce/coalesce).
* Incluir métricas rudimentares (counters em KV) para monitorar uso e alertar quando se aproximar do limite.

---

## 16. Roadmap de entrega (sprints)

Idêntico ao anterior, mas com Sprint 0 incluindo criação de recursos Cloudflare (D1, R2, DO namespace).

---

## 17. Checklist final para release do MVP (Cloudflare-first)

* [ ] OAuth (GitHub/Google) funcionando e perfis gravados em D1
* [ ] Editor com CRDT (Yjs) sincronizando entre duas abas via Durable Objects
* [ ] Durable Object persistindo snapshots para R2 e metadata em D1
* [ ] Comments + presence funcionando
* [ ] Deploy frontend (Cloudflare Pages) e backend (Workers) configurado
* [ ] Scripts de backup (export D1, list R2) prontos
* [ ] README com instruções para rodar local e deploy

---

## Anexos: comandos úteis e exemplos (Cloudflare)

**Wrangler (Cloudflare Workers & Durable Objects & D1)**

```bash
npm i -g wrangler
wrangler login
# publish workers & DO
wrangler publish
# D1 migrations
wrangler d1 migrations create "init" --db COLLAP_DOCS_DB
wrangler d1 migrations apply --db COLLAP_DOCS_DB
```

**Exemplo: salvar snapshot em R2 (Worker)**

```js
// pseudo-code
const buf = compress(yjsStateUint8Array)
await R2_BUCKET.put(`snapshots/${docId}/${ts}.bin`, buf)
await D1.prepare(`INSERT INTO snapshots (...) VALUES (...)`)
```

**WebSocket upgrade (Worker -> DO)**

```js
export async function handleRequest(request, env) {
  if (request.headers.get('upgrade') === 'websocket') {
    const url = new URL(request.url)
    const docId = url.pathname.split('/').pop()
    const id = env.DOC_DO.idFromName(`document:${docId}`)
    const obj = env.DOC_DO.get(id)
    return obj.fetch(request)
  }
}
```

**Export script (maintenance/export.sh)**

```bash
# uses Cloudflare API; Claude Code should fill account_id & token
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DB_ID/export" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -o d1_export.tar.gz
# list R2 keys and download via signed urls
```

---

## Observações finais para Claude Code (diretivas específicas)

1. **Remova dependências com Supabase**: todo código gerado deve usar bindings Cloudflare (D1, R2, KV) e Durable Objects para sincronização e persistência.
2. **Autenticação MVP**: implemente OAuth-only (GitHub + Google) no Worker. Emitir JWT (HS256) assinado com `JWT_SIGNING_KEY` guardado em `wrangler secret`.
3. **Yjs integration**: implemente provider que usa WebSocket binary frames diretamente com DOs (evitar base64 quando possível). Use `y-websocket` protocol as referência e adapte para Cloudflare's WebSocket em Workers/DOs.
4. **Persistence pattern**: DO deve coalescer updates e persistir para R2/D1 apenas com debounce (ex.: 5s or 500 updates) para reduzir consumo de CPU e storage.
5. **Migrations**: Claude Code deve gerar `wrangler d1` migrations SQL com o schema acima e aplicar no deploy pipeline.
6. **CI**: gerar GitHub Actions workflow que faz `npm build`, `wrangler d1 migrations apply` (próximo ao deploy), `wrangler publish`.
7. **Secrets**: use `wrangler secret put` para `JWT_SIGNING_KEY`, `OAUTH_*` pares e `CF_API_TOKEN` se necessário para manutenção scripts.

---

# Fim do guia atualizado — pronto para execução automática por Claude Code

> Nota: se desejar, posso agora gerar os arquivos iniciais do repositório (package.json, tsconfig, template do Durable Object em TypeScript, migrations D1 init SQL e workflow GitHub Actions) adaptados ao stack Cloudflare. Indique quais arquivos você quer primeiro e eu os adiciono ao canvas.
