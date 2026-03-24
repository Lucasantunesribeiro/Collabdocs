# 1 Visão Geral do Projeto

O projeto implementa uma plataforma de documentos colaborativos chamada **CollabDocs**, com foco em autenticação social, criação de documentos, edição em navegador, controle de visibilidade, compartilhamento com colaboradores e auditoria de operações.

Na prática, o problema que ele resolve é permitir que usuários autenticados criem e gerenciem documentos de forma estruturada, com dois backends complementares e uma interface moderna. O domínio é de **colaboração documental**, com elementos de ACL, autenticação, persistência relacional, auditoria, mensageria assíncrona e controle de concorrência.

O repositório é um projeto **fullstack TypeScript + .NET**, com duas implementações de backend em **contextos delimitados** (bounded contexts): um Cloudflare Worker (TypeScript) para colaboração em tempo real e uma Web API ASP.NET Core 9 (C#) para gerenciamento documental. Isso permite posicionamento para vagas JavaScript/TypeScript e vagas .NET simultaneamente.

# 2 Arquitetura do Sistema

A arquitetura implementa **bounded contexts** claros:

## Contexto 1: Gerenciamento Documental (.NET API + PostgreSQL)

Responsável por CRUD de documentos, regras de negócio, permissões e auditoria. Implementado com Clean Architecture e CQRS:

- `CollabDocs.Domain`: entidades ricas, interfaces, domain events, Outbox
- `CollabDocs.Application`: commands/queries MediatR, handlers, interfaces de porta (IDocumentCacheService)
- `CollabDocs.Infrastructure`: EF Core + Npgsql, repositórios, OutboxRepository, messaging (RabbitMQ), cache (Redis)
- `CollabDocs.API`: controllers, JWT Bearer, Swagger, CORS, OpenTelemetry, migrations no startup

## Contexto 2: Colaboração em Tempo Real (Cloudflare Workers + D1)

Responsável por sessões WebSocket, presença de usuários e sincronização de edição:

- `workers/domain/types.ts`: interfaces de domínio (Document, User, AuthenticatedUser, Permission)
- `workers/infrastructure/db.ts`: repositório D1 com todas as queries SQL
- `workers/middleware/auth.ts`: verificação JWT (Web Crypto API, verifyToken + verifyWebSocketToken)
- `workers/middleware/rateLimit.ts`: rate limiting por IP (20 req/min via Durable Object)
- `workers/middleware/cors.ts`: CORS com whitelist via env var
- `workers/application/documents.ts`: casos de uso de documentos
- `workers/application/collaborators.ts`: casos de uso de colaboradores
- `workers/api/handlers.ts`: handlers HTTP finos com logging
- `workers/api/router.ts`: roteamento + upgrade WebSocket com verificação JWT antes do DO
- `workers/collaboration/DocumentSession.ts`: Durable Object para sessões WebSocket
- `workers/collaboration/RateLimiter.ts`: Durable Object para rate limiting in-memory
- `workers/queues/emailConsumer.ts`: consumer da Cloudflare Queue para MailChannels

## Frontend (Next.js + Vercel)

- `src/app`: rotas e páginas com App Router do Next.js
- `src/lib/secure-api.ts`: cliente HTTP que roteia CRUD para .NET API, WebSocket para Worker
- `src/lib/auth.ts`: NextAuth com Google e GitHub, gera workerToken JWT

# 3 Stack Tecnológica

## Backend C# (ASP.NET Core 9)

- **ASP.NET Core 9 Web API**: endpoints REST com controllers e DI nativa
- **MediatR 12**: padrão CQRS (commands/queries/handlers)
- **Entity Framework Core 9 + Npgsql**: ORM com PostgreSQL (migrations geradas via EF CLI)
- **RabbitMQ.Client 6.8**: mensageria com topic exchange, Transactional Outbox Pattern
- **StackExchange.Redis 2.8**: cache-aside com fallback gracioso (NullDocumentCacheService)
- **JWT Bearer (Microsoft.AspNetCore.Authentication.JwtBearer)**: autenticação com HS256
- **Swashbuckle/Swagger**: documentação OpenAPI com suporte a Bearer token
- **OpenTelemetry 1.9**: tracing distribuído com OTLP exporter (Honeycomb.io/CloudWatch)
- **xUnit + Moq + FluentAssertions**: 13 testes unitários
- **xUnit + TestContainers**: 8 testes de integração com PostgreSQL real em container Docker

## Backend TypeScript (Cloudflare Workers)

- **Cloudflare Workers**: API REST serverless com baixa latência global
- **TypeScript**: tipagem ponta a ponta, tsconfig separado para workers
- **Web Crypto API nativa**: validação JWT HS256 sem dependências externas
- **Cloudflare D1**: banco SQL serverless (SQLite-compatible) com 8 migrações versionadas
- **Cloudflare Durable Objects**: sessões WebSocket em tempo real (`DocumentSession`) + rate limiting in-memory (`RateLimiter`)
- **Cloudflare Queues + MailChannels**: mensageria assíncrona para notificações de email
- **SQL puro com prepared statements**: sem ORM, seguro contra SQL injection

## Frontend

- **Next.js 14 (App Router)**: estrutura das páginas, rotas de autenticação e build de produção
- **React 18**: base da interface
- **Tailwind CSS**: estilização utilitária

## Banco de Dados

- **PostgreSQL 16 via EF Core + Npgsql** (.NET API): migrations geradas (`InitialCreate`, `AddOutboxMessages`), `db.Database.Migrate()` no startup
- **Cloudflare D1** (Worker): banco SQL serverless com 8 migrações versionadas
  - documents, users, document_collaborators, document_audit_log, rate_limits
  - Coluna `version` para controle de concorrência otimista

## Infraestrutura e DevOps

- **Vercel**: deploy automático do frontend
- **Cloudflare Workers**: deploy via Wrangler
- **AWS ECS Fargate**: .NET API em container na nuvem AWS (CloudFormation completo)
  - ALB (público) → ECS Task (privado) → RDS PostgreSQL + ElastiCache Redis + Amazon MQ + SQS FIFO
  - OIDC GitHub Actions para deploy sem chaves estáticas
- **Docker**: Dockerfile multi-stage + docker-compose com PostgreSQL, RabbitMQ e Redis
- **GitHub Actions**: pipeline CI com 6 jobs: quality, typecheck-workers, test, e2e, security, dotnet-test
- **package-lock.json**: lockfile para `npm ci` reprodutível em CI

## Observabilidade

- **Logger JSON estruturado** (`workers/lib/logger.ts`): NDJSON compatível com Cloudflare Logpush
- **Request timing middleware**: todas as requisições logam `{ method, path, status, durationMs }`
- **Audit trail**: tabela `document_audit_log` captura create/update/delete/collaborator events
- **Health check rico**: `GET /health` e `GET /api/health` com resposta `{ status, timestamp }`
- **OpenTelemetry (.NET)**: tracing distribuído via OTLP — spans em `CreateDocument`, `UpdateDocument`, `DeleteDocument`; exporter configurável; compatível com Honeycomb.io e CloudWatch

# 4 Padrões e Conceitos de Engenharia

## Transactional Outbox Pattern

Domain events são gravados **atomicamente** com a entidade de domínio, usando o mesmo `DbContext`:

1. Handler chama `outboxRepository.AddAsync(message)` — apenas adiciona ao change tracker, sem SaveChanges
2. Handler chama `documentRepository.AddAsync/UpdateAsync/DeleteAsync()` — chama `SaveChangesAsync()` que persiste entidade + outbox message na mesma transação
3. `OutboxPublisherService` (BackgroundService) faz polling a cada 5s e publica no RabbitMQ
4. Mensagens com falha têm retry automático (até 5 tentativas), degradando graciosamente se RabbitMQ estiver indisponível

## Redis Cache-Aside Pattern

- `GET /api/documents` verifica Redis primeiro (chave: `docs:user:{userId}`, TTL: 5 min)
- Cache miss → consulta PostgreSQL → popula cache → retorna resultado
- Qualquer operação de escrita invalida o cache do usuário afetado
- Fallback automático para `NullDocumentCacheService` (no-op) sem Redis

## Idempotência

- Commands CreateDocument, UpdateDocument, DeleteDocument têm campo opcional `IdempotencyKey`
- Chave armazenada na tabela `outbox_messages` e verificada antes de processar
- Worker usa `INSERT OR REPLACE` no D1 para upsert idempotente de usuários

## Segurança Endurecida

- Todos os endpoints de debug removidos do runtime de produção
- WebSocket autentica via `?token=<jwt>` (browsers não suportam Authorization em WS upgrade)
- Verificação JWT ocorre no router antes de encaminhar para o Durable Object
- DO recebe apenas parâmetros verificados pelo servidor (`__verified_userId`, `__verified_userName`)
- CORS via env var (sem hardcode de domínios)
- Rate limiting: 20 req/min por IP
- Controle de concorrência otimista (optimistic locking com version)
- Error responses não vazam informação interna
- AWS: secrets em Secrets Manager, ECS em subnets privadas, OIDC sem chaves estáticas

# 5 Fluxo do Sistema

## Fluxo de operações de documento (com Outbox Pattern)

1. Frontend chama `.NET API` com JWT Bearer
2. Controller recebe e envia command via MediatR
3. Handler executa lógica de negócio na entidade Domain
4. Handler chama `outboxRepository.AddAsync()` (staging apenas)
5. Handler chama `documentRepository.AddAsync/UpdateAsync/DeleteAsync()` que chama `SaveChangesAsync()` → **entidade + outbox message persistidos atomicamente**
6. Handler invalida cache Redis para o usuário afetado
7. `OutboxPublisherService` (BackgroundService) publica evento no RabbitMQ topic exchange
8. `DocumentEventConsumer` consome eventos e loga estruturadamente

## Fluxo de colaboração em tempo real (WebSocket + Durable Objects)

1. Frontend solicita conexão WebSocket com `?token=<jwt>`
2. Router verifica JWT — se inválido, retorna 401 sem abrir sessão
3. Router injeta `__verified_userId/__verified_userName` nos params (server-trusted)
4. Durable Object `DocumentSession` aceita upgrade e registra cliente
5. Ao digitar, frontend envia `{ type: "update", delta: "..." }` pelo socket
6. DO faz broadcast para todos os outros participantes conectados
7. Eventos de presença (`join`/`leave`) propagados para lista de usuários ativos

## Fluxo de listagem com cache-aside

1. Frontend chama `GET /api/documents` com JWT
2. Handler verifica cache Redis (`docs:user:{userId}`)
3. Cache hit → retorna imediatamente sem consultar PostgreSQL
4. Cache miss → consulta PostgreSQL, armazena no cache com TTL de 5 min, retorna
5. Qualquer create/update/delete invalida a chave do usuário afetado

# 6 Conceitos de Engenharia Aplicados

## SOLID

Aplicação material e demonstrável:

- **SRP**: cada handler faz uma única coisa; repositórios são separados por entidade
- **OCP**: novos handlers adicionados sem modificar os existentes; nova implementação de cache sem mudar handlers
- **LSP**: `NullDocumentCacheService` substitui `DocumentCacheService` sem alterar comportamento externo
- **ISP**: interfaces pequenas e coesas (`IDocumentRepository`, `IDocumentCacheService`, `IOutboxRepository` separados)
- **DIP**: handlers dependem de abstrações; `OutboxPublisherService` depende de `IOutboxRepository`, não de `OutboxRepository`

## DDD

Aplicação parcial e honesta:

- Entidade `Document` rica com `Create`, `Update`, `CanEdit`, `CanView` encapsulando regras de negócio
- Domain Events (`DocumentCreatedEvent`, `DocumentUpdatedEvent`, `DocumentDeletedEvent`) como tipos de primeira classe
- Bounded contexts explícitos (Document Management vs Real-Time Collaboration)

## Clean Architecture

Implementada de forma concreta:

- `Domain` não conhece EF Core, MediatR, RabbitMQ, Redis
- `Application` não conhece DbContext, RabbitMQ, Redis (apenas interfaces)
- `Infrastructure` implementa as abstrações com tecnologias concretas
- `API` orquestra tudo via DI

## CQRS

Implementado no backend .NET via MediatR:

- Commands (CreateDocument, UpdateDocument, DeleteDocument) com `IdempotencyKey`
- Queries (GetDocuments, GetDocumentById) com suporte a cache
- Handlers isolados, testáveis com mocks

# 7 Relevância Para o Mercado Brasileiro

## Skills demonstradas

Sim, de forma muito completa após todas as melhorias.

Demonstra:

- Frontend React/Next.js
- Autenticação OAuth
- API REST
- Persistência SQL com migrations
- Cloud serverless (Cloudflare Workers)
- ACL e proteção de rotas
- **C# / ASP.NET Core 9**
- **Clean Architecture real**
- **CQRS com MediatR**
- **EF Core + PostgreSQL**
- **RabbitMQ + Transactional Outbox Pattern**
- **Redis cache-aside com fallback**
- **Domain Events tipados**
- **Testes unitários com mocks** (xUnit + Moq + FluentAssertions)
- **Testes de integração com banco real** (TestContainers + PostgreSQL)
- **CI/CD funcional** (GitHub Actions, 6 jobs)
- **Docker** (Dockerfile multi-stage + docker-compose completo)
- **Observabilidade** (logger estruturado, audit trail, OpenTelemetry OTLP)
- **Controle de concorrência** (optimistic locking)
- **Segurança endurecida** (WebSocket JWT, sem debug endpoints, CORS env-driven)
- **AWS deployment** (ECS Fargate, RDS, ElastiCache, CloudFormation)

## Parece um projeto enterprise?

Sim, de forma genuína.

O backend .NET atinge nível enterprise: Clean Architecture, CQRS, Domain Events, Transactional Outbox Pattern, Redis cache-aside, testes unitários + integração, OpenTelemetry, AWS deployment com IAM mínimo e OIDC. O backend Worker tem segurança WebSocket real, mensageria assíncrona e observabilidade estruturada.

## É relevante para vagas Junior?

Sim, fortemente:

- **Fullstack React/Next.js**: direto ao ponto
- **Fullstack JavaScript/TypeScript**: com backend serverless de qualidade
- **Junior/Pleno .NET**: o backend C# demonstra os conceitos esperados em entrevistas

# 8 Como Explicar o Projeto em Entrevista

## Explicação simples (30 segundos)

"CollabDocs é uma plataforma de documentos colaborativos com dois backends: um em TypeScript com Cloudflare Workers para colaboração em tempo real, e outro em C# com ASP.NET Core 9 e Clean Architecture para gerenciamento documental. Inclui RabbitMQ com Outbox Pattern, Redis cache-aside, testes de integração com TestContainers e deploy na AWS com CloudFormation."

## Explicação técnica (2 minutos)

"O projeto tem um frontend em Next.js com App Router, autenticação OAuth via NextAuth e dois backends em contextos delimitados.

O backend TypeScript roda em Cloudflare Workers com D1 como banco SQL serverless, estruturado em camadas. Tem logger JSON estruturado, audit trail, rate limiting via Durable Objects, mensageria assíncrona com Cloudflare Queues e WebSocket em tempo real com autenticação JWT via query param — porque browsers não suportam Authorization header em WS upgrade.

O backend C# usa ASP.NET Core 9 com Clean Architecture e CQRS via MediatR. Tem Domain Events e Transactional Outbox Pattern — cada operação grava a entidade e a mensagem de evento atomicamente no mesmo `SaveChangesAsync`. O `OutboxPublisherService` faz polling e publica no RabbitMQ com retry automático. Tem Redis com cache-aside: cache por usuário com TTL de 5 minutos e invalidação em toda escrita. Há 13 testes unitários com Moq e 8 testes de integração com TestContainers rodando PostgreSQL real. Deploy na AWS com CloudFormation: ECS Fargate, RDS PostgreSQL, ElastiCache Redis e Amazon MQ em subnets privadas, com OIDC no GitHub Actions."

# 9 Pontos Fortes do Projeto

- Dois backends em **bounded contexts** claros, com routing explícito no frontend
- **Transactional Outbox Pattern** real: atomicidade entre entidade e evento no mesmo `SaveChangesAsync`
- **Redis cache-aside** com fallback gracioso (NullDocumentCacheService)
- **Domain Events** tipados como tipos de primeira classe no Domain
- **Testes de integração** com TestContainers rodando PostgreSQL real (sem mocks de banco)
- **Testes unitários** (13) com mocks de repositório, cache e outbox
- **WebSocket JWT** — autenticação via query param com verificação no router antes do Durable Object
- **AWS deployment** completo: ECS, RDS, ElastiCache, Amazon MQ, SQS FIFO, CloudFormation, OIDC
- CI/CD funcional com 6 jobs reais (type-check workers, build, test, security, dotnet)
- Logger JSON estruturado compatível com Cloudflare Logpush
- Audit trail de operações persistida em banco
- Controle de concorrência otimista (optimistic locking com version)
- Docker multi-stage + docker-compose com PostgreSQL, RabbitMQ e Redis
- CORS via env var, sem hardcode de domínios
- Idempotência via `IdempotencyKey` em commands

# 10 Pontos a Melhorar (estado atual)

- Colaboração WebSocket usa broadcast simples (sem CRDT/Yjs): dois usuários editando simultaneamente podem ter conflito na persistência HTTP
- Sem pipeline behaviors MediatR (logging centralizado, validação FluentValidation)
- Sem paginação nas queries de listagem de documentos
- `DocumentEventConsumer` recebe eventos mas apenas loga — sem caso de uso real downstream (como invalidar cache de outra instância via pub/sub)

# 11 Como Colocar no Currículo

Plataforma de documentos colaborativos fullstack com dois backends em bounded contexts:

- **TypeScript + Cloudflare Workers**: API REST serverless, WebSocket em tempo real via Durable Objects com autenticação JWT, notificações assíncronas via Cloudflare Queues + MailChannels, rate limiting in-memory, logger JSON estruturado e audit trail.
- **C# + ASP.NET Core 9**: Clean Architecture, CQRS com MediatR, Domain Events, Transactional Outbox Pattern + RabbitMQ, Redis cache-aside, EF Core + PostgreSQL, JWT Bearer, Swagger, OpenTelemetry OTLP.

Frontend em **Next.js 14**, autenticação OAuth (NextAuth), testes unitários com **Vitest** (41 casos) e **xUnit** (13 casos), testes de integração com **TestContainers** (8 casos), **Docker** completo e pipeline **GitHub Actions** com 6 jobs.

Deploy: Vercel (frontend), Cloudflare Workers (real-time), AWS ECS Fargate + RDS + ElastiCache + CloudFormation (API .NET).

# 12 Nível do Projeto

**Classificação: Pleno consolidado (TypeScript/Cloud) / Pleno (.NET)**

**TypeScript / Cloudflare:**
- Serverless com Durable Objects (stateful), Queues (assíncrono), D1 (persistência)
- Real-time WebSocket com autenticação JWT real
- Mensageria com retry automático e DLQ
- Rate limiting in-memory sem banco (padrão cloud-native)
- Observabilidade estruturada com audit trail

**.NET:**
- Clean Architecture com regra de dependência aplicada
- CQRS com MediatR, Domain Events, Transactional Outbox Pattern
- RabbitMQ como broker real (não simulado)
- Redis cache-aside com degradação graciosa
- PostgreSQL com migrations geradas via EF CLI
- Testes unitários (13) + integração com banco real via TestContainers (8)
- OpenTelemetry com spans nos handlers críticos
- AWS deployment completo com CloudFormation

# 13 Checklist de Mercado

| Requisito de Mercado | Presente no Projeto | Observação |
|---|---|---|
| C# | Sim | Backend .NET em `dotnet/` |
| .NET | Sim | ASP.NET Core 9 Web API |
| React | Sim | Frontend em Next.js/React |
| APIs REST | Sim | Dois backends expõem REST |
| SQL | Sim | D1 (SQLite serverless) + PostgreSQL via EF Core |
| PostgreSQL / SQL Server | Sim | EF Core + Npgsql + migrations geradas |
| EF Core | Sim | Infrastructure layer com migrations e Fluent API |
| Clean Architecture | Sim | Backend .NET com regra de dependência aplicada |
| DDD | Parcial | Domain Events, entidade rica, bounded contexts |
| CQRS | Sim | MediatR com IdempotencyKey |
| Event Driven | Sim | Domain Events + RabbitMQ + Outbox Pattern + Cloudflare Queues |
| Outbox Pattern | Sim | Atomicidade entre entidade e evento no mesmo SaveChangesAsync |
| Mensageria | Sim | RabbitMQ (topic exchange, retry, graceful degrade) |
| Cache | Sim | Redis cache-aside com NullDocumentCacheService fallback |
| Idempotência | Sim | IdempotencyKey em commands + upsert no Worker |
| OAuth / autenticação | Sim | NextAuth com Google e GitHub |
| Autorização / ACL | Sim | Owner e colaboradores com permissões |
| Rate limiting | Sim | 20 req/min por IP via Durable Object (in-memory) |
| WebSocket / Real-time | Sim | Durable Objects com broadcast de presença + auth JWT real |
| Docker | Sim | Dockerfile multi-stage + docker-compose completo |
| CI/CD | Sim | GitHub Actions funcional (6 jobs: quality, typecheck, test, e2e, security, dotnet) |
| Testes unitários | Sim | 41 Vitest (Worker) + 13 xUnit (ASP.NET) |
| Testes de integração | Sim | 8 testes com TestContainers + PostgreSQL real |
| Observabilidade | Sim | Logger JSON, audit trail, health check, OpenTelemetry OTLP |
| Cloud | Sim | Vercel + Cloudflare Workers + AWS ECS/RDS/ElastiCache |
| AWS | Sim | CloudFormation completo: ECS Fargate, RDS, ElastiCache, Amazon MQ, SQS FIFO |
| Segurança | Sim | Auth JWT, WebSocket JWT, ACL, OIDC AWS, sem debug público, CORS env-driven |
| Migrations | Sim | 8 SQL migrations (D1) + EF Core migrations geradas (PostgreSQL) |
| Controle de concorrência | Sim | Optimistic locking via campo version |

# 14 Score Final do Projeto

**Nota final: 9.3 / 10**

Justificativa:

O projeto evoluiu de **5.8 → 7.8 → 8.8 → 9.3** com todas as melhorias implementadas.

Ganhos da primeira rodada (5.8 → 7.8):
- **+1.0**: Backend C#/ASP.NET Core com Clean Architecture real
- **+0.4**: Testes automatizados reais (Vitest + xUnit)
- **+0.3**: CI/CD funcional
- **+0.2**: Docker e ambiente reproduzível
- **+0.1**: Observabilidade estruturada e audit trail

Ganhos da segunda rodada (7.8 → 8.8):
- **+0.4**: WebSocket em tempo real via Durable Objects
- **+0.3**: Cloudflare Queues + MailChannels
- **+0.2**: PostgreSQL + EF Core migrations
- **+0.2**: OpenTelemetry com OTLP
- **+0.2**: Playwright E2E + 5 jobs CI
- **-0.2**: WebSocket sem auth JWT (problema não resolvido na época)

Ganhos da terceira rodada (8.8 → 9.3):
- **+0.2**: Bounded contexts claramente separados + routing explícito
- **+0.2**: WebSocket JWT auth real via query param
- **+0.2**: Transactional Outbox Pattern + RabbitMQ com degradação graciosa
- **+0.1**: Redis cache-aside com NullDocumentCacheService
- **+0.1**: Idempotência via IdempotencyKey nos commands
- **+0.1**: Testes de integração com TestContainers (PostgreSQL real)
- **+0.1**: AWS deployment completo com CloudFormation + OIDC
- **-0.2**: Sem pipeline behaviors MediatR, sem CRDT no WebSocket

Para chegar a **9.5+**: pipeline behaviors MediatR com FluentValidation, CRDT/Yjs para colaboração sem conflito, cursor-based pagination.
