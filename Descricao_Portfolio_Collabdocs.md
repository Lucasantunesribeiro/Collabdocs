# 1 Visão Geral do Projeto

O projeto **CollabDocs .NET** é um backend Web API em C# que implementa o contexto de **Gerenciamento Documental** da plataforma CollabDocs usando as tecnologias mais demandadas no mercado enterprise brasileiro: **ASP.NET Core 9**, **Clean Architecture**, **CQRS com MediatR**, **Transactional Outbox Pattern**, **RabbitMQ**, **Redis**, **Entity Framework Core**, **xUnit** e **TestContainers**.

O domínio é de **gestão documental colaborativa**: usuários autenticados criam, editam, compartilham e auditam documentos, com controle de acesso por permissões (owner/editor/viewer), controle de concorrência otimista e publicação de eventos de domínio via Outbox Pattern.

O projeto existe como contraparte C# de um backend TypeScript serverless (Cloudflare Workers) para colaboração em tempo real, demonstrando a capacidade de modelar os mesmos bounded contexts com tecnologias distintas — habilidade valorizada para candidatos que transitam entre stacks.

# 2 Arquitetura do Sistema

A arquitetura implementa Clean Architecture com CQRS e Transactional Outbox Pattern. A regra de dependência é aplicada de forma estrita: as camadas internas não conhecem as externas.

```
CollabDocs.Domain
  └── Entities: Document (rich), User, DocumentCollaborator
  └── Events: IDomainEvent, DocumentCreatedEvent, DocumentUpdatedEvent, DocumentDeletedEvent
  └── Outbox: OutboxMessage
  └── Interfaces: IDocumentRepository, IUserRepository, ICollaboratorRepository, IAuditService, IOutboxRepository
  └── Enums: Visibility, Permission
        ↑
CollabDocs.Application
  └── Commands: CreateDocumentCommand, UpdateDocumentCommand, DeleteDocumentCommand (com IdempotencyKey)
  └── Queries: GetDocumentsQuery, GetDocumentByIdQuery
  └── Handlers: 5 handlers MediatR
  └── DTOs: DocumentDto, CreateDocumentRequest, UpdateDocumentRequest
  └── Interfaces: IDocumentCacheService (porta para cache)
        ↑
CollabDocs.Infrastructure
  └── Data: AppDbContext (EF Core, inclui DbSet<OutboxMessage>)
  └── Repositories: DocumentRepository, UserRepository, CollaboratorRepository
  └── Outbox: OutboxRepository (staging sem SaveChanges, atomicidade garantida pelo caller)
  └── Messaging: OutboxPublisherService, DocumentEventConsumer, RabbitMQSettings
  └── Cache: DocumentCacheService (Redis), NullDocumentCacheService (fallback)
  └── Services: AuditService
  └── Migrations: InitialCreate, AddOutboxMessages
        ↑
CollabDocs.API
  └── Controllers: DocumentsController, HealthController
  └── Program.cs: DI, JWT, Swagger, CORS, OpenTelemetry, migrations no startup
```

## Princípio de Dependência

- `Domain` não depende de nada externo (sem EF Core, MediatR, RabbitMQ, Redis)
- `Application` depende apenas do `Domain` (interfaces, entidades, enums, eventos)
- `Infrastructure` implementa as interfaces do `Domain` e `Application` com tecnologias concretas
- `API` orquestra tudo via DI e expõe os endpoints HTTP

# 3 Stack Tecnológica

## Linguagem e Runtime

- **C# 12 / .NET 9**: linguagem e runtime principais
- **Nullable reference types habilitado**: segurança em tempo de compilação contra NPE

## Web API

- **ASP.NET Core 9**: framework Web API com controller-based routing
- **Microsoft.AspNetCore.Authentication.JwtBearer 8.x**: autenticação JWT Bearer com HS256
- **Swashbuckle.AspNetCore 6.7**: Swagger/OpenAPI com suporte a Bearer token
- **CORS policy**: origens permitidas via configuration (não hardcoded)

## CQRS / Mediator

- **MediatR 12.2**: padrão Mediator para CQRS
  - Commands encapsulam intenções de escrita com `IdempotencyKey` opcional
  - Queries encapsulam intenções de leitura com suporte a cache-aside
  - Handlers são responsáveis por uma única operação (SRP explícito)

## Mensageria — Transactional Outbox Pattern

- **RabbitMQ.Client 6.8**: publicação para topic exchange `collabdocs.events`
- **OutboxMessage**: entidade de domínio persistida atomicamente com a entidade principal
- **OutboxPublisherService**: BackgroundService com polling a cada 5s, retry até 5 vezes, degradação graciosa se RabbitMQ indisponível
- **DocumentEventConsumer**: BackgroundService consumindo `document.*` routing keys, reconexão com backoff

