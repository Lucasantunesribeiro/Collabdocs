# 1 Visão Geral do Projeto

O projeto **CollabDocs .NET** (também referenciado como **SmartDocs API**) é um backend Web API em C# que implementa a lógica de negócio da plataforma CollabDocs usando as tecnologias mais demandadas no mercado enterprise brasileiro: **ASP.NET Core 8**, **Clean Architecture**, **CQRS com MediatR**, **Entity Framework Core** e **xUnit**.

O domínio é de **gestão documental colaborativa**: usuários autenticados criam, editam, compartilham e auditam documentos, com controle de acesso por permissões (owner/editor/viewer) e controle de concorrência otimista.

O projeto existe como contraparte C# de um backend TypeScript serverless (Cloudflare Workers), demonstrando a capacidade de implementar as mesmas regras de negócio em duas stacks distintas — habilidade valiosa para candidatos que transitam entre tecnologias.

# 2 Arquitetura do Sistema

A arquitetura implementa Clean Architecture com CQRS. A regra de dependência é aplicada de forma estrita: as camadas internas não conhecem as externas.

```
CollabDocs.Domain
  └── Entities: Document, User, DocumentCollaborator
  └── Enums: Visibility, Permission
  └── Interfaces: IDocumentRepository, IUserRepository, ICollaboratorRepository, IAuditService
        ↑
CollabDocs.Application
  └── Commands: CreateDocumentCommand, UpdateDocumentCommand, DeleteDocumentCommand
  └── Queries: GetDocumentsQuery, GetDocumentByIdQuery
  └── Handlers: 5 handlers MediatR (um por command/query)
  └── DTOs: DocumentDto, CreateDocumentRequest, UpdateDocumentRequest
        ↑
CollabDocs.Infrastructure
  └── Data: AppDbContext (EF Core)
  └── Repositories: DocumentRepository, UserRepository, CollaboratorRepository
  └── Services: AuditService (ILogger)
        ↑
CollabDocs.API
  └── Controllers: DocumentsController, HealthController
  └── Program.cs: DI, JWT, Swagger, CORS, migrations
```

## Princípio de Dependência

- `Domain` não depende de nada externo
- `Application` depende apenas do `Domain` (interfaces, entidades, enums)
- `Infrastructure` implementa as interfaces do `Domain` usando EF Core
- `API` orquestra tudo via DI e expõe os endpoints HTTP

# 3 Stack Tecnológica

## Linguagem e Runtime

- **C# 12 / .NET 8**: linguagem e runtime principais
- **Nullable reference types habilitado**: segurança em tempo de compilação contra NPE

## Web API

- **ASP.NET Core 8**: framework Web API com controller-based routing
- **Microsoft.AspNetCore.Authentication.JwtBearer 8.0**: autenticação JWT Bearer com HS256
- **Swashbuckle.AspNetCore 6.7**: Swagger/OpenAPI com suporte a Bearer token
- **CORS policy**: origens permitidas via configuration (não hardcoded)

## CQRS / Mediator

- **MediatR 12.2**: padrão Mediator para CQRS
  - Commands encapsulam intenções de escrita com seus dados
  - Queries encapsulam intenções de leitura
  - Handlers são responsáveis por uma única operação (SRP explícito)

## ORM / Banco de Dados

- **Entity Framework Core 8.0 + Npgsql**: ORM com configuração Fluent API, banco **PostgreSQL**
- Migrations geradas via `dotnet ef migrations add InitialCreate` — padrão enterprise
- `db.Database.Migrate()` no startup para aplicação automática em deploy

Configuração da entidade Document:
- `Visibility` e `Permission` persistidos como strings lowercase (não como int)
- Índices em `OwnerId` e `UpdatedAt` para queries de listagem eficientes
- Chave composta em `DocumentCollaborator` (DocumentId + UserId)

## Testes

- **xUnit 2.9**: framework de testes padrão .NET
- **Moq 4.20**: mocking de dependências (interfaces de repositório, IAuditService)
- **FluentAssertions 6.12**: assertions expressivas e legíveis
- **Microsoft.NET.Test.Sdk**: runner de testes

