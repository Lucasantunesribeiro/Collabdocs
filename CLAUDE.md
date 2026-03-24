# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Frontend (Next.js):**
```bash
npm run dev          # Start dev server on localhost:3000
npm run build        # Production build
npm run typecheck    # TypeScript type check (Next.js)
npm run typecheck:workers  # TypeScript type check (Cloudflare Workers)
npm run lint         # ESLint
npm run test         # Run Vitest unit/integration tests
```

**Backend (Cloudflare Workers):**
```bash
wrangler dev           # Start worker locally on localhost:8787
wrangler deploy        # Deploy to Cloudflare Workers
wrangler tail          # Stream live logs
```

**Database migrations:**
```bash
wrangler d1 migrations apply COLLAB_DOCS_DB                                          # Apply all pending to remote D1
wrangler d1 execute COLLAB_DOCS_DB --local --file=migrations/<file>.sql              # Apply single file locally
wrangler d1 migrations apply COLLAB_DOCS_DB --local                                  # Apply all locally
```

**ASP.NET Core backend (dotnet/):**
```bash
cd dotnet && dotnet build                     # Build
cd dotnet && dotnet test                      # Run all tests (unit + integration)
cd dotnet && dotnet test dotnet/tests/CollabDocs.Tests.Unit     # Unit tests only
cd dotnet && dotnet test dotnet/tests/CollabDocs.Tests.Integration  # Integration tests (requires Docker)
cd dotnet && dotnet run --project src/API     # Start API on localhost:5000
```

**EF Core migrations (run from dotnet/ directory):**
```bash
dotnet ef migrations add <Name> --project src/CollabDocs.Infrastructure --startup-project src/CollabDocs.API
dotnet ef database update --project src/CollabDocs.Infrastructure --startup-project src/CollabDocs.API
```

**Docker:**
```bash
docker compose up --build          # Start full local stack (frontend + worker + dotnet API + PostgreSQL + RabbitMQ + Redis)
docker compose up frontend         # Frontend only
docker compose up dotnet-api       # .NET API + PostgreSQL + RabbitMQ + Redis
```

## Architecture

This is a **split-deployment** app with three bounded contexts:

### Bounded Contexts

1. **Document Management** — .NET API (`dotnet/`) + PostgreSQL
   - CRUD operations, business rules, permissions, audit logging
   - Frontend communicates via `NEXT_PUBLIC_DOTNET_API_URL`

2. **Real-Time Collaboration** — Cloudflare Worker (`workers/`) + Durable Objects + D1
   - WebSocket sessions, presence broadcasting
   - Frontend communicates via `NEXT_PUBLIC_API_URL`

3. **Frontend** — Next.js on Vercel
   - `src/lib/secure-api.ts` routes document CRUD to .NET API, WebSocket to Worker

### Auth Flow

NextAuth (`src/lib/auth.ts`) handles OAuth with GitHub and Google. On login, the `session` callback generates a **workerToken** — a JWT signed with `NEXTAUTH_SECRET` using Node.js `jsonwebtoken`. This token is sent as `Authorization: Bearer <workerToken>` to the Worker and .NET API.

The Worker (`workers/api/handlers.ts`) verifies this token using `@tsndr/cloudflare-worker-jwt` (Cloudflare-compatible — **not** `jsonwebtoken`). Both sides use the same `NEXTAUTH_SECRET`.

**WebSocket auth**: Since browsers cannot set `Authorization` headers on WS upgrade requests, the JWT is passed as `?token=<jwt>` query param, verified server-side in `workers/api/router.ts` before forwarding to the Durable Object. The DO receives `__verified_userId/__verified_userName` from the router (server-trusted only).

### .NET API Layer Structure (Clean Architecture)

```
dotnet/
  src/
    CollabDocs.Domain/
      Entities/           # Document, User, DocumentCollaborator (rich entities)
      Events/             # IDomainEvent, DocumentCreatedEvent, DocumentUpdatedEvent, DocumentDeletedEvent
      Outbox/             # OutboxMessage (Transactional Outbox Pattern)
      Interfaces/         # IDocumentRepository, IUserRepository, ICollaboratorRepository, IAuditService, IOutboxRepository
      Enums/              # Visibility, Permission
    CollabDocs.Application/
      Commands/           # CreateDocumentCommand, UpdateDocumentCommand, DeleteDocumentCommand (with IdempotencyKey)
      Queries/            # GetDocumentsQuery, GetDocumentByIdQuery
      Handlers/           # MediatR handlers (one per command/query)
      DTOs/               # DocumentDto, request DTOs
      Interfaces/         # IDocumentCacheService (port for Redis cache)
    CollabDocs.Infrastructure/
      Data/               # AppDbContext (EF Core, includes OutboxMessages DbSet)
      Repositories/       # DocumentRepository, UserRepository, CollaboratorRepository
      Outbox/             # OutboxRepository (atomic write with domain entities)
      Messaging/          # OutboxPublisherService (polls DB, publishes to RabbitMQ), DocumentEventConsumer, RabbitMQSettings
      Cache/              # DocumentCacheService (Redis, cache-aside), NullDocumentCacheService (fallback)
      Services/           # AuditService
      Migrations/         # EF Core migrations
    CollabDocs.API/
      Controllers/        # DocumentsController, HealthController
      Program.cs          # DI registration, JWT, Swagger, CORS, OpenTelemetry, migrations on startup
  tests/
    CollabDocs.Tests.Unit/        # xUnit + Moq + FluentAssertions (13 tests)
    CollabDocs.Tests.Integration/ # xUnit + TestContainers (PostgreSQL real DB, 8 tests)
```