**Como a atomicidade funciona:**
```csharp
// No handler, antes de salvar a entidade principal:
await outboxRepository.AddAsync(outboxMessage, ct); // apenas staging no change tracker

// O repositório chama SaveChangesAsync — persiste entidade + outbox em uma transação:
await documentRepository.AddAsync(document, ct); // → SaveChangesAsync() aqui
```

## Cache — Cache-Aside Pattern

- **StackExchange.Redis 2.8**: cache de lista de documentos por usuário
- Chave: `docs:user:{userId}`, TTL: 5 minutos
- Invalidação em qualquer escrita que afete o usuário
- **NullDocumentCacheService**: implementação no-op usada quando Redis não está configurado
- Qualquer erro Redis é logado como warning, nunca falha a requisição (fail-open)

## ORM / Banco de Dados

- **Entity Framework Core 9 + Npgsql**: ORM com PostgreSQL
- Configuração Fluent API para entidades e índices
- `OutboxMessages` com índice composto em `(ProcessedAt, RetryCount)` para polling eficiente
- Migrations geradas: `InitialCreate`, `AddOutboxMessages`
- `db.Database.Migrate()` no startup para aplicar automaticamente

## Testes

- **xUnit 2.9 + Moq 4.20 + FluentAssertions 6.12**: 13 testes unitários
  - CreateDocumentHandler (5 testes): DTO correto, audit log, timestamps, persistência, outbox message
  - UpdateDocumentHandler (4 testes): owner pode editar, não-colaborador lança 403, conflito de versão, outbox message
  - GetDocumentsHandler (4 testes): cache hit, cache miss + DB, skip DB no hit, populate cache no miss
- **xUnit + Testcontainers.PostgreSql + Microsoft.AspNetCore.Mvc.Testing**: 8 testes de integração
  - Sobe PostgreSQL real em container Docker
  - Aplica migrations reais
  - Testa todos os endpoints CRUD com JWT real
  - Cobre `409 Conflict` por versão desatualizada

## Segurança

- **JWT HS256**: mesmo `NEXTAUTH_SECRET` do frontend Next.js
- `[Authorize]` em todos os endpoints de negócio
- Claims extraídos do token: `sub` (userId), `email`, `name`
- `[AllowAnonymous]` explícito no `HealthController`
- Sem exposição de stack trace em respostas de erro
- AWS: secrets em Secrets Manager (`valueFrom`), OIDC no GitHub Actions (sem chaves estáticas)

## Infraestrutura

- **Dockerfile multi-stage**: `sdk:9.0` para build → `aspnet:9.0` para runtime (imagem menor, usuário não-root)
- **docker-compose**: PostgreSQL 16, RabbitMQ 3 (+ management UI em 15672), Redis 7
- **AWS CloudFormation**: ECS Fargate, RDS PostgreSQL 16, ElastiCache Redis, Amazon MQ (RabbitMQ), SQS FIFO, ALB, ECR, CloudWatch

## Observabilidade

- **OpenTelemetry 1.9**: tracing distribuído com OTLP exporter
  - Spans em `CreateDocument`, `UpdateDocument`, `DeleteDocument`
  - Tags: `document.id`, `document.owner_id`, `document.version`, `document.visibility`
  - Compatível com Honeycomb.io e AWS CloudWatch (via OTEL env vars)
- **GET /health**: `{ status: "healthy", timestamp: "..." }` com `[AllowAnonymous]`

# 4 Domínio e Regras de Negócio

## Entidade Document (rica)

```csharp
// Factory method — controla invariantes de criação
Document.Create(ownerId, title, content, visibility)

// Comportamento de domínio
document.Update(content, title)    // incrementa Version
document.CanEdit(userId, collabs)  // owner ou editor/owner em collabs
document.CanView(userId, collabs)  // público OR owner OR qualquer colaborador
```

## Domain Events

Eventos tipados como `record` com `IDomainEvent`:
- `DocumentCreatedEvent { DocumentId, Title, OwnerId }`
- `DocumentUpdatedEvent { DocumentId, Title, UpdatedBy, Version }`
- `DocumentDeletedEvent { DocumentId, Title, OwnerId, DeletedBy }`

Cada evento tem `EventId` (Guid), `OccurredAt` (DateTime) e `EventType` (routing key para RabbitMQ).

## Controle de Concorrência