## Segurança

- **JWT HS256**: mesmo `NEXTAUTH_SECRET` do frontend Next.js, evitando infraestrutura de auth duplicada
- `[Authorize]` em todos os endpoints de negócio
- Claims extraídos do token: `sub` (userId), `email`, `name`
- Sem exposição de stack trace em respostas de erro

## Observabilidade

- **OpenTelemetry 1.9**: tracing distribuído via OTLP — spans em `CreateDocument` e `UpdateDocument`
- Compatível com **Honeycomb.io** e qualquer backend OTLP; fallback para console em dev
- Configuração via env vars standard: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME`

## Infraestrutura

- **Dockerfile multi-stage**: `sdk:8.0` para build → `aspnet:8.0` para runtime (imagem menor)
- **Render.com Blueprint** (`render.yaml`): deploy automático com PostgreSQL gerenciado
- URL de produção: `https://collabdocs-dotnet-api.onrender.com/swagger`

# 4 Domínio e Regras de Negócio

## Entidade Document

A entidade `Document` é rica, com comportamento encapsulado:

```csharp
// Factory method — controla invariantes de criação
Document.Create(ownerId, title, content, visibility)

// Comportamento de domínio
document.Update(content, title)    // incrementa Version
document.CanEdit(userId, collabs)  // owner ou editor/owner em collabs
document.CanView(userId, collabs)  // público OR owner OR qualquer colaborador
```

## Permissões

- **Owner**: pode editar, deletar, adicionar colaboradores
- **Editor**: pode editar o conteúdo
- **Viewer**: pode visualizar (somente leitura)
- Documentos `Public` são visíveis sem autenticação de colaboração

## Controle de Concorrência

O campo `Version` na entidade Document suporta **optimistic locking**:
- Incrementado em todo `Update`
- O handler verifica `document.Version == request.ExpectedVersion` quando fornecido
- Lança `InvalidOperationException` mapeada para **HTTP 409 Conflict** no controller

## Upsert de Usuário

Todo create de documento sincroniza o perfil do usuário (nome, email, provider) via `IUserRepository.UpsertAsync`, evitando dados desatualizados sem consistência eventual.

# 5 Fluxo de uma Requisição (Exemplo: UpdateDocument)

```
HTTP PUT /api/documents/{id}
  ↓
DocumentsController.UpdateDocument()
  - Extrai UserId, valida model binding
  - Envia UpdateDocumentCommand via ISender
  ↓
UpdateDocumentHandler.Handle()
  - Busca documento via IDocumentRepository.GetByIdAsync()
  - Busca colaboradores via ICollaboratorRepository.GetByDocumentIdAsync()
  - Chama document.CanEdit(userId, collabs) → UnauthorizedAccessException se false
  - Verifica version se ExpectedVersion fornecido → InvalidOperationException se mismatch
  - Chama document.Update(content, title) → incrementa Version, atualiza UpdatedAt
  - Chama IDocumentRepository.UpdateAsync()
  - Chama IAuditService.LogAsync("updated", metadata)
  - Retorna DocumentDto
  ↓
DocumentsController
  - Mapeia exceções para HTTP status codes (403, 404, 409)
  - Retorna 200 OK com { document: DocumentDto }
```

Nenhuma camada conhece detalhes das outras além da interface contratada.

# 6 Conceitos de Engenharia Aplicados

## SOLID

Aplicação material e demonstrável:

- **SRP**: cada handler faz uma única coisa (e.g., `DeleteDocumentHandler` apenas deleta)
- **OCP**: novos handlers são adicionados sem modificar os existentes
- **LSP**: repositórios são substituíveis (SQLite por SQL Server sem mudar Application)
- **ISP**: interfaces pequenas e coesas (IDocumentRepository, IUserRepository separados)
- **DIP**: handlers dependem de abstrações (`IDocumentRepository`), não de `DocumentRepository`

## Clean Architecture

Implementada com regra de dependência aplicada:

