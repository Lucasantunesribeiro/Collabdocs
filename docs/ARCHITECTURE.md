# CollabDocs — Architecture & Bounded Contexts

## Overview

CollabDocs is a split-deployment application with three clearly separated bounded contexts.
Each context owns its data, has well-defined responsibilities, and communicates through
explicit API contracts.

```
┌────────────────────────────────────────────────────────────────┐
│                    Frontend Context                            │
│              Next.js on Vercel                                 │
│                                                                │
│  • Auth (NextAuth + GitHub / Google OAuth)                     │
│  • Document UI — calls .NET API for CRUD                       │
│  • Editor — calls Worker WebSocket for real-time presence      │
└──────────────────────┬──────────────────────┬──────────────────┘
                       │ REST (Bearer JWT)     │ WebSocket (JWT query param)
                       ▼                       ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│  Document Management     │   │  Real-Time Collaboration         │
│  Context                 │   │  Context                         │
│                          │   │                                  │
│  .NET API + PostgreSQL   │   │  Cloudflare Worker +             │
│  (primary backend)       │   │  Durable Objects (edge)          │
└──────────────────────────┘   └──────────────────────────────────┘
```

---

## Bounded Context 1 — Document Management

**Runtime:** ASP.NET Core 8 on a container / VM (Docker, Railway, Render, etc.)
**Database:** PostgreSQL (via EF Core + Npgsql)
**Entry point:** `dotnet/src/CollabDocs.API/`

### Responsibilities

- All document CRUD operations (`GET /api/documents`, `POST`, `PUT`, `DELETE`)
- Business rule enforcement (ownership, optimistic concurrency via `version` column)
- Collaborator management (future: `CollaboratorsController`)
- Audit logging (`document_audit_log` via EF Core interceptors)
- CQRS with MediatR — Commands and Queries are separate pipelines

### Internal Layers

```
CollabDocs.Domain/          Pure domain entities, value objects, enums (no framework deps)
CollabDocs.Application/     Use cases via MediatR handlers, DTOs, validation
CollabDocs.Infrastructure/  EF Core DbContext, repositories, migrations
CollabDocs.API/             ASP.NET controllers, JWT auth middleware, DI wiring
```

### API Endpoints

| Method | Path                      | Description                              |
|--------|---------------------------|------------------------------------------|
| GET    | /api/documents            | List all documents accessible to user    |
| POST   | /api/documents            | Create a new document                    |
| GET    | /api/documents/{id}       | Get a single document by GUID            |
| PUT    | /api/documents/{id}       | Update title/content (optimistic lock)   |
| DELETE | /api/documents/{id}       | Soft-delete document (owner only)        |

### Authentication

JWT Bearer tokens issued by NextAuth (`HS256`, signed with `NEXTAUTH_SECRET`).
ASP.NET validates with `Jwt:Secret` (must equal `NEXTAUTH_SECRET`).
Claims used: `sub` (user ID), `email`, `name`.

### Required Environment Variables

| Variable                       | Example                                              |
|-------------------------------|------------------------------------------------------|
| `Jwt__Secret`                  | `${NEXTAUTH_SECRET}` (same secret as NextAuth)       |
| `ConnectionStrings__Default`   | `Host=postgres;Database=collabdocs;...`              |
| `AllowedOrigins__0`            | `http://localhost:3000`                              |
| `AllowedOrigins__1`            | `https://your-app.vercel.app`                        |

---

## Bounded Context 2 — Real-Time Collaboration

**Runtime:** Cloudflare Workers (edge, globally distributed)
**State:** Cloudflare Durable Objects (per-document WebSocket sessions)
**Entry point:** `workers/index.ts`

### Responsibilities

- WebSocket sessions — authenticated presence and content broadcast
- Per-IP rate limiting (20 req/min via D1 `rate_limits` table)
- CORS enforcement (via `ALLOWED_ORIGINS` env var)
- Edge-local collaborator reads (D1 `document_collaborators` table)

### Internal Layers

```
workers/domain/types.ts          Domain interfaces (Document, User, JWTPayload)
workers/infrastructure/db.ts     D1 repository (pure data access, no business logic)
workers/application/             Use cases: documents.ts, collaborators.ts
workers/middleware/              auth.ts, rateLimit.ts, cors.ts
workers/api/handlers.ts          Thin HTTP handlers — route → use case → response
workers/lib/logger.ts            Structured JSON logger
```

### API Endpoints