O campo `Version` na entidade `Document` suporta **optimistic locking**:
- Incrementado em todo `Update`
- Handler verifica `document.Version == request.ExpectedVersion` quando fornecido
- Lança `InvalidOperationException` mapeada para **HTTP 409 Conflict**

## Idempotência

Commands têm `IdempotencyKey?` opcional:
- Armazenada no `OutboxMessage.IdempotencyKey`
- `IOutboxRepository.ExistsAsync(idempotencyKey)` verifica duplicatas nas últimas 24h

# 5 Fluxo de uma Requisição (Exemplo: UpdateDocument)

```
HTTP PUT /api/documents/{id}  Authorization: Bearer <jwt>
  ↓
DocumentsController.UpdateDocument()
  - Extrai UserId do JWT, valida model binding
  - Envia UpdateDocumentCommand via ISender
  ↓
UpdateDocumentHandler.Handle()
  - Busca documento via IDocumentRepository.GetByIdAsync()
  - Busca colaboradores via ICollaboratorRepository.GetByDocumentIdAsync()
  - Chama document.CanEdit(userId, collabs) → 403 se false
  - Verifica version se ExpectedVersion fornecido → 409 se mismatch
  - Chama document.Update(content, title) → incrementa Version
  - Cria DocumentUpdatedEvent e chama outboxRepository.AddAsync() [staging only]
  - Chama documentRepository.UpdateAsync() → SaveChangesAsync() [document + outbox atomicamente]
  - Chama cacheService.InvalidateUserAsync(userId)
  - Chama auditService.LogAsync("updated", metadata)
  - Retorna DocumentDto
  ↓
DocumentsController
  - Mapeia exceções para HTTP status codes (403, 404, 409)
  - Retorna 200 OK com { document: DocumentDto }

[Background] OutboxPublisherService (5s poll)
  - Busca OutboxMessages pendentes
  - Publica DocumentUpdatedEvent no RabbitMQ (exchange: collabdocs.events)
  - Marca message como processada

[Background] DocumentEventConsumer
  - Consome event de document.updated
  - Loga estruturadamente com metadata
```

# 6 Conceitos de Engenharia Aplicados

## SOLID — Materialmente demonstrável

- **SRP**: `CreateDocumentHandler` cria documentos; `OutboxPublisherService` publica; `DocumentCacheService` faz cache
- **OCP**: novos handlers sem modificar existentes; novo provider de cache sem mudar handlers
- **LSP**: `NullDocumentCacheService` substitui `DocumentCacheService` sem alterar comportamento observável
- **ISP**: `IDocumentRepository`, `IDocumentCacheService`, `IOutboxRepository` — cada um com propósito único
- **DIP**: handlers dependem de `IDocumentRepository`, `IDocumentCacheService`, `IOutboxRepository` — nunca das implementações

## Clean Architecture — Regra de dependência verificável

- Domain compila sem referência a EF Core, MediatR, RabbitMQ, Redis
- Application compila sem referência a HttpContext, DbContext, ConnectionMultiplexer
- Infrastructure implementa as abstrações (EF, Redis, RabbitMQ)
- API faz a composição via DI

## CQRS — Separação real de intenções

- Commands: `CreateDocumentCommand`, `UpdateDocumentCommand`, `DeleteDocumentCommand`
- Queries: `GetDocumentsQuery`, `GetDocumentByIdQuery`
- Handlers: isolados, testáveis com mocks simples

## Transactional Outbox Pattern — Atomicidade garantida

O OutboxRepository não chama `SaveChangesAsync`:

```csharp
public Task AddAsync(OutboxMessage message, CancellationToken ct = default)
{
    db.OutboxMessages.Add(message); // staging apenas
    return Task.CompletedTask;      // SaveChanges handled by caller for atomicity
}
```

O `DocumentRepository` sim — e como compartilham o mesmo `DbContext` (scoped), a transação inclui ambos.

## Cache-Aside Pattern — Degradação graciosa

```csharp
var cached = await cacheService.GetDocumentsAsync(request.UserId, ct);
if (cached is not null) return cached; // hit
var documents = await documentRepository.GetByOwnerOrCollaboratorAsync(...);
await cacheService.SetDocumentsAsync(request.UserId, documents, ct);
return documents;
```

Qualquer erro Redis é silenciado e logado — o sistema nunca falha por indisponibilidade de cache.

## Testabilidade — Unit + Integration

Handlers são testáveis com mocks simples:
```csharp
var handler = new CreateDocumentHandler(
    _documentRepo.Object, _userRepo.Object, _audit.Object, _outbox.Object, _cache.Object);
```

