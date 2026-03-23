# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Frontend (Next.js):**
```bash
npm run dev          # Start dev server on localhost:3000
npm run build        # Production build
npm run typecheck    # TypeScript type check
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
cd dotnet && dotnet test                      # Run xUnit tests
cd dotnet && dotnet run --project src/API     # Start API on localhost:5000
```

**Docker:**
```bash
docker compose up --build          # Start full local stack (frontend + worker + dotnet API)
docker compose up frontend         # Frontend only
```

## Architecture

This is a **split-deployment** app: Next.js frontend on Vercel + TypeScript backend on Cloudflare Workers + (optional) ASP.NET Core backend in `dotnet/`.

### Auth Flow

NextAuth (`src/lib/auth.ts`) handles OAuth with GitHub and Google. On login, the `session` callback generates a **workerToken** — a JWT signed with `NEXTAUTH_SECRET` using Node.js `jsonwebtoken`. This token is sent as `Authorization: Bearer <workerToken>` to the Worker.

The Worker (`workers/api/handlers.ts`) verifies this token using `@tsndr/cloudflare-worker-jwt` (Cloudflare-compatible — **not** `jsonwebtoken`). Both sides use the same `NEXTAUTH_SECRET`.

### Worker Layer Structure

```
workers/
  index.ts                  # Entry point, delegates to router
  domain/types.ts           # Domain interfaces (Document, User, Permission, JWTPayload)
  infrastructure/db.ts      # D1 repository functions (pure data access)
  application/documents.ts  # Document use cases (business logic)
  application/collaborators.ts  # Collaborator use cases
  middleware/auth.ts        # JWT verification middleware
  middleware/rateLimit.ts   # IP-based rate limiting (20 req/min via D1)
  middleware/cors.ts        # CORS with env-driven whitelist
  api/handlers.ts           # Thin HTTP handlers (route → use case → response)
  lib/logger.ts             # Structured JSON logger
```

### Frontend → Worker Communication

`src/lib/secure-api.ts` is the singleton `secureApiService`. URL resolution: localhost → `localhost:8787`, Vercel → `NEXT_PUBLIC_API_URL`.

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
- `NEXTAUTH_SECRET` — shared secret for signing workerTokens (must match Worker)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- `NEXT_PUBLIC_API_URL` — Worker base URL

**Cloudflare Workers (`wrangler secret put <KEY>`):**
- `NEXTAUTH_SECRET` — must match Next.js value exactly
- `GITHUB_CLIENT_ID/SECRET` / `GOOGLE_CLIENT_ID/SECRET`
- `ALLOWED_ORIGINS` — comma-separated CORS whitelist
- `DB` — D1 binding (defined in `wrangler.toml`)

**ASP.NET Core (`dotnet/src/API/appsettings.json`):**
- `Jwt:Secret` — JWT signing secret
- `ConnectionStrings:Default` — SQLite (local) or SQL Server connection string

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
| `backend-architect` | Implementing/reviewing Worker routes, ASP.NET Core endpoints, API design, database query optimization, EF Core, Clean Architecture decisions |
| `qa-engineer` | Writing Vitest tests, xUnit tests, Playwright E2E tests, test strategy, pre-PR test coverage review |
| `lucas-frontend-engineer` | Next.js pages/components, React state, Tailwind, auth flows in the frontend, dashboard/editor UI |
| `sre-observability` | Structured logging, health checks, metrics, audit trails, production readiness review |
| `security-hardening-validator` | Auth middleware review, JWT security, CORS validation, input validation, endpoint exposure audit |
| `devops-deploy-architect` | Docker/docker-compose, CI/CD pipeline (GitHub Actions), wrangler deploy config, Dockerfile optimization |
| `architecture-advisor` | Major refactoring decisions, layer boundaries, when to split files, dependency injection design |
| `tech-lead-orchestrator` | Production readiness review before merging large PRs, cross-cutting concerns |
| `code-quality-reviewer` | Code review after significant changes — patterns, duplication, edge cases |
| `postgres-architect` | SQL schema design, migration strategy, index optimization (applies to D1/SQLite too) |
| `dx-docs-writer` | README updates, setup guides, environment variable docs after adding new features |
| `llm-integration-architect` | If AI features are added (prompt engineering, Claude API integration) |
| `Explore` | Finding files by pattern, searching for specific code across the codebase |
| `Plan` | Designing implementation strategy before a large feature |
