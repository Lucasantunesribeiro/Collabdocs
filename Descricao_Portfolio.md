# 1 Visão Geral do Projeto

O projeto implementa uma plataforma de documentos colaborativos chamada **CollabDocs**, com foco em autenticação social, criação de documentos, edição em navegador, controle de visibilidade, compartilhamento com colaboradores e auditoria de operações.

Na prática, o problema que ele resolve é permitir que usuários autenticados criem e gerenciem documentos de forma estruturada, com um backend serverless e uma interface moderna. O domínio é de **colaboração documental**, com elementos de ACL, autenticação, persistência relacional, auditoria e controle de concorrência.

O repositório é agora um projeto **fullstack TypeScript + .NET**, com duas implementações de backend independentes: um Cloudflare Worker (TypeScript) e uma Web API ASP.NET Core 8 (C#). Isso permite posicionamento para vagas JavaScript/TypeScript e vagas .NET simultaneamente.

# 2 Arquitetura do Sistema

A arquitetura implementada é **frontend Next.js + backend serverless em Cloudflare Workers + backend alternativo em ASP.NET Core 8**, comunicando-se por HTTP/JSON.

## Worker Backend (TypeScript)

O Worker foi reestruturado em camadas reais:

- `workers/domain/types.ts`: interfaces de domínio (Document, User, AuthenticatedUser, Permission)
- `workers/infrastructure/db.ts`: repositório D1 com todas as queries SQL
- `workers/middleware/auth.ts`: verificação JWT (Web Crypto API, sem dependências extras)
- `workers/middleware/rateLimit.ts`: rate limiting por IP (20 req/min via Durable Object)
- `workers/middleware/cors.ts`: CORS com whitelist via env var
- `workers/application/documents.ts`: casos de uso de documentos (lógica de negócio pura)
- `workers/application/collaborators.ts`: casos de uso de colaboradores (+ enfileiramento de email)
- `workers/api/handlers.ts`: handlers HTTP finos com logging de request
- `workers/api/router.ts`: roteamento com timing de request + upgrade WebSocket para DO
- `workers/lib/logger.ts`: logger JSON estruturado (NDJSON, compatível com Cloudflare Logpush)
- `workers/collaboration/DocumentSession.ts`: Durable Object para sessões WebSocket em tempo real
- `workers/collaboration/RateLimiter.ts`: Durable Object para rate limiting in-memory por IP
- `workers/queues/emailConsumer.ts`: consumer da Cloudflare Queue para envio via MailChannels

Organização real do frontend:

- `src/app`: rotas e páginas com App Router do Next.js
- `src/components`: componentes de interface e fluxo de edição
- `src/lib`: autenticação NextAuth e cliente HTTP autenticado
- `migrations/`: evolução do schema SQL do D1 (7 migrações)

## ASP.NET Core Backend (C#)

Localizado em `dotnet/`, implementa a mesma lógica de negócio em Clean Architecture:

- `CollabDocs.Domain`: entidades ricas, interfaces de repositório, enums
- `CollabDocs.Application`: CQRS com MediatR (commands, queries, handlers, `Telemetry.cs` ActivitySource)
- `CollabDocs.Infrastructure`: EF Core + Npgsql (PostgreSQL), migrations geradas, repositórios
- `CollabDocs.API`: controllers, JWT Bearer, Swagger, CORS, OpenTelemetry (OTLP/Honeycomb)

# 3 Stack Tecnológica

## Backend TypeScript (Cloudflare Workers)

- **Cloudflare Workers**: API REST serverless com baixa latência global
- **TypeScript**: tipagem ponta a ponta
- **Web Crypto API nativa**: validação JWT HS256 sem dependências externas
- **Cloudflare D1**: banco SQL serverless (SQLite-compatible) com 8 migrações versionadas
- **Cloudflare Durable Objects**: sessões WebSocket em tempo real (`DocumentSession`) + rate limiting in-memory por IP (`RateLimiter`)
- **Cloudflare Queues + MailChannels**: mensageria assíncrona para notificações de email ao adicionar colaborador
- **SQL puro com prepared statements**: sem ORM, seguro contra SQL injection

## Backend C# (ASP.NET Core 8)

- **ASP.NET Core 8 Web API**: endpoints REST com controllers e DI nativa
- **MediatR 12**: padrão CQRS (commands/queries/handlers)
- **Entity Framework Core 8 + Npgsql**: ORM com PostgreSQL (migrations geradas via EF CLI)
- **JWT Bearer (Microsoft.AspNetCore.Authentication.JwtBearer)**: autenticação com HS256
- **Swashbuckle/Swagger**: documentação OpenAPI com suporte a Bearer token
- **OpenTelemetry 1.9**: tracing distribuído com OTLP exporter (Honeycomb.io); spans nos handlers críticos
- **xUnit + Moq + FluentAssertions**: testes unitários

## Frontend

- **Next.js 14 (App Router)**: estrutura das páginas, rotas de autenticação e build de produção
- **React 18**: base da interface
- **Tailwind CSS**: estilização utilitária
- **lucide-react**: ícones

## Banco de Dados

- **Cloudflare D1** (Worker): banco SQL serverless com 8 migrações versionadas
  - documents, users, document_collaborators, document_audit_log
  - Coluna `version` para controle de concorrência otimista
- **PostgreSQL via EF Core + Npgsql** (ASP.NET): migrations geradas (`InitialCreate`), `db.Database.Migrate()` no startup

## Infraestrutura e DevOps

- **Vercel**: deploy automático do frontend (push para main) — `collabdocs-app.vercel.app`
- **Cloudflare Workers**: deploy via Wrangler — `collab-docs.collabdocs.workers.dev`
- **Render.com**: .NET API com PostgreSQL gerenciado via Blueprint (`render.yaml`) — `collabdocs-dotnet-api.onrender.com`
- **Docker**: Dockerfile multi-stage + docker-compose para stack local completa
- **GitHub Actions**: pipeline CI com 5 jobs: quality, test, e2e, security, dotnet-test
- **package-lock.json**: lockfile para `npm ci` reprodutível em CI

## Observabilidade

- **Logger JSON estruturado** (`workers/lib/logger.ts`): cada log é NDJSON, compatível com Cloudflare Logpush e Tail Workers
- **Request timing middleware**: todas as requisições logam `{ method, path, status, durationMs }`
- **Audit trail**: tabela `document_audit_log` captura create/update/delete/collaborator events com metadata
- **Health check rico**: `GET /api/health` testa conectividade com D1, retorna `healthy`/`degraded`
- **OpenTelemetry (.NET)**: tracing distribuído via OTLP — spans em `CreateDocument` e `UpdateDocument`; exporter configurável via env vars; compatível com Honeycomb.io

## Tecnologias não implementadas (documentação corrigida)

- **Cloudflare KV**: não utilizado (removido da documentação)
- **R2**: não implementado (removido da documentação)
- **Yjs/CRDT**: colaboração real-time usa WebSocket + broadcast simples via Durable Objects (sem Yjs)
- **Turborepo/monorepo**: não há workspaces reais (removido da documentação)

# 4 Fluxo do Sistema

## Fluxo de autenticação e autorização

1. O usuário acessa a interface Next.js
2. O middleware NextAuth protege as rotas privadas
3. Login via OAuth com Google ou GitHub
4. No callback de sessão, o frontend gera um `workerToken` assinado com `NEXTAUTH_SECRET`
5. O cliente HTTP (`secure-api.ts`) envia esse token no header `Authorization: Bearer <token>`
6. O Worker valida a assinatura com Web Crypto API (sem dependências extras)
7. Nenhum header `X-User-Profile` é necessário — autenticação é feita exclusivamente via JWT

## Fluxo de operações de documento

1. CRUD de documentos com controle de permissão por owner e colaboradores
2. Rate limiting por IP (20 req/min) antes de operações de escrita
3. Controle de concorrência otimista: `PUT /api/documents/:id` com `expectedVersion` retorna 409 se outro usuário modificou o documento
4. Toda operação gera entrada em `document_audit_log`

## Fluxo de colaboração em tempo real (WebSocket + Durable Objects)

1. Frontend abre conexão WebSocket em `GET /api/documents/:id/ws`
2. Router encaminha para a instância `DocumentSession` DO do documento
3. DO aceita upgrade, registra o cliente na sessão com `userId` e `userName`
4. Ao digitar, frontend envia `{ type: "update", delta: "..." }` pelo socket
5. DO faz broadcast para todos os outros participantes conectados
6. Eventos de presença (`join`/`leave`) são propagados para a lista de usuários ativos
7. Novo cliente recebe imediatamente a lista de usuários presentes no `join`

## Fluxo de notificação por email (Cloudflare Queues)

1. Owner adiciona colaborador via `POST /api/documents/:id/collaborators`
2. Handler chama `addCollaborator(env.DB, user, id, email, permission, env.NOTIFICATION_QUEUE)`
3. Use case persiste no D1, registra em `document_audit_log`, enfileira mensagem no Queue
4. Consumer (`processEmailQueue`) recebe batch e chama MailChannels API
5. Email HTML enviado ao colaborador com link direto ao documento
6. Falha no Queue = `message.retry()` com até 3 tentativas; DLQ configurada

# 5 Conceitos de Engenharia Aplicados

## SOLID

Aplicação materialmente melhorada.

O Worker segue SRP com separação real por camadas (domain, infrastructure, application, api). O backend .NET aplica SRP, OCP e DIP de forma explícita: os handlers dependem de interfaces, não de implementações concretas; os repositórios implementam interfaces definidas no domínio.

## DDD

Aplicação parcial e honesta.

O backend .NET tem uma entidade `Document` com comportamento rico (`Create`, `Update`, `CanEdit`, `CanView`), que encapsula regras de negócio em vez de ser um DTO anêmico. O Worker tem separação de use cases mas entidades mais simples.

## Clean Architecture

Implementada de forma concreta no backend .NET.

A regra de dependência é aplicada: Domain ← Application ← Infrastructure ← API. O backend Worker também tem separação em camadas (domain → infrastructure → application → api) com dependência em uma única direção.

## CQRS

Implementado no backend .NET via MediatR.

Commands (CreateDocument, UpdateDocument, DeleteDocument) e Queries (GetDocuments, GetDocumentById) são tipos distintos, processados por handlers específicos.

## Idempotência

Melhorada.

`upsertUser` usa INSERT OR REPLACE no Worker e upsert via EF Core no .NET. Criação de documentos ainda não é idempotente por design (sem idempotency key no cliente).

## Segurança e integridade

Significativamente endurecida:

- Todos os endpoints de debug e limpeza de banco removidos do runtime de produção
- Autenticação exclusivamente via JWT assinado (X-User-Profile eliminado)
- CORS via env var (sem domínios hardcoded no código)
- Prepared statements em todas as queries
- Rate limiting: 20 req/min por IP
- Controle de concorrência otimista para evitar sobrescrita silenciosa
- Error responses não vazam informação interna

# 6 Relevância Para o Mercado Brasileiro

## O projeto demonstra skills demandadas?

Sim, de forma significativamente mais completa após as melhorias.

Ele demonstra agora:

- Frontend React/Next.js
- Autenticação OAuth
- API REST
- Persistência SQL com migrations
- Cloud serverless (Cloudflare Workers)
- ACL e proteção de rotas
- **C# / ASP.NET Core 8** (nova adição)
- **Clean Architecture real** (backend .NET)
- **CQRS com MediatR** (backend .NET)
- **EF Core** (backend .NET)
- **Testes automatizados reais** (Vitest + xUnit)
- **CI/CD funcional** (GitHub Actions)
- **Docker** (Dockerfile + docker-compose)
- **Observabilidade** (logger estruturado, audit trail, health check rico)
- **Controle de concorrência** (optimistic locking)

## Ele parece um projeto enterprise?

Muito mais próximo após as melhorias.

O backend .NET atinge nível enterprise em arquitetura: Clean Architecture, CQRS, DI explícita, testes unitários com mocks, separação por camadas com dependência correta. O backend Worker saiu de um monolito de 1400 linhas para uma estrutura em camadas clara.

## Ele é relevante para vagas Junior?

Sim, fortemente:

- **Fullstack React/Next.js**: direto ao ponto
- **Fullstack JavaScript/TypeScript**: com backend serverless de qualidade
- **Junior .NET**: o backend C# demonstra os conceitos esperados em entrevistas

Para vagas **Junior/Pleno .NET**, o projeto agora tem peça principal relevante.

# 7 Como Explicar o Projeto em Entrevista

## Explicação simples (30 segundos)

"CollabDocs é uma plataforma de documentos colaborativos que eu construí em duas versões de backend: uma em TypeScript com Cloudflare Workers e outra em C# com ASP.NET Core 8 e Clean Architecture. As duas expõem a mesma API REST, compartilham o modelo de domínio e têm testes automatizados."

## Explicação técnica (2 minutos)

"O projeto tem um frontend em Next.js com App Router, React e Tailwind, autenticação OAuth via NextAuth com Google e GitHub, e dois backends.

O backend TypeScript roda em Cloudflare Workers com D1 como banco SQL serverless. Ele foi estruturado em camadas: domain, infrastructure, application e api. Tem logger JSON estruturado, audit trail em banco, health check com teste de conectividade real, controle de concorrência otimista via campo version, e 44 testes unitários com Vitest.

O backend C# usa ASP.NET Core 8 com Clean Architecture e CQRS via MediatR. O domínio tem uma entidade Document rica com regras de negócio encapsuladas. A camada de aplicação tem commands e queries processados por handlers independentes. A infraestrutura usa EF Core com SQLite. Há JWT Bearer, Swagger e 10 testes unitários com xUnit, Moq e FluentAssertions.

Em termos de DevOps, o projeto tem pipeline GitHub Actions funcional, Docker com multi-stage build, docker-compose para stack local, e lockfile para CI reprodutível."

# 8 Pontos Fortes do Projeto

- Duas implementações de backend: TypeScript serverless e C# Clean Architecture
- Frontend fullstack ponta a ponta, com autenticação, persistência, ACL e build de produção
- Clean Architecture implementada de forma concreta no backend .NET (não apenas intencional)
- CQRS com MediatR, separação real de commands e queries
- 44 testes unitários Vitest (Worker) + 10 testes xUnit (ASP.NET Core)
- CI/CD funcional com 3 jobs reais (type-check, build, test, security audit)
- Logger JSON estruturado compatível com Cloudflare Logpush (NDJSON)
- Audit trail de operações persistida em banco
- Controle de concorrência otimista (optimistic locking com version)
- Docker multi-stage + docker-compose para stack local reproduzível
- CORS via env var (sem hardcode de domínios)
- Autenticação exclusivamente via JWT (X-User-Profile eliminado)
- Migrations SQL versionadas (7 migrações incrementais)
- Prepared statements em todas as queries D1

# 9 Pontos a Melhorar (estado atual)

- WebSocket ainda sem validação de token JWT (browsers não enviam Authorization em WS upgrade); deve adicionar `?token=...` no query param e validar no `DocumentSession.fetch()`
- Colaboração WebSocket usa broadcast simples (sem CRDT/Yjs): dois usuários editando simultaneamente podem ter conflito na persistência HTTP
- Sem testes de integração com banco real no .NET (apenas unitários com mocks)
- Sem pipeline behaviors MediatR (logging centralizado, validação FluentValidation)
- Sem paginação nas queries de listagem de documentos

# 10 Melhorias Prioritárias Restantes Para Portfólio

1. **Validar JWT no WebSocket** — passar `?token=` no URL de upgrade e verificar no `DocumentSession.fetch()` antes de aceitar a sessão

2. **Pipeline behaviors MediatR** — logging e validação centralizada com FluentValidation em todos os commands

3. **Testes de integração .NET** — banco PostgreSQL in-memory ou via Testcontainers para testes de repositório

4. **Paginação nas queries** — cursor-based pagination em `GET /api/documents`

# 11 Como Colocar no Currículo

Plataforma de documentos colaborativos fullstack com dois backends independentes:

- **TypeScript + Cloudflare Workers**: API REST serverless, WebSocket em tempo real via Durable Objects, notificações assíncronas via Cloudflare Queues + MailChannels, rate limiting in-memory por Durable Object, logger JSON estruturado e audit trail.
- **C# + ASP.NET Core 8**: Clean Architecture, CQRS com MediatR, EF Core + PostgreSQL (migrations geradas), JWT Bearer, Swagger e OpenTelemetry (OTLP/Honeycomb).

Frontend em **Next.js 14**, autenticação OAuth (NextAuth), testes com **Vitest** (41 casos), **xUnit** (10 casos) e **Playwright E2E**, **Docker** e pipeline **GitHub Actions** com 5 jobs.

Deployado em produção: Vercel (frontend), Cloudflare Workers (API), Render.com (.NET + PostgreSQL).

# 12 Nível do Projeto

**Classificação: Pleno inicial (TypeScript/Cloud) / Junior Sênior (.NET)**

O projeto atingiu maturidade de portfólio para vagas Pleno:

**TypeScript / Cloudflare:**
- Serverless com Durable Objects (stateful), Queues (assíncrono), D1 (persistência)
- Real-time WebSocket com broadcast de presença
- Mensageria com retry automático e DLQ
- Rate limiting in-memory sem banco (padrão cloud-native)
- Observabilidade estruturada com audit trail

**.NET:**
- Clean Architecture com regra de dependência aplicada
- CQRS com MediatR, handlers testáveis com mocks
- PostgreSQL com migrations geradas via EF CLI
- OpenTelemetry com spans nos handlers críticos e exporter OTLP
- Deploy em nuvem com banco gerenciado (Render + PostgreSQL)

**Pontos que ainda limitam a Pleno consolidado:**
- WebSocket sem auth JWT (browsers não suportam Authorization em upgrade)
- Sem pipeline behaviors MediatR (validação centralizada)
- Sem testes de integração .NET com banco real

# 13 Checklist de Mercado

| Requisito de Mercado | Presente no Projeto | Observação |
|---|---|---|
| C# | Sim | Backend .NET em `dotnet/` |
| .NET | Sim | ASP.NET Core 8 Web API |
| React | Sim | Frontend em Next.js/React |
| APIs REST | Sim | Dois backends expõem REST |
| SQL | Sim | D1 (SQLite serverless) + EF Core SQLite |
| PostgreSQL / SQL Server | Sim | EF Core + Npgsql + migrations geradas (backend .NET) |
| EF Core | Sim | Infrastructure layer do backend .NET com migrations |
| Clean Architecture | Sim | Backend .NET implementa de forma concreta |
| DDD | Parcial | Entidade Document com comportamento, sem aggregates completos |
| CQRS | Sim | MediatR no backend .NET |
| Microservices | Não | Um único backend por deploy |
| Event Driven | Sim | Cloudflare Queues para notificações assíncronas por email |
| OAuth / autenticação | Sim | NextAuth com Google e GitHub |
| Autorização / ACL | Sim | Owner e colaboradores com permissões |
| Rate limiting | Sim | 20 req/min por IP via Durable Object (in-memory) |
| WebSocket / Real-time | Sim | Durable Objects com broadcast de presença e atualizações |
| Docker | Sim | Dockerfile multi-stage + docker-compose |
| CI/CD | Sim | GitHub Actions funcional (5 jobs: quality, test, e2e, security, dotnet) |
| Testes automatizados | Sim | 41 Vitest (Worker) + 10 xUnit (ASP.NET) + Playwright E2E |
| Observabilidade | Sim | Logger JSON, audit trail, health check, OpenTelemetry OTLP |
| Cloud | Sim | Vercel + Cloudflare Workers + Render.com |
| AWS | Não | Cloud principal não é AWS |
| Segurança | Sim | Auth JWT, ACL, prepared statements, sem debug público, CORS env-driven |
| Migrations | Sim | 8 SQL migrations (D1) + EF Core migrations geradas (PostgreSQL) |
| Controle de concorrência | Sim | Optimistic locking via campo version |

# 14 Score Final do Projeto

**Nota final: 8.8 / 10**

Justificativa:

O projeto evoluiu de **5.8 → 7.8 → 8.8** com todas as melhorias implementadas.

Ganhos da primeira rodada (5.8 → 7.8):
- **+1.0**: Backend C#/ASP.NET Core 8 com Clean Architecture real
- **+0.4**: Testes automatizados reais (Vitest + xUnit)
- **+0.3**: CI/CD funcional
- **+0.2**: Docker e ambiente reproduzível
- **+0.1**: Observabilidade estruturada e audit trail

Ganhos da segunda rodada (7.8 → 8.8):
- **+0.4**: WebSocket em tempo real via Durable Objects → feature cloud-native real
- **+0.3**: Cloudflare Queues + MailChannels → mensageria assíncrona de produção
- **+0.2**: PostgreSQL + EF Core migrations → banco enterprise no .NET
- **+0.2**: OpenTelemetry com OTLP → observabilidade distribuída profissional
- **+0.2**: Playwright E2E + 5 jobs CI → pipeline de qualidade completo
- **+0.2**: Deploy em produção com links demo → proof of work concreto
- **-0.2**: WebSocket sem auth JWT, sem pipeline behaviors MediatR

Para chegar a **9.0+**: validar JWT no WebSocket, pipeline behaviors MediatR, testes de integração com banco real.

O projeto ainda não alcança **9.0+** porque faltam banco enterprise, testes e2e, mensageria real e colaboração em tempo real. Mas está claramente no patamar de um candidato que entende engenharia de software além de "fazer funcionar".