Testes de integração com TestContainers sobem PostgreSQL real e testam o stack completo.

# 7 Relevância Para o Mercado Brasileiro

## Skills .NET demonstradas

| Skill | Demonstrado | Forma |
|---|---|---|
| C# 12 / .NET 9 | Sim | Todo o backend |
| ASP.NET Core Web API | Sim | Controllers, DI, middleware |
| Clean Architecture | Sim | Camadas com dependência correta |
| CQRS | Sim | MediatR commands/queries/handlers |
| MediatR | Sim | 5 handlers, IdempotencyKey |
| EF Core + PostgreSQL | Sim | AppDbContext, repositórios, Fluent API, migrations |
| Domain Events | Sim | IDomainEvent, 3 eventos tipados |
| Outbox Pattern | Sim | Atomicidade, retry, degradação graciosa |
| RabbitMQ | Sim | Topic exchange, publisher + consumer BackgroundServices |
| Redis | Sim | Cache-aside, TTL, invalidação, NullDocumentCacheService |
| JWT Bearer | Sim | Autenticação com HS256 |
| Swagger/OpenAPI | Sim | Documentação com Bearer support |
| OpenTelemetry | Sim | Spans em handlers críticos, OTLP exporter |
| xUnit + Moq + FluentAssertions | Sim | 13 testes unitários |
| TestContainers | Sim | 8 testes de integração com PostgreSQL real |
| Docker | Sim | Dockerfile multi-stage, docker-compose completo |
| AWS CloudFormation | Sim | ECS, RDS, ElastiCache, Amazon MQ, SQS FIFO |

## Alinhamento com vagas Junior/Pleno .NET

Este projeto atende diretamente os requisitos mais comuns em JDs de vagas .NET no Brasil:

- "Clean Architecture" → camadas com dependência correta implementada
- "CQRS" → MediatR commands/queries/handlers com separação real
- "EF Core + PostgreSQL" → migrations geradas, repositórios, Fluent API
- "Mensageria / Event-Driven" → RabbitMQ + Domain Events + Outbox Pattern
- "Cache" → Redis cache-aside com fallback
- "Testes unitários" → xUnit + Moq + FluentAssertions
- "Testes de integração" → TestContainers com PostgreSQL real
- "Docker / Kubernetes" → Dockerfile multi-stage + docker-compose + ECS
- "AWS" → CloudFormation completo (ECS, RDS, ElastiCache, MQ, SQS)

# 8 Como Explicar em Entrevista

## Explicação simples (30 segundos)

"O CollabDocs .NET é um backend Web API em C# com Clean Architecture e CQRS que gerencia documentos colaborativos. Inclui Transactional Outbox Pattern para publicar eventos de domínio no RabbitMQ com atomicidade garantida, Redis cache-aside para lista de documentos, testes unitários com mocks e testes de integração com PostgreSQL real via TestContainers."

## Explicação técnica (2 minutos)

"O projeto segue Clean Architecture com quatro camadas. O Domain tem a entidade Document com comportamento rico — CanEdit, CanView, Update — e Domain Events tipados como records. Na Application, uso MediatR para CQRS: commands com IdempotencyKey opcional e queries com suporte a cache.

O ponto mais interessante é o Transactional Outbox Pattern. Quando o handler cria um documento, ele chama outboxRepository.AddAsync que apenas adiciona ao change tracker do EF Core — sem SaveChanges. Em seguida, o documentRepository.AddAsync chama SaveChangesAsync, que persiste a entidade e o evento na mesma transação. Um BackgroundService faz polling a cada 5 segundos e publica no RabbitMQ. Se o RabbitMQ estiver down, as mensagens ficam no banco e tentam novamente — degradação graciosa.

O Redis tem o cache-aside padrão: verifica cache antes de ir ao banco, TTL de 5 minutos, invalidação em toda escrita. Se Redis não estiver disponível, o NullDocumentCacheService funciona como fallback transparente.

Para testes, tenho 13 unitários com mocks e 8 de integração com TestContainers — estes sobem um PostgreSQL real em Docker, aplicam as migrations e testam o stack completo via HttpClient."

## Perguntas comuns e respostas

**"Por que Outbox Pattern e não publicar diretamente no RabbitMQ?"**
"Se publicarmos no RabbitMQ antes de salvar no banco e o banco falhar, perdemos o evento. Se salvarmos no banco e depois publicarmos e o RabbitMQ falhar, o evento nunca chega. O Outbox Pattern resolve isso: a entidade e o evento são gravados atomicamente no banco. O publicador tem retry automático e funciona mesmo se o RabbitMQ ficar temporariamente indisponível."