- Domain não conhece MediatR, EF Core, ASP.NET
- Application não conhece HttpContext, DbContext, SQLite
- Infrastructure implementa as abstrações do Domain com EF Core
- API faz a composição via DI

## CQRS

Commands e Queries são tipos distintos com semântica clara:

- Commands: `CreateDocumentCommand`, `UpdateDocumentCommand`, `DeleteDocumentCommand`
- Queries: `GetDocumentsQuery`, `GetDocumentByIdQuery`
- Handlers: isolados, testáveis com mocks simples

## Domain-Driven Design (parcial)

- Entidade `Document` com comportamento rico (não é DTO anêmico)
- Factory method `Document.Create()` controlando invariantes
- Linguagem ubíqua refletida nos nomes: Document, Collaborator, Permission, Visibility

## Testabilidade

A separação por camadas e o uso de interfaces torna os handlers testáveis com mocks:

```csharp
var mockRepo = new Mock<IDocumentRepository>();
mockRepo.Setup(r => r.GetByIdAsync(id, ...)).ReturnsAsync(document);
var handler = new UpdateDocumentHandler(mockRepo.Object, collabMock.Object, auditMock.Object);
var result = await handler.Handle(command, CancellationToken.None);
```

Sem necessidade de banco real nos testes unitários.

# 7 Relevância Para o Mercado Brasileiro

## Skills .NET demonstradas

| Skill | Demonstrado | Forma |
|---|---|---|
| C# 12 / .NET 8 | Sim | Todo o backend |
| ASP.NET Core Web API | Sim | Controllers, DI, middleware |
| Clean Architecture | Sim | Camadas com dependência correta |
| CQRS | Sim | MediatR commands/queries/handlers |
| MediatR | Sim | 5 handlers registrados |
| EF Core | Sim | AppDbContext, repositórios, Fluent API, migrations geradas |
| JWT Bearer | Sim | Autenticação com HS256 |
| Swagger/OpenAPI | Sim | Documentação com Bearer support |
| xUnit | Sim | 10 testes unitários |
| Moq | Sim | Mocking de repositórios e serviços |
| FluentAssertions | Sim | Assertions expressivas |
| Docker | Sim | Dockerfile multi-stage |
| OpenTelemetry | Sim | OTLP exporter, spans em handlers críticos |
| PostgreSQL | Sim | Provider Npgsql, migrations geradas, deploy em Render |

## Alinhamento com vagas Junior/Pleno .NET

Este projeto atende diretamente os requisitos mais comuns em JDs de vagas .NET no Brasil:

- "Conhecimento em Clean Architecture" → camadas com dependência correta implementada
- "Experiência com CQRS" → MediatR commands/queries/handlers
- "EF Core" → repositórios, DbContext, Fluent API
- "Testes unitários" → xUnit + Moq + FluentAssertions
- "ASP.NET Core Web API" → controllers com JWT e Swagger
- "Boas práticas de desenvolvimento" → SOLID, DIP, SRP demonstráveis

# 8 Como Explicar em Entrevista

## Explicação simples (30 segundos)

"O CollabDocs .NET é um backend Web API em C# que eu escrevi para demonstrar Clean Architecture e CQRS na prática. Ele implementa gerenciamento de documentos com controle de acesso, usando MediatR para separar commands e queries, EF Core para persistência e xUnit para testes unitários."

## Explicação técnica (2 minutos)

"O projeto segue Clean Architecture com quatro camadas: Domain, Application, Infrastructure e API. A regra de dependência é aplicada de forma estrita — o Domain não conhece EF Core nem MediatR, a Application não conhece HttpContext nem banco de dados.

No Domain eu tenho a entidade Document com comportamento rico: ela tem métodos `CanEdit` e `CanView` que encapsulam as regras de permissão, e um factory method `Create` que controla os invariantes de criação. Ela implementa controle de concorrência otimista com um campo `Version` que incrementa a cada update.

Na Application eu uso MediatR para CQRS. Tenho commands para operações de escrita e queries para leitura — cada um processado por um handler dedicado que depende apenas de interfaces. Isso torna os handlers completamente testáveis com mocks simples.

