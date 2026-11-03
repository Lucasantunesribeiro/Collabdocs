# 0002 — WebSocket do Worker autorizado pela API .NET

- Status: aceito
- Data: 2026-11-03

## Contexto

O frontend cria e edita documentos na API .NET (PostgreSQL). O WebSocket roda no Worker, que autorizava o upgrade consultando o **D1** do próprio Worker. Os documentos da API .NET não existem no D1, então a checagem falhava para eles. Quando o D1 dava erro, a checagem liberava o acesso (fail-open).

Replicar documentos e colaboradores no D1 criaria duas fontes da verdade para permissões.

## Decisão

- Com `DOCUMENTS_API_URL` definida, o router do Worker chama `GET {DOCUMENTS_API_URL}/documents/{id}` repassando o JWT do usuário. O papel vem do campo `permission` da resposta (`owner` | `write` | `read`). Assim a mesma política do .NET decide o acesso ao tempo real.
- Sem a variável, o Worker usa o D1 com a política espelhada (`workers/domain/authorization.ts`).
- Qualquer falha (rede, status diferente de 2xx, JSON inválido, id divergente, erro do D1) resulta em papel `none`, ou seja, fail-closed. O upgrade responde 404.
- O router remove `token` e qualquer `__verified_*` da URL do cliente e injeta identidade, papel e documento verificados. O Durable Object só confia nesses parâmetros.

## Consequências

- Cada conexão WebSocket custa uma chamada HTTP à API .NET, o que adiciona latência no upgrade. As mensagens seguintes não fazem chamada.
- O papel é fixado no upgrade, mas a sessão tem prazo: `min(exp do JWT, agora + 10 min)`, calculado pelo router e enviado em `__verified_expiresAt`. Ao vencer, o Durable Object fecha com `4001`, descarta mensagens recebidas depois do prazo e não entrega broadcast a quem venceu. O cliente reconecta em `4001` e passa de novo pela autorização. Revogar um colaborador ou tornar o documento privado corta o tempo real em no máximo 10 minutos. Uma revogação instantânea exigiria a API .NET notificar o Worker, o que não foi feito.
- Cada reconexão (a cada 10 min por cliente) custa outra chamada à API .NET.
- O deploy do Worker precisa da variável `DOCUMENTS_API_URL`. Sem ela, o tempo real nega documentos que só existem no PostgreSQL.
