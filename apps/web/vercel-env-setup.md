# Configuração de Variáveis de Ambiente no Vercel

## 🚀 **Deploy para Produção**

Para resolver o erro 404 em produção, você precisa:

### 1. **Fazer Deploy das Mudanças**

Execute o script de deploy:
```bash
# Na raiz do projeto
.\scripts\deploy-vercel.ps1
```

### 2. **Configurar Variáveis de Ambiente no Vercel**

Acesse [Vercel Dashboard](https://vercel.com/dashboard) e configure:

#### **Environment Variables:**

```bash
# NextAuth Configuration
NEXTAUTH_SECRET=sSCxa3GBGJ7TQtZ34xBIOgUfBvt30rNl6OAeKUz/NzQ=
NEXTAUTH_URL=https://collabdocs-app.vercel.app

# GitHub OAuth
GITHUB_CLIENT_ID=seu-github-client-id-real
GITHUB_CLIENT_SECRET=seu-github-client-secret-real

# Google OAuth
GOOGLE_CLIENT_ID=seu-google-client-id-real
GOOGLE_CLIENT_SECRET=seu-google-client-secret-real
```

### 3. **Atualizar URLs de Callback nos Provedores**

#### **GitHub OAuth App:**
- **Authorization callback URL**: `https://collabdocs-app.vercel.app/api/auth/callback/github`
- **Homepage URL**: `https://collabdocs-app.vercel.app`

#### **Google OAuth 2.0:**
- **Authorized redirect URIs**: `https://collabdocs-app.vercel.app/api/auth/callback/google`
- **Authorized JavaScript origins**: `https://collabdocs-app.vercel.app`

## 🔍 **Verificação**

Após o deploy, teste:

1. **Acesse**: https://collabdocs-app.vercel.app
2. **Clique**: "Entrar com GitHub" ou "Entrar com Google"
3. **Resultado**: Deve redirecionar para o provedor OAuth (sem erro 404)

## 🐛 **Se o Erro Persistir**

1. **Verifique logs**: `vercel logs`
2. **Re-deploy**: `vercel --prod`
3. **Cache**: Limpe cache do Vercel se necessário

## 📱 **Status Atual**

- ✅ **Local**: Auth.js funcionando (porta 3002)
- ❌ **Produção**: Código antigo ainda ativo
- 🔄 **Solução**: Deploy das mudanças para Vercel