| Method    | Path                                  | Description                              |
|-----------|---------------------------------------|------------------------------------------|
| GET/WS    | /api/documents/{id}/ws?token=...      | WebSocket upgrade (JWT in query param)   |
| GET       | /api/documents/{id}/collaborators     | List collaborators (D1)                  |
| POST      | /api/documents/{id}/collaborators     | Add collaborator (D1)                    |
| DELETE    | /api/documents/{id}/collaborators     | Remove collaborator (D1)                 |

Note: Document CRUD routes are still present in the Worker for backward compatibility
but the Frontend now routes all CRUD calls to the .NET API. The Worker CRUD routes
will be removed in a future cleanup PR.

### Authentication

JWT Bearer tokens (same HS256 token from NextAuth). WebSocket connections pass
the token as `?token=<jwt>` because browsers cannot set custom headers on WS upgrades.
Verified using `@tsndr/cloudflare-worker-jwt` (Cloudflare V8-compatible — not Node.js).

### Required Environment Variables / Bindings

| Variable / Binding  | Description                                  |
|--------------------|----------------------------------------------|
| `NEXTAUTH_SECRET`   | Must match Next.js value exactly              |
| `ALLOWED_ORIGINS`   | Comma-separated CORS whitelist                |
| `DB`                | D1 database binding (defined in wrangler.toml)|

---

## Bounded Context 3 — Frontend

**Runtime:** Next.js 14 (App Router) on Vercel
**Entry point:** `src/`

### Responsibilities

- User authentication (NextAuth, OAuth with GitHub and Google)
- Document listing and management UI
- Collaborative editor — auto-save + real-time presence indicator
- Route resolution: CRUD calls go to `.NET API`, WebSocket goes to Worker

### Key Files

| File                              | Purpose                                          |
|----------------------------------|--------------------------------------------------|
| `src/lib/secure-api.ts`           | Singleton API service — routes CRUD to .NET API  |
| `src/lib/auth.ts`                 | NextAuth config, JWT generation (workerToken)    |
| `src/components/CollaborativeEditor.tsx` | Editor + WebSocket via `NEXT_PUBLIC_WS_URL` |
| `src/types/shared.ts`             | Shared types — keep in sync with worker/domain   |

### Required Environment Variables

| Variable                     | Description                                          |
|-----------------------------|------------------------------------------------------|
| `NEXTAUTH_SECRET`            | Shared secret (must match .NET API and Worker)       |
| `NEXTAUTH_URL`               | Public URL of the Next.js app                        |
| `NEXT_PUBLIC_DOTNET_API_URL` | .NET API base URL (e.g. `http://localhost:5000/api`) |
| `NEXT_PUBLIC_API_URL`        | Worker API base URL (collaborators, fallback)        |
| `NEXT_PUBLIC_WS_URL`         | Worker WebSocket base URL                            |
| `GITHUB_CLIENT_ID/SECRET`    | GitHub OAuth app credentials                         |
| `GOOGLE_CLIENT_ID/SECRET`    | Google OAuth app credentials                         |

---

## Auth Token Flow

```
Browser → NextAuth (Next.js)
  → signs HS256 JWT with NEXTAUTH_SECRET
  → stores as session.sessionToken

Frontend → .NET API
  Authorization: Bearer <sessionToken>
  .NET API validates with Jwt__Secret (= NEXTAUTH_SECRET)
  Claims: sub (userId), email, name

Frontend → Worker (WebSocket)
  wss://worker.../api/documents/{id}/ws?token=<sessionToken>
  Worker validates with NEXTAUTH_SECRET using cloudflare-worker-jwt
```

---

## Local Development

### Full stack (Docker)

```bash
docker compose up --build
```

Services:
- `http://localhost:3000` — Next.js frontend
- `http://localhost:5000` — .NET API
- `http://localhost:8787` — Cloudflare Worker (wrangler dev)
- `localhost:5432` — PostgreSQL

### Individual services

```bash
# Frontend
npm run dev

# .NET API
cd dotnet && dotnet run --project src/CollabDocs.API

# Worker
wrangler dev
```

---

## Future Work

- Migrate collaborator management endpoints from Worker to `.NET API`
  (`CollaboratorsController` + EF Core repository)
- Remove document CRUD routes from the Worker once migration is confirmed stable
- Add OpenTelemetry tracing to the .NET API and Worker
- Introduce a read-model / projection layer for the Dashboard queries
