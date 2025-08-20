# Configuração do Sistema de Autenticação

Este projeto agora usa o **Auth.js (NextAuth)** para autenticação OAuth com GitHub e Google.

## 🚀 Configuração Rápida

### 1. Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto `apps/web/` com as seguintes variáveis:

```bash
# NextAuth Configuration
NEXTAUTH_SECRET=sua-chave-secreta-aqui
NEXTAUTH_URL=http://localhost:3002

# GitHub OAuth
GITHUB_CLIENT_ID=seu-github-client-id
GITHUB_CLIENT_SECRET=seu-github-client-secret

# Google OAuth
GOOGLE_CLIENT_ID=seu-google-client-id
GOOGLE_CLIENT_SECRET=seu-google-client-secret
```

### 2. Gerar NEXTAUTH_SECRET

Execute este comando para gerar uma chave secreta segura:

```bash
openssl rand -base64 32
```

Ou use qualquer string aleatória de pelo menos 32 caracteres.

### 3. Configurar URLs de Callback

#### GitHub OAuth App:
- **Authorization callback URL**: `http://localhost:3002/api/auth/callback/github`
- **Homepage URL**: `http://localhost:3002`

#### Google OAuth 2.0:
- **Authorized redirect URIs**: `http://localhost:3002/api/auth/callback/google`
- **Authorized JavaScript origins**: `http://localhost:3002`

## 🔧 Para Produção (Vercel)

### 1. Variáveis de Ambiente no Vercel

Configure as seguintes variáveis no seu projeto Vercel:

```bash
NEXTAUTH_SECRET=sua-chave-secreta-producao
NEXTAUTH_URL=https://seu-dominio.vercel.app
GITHUB_CLIENT_ID=seu-github-client-id
GITHUB_CLIENT_SECRET=seu-github-client-secret
GOOGLE_CLIENT_ID=seu-google-client-id
GOOGLE_CLIENT_SECRET=seu-google-client-secret
```

### 2. URLs de Callback para Produção

#### GitHub OAuth App:
- **Authorization callback URL**: `https://seu-dominio.vercel.app/api/auth/callback/github`
- **Homepage URL**: `https://seu-dominio.vercel.app`

#### Google OAuth 2.0:
- **Authorized redirect URIs**: `https://seu-dominio.vercel.app/api/auth/callback/google`
- **Authorized JavaScript origins**: `https://seu-dominio.vercel.app`

## 📱 Como Funciona

### Fluxo de Autenticação

1. **Usuário clica em "Entrar com GitHub/Google"**
2. **NextAuth redireciona para o provedor OAuth**
3. **Usuário autoriza a aplicação**
4. **Provedor redireciona de volta para `/api/auth/callback/[provider]`**
5. **NextAuth processa a resposta e cria uma sessão**
6. **Usuário é redirecionado para a página principal**

### Integração com Sistema Existente

O sistema mantém compatibilidade com:
- ✅ **Modo Demo** (localStorage)
- ✅ **NextAuth OAuth** (GitHub/Google)
- ✅ **AuthContext existente**

## 🐛 Solução de Problemas

### Erro 404 nas rotas de auth

Se você ainda receber erros 404, verifique:

1. **Arquivo da API existe**: `src/app/api/auth/[...nextauth]/route.ts`
2. **Variáveis de ambiente configuradas**
3. **Servidor reiniciado** após mudanças

### Erro de CORS

Para desenvolvimento local, o NextAuth lida com CORS automaticamente. Para produção, configure no Vercel.

### Erro de Secret

Certifique-se de que `NEXTAUTH_SECRET` está definido e é único para cada ambiente.

## 🔒 Segurança

- ✅ **HTTPS obrigatório** em produção
- ✅ **Secrets únicos** para cada ambiente
- ✅ **URLs de callback validadas**
- ✅ **Tokens JWT seguros**

## 📚 Recursos Adicionais

- [Documentação do Auth.js](https://authjs.dev/)
- [NextAuth.js GitHub](https://github.com/nextauthjs/next-auth)
- [OAuth 2.0 Flow](https://oauth.net/2/)