**"Como funciona a atomicidade do Outbox?"**
"O OutboxRepository.AddAsync apenas adiciona ao change tracker do EF Core, sem chamar SaveChangesAsync. O DocumentRepository chama SaveChangesAsync no final, e como os dois repositórios compartilham o mesmo DbContext (ambos são Scoped no DI), a transação inclui tanto a entidade quanto a mensagem de outbox."

**"Por que NullDocumentCacheService em vez de só checar null?"**
"É o padrão Null Object. O handler não precisa saber se Redis está configurado — ele sempre chama IDocumentCacheService. Se Redis não está disponível, o NullDocumentCacheService é injetado e todas as operações são no-ops. Isso mantém os handlers limpos e testáveis."

# 9 Pontos Fortes

- Transactional Outbox Pattern com atomicidade real (não apenas intenção documentada)
- Domain Events como tipos de primeira classe no Domain, não apenas strings
- Redis cache-aside com degradação graciosa — nunca falha por ausência de cache
- Clean Architecture verificável: Domain compila sem EF Core, Application sem DbContext
- Testes de integração com banco PostgreSQL real via TestContainers (não in-memory)
- Idempotência via IdempotencyKey armazenada na tabela de outbox
- AWS deployment completo com CloudFormation, ECS Fargate e OIDC no CI
- Código C# moderno: primary constructors, records para events, pattern matching, nullable references

# 10 Pontos a Melhorar

- Sem pipeline behaviors MediatR (logging centralizado, validação FluentValidation nos commands)
- `DocumentEventConsumer` recebe eventos mas apenas loga — sem caso de uso downstream real
- Sem paginação nas queries de listagem
- Sem circuit breaker explícito para RabbitMQ (degradação é por try/catch, não Polly)
- Sem healthcheck integrado ao EF Core e Redis (apenas status simples no /health)

# 11 Como Colocar no Currículo

**CollabDocs .NET (ASP.NET Core 9 + Clean Architecture + Event-Driven)**

Backend Web API em C# com Clean Architecture, CQRS (MediatR), Domain Events, Transactional Outbox Pattern + RabbitMQ, Redis cache-aside, EF Core + PostgreSQL (migrations geradas), JWT Bearer e OpenTelemetry (OTLP/Honeycomb). Testes unitários com xUnit + Moq + FluentAssertions (13 casos) e testes de integração com TestContainers + PostgreSQL real (8 casos). Deploy na AWS com CloudFormation: ECS Fargate, RDS PostgreSQL, ElastiCache Redis, Amazon MQ — OIDC no GitHub Actions, sem chaves estáticas.

# 12 Nível do Projeto

**Classificação: Pleno (do ponto de vista .NET)**

O projeto demonstra:

- Arquitetura que vai além de "controller → service → repository" plano
- CQRS como padrão estrutural real (não apenas citado)
- Event-Driven com atomicidade garantida (Outbox Pattern)
- Mensageria com RabbitMQ (publisher + consumer com retry)
- Cache com degradação graciosa (Redis + NullObject fallback)
- Testes com mocking real (unitários) e banco real (integração)
- Inversão de dependência na prática (Domain sem EF Core)
- AWS deployment production-ready com CloudFormation

Para candidatos **Junior/Pleno .NET**, é diretamente relevante e demonstrável em entrevistas técnicas.

# 13 Score Final

**Nota: 9.0 / 10**

Justificativa:

O backend .NET atingiu nível Pleno consolidado:

**Positivos:**
- Clean Architecture real com regra de dependência verificável (+2.0)
- CQRS com MediatR, commands/queries/handlers (+1.0)
- Domain Events + Transactional Outbox Pattern (+1.0)
- RabbitMQ com publisher + consumer real (+0.5)
- Redis cache-aside com NullObject fallback (+0.5)
- Testes unitários com mocks (13 casos) (+0.5)
- Testes de integração com TestContainers (8 casos) (+0.5)
- PostgreSQL com migrations EF Core geradas (+0.3)
- AWS CloudFormation completo (+0.3)
- OpenTelemetry com spans (+0.2)
- Docker multi-stage + docker-compose completo (+0.2)

**Limitações:**
- Sem pipeline behaviors MediatR (validação centralizada) (-0.5)
- Consumer RabbitMQ apenas loga, sem processamento real (-0.3)
- Sem paginação (-0.2)
- Sem Polly/circuit breaker para RabbitMQ (-0.2)

O projeto é uma peça de portfólio forte para vagas **Junior/Pleno .NET** que exigem Clean Architecture, CQRS, mensageria e testes.