### Transactional Outbox Pattern

Domain events are written atomically with entity changes:
1. Handler calls `outboxRepository.AddAsync(message)` — stages message in EF DbContext change tracker (no SaveChanges)
2. Handler calls `documentRepository.AddAsync/UpdateAsync/DeleteAsync()` — calls `SaveChangesAsync()` which commits both atomically
3. `OutboxPublisherService` BackgroundService polls every 5s, publishes to RabbitMQ, marks processed/failed (max 5 retries)
4. Degrades gracefully: if RabbitMQ is unavailable, messages accumulate in DB and retry on reconnect

### Redis Cache (Cache-Aside Pattern)

- `GET /api/documents` checks Redis first (key: `docs:user:{userId}`, TTL: 5 min)
- On cache miss, queries PostgreSQL and populates cache
- Cache invalidated on any write (create/update/delete) for that user's key
- Falls back to `NullDocumentCacheService` (no-op) when Redis connection string is missing or Redis is unavailable

### Worker Layer Structure

```
workers/
  index.ts                  # Entry point, delegates to router
  domain/types.ts           # Domain interfaces (Document, User, Permission, JWTPayload)
  infrastructure/db.ts      # D1 repository functions (pure data access)
  application/documents.ts  # Document use cases (business logic)
  application/collaborators.ts  # Collaborator use cases
  middleware/auth.ts        # JWT verification middleware (verifyToken + verifyWebSocketToken)
  middleware/rateLimit.ts   # IP-based rate limiting (20 req/min via D1)
  middleware/cors.ts        # CORS with env-driven whitelist
  api/handlers.ts           # Thin HTTP handlers (route → use case → response)
  api/router.ts             # Routing + WebSocket upgrade with JWT verification
  lib/logger.ts             # Structured JSON logger
  collaboration/DocumentSession.ts   # Durable Object: WebSocket sessions, presence broadcast
  collaboration/RateLimiter.ts       # Durable Object: rate limiting in-memory per IP
  queues/emailConsumer.ts   # Cloudflare Queue consumer for MailChannels email
```

### Frontend → Backend Communication

`src/lib/secure-api.ts` is the singleton `secureApiService`:
- Document CRUD → `.NET API` (`NEXT_PUBLIC_DOTNET_API_URL`)
- WebSocket / Collaborators → Cloudflare Worker (`NEXT_PUBLIC_API_URL`)
- URL resolution: localhost → `localhost:5000` (.NET) / `localhost:8787` (Worker), Vercel → env vars

### Database Schema (D1 / SQLite)

Migrations in `migrations/` (apply sequentially):
- `0001_init.sql` — `documents` table
- `0002_add_content_column.sql` — adds `content` column
- `0003_add_users_table.sql` — `users` table
- `0004_add_collaborators_table.sql` — `document_collaborators` (roles: owner/editor/viewer)
- `0005_add_rate_limits.sql` — `rate_limits` table for IP throttling
- `0006_add_audit_log.sql` — `document_audit_log` for auditability
- `0007_add_document_version.sql` — `version` column for optimistic concurrency

### CORS

Allowed origins are set via **`ALLOWED_ORIGINS` env var** in `wrangler.toml` (comma-separated). Fallback: `http://localhost:3000`. Add new origins in `wrangler.toml` without touching code.

### Type Sharing

`src/types/shared.ts` mirrors the domain types from `workers/domain/types.ts`. Keep them in sync when modifying domain entities.

## Environment Variables

**Next.js (Vercel):**
- `NEXTAUTH_SECRET` — shared secret for signing workerTokens (must match Worker and .NET API)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- `NEXT_PUBLIC_DOTNET_API_URL` — .NET API base URL (Document Management context)
- `NEXT_PUBLIC_API_URL` — Cloudflare Worker base URL (Real-Time Collaboration context)

**Cloudflare Workers (`wrangler secret put <KEY>`):**
- `NEXTAUTH_SECRET` — must match Next.js value exactly
- `GITHUB_CLIENT_ID/SECRET` / `GOOGLE_CLIENT_ID/SECRET`
- `ALLOWED_ORIGINS` — comma-separated CORS whitelist
- `DB` — D1 binding (defined in `wrangler.toml`)

