# 🔐 Configuração do Google OAuth para CollabDocs

## 📋 Passos para Configurar Google OAuth

### 1. Acessar Google Cloud Console
- Vá para: https://console.cloud.google.com/
- Faça login com sua conta Google

### 2. Criar Novo Projeto (ou usar existente)
- Clique no seletor de projeto no topo
- Clique em "Novo Projeto"
- Nome: `CollabDocs`
- Clique em "Criar"

### 3. Habilitar Google+ API
- No menu lateral, vá em "APIs e Serviços" > "Biblioteca"
- Procure por "Google+ API" ou "Google Identity"
- Clique em "Habilitar"

### 4. Configurar Tela de Consentimento OAuth
- Vá em "APIs e Serviços" > "Tela de consentimento OAuth"
- Escolha "Externo" e clique em "Criar"
- Preencha:
  - **Nome do app**: `CollabDocs`
  - **Email de suporte**: Seu email
  - **Logo**: (opcional)
  - **Domínio do app**: `collabdocs.workers.dev`
  - **Email de contato do desenvolvedor**: Seu email
- Clique em "Salvar e continuar"
- Em "Escopos", clique em "Adicionar ou remover escopos"
- Selecione:
  - `.../auth/userinfo.email`
  - `.../auth/userinfo.profile`
- Clique em "Salvar e continuar"
- Em "Usuários de teste", adicione seu email
- Clique em "Salvar e continuar"

### 5. Criar Credenciais OAuth
- Vá em "APIs e Serviços" > "Credenciais"
- Clique em "Criar credenciais" > "ID do cliente OAuth"
- Tipo de aplicativo: `Aplicativo da Web`
- Nome: `CollabDocs Web Client`
- **URIs de redirecionamento autorizados**:
  ```
  https://collab-docs.collabdocs.workers.dev/auth/google/callback
  http://localhost:3000/auth/google/callback
  ```
- Clique em "Criar"

### 6. Copiar Credenciais
- **Client ID**: Copie o ID do cliente
- **Client Secret**: Clique em "Mostrar" e copie o segredo

### 7. Atualizar wrangler.toml
Substitua no arquivo `wrangler.toml`:
```toml
GOOGLE_CLIENT_ID = "SEU_GOOGLE_CLIENT_ID_AQUI"
GOOGLE_CLIENT_SECRET = "SEU_GOOGLE_CLIENT_SECRET_AQUI"
```

### 8. Fazer Deploy
```bash
wrangler deploy
```

## ⚠️ Importante
- **Client Secret** é confidencial - nunca compartilhe
- **URIs de redirecionamento** devem ser exatos
- **Domínios autorizados** devem incluir seu domínio de produção

## 🔍 Testando
Após configurar:
1. Acesse: https://collab-docs.collabdocs.workers.dev/auth/google
2. Deve redirecionar para Google
3. Após autorizar, retorna para o frontend com token

## 🆘 Solução de Problemas
- **Erro 400**: Verificar URIs de redirecionamento
- **Erro 403**: Verificar se API está habilitada
- **Erro 500**: Verificar se credenciais estão corretas
