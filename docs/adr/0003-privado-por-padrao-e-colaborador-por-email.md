# 0003 — Documento privado por padrão e colaborador vinculado por e-mail

- Status: aceito
- Data: 2026-11-03

## Contexto

- `CreateDocumentRequest` (.NET), `createDocument` (Worker) e o modal do frontend usavam `public` como padrão. Um esquecimento do usuário expunha o documento a qualquer conta autenticada.
- O convite de colaborador é feito por e-mail antes de a pessoa existir no sistema. A tabela guarda `UserEmail` e um `UserId` vazio, e nenhum código preenchia o `UserId` depois.
- O índice único `(DocumentId, UserEmail)` diferenciava maiúsculas. Um reconvite com o mesmo e-mail estourava esse índice e virava 500.

## Decisão

- Sem `visibility: "public"` explícito, o documento é criado `private` nas três camadas.
- Só o dono muda a visibilidade (`PUT /api/documents/{id}` com `visibility`).
- O colaborador é identificado pelo e-mail do JWT ou pelo `UserId`, quando preenchido. A comparação ignora maiúsculas e ignora valores vazios.
- O e-mail é normalizado (`trim` + minúsculas) ao gravar e remover.
- Reconvidar o mesmo e-mail atualiza a permissão.
- O dono não pode ser convidado para o próprio documento.

## Consequências

- Documentos criados por clientes antigos que não enviam `visibility` passam a ser privados.
- A segurança do compartilhamento depende de o e-mail no JWT ser confiável. Ele vem do NextAuth e do provedor OAuth, e a API não verifica o e-mail por conta própria.
- Linhas antigas com e-mail em maiúsculas continuam funcionando, porque a comparação ignora caixa. Ainda assim, duas linhas que diferem só na caixa podem coexistir até serem regravadas.
