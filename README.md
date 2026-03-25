# CollabDocs

Plataforma de documentos colaborativos com edição em tempo real, construída sobre Cloudflare Workers (TypeScript) e ASP.NET Core 9 (C#).

## Links de Produção

| Serviço | URL |
|---|---|
| **Frontend** (Next.js / Vercel) | [https://collabdocs-app.vercel.app](https://collabdocs-app.vercel.app) |
| **Worker API** (Cloudflare Workers) | [https://collab-docs.collabdocs.workers.dev](https://collab-docs.collabdocs.workers.dev) |
| **Worker Health** | [https://collab-docs.collabdocs.workers.dev/api/health](https://collab-docs.collabdocs.workers.dev/api/health) |
| **.NET API** (AWS Lambda) | [https://gexxy5wfog4drgronvtfs7re4a0mcopr.lambda-url.us-east-1.on.aws](https://gexxy5wfog4drgronvtfs7re4a0mcopr.lambda-url.us-east-1.on.aws) |
| **.NET Health** | [https://gexxy5wfog4drgronvtfs7re4a0mcopr.lambda-url.us-east-1.on.aws/health](https://gexxy5wfog4drgronvtfs7re4a0mcopr.lambda-url.us-east-1.on.aws/health) |

## Arquitetura

O sistema é dividido em três contextos delimitados com responsabilidades distintas:

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (Vercel)                │
│  secure-api.ts → /api/dotnet proxy → .NET API              │
│                → Cloudflare Worker (WebSocket)              │
└─────────────┬────────────────────────┬───────────────────────┘
              │                        │
              ▼                        ▼
┌─────────────────────┐   ┌────────────────────────────┐
│  .NET API           │   │  Cloudflare Worker          │
│  (AWS Lambda)       │   │  (Durable Objects)          │
│                     │   │                             │
│  CRUD documentos    │   │  WebSocket / presença        │
│  Regras de negócio  │   │  Rate limiting (DO)          │
│  Audit log          │   │  Email via Queues            │
│  Outbox + RabbitMQ  │   │  D1 (SQLite serverless)      │
│  Redis cache        │   │                             │
│  PostgreSQL (Neon)  │   │                             │
└─────────────────────┘   └────────────────────────────┘
```

### Contextos Delimitados

| Contexto | Responsabilidade | Stack |
|---|---|---|
| **Gerenciamento de Documentos** | CRUD, permissões, regras de negócio, audit | .NET API + PostgreSQL (Neon) |
| **Colaboração em Tempo Real** | WebSocket, presença, broadcasting | Cloudflare Worker + Durable Objects + D1 |
| **Frontend** | UI, autenticação OAuth, proxy para as APIs | Next.js 14 + NextAuth + Vercel |

## Stack

### ASP.NET Core 9 (C# / .NET)
- **Arquitetura**: Clean Architecture (Domain → Application → Infrastructure → API)
- **CQRS**: MediatR 12 — commands/queries/handlers isolados
- **ORM**: Entity Framework Core 9 + Npgsql (PostgreSQL)
- **Mensageria**: RabbitMQ (topic exchange) + Transactional Outbox Pattern com idempotência
- **Cache**: Redis cache-aside (`docs:user:{userId}`, TTL 5 min) com fallback `NullDocumentCacheService`
- **Auth**: JWT Bearer HS256 (mesmo secret do Worker e do NextAuth)
- **Observabilidade**: OpenTelemetry (OTLP) — tracing distribuído compatível com Honeycomb.io
- **Deploy**: AWS Lambda (container image) + Lambda Web Adapter + Lambda Function URL
- **Banco**: Neon free-tier PostgreSQL (SSL, sem VPC necessária)
- **Testes**: xUnit + Moq + FluentAssertions — 30 testes unitários + 9 de integração (TestContainers PostgreSQL)

### TypeScript Worker (Cloudflare)
- **Runtime**: Cloudflare Workers (V8 isolates, zero cold-start)
- **Banco**: Cloudflare D1 (SQLite serverless)
- **WebSocket**: Cloudflare Durable Objects (`DocumentSession`) — sessões de colaboração em tempo real
- **Rate Limiting**: Cloudflare Durable Objects (`RateLimiter`) — 20 req/min por IP, in-memory
- **Email**: Cloudflare Queues + MailChannels — notificações assíncronas ao adicionar colaborador
- **Auth**: JWT Bearer (HS256) verificado com Web Crypto API nativa
- **Observabilidade**: Cloudflare Logpush + structured JSON logging (NDJSON)

### Frontend (Next.js / Vercel)
- **Framework**: Next.js 14 App Router
- **Auth**: NextAuth (OAuth GitHub + Google)
- **Real-time**: WebSocket para edição colaborativa
- **Proxy**: `/api/dotnet/[...path]` repassa chamadas para o .NET API server-side (nunca expõe a URL do backend)

## Funcionalidades

- **Documentos**: CRUD com visibilidade pública/privada, optimistic locking (versão + 409 Conflict)
- **Visibilidade**: Documentos públicos aparecem para todos os usuários; documentos privados só para o dono e colaboradores explícitos
- **Colaboradores**: Adicionar/remover por email com permissões (owner/editor/viewer); notificação por email automática
- **Real-time**: WebSocket via Durable Objects — presença de usuários e broadcast de atualizações
- **Audit trail**: Todas as operações de escrita registradas em `document_audit_log`
- **Rate limiting**: 20 req/min por IP via Durable Object (fail-open)
- **Segurança**: CORS por origin whitelist, JWT Bearer apenas, sem debug endpoints expostos

## Desenvolvimento Local

### Pré-requisitos
- Node.js 20+
- Docker + Docker Compose
- .NET 9 SDK

### Stack completa com Docker
```bash
docker compose up --build
# Frontend:    http://localhost:3000
# .NET API:    http://localhost:5000/swagger
# Worker:      http://localhost:8787
# PostgreSQL:  localhost:5432
# RabbitMQ:    http://localhost:15672 (admin/admin)
# Redis:       localhost:6379
```

### Serviços individuais
```bash
# Frontend Next.js
npm install && npm run dev          # localhost:3000

# Cloudflare Worker
wrangler dev                        # localhost:8787

# .NET API
cd dotnet && dotnet run --project src/CollabDocs.API
# localhost:5000/swagger
```

### Migrações do banco de dados

**D1 (Worker):**
```bash
wrangler d1 migrations apply COLLAB_DOCS_DB --local   # todas as pendentes (local)
wrangler d1 migrations apply COLLAB_DOCS_DB            # todas as pendentes (remoto)
```

**PostgreSQL (.NET):**
```bash
# EF Core migrations (executar dentro de dotnet/)
dotnet ef migrations add <Nome> \
  --project src/CollabDocs.Infrastructure \
  --startup-project src/CollabDocs.API
dotnet ef database update \
  --project src/CollabDocs.Infrastructure \
  --startup-project src/CollabDocs.API
```
As migrations também rodam automaticamente no startup do Lambda (`db.Database.Migrate()`).

## Testes

```bash
# Unit tests (.NET) — 30 testes
cd dotnet && dotnet test tests/CollabDocs.Tests.Unit -c Release

# Integration tests (.NET) — 9 testes (requer Docker para TestContainers)
cd dotnet && dotnet test tests/CollabDocs.Tests.Integration -c Release

# Todos os testes .NET
cd dotnet && dotnet test

# Unit tests TypeScript (Vitest)
npm run test

# E2E (Playwright)
npx playwright test
```

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`) — acionado em push para `main` quando arquivos em `dotnet/**` mudam:

| Job | O que faz |
|---|---|
| `check-aws-secrets` | Verifica se os secrets AWS estão configurados; pula o deploy graciosamente se não estiverem |
| `dotnet-build` | `dotnet build` + `dotnet test` (unit tests) |
| `build-and-push` | Build da imagem Docker + push para Amazon ECR |
| `deploy` | `aws lambda update-function-code` + aguarda atualização + health check no endpoint `/health` |

**Autenticação AWS**: OIDC (sem credenciais de longa duração armazenadas no GitHub).

**Secrets necessários no GitHub:**

| Secret | Valor |
|---|---|
| `AWS_ROLE_ARN` | `arn:aws:iam::246599827442:role/github-actions-collabdocs` |
| `AWS_REGION` | `us-east-1` |
| `ECR_REPOSITORY` | `collabdocs-api` |

## Deploy

### .NET API (AWS Lambda)

Infraestrutura provisionada manualmente (sem CloudFormation):

```bash
# Criar repositório ECR
aws ecr create-repository --repository-name collabdocs-api --region us-east-1

# Build e push manual (normalmente feito pelo CI)
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 246599827442.dkr.ecr.us-east-1.amazonaws.com
docker build -f dotnet/src/CollabDocs.API/Dockerfile -t collabdocs-api dotnet
docker tag collabdocs-api:latest \
  246599827442.dkr.ecr.us-east-1.amazonaws.com/collabdocs-api:latest
docker push 246599827442.dkr.ecr.us-east-1.amazonaws.com/collabdocs-api:latest

# Atualizar código do Lambda
aws lambda update-function-code \
  --function-name collabdocs-api \
  --image-uri 246599827442.dkr.ecr.us-east-1.amazonaws.com/collabdocs-api:latest \
  --region us-east-1
```

**Configurações do Lambda:**
- Memória: 512 MB | Timeout: 30s
- Runtime: container image com Lambda Web Adapter (`public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4`)
- `PORT=5000` + `AWS_LWA_READINESS_CHECK_PATH=/health`
- Function URL com `AuthType: NONE` (acesso público)

**Banco de dados**: Neon free-tier PostgreSQL (SSL, sem necessidade de VPC). Configure a connection string nas variáveis de ambiente do Lambda:
```
ConnectionStrings__Default=Host=...;Database=...;Username=...;Password=...;SSL Mode=Require
```

**RabbitMQ / Redis**: Omitidos intencionalmente na produção. O app degrada graciosamente:
- Sem `RabbitMQ:Host` → `OutboxPublisherService` não registrado; mensagens acumulam no DB
- Sem `ConnectionStrings:Redis` → usa `NullDocumentCacheService` (sem cache, sem erro)

### Worker (Cloudflare)
```bash
wrangler login
wrangler deploy
```

### Frontend (Vercel)
Deploy automático via push para `main`. Variáveis de ambiente necessárias:

| Variável | Descrição |
|---|---|
| `NEXTAUTH_SECRET` | Secret JWT compartilhado (igual ao Worker e ao .NET API) |
| `NEXTAUTH_URL` | URL de produção do app (`https://collabdocs-app.vercel.app`) |
| `GOOGLE_CLIENT_ID` | ID do cliente OAuth Google |
| `GOOGLE_CLIENT_SECRET` | Secret do cliente OAuth Google |
| `GITHUB_CLIENT_ID` | ID do app OAuth GitHub |
| `GITHUB_CLIENT_SECRET` | Secret do app OAuth GitHub |
| `DOTNET_API_URL` | URL do .NET API (server-side apenas, nunca exposta ao browser) |
| `NEXT_PUBLIC_API_URL` | URL do Cloudflare Worker |

> `DOTNET_API_URL` já está configurado em `vercel.json`. As demais devem ser configuradas no dashboard do Vercel ou via CLI (`vercel env add`).

**Google OAuth**: Adicionar `https://collabdocs-app.vercel.app/api/auth/callback/google` nos URIs de redirecionamento autorizados no Google Cloud Console.

## Variáveis de Ambiente do Worker

Configurar via `wrangler secret put <KEY>` ou no dashboard da Cloudflare:

| Variável | Descrição |
|---|---|
| `NEXTAUTH_SECRET` | Secret compartilhado para verificação JWT (HS256) |
| `ALLOWED_ORIGINS` | Origins CORS separados por vírgula |
| `GITHUB_CLIENT_ID` | OAuth GitHub |
| `GITHUB_CLIENT_SECRET` | OAuth GitHub |
| `GOOGLE_CLIENT_ID` | OAuth Google |
| `GOOGLE_CLIENT_SECRET` | OAuth Google |

## Variáveis de Ambiente do .NET API

Configurar nas variáveis de ambiente do Lambda (ou `appsettings.json` local):

| Variável | Descrição | Obrigatório |
|---|---|---|
| `Jwt__Secret` | Secret JWT (mesmo valor do `NEXTAUTH_SECRET`) | Sim |
| `ConnectionStrings__Default` | PostgreSQL connection string | Sim |
| `ConnectionStrings__Redis` | Redis connection string | Não (fallback sem cache) |
| `RabbitMQ__Host` | Hostname do RabbitMQ | Não (fallback sem mensageria) |
| `RabbitMQ__Port` | Porta do RabbitMQ (padrão: 5672) | Não |
| `RabbitMQ__Username` | Usuário do RabbitMQ | Não |
| `RabbitMQ__Password` | Senha do RabbitMQ | Não |
| `AllowedOrigins__0` | Primeira origin CORS permitida | Não (padrão: localhost:3000) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint OTLP (ex: Honeycomb) | Não |
| `OTEL_EXPORTER_OTLP_HEADERS` | Headers OTLP (ex: `x-honeycomb-team=...`) | Não |

## Estrutura do Projeto

```
collabdocs/
├── src/                          # Frontend Next.js
│   ├── app/
│   │   └── api/dotnet/[...path]/ # Proxy server-side para o .NET API
│   ├── lib/
│   │   ├── auth.ts               # NextAuth + geração do workerToken
│   │   └── secure-api.ts         # Singleton: roteia CRUD → .NET, WS → Worker
│   └── types/shared.ts           # Tipos espelhados do Worker
│
├── workers/                      # Cloudflare Worker (TypeScript)
│   ├── index.ts
│   ├── api/                      # Handlers + router
│   ├── application/              # Use cases
│   ├── collaboration/            # Durable Objects (DocumentSession, RateLimiter)
│   ├── infrastructure/db.ts      # D1 queries
│   └── middleware/               # Auth, CORS, rate limit
│
├── dotnet/                       # ASP.NET Core 9
│   ├── src/
│   │   ├── CollabDocs.Domain/    # Entidades, eventos, enums, interfaces
│   │   ├── CollabDocs.Application/ # Commands, queries, handlers, DTOs
│   │   ├── CollabDocs.Infrastructure/ # EF Core, repositórios, Redis, RabbitMQ, Outbox
│   │   └── CollabDocs.API/       # Controllers, Program.cs, Dockerfile
│   └── tests/
│       ├── CollabDocs.Tests.Unit/        # 30 testes (xUnit + Moq)
│       └── CollabDocs.Tests.Integration/ # 9 testes (TestContainers PostgreSQL)
│
├── migrations/                   # Migrações D1/SQLite (Worker)
├── aws/                          # Stacks CloudFormation e App Runner (referência)
├── .github/workflows/deploy.yml  # CI/CD: build → ECR → Lambda
├── docker-compose.yml            # Stack local completa
├── vercel.json                   # Config Vercel + env vars
└── wrangler.toml                 # Config Cloudflare Worker
```
