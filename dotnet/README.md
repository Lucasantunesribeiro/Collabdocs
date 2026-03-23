# CollabDocs .NET API

ASP.NET Core 8 Web API implementing the CollabDocs business logic with **Clean Architecture**, **CQRS** (MediatR), and **EF Core** (SQLite).

This is the .NET companion to the Cloudflare Workers TypeScript backend, demonstrating the same domain logic in C# for .NET-focused roles.

## Architecture

```
CollabDocs.Domain          ← Entities, interfaces, enums (no external deps)
CollabDocs.Application     ← CQRS commands/queries/handlers (MediatR)
CollabDocs.Infrastructure  ← EF Core repositories, DbContext, audit service
CollabDocs.API             ← ASP.NET Core controllers, JWT auth, Swagger
CollabDocs.Tests.Unit      ← xUnit + Moq + FluentAssertions
```

**Dependency rule**: Domain ← Application ← Infrastructure ← API

## Tech Stack

- **ASP.NET Core 8** — Web API with minimal setup
- **MediatR 12** — CQRS pattern (commands + queries + handlers)
- **Entity Framework Core 8** — ORM with PostgreSQL (Npgsql)
- **JWT Bearer Auth** — HS256 token verification (same secret as the Next.js frontend)
- **Swagger/OpenAPI** — auto-generated docs at `/swagger`
- **xUnit + Moq + FluentAssertions** — unit tests

## Database Setup (PostgreSQL)

### Local with Docker

```bash
docker compose up postgres -d
dotnet run --project src/CollabDocs.API
```

### Apply Migrations

```bash
cd dotnet
dotnet ef database update --project src/CollabDocs.Infrastructure --startup-project src/CollabDocs.API
```

### Deploy on Render.com

1. Fork/push the repo to GitHub
2. Go to render.com -> New -> Blueprint
3. Select the repo — it will read `render.yaml` automatically
4. Set `Jwt__Secret` environment variable in the Render dashboard
5. Deploy

## Running Locally

```bash
# Start PostgreSQL first
docker compose up postgres -d

cd dotnet
dotnet restore
dotnet run --project src/CollabDocs.API
# API: http://localhost:5000
# Swagger: http://localhost:5000/swagger
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `Jwt__Secret` | HS256 signing secret (must match NEXTAUTH_SECRET in the Next.js app) |
| `ConnectionStrings__Default` | PostgreSQL connection string |
| `AllowedOrigins__0` | CORS origin (e.g. `http://localhost:3000`) |

Override via environment:
```bash
ConnectionStrings__Default="Host=localhost;Database=collabdocs;Username=postgres;Password=postgres" \
  Jwt__Secret=your-secret \
  dotnet run --project src/CollabDocs.API
```

## Running Tests

```bash
cd dotnet
dotnet test
```

Tests cover:
- `CreateDocumentHandler` — returns correct DTO, calls audit, persists document
- `UpdateDocumentHandler` — owner can edit, non-owner denied, version mismatch → 409
- `GetDocumentsHandler` — returns owned + collaborated documents

## Docker

```bash
# From dotnet/ directory:
docker build -f src/CollabDocs.API/Dockerfile -t collabdocs-api .
docker run -p 5000:5000 -e Jwt__Secret=your-secret collabdocs-api
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| GET | `/api/documents` | Bearer JWT | List accessible documents |
| POST | `/api/documents` | Bearer JWT | Create document |
| GET | `/api/documents/{id}` | Bearer JWT | Get document by ID |
| PUT | `/api/documents/{id}` | Bearer JWT | Update document (optional version check) |
| DELETE | `/api/documents/{id}` | Bearer JWT | Delete document (owner only) |

### Optimistic Concurrency

Pass `expectedVersion` in PUT body to enable optimistic locking:
```json
{ "content": "Updated text", "expectedVersion": 3 }
```
Returns `409 Conflict` if the document was modified since version 3.