**ASP.NET Core (`dotnet/src/API/appsettings.json` or environment):**
- `Jwt:Secret` — JWT signing secret (same as NEXTAUTH_SECRET)
- `ConnectionStrings:Default` — PostgreSQL connection string
- `ConnectionStrings:Redis` — Redis connection string (optional, falls back to NullDocumentCacheService)
- `RabbitMQ:Host` — RabbitMQ hostname (default: localhost)
- `RabbitMQ:Port` — RabbitMQ port (default: 5672)
- `RabbitMQ:Username` / `RabbitMQ:Password` — RabbitMQ credentials
- `RabbitMQ:ExchangeName` — topic exchange name (default: collabdocs.events)
- `RabbitMQ:QueueName` — queue name (default: collabdocs.documents)

**AWS (GitHub secrets for deployment):**
- `AWS_ROLE_ARN` — OIDC role ARN for GitHub Actions
- `AWS_REGION` — AWS region (e.g., us-east-1)
- `ECR_REPOSITORY` — ECR repository URI

## AWS Deployment

CloudFormation stack in `aws/cloudformation.yml` provisions:
- ECS Fargate cluster with .NET API (512 CPU, 1024 MB, private subnets)
- ALB in public subnets (health check: `GET /health`)
- RDS PostgreSQL 16 (db.t3.micro, encrypted, private subnets)
- ElastiCache Redis (cache.t3.micro, encrypted, private subnets)
- Amazon MQ (RabbitMQ mq.t3.micro, private subnets)
- SQS FIFO queue (`collabdocs-events.fifo`) with DLQ
- CloudWatch log group `/ecs/collabdocs-api`
- ECR repository for Docker images
- IAM roles with least-privilege (ECR pull, CloudWatch logs, Secrets Manager, SQS)

Deploy: `aws cloudformation deploy --template-file aws/cloudformation.yml --stack-name collabdocs --capabilities CAPABILITY_NAMED_IAM`

CI/CD: GitHub Actions (`aws/deploy.yml`) — triggered on `dotnet/**` changes, uses OIDC auth (no static keys), builds + pushes to ECR, updates ECS service.

## Available MCPs and When to Use Them

Use these MCPs proactively when the task matches:

| MCP | Tools | Use For |
|-----|-------|---------|
| `mcp__context7` | `resolve-library-id`, `query-docs` | Look up up-to-date docs for any library (Next.js, ASP.NET Core, Vitest, Cloudflare Workers, EF Core, etc.) before implementing |
| `mcp__playwright` | `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_fill_form`, `browser_take_screenshot`, `browser_console_messages`, `browser_network_requests` | E2E tests, visual verification, debugging UI flows in the browser |
| `mcp__shadcn-ui` | `get_component`, `list_components`, `get_component_demo`, `get_block` | Get shadcn/ui component source and demos when building UI |
| `mcp__supabase` | `execute_sql`, `apply_migration`, `list_tables`, `get_logs`, `generate_typescript_types` | If project migrates to Supabase; SQL schema exploration |
| `mcp__chrome-devtools` | `take_screenshot`, `evaluate_script`, `get_network_request`, `list_console_messages`, `lighthouse_audit` | Performance audits, debugging, screenshot verification |
| `mcp__sequential-thinking` | `sequentialthinking` | Complex multi-step reasoning before implementing tricky logic |
| `mcp__firecrawl-mcp` | `firecrawl_scrape`, `firecrawl_search` | Scrape external documentation or research when context7 doesn't have it |
| `mcp__exa` | `web_search_exa`, `get_code_context_exa` | Web search for technical solutions and code examples |

## Available Specialized Agents and When to Use Them

Use these agents (via the `Agent` tool) when the task matches:

| Agent | Use For |
|-------|---------|
| `backend-architect` | Implementing/reviewing Worker routes, ASP.NET Core endpoints, API design, EF Core, Clean Architecture decisions, RabbitMQ/messaging patterns, Redis cache design |
| `qa-engineer` | Writing Vitest tests, xUnit tests, Playwright E2E tests, TestContainers integration tests, test strategy, pre-PR test coverage review |
| `lucas-frontend-engineer` | Next.js pages/components, React state, Tailwind, auth flows in the frontend, dashboard/editor UI |
| `sre-observability` | Structured logging, health checks, metrics, audit trails, OpenTelemetry spans, production readiness review |
| `security-hardening-validator` | Auth middleware review, JWT security, WebSocket auth, CORS validation, input validation, endpoint exposure audit |
| `devops-deploy-architect` | Docker/docker-compose, CI/CD pipeline (GitHub Actions), wrangler deploy config, Dockerfile optimization, AWS ECS/CloudFormation |
| `architecture-advisor` | Major refactoring decisions, layer boundaries, when to split files, bounded context design, dependency injection design |
| `tech-lead-orchestrator` | Production readiness review before merging large PRs, cross-cutting concerns |
| `code-quality-reviewer` | Code review after significant changes — patterns, duplication, edge cases |
| `postgres-architect` | SQL schema design, migration strategy, index optimization (applies to D1/SQLite and EF Core/PostgreSQL) |
| `dx-docs-writer` | README updates, setup guides, environment variable docs after adding new features |
| `llm-integration-architect` | If AI features are added (prompt engineering, Claude API integration) |
| `Explore` | Finding files by pattern, searching for specific code across the codebase |
| `Plan` | Designing implementation strategy before a large feature |
