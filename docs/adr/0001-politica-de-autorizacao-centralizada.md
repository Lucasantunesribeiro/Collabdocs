# 0001 — Política de autorização por documento centralizada

- Status: aceito
- Data: 2026-11-03

## Contexto

As checagens de acesso estavam espalhadas pelos handlers .NET (`OwnerId != userId`, `CanView`, `CanEdit`) e pelos casos de uso do Worker, e não concordavam entre si:

- `Document.CanView/CanEdit` comparavam apenas `UserId`, mas o convite grava `UserId` vazio. Um colaborador de documento privado via o documento na listagem (que compara e-mail), mas recebia 403 ao abrir ou salvar;
- documento privado sem acesso respondia 403 e id inexistente respondia 404. A diferença revelava a existência do documento (IDOR por enumeração de ids);
- a API aceitava conceder `owner` a um colaborador;
- o WebSocket liberava o acesso quando o D1 falhava (fail-open) e repassava qualquer mensagem, inclusive `update` de viewers e `join`/`leave` forjados.

## Decisão

- Papéis: `None`, `PublicReader`, `Viewer`, `Editor`, `Owner`.
- Operações: `Read`, `ListCollaborators`, `EditContent`, `Rename`, `ChangeVisibility`, `Delete`, `ManageCollaborators`, `ConnectRealtime`, `SendRealtimeUpdate`.
- A matriz papel x operação mora em um único módulo por runtime: `DocumentAccessPolicy` (.NET) e `workers/domain/authorization.ts` (Worker). Os dois têm a mesma tabela.
- Todos os handlers .NET passam por `IDocumentAuthorizationService.AuthorizeAsync`. Ele carrega o documento e os colaboradores, resolve o papel e:
  - lança `DocumentNotFoundException` (404) quando o usuário não pode ler;
  - lança `DocumentAccessDeniedException` (403) quando o usuário lê, mas não pode executar a operação.
- `DocumentExceptionFilter` é o único lugar que converte exceção em status HTTP.
- `Permission.Owner` em linha de colaborador vale como `Editor`. Posse é sempre `Document.OwnerId`.
- O WebSocket aplica `ConnectRealtime` no upgrade e `SendRealtimeUpdate` mensagem a mensagem.

## Consequências

- Uma regra nova (ex.: "editor pode convidar viewer") muda em um ponto e quebra a matriz de testes (`DocumentAuthorizationMatrixTests`, `tests/unit/authorization.test.ts`) se divergir.
- Os dois runtimes duplicam a tabela. A divergência é evitada por testes espelhados, não por código compartilhado.
- O cliente não distingue "não existe" de "sem acesso". Isso é intencional.
