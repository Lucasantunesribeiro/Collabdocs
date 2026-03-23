# CollabDocs

Plataforma de documentos colaborativos com edição em tempo real, construída sobre Cloudflare Workers (TypeScript) e ASP.NET Core 8 (C#).

## Links de Produção

| Serviço | URL |
|---|---|
| **Frontend** (Next.js / Vercel) | [https://collabdocs-app.vercel.app](https://collabdocs-app.vercel.app) |
| **Worker API** (Cloudflare Workers) | [https://collab-docs.collabdocs.workers.dev](https://collab-docs.collabdocs.workers.dev) |
| **Worker Health** | [https://collab-docs.collabdocs.workers.dev/api/health](https://collab-docs.collabdocs.workers.dev/api/health) |
| **.NET API** (Render.com) | [https://collabdocs-dotnet-api.onrender.com](https://collabdocs-dotnet-api.onrender.com) |
| **.NET Swagger** | [https://collabdocs-dotnet-api.onrender.com/swagger](https://collabdocs-dotnet-api.onrender.com/swagger) |

## Stack

### TypeScript Worker (Cloudflare)
- **Runtime**: Cloudflare Workers (V8 isolates, zero cold-start)
- **Banco**: Cloudflare D1 (SQLite serverless)
- **WebSocket**: Cloudflare Durable Objects (`DocumentSession`) — sessões de colaboração em tempo real
- **Rate Limiting**: Cloudflare Durable Objects (`RateLimiter`) — 20 req/min por IP, in-memory
- **Email**: Cloudflare Queues + MailChannels — notificações assíncronas ao adicionar colaborador
- **Auth**: JWT Bearer (HS256) verificado com Web Crypto API nativa
- **Observabilidade**: Cloudflare Logpush + structured JSON logging (NDJSON)

### ASP.NET Core 8 (C# / .NET)
- **Arquitetura**: Clean Architecture (Domain → Application → Infrastructure → API)
- **CQRS**: MediatR 12 — commands/queries/handlers isolados
- **ORM**: Entity Framework Core 8 + Npgsql (PostgreSQL)
- **Auth**: JWT Bearer HS256 (mesmo secret do Worker)
- **Observabilidade**: OpenTelemetry (OTLP) — tracing distribuído compatível com Honeycomb.io
- **Testes**: xUnit + Moq + FluentAssertions (10 testes unitários)

### Frontend (Next.js / Vercel)
- **Framework**: Next.js 14 App Router
- **Auth**: NextAuth (OAuth GitHub + Google)
- **Real-time**: WebSocket para edição colaborativa

## Arquitetura do Worker

```
Request
  ↓
router.ts        — URL routing + request timing
  ↓
middleware/      — JWT auth, CORS, DO-based rate limiting
  ↓
handlers.ts      — HTTP parsing, thin orchestration
  ↓
application/     — Use cases (documents, collaborators)
  ↓
infrastructure/  — D1 SQL queries (pure functions)
```

## Desenvolvimento Local

### Pré-requisitos
- Node.js 20+
- Docker + Docker Compose
- .NET 8 SDK (para o backend C#)

### Worker + Frontend
```bash
npm install
npm run dev          # Next.js frontend (localhost:3000)
wrangler dev         # Worker local (localhost:8787)
```

### Stack completa com Docker
```bash
docker-compose up    # PostgreSQL + .NET API + Next.js
```

### .NET API isolada
```bash
cd dotnet
dotnet run --project src/CollabDocs.API
# Disponível em http://localhost:5000/swagger
```

### Banco de dados (D1 local)
```bash
wrangler d1 execute COLLAB_DOCS_DB --local --file migrations/0001_init.sql
# Repetir para cada migration
```

## Testes

```bash
# Unit tests (Worker TypeScript) — 41 testes
npx vitest run tests/unit/

# xUnit (.NET) — 10 testes
cd dotnet && dotnet test

# E2E (Playwright)
npx playwright test
```

## CI/CD

GitHub Actions (`main` branch):

| Job | O que faz |
|---|---|
| `quality` | TypeScript typecheck + Next.js build |
| `test` | Vitest unit tests |
| `e2e` | Playwright E2E |
| `security` | npm audit |
| `dotnet-test` | dotnet build + xUnit |

## Deploy

### Worker (Cloudflare)
```bash
wrangler login
wrangler deploy
```

### .NET API (Render.com)
O arquivo `render.yaml` define o Blueprint. No dashboard do Render:
1. **New → Blueprint** → conectar este repositório
2. As variáveis `ConnectionStrings__Default` (auto via banco gerenciado) e `Jwt__Secret` serão criadas
3. Para OpenTelemetry (Honeycomb): definir `OTEL_EXPORTER_OTLP_ENDPOINT` e `OTEL_EXPORTER_OTLP_HEADERS`

### Frontend (Vercel)
Deploy automático via push para `main`. Variáveis necessárias:
```
NEXTAUTH_SECRET=<mesmo valor do NEXTAUTH_SECRET do Worker>
GITHUB_ID=<app OAuth do GitHub>
GITHUB_SECRET=<secret do app>
GOOGLE_CLIENT_ID=<credencial Google>
GOOGLE_CLIENT_SECRET=<secret Google>
NEXT_PUBLIC_API_URL=https://collab-docs.collabdocs.workers.dev/api
NEXT_PUBLIC_WS_URL=wss://collab-docs.collabdocs.workers.dev
```

## Variáveis de Ambiente do Worker

Configurar secrets no dashboard Cloudflare (`wrangler secret put <KEY>`):

| Variável | Descrição |
|---|---|
| `NEXTAUTH_SECRET` | Secret compartilhado para JWT (HS256) |
| `ALLOWED_ORIGINS` | Origins CORS comma-separated |
| `GITHUB_CLIENT_ID/SECRET` | OAuth GitHub |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth Google |

## Funcionalidades

- **Documentos**: CRUD com controle de acesso (owner/write/read) e optimistic locking (versão + 409)
- **Colaboradores**: Adicionar/remover por email, notificação por email automática via Cloudflare Queues
- **Real-time**: WebSocket via Durable Objects — presença de usuários e broadcast de atualizações
- **Audit trail**: Todas as operações de escrita registradas em `document_audit_log`
- **Rate limiting**: 20 req/min por IP via Durable Object (fail-open)
- **Segurança**: Sem debug endpoints, CORS por origin whitelist, JWT Bearer only