Na Infrastructure eu implemento as interfaces com EF Core SQLite. A camada de API faz a composição via DI nativa do ASP.NET, expõe os controllers com JWT Bearer e Swagger, e mapeia exceções do domínio para HTTP status codes corretos."

## Perguntas comuns e respostas

**"Por que MediatR?"**
"MediatR implementa o padrão Mediator, que desacopla quem emite uma intenção (o controller) de quem a executa (o handler). Isso facilita adicionar cross-cutting concerns como logging, validação e auditoria via pipeline behaviors, sem modificar os handlers."

**"Qual a diferença de Clean Architecture para apenas dividir em pastas?"**
"A diferença é a regra de dependência: as camadas internas não conhecem as externas. Aqui o Domain não tem referência a EF Core nem a MediatR. Se eu trocar o banco de SQLite para SQL Server, só mudo a Infrastructure — Application e Domain não mudam."

**"Como você testaria isso em produção?"**
"Os repositórios são interfaces — em testes unitários eu uso Moq para fornecer comportamento controlado. Para testes de integração, usaria um banco SQLite in-memory via UseInMemoryDatabase ou SQLite em arquivo temporário."

# 9 Pontos Fortes

- Clean Architecture implementada de forma demonstrável e explicável em entrevistas
- CQRS com MediatR — padrão presente em grande parte das vagas .NET enterprise
- Entidade `Document` com comportamento rico (não DTO anêmico)
- Controle de concorrência otimista via campo `version` → 409 Conflict
- Handlers isolados e testáveis com interfaces mockáveis
- JWT compatível com o frontend Next.js (mesmo secret)
- Swagger com Bearer token pronto para exploração manual
- Dockerfile multi-stage com imagem de runtime mínima
- Código C# moderno: primary constructors, pattern matching, nullable references

# 10 Pontos a Melhorar

- Adicionar FluentValidation nos handlers para validação centralizada de commands
- Implementar pipeline behaviors do MediatR (logging, validação, retry)
- Adicionar testes de integração com banco PostgreSQL via Testcontainers
- Implementar paginação cursor-based nas queries de listagem

# 11 Como Colocar no Currículo

**CollabDocs .NET (ASP.NET Core 8 + Clean Architecture)**
Web API em C# com Clean Architecture, CQRS (MediatR), EF Core (SQLite), JWT Bearer e Swagger. Implementa gerenciamento de documentos colaborativos com controle de acesso por permissões, controle de concorrência otimista (optimistic locking) e testes unitários com xUnit, Moq e FluentAssertions.

# 12 Nível do Projeto

**Classificação: Pleno inicial (do ponto de vista .NET)**

O projeto demonstra:

- Arquitetura que vai além de "controller → service → repository" plano
- CQRS como padrão estrutural (não apenas conceito citado)
- Testes com mocking real de dependências
- Compreensão de inversão de dependência na prática

Ainda não chega a **Pleno consolidado** porque:

- Sem pipeline behaviors MediatR (validação centralizada com FluentValidation)
- Sem testes de integração (apenas unitários com mocks)
- Sem paginação nas queries de listagem

Como peça de portfólio para vagas **Pleno .NET**, é diretamente relevante e demonstrável em entrevistas técnicas com deploy em produção.

# 13 Score Final

**Nota: 8.5 / 10**

Justificativa:

O projeto evoluiu de **7.5 para 8.5** com as melhorias implementadas:

**Positivos:**
- Clean Architecture real (+2.0 vs projeto sem arquitetura)
- CQRS com MediatR (+1.0)
- Testes unitários com mocks (+1.0)
- Entidade rica com comportamento de domínio (+0.5)
- PostgreSQL com migrations geradas (+0.5, antes SQLite -0.5)
- OpenTelemetry com OTLP exporter (+0.5)
- Deploy em produção no Render.com com Swagger acessível (+0.3)
- Swagger, JWT, Docker (+0.5)

**Limitações:**
- Sem pipeline behaviors MediatR (-0.2)
- Sem testes de integração (-0.3)

Para vagas **Pleno .NET** com banco enterprise, observabilidade e deploy em produção demonstráveis.
