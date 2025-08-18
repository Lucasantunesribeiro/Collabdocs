# CollabDocs - Guia para Windows

Este guia e especifico para usuarios Windows que estao desenvolvendo o CollabDocs.

## Scripts PowerShell

Criamos scripts PowerShell equivalentes aos scripts bash para facilitar o desenvolvimento no Windows:

### Scripts Disponiveis

- **`setup-cloudflare.ps1`** - Configura recursos Cloudflare (D1, R2, KV, secrets) - COMPLETO
- **`setup-cloudflare-simple.ps1`** - Configura apenas recursos essenciais (RECOMENDADO)
- **`dev.ps1`** - Inicia ambiente de desenvolvimento local
- **`deploy.ps1`** - Faz deploy para producao/staging

### Como Usar

#### 1. Setup Inicial da Cloudflare (RECOMENDADO)
```powershell
# Opcao 1: Setup simplificado (RECOMENDADO para primeiro uso)
npm run setup:cloudflare:simple

# Opcao 2: Setup completo (pode ter problemas com R2/KV)
npm run setup:cloudflare

# Opcao 3: Direto via PowerShell
powershell -ExecutionPolicy Bypass -File scripts/setup-cloudflare-simple.ps1
```

#### 2. Desenvolvimento Local
```powershell
# Opcao 1: Via npm script
npm run dev:windows

# Opcao 2: Direto via PowerShell
powershell -ExecutionPolicy Bypass -File scripts/dev.ps1
```

#### 3. Deploy para Producao
```powershell
# Opcao 1: Via npm script
npm run deploy:windows

# Opcao 2: Direto via PowerShell
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1

# Para staging
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Environment staging
```

## Configuracoes Necessarias

### PowerShell Execution Policy
Se voce encontrar erros de execucao, execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Wrangler CLI
Certifique-se de que o Wrangler esta instalado:
```powershell
npm install -g wrangler@latest
```

## Problemas Conhecidos e Solucoes

### 1. Erro R2: "Please enable R2 through the Cloudflare Dashboard"
**Problema**: R2 Object Storage nao esta habilitado na sua conta Cloudflare.
**Solucao**: 
1. Vá para https://dash.cloudflare.com
2. Habilite R2 Object Storage
3. Ou use o script simplificado que pula R2

### 2. Erro KV: "Unknown arguments: kv:namespace"
**Problema**: Sintaxe do comando KV mudou na versao mais recente do Wrangler.
**Solucao**: Use o script simplificado ou crie manualmente via Dashboard.

### 3. Erro de Indice: "O índice estava fora dos limites da matriz"
**Problema**: Parsing do output do Wrangler falhou.
**Solucao**: Use o script simplificado que tem melhor tratamento de erros.

## Troubleshooting

### Erro: "Cannot be loaded because running scripts is disabled"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Erro: "wrangler command not found"
```powershell
npm install -g wrangler@latest
```

### Erro: "git command not found"
Instale o Git para Windows: https://git-scm.com/download/win

### Erro: "R2 precisa ser habilitado"
1. Vá para https://dash.cloudflare.com
2. Habilite R2 Object Storage
3. Ou use o script simplificado

## Estrutura dos Scripts

```
scripts/
├── setup-cloudflare-simple.ps1  # Setup essencial (RECOMENDADO)
├── setup-cloudflare.ps1         # Setup completo
├── dev.ps1                      # Desenvolvimento local
├── deploy.ps1                   # Deploy producao
├── setup-cloudflare.sh          # Script bash original
├── dev.sh                       # Script bash original
└── deploy.sh                    # Script bash original
```

## URLs de Desenvolvimento

Apos executar `npm run dev:windows`:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8787
- **WebSocket**: ws://localhost:8787/ws

## Notas Importantes

1. **Sempre execute os scripts na raiz do projeto** (onde esta o `package.json`)
2. **Use `setup:cloudflare:simple` primeiro** para evitar problemas
3. **Use Ctrl+C** para parar os servicos de desenvolvimento
4. **Os scripts PowerShell sao equivalentes aos bash** - escolha o que preferir

## Suporte

Se encontrar problemas:
1. Verifique se esta na raiz do projeto
2. Confirme se o Wrangler esta instalado
3. Verifique se o PowerShell tem permissao de execucao
4. Use o script simplificado se o completo falhar
5. Consulte os logs de erro para mais detalhes

## Migracao dos Scripts Bash

Se voce estava usando os scripts bash anteriormente, pode continuar usando-os via WSL ou Git Bash. Os scripts PowerShell sao apenas uma alternativa nativa para Windows.

## Correcoes Aplicadas

- Removidos todos os emojis que causavam problemas de codificacao
- Corrigida a sintaxe PowerShell para compatibilidade total com Windows
- Simplificados os caracteres especiais para evitar problemas de encoding
- Criado script simplificado para evitar problemas com R2/KV
- Melhorado tratamento de erros e fallbacks
- Mantida toda a funcionalidade essencial dos scripts originais

## Recomendacao de Uso

**Para primeiro uso**: `npm run setup:cloudflare:simple`
**Para uso avancado**: `npm run setup:cloudflare` (apos resolver problemas R2/KV)
**Para desenvolvimento**: `npm run dev:windows`
**Para deploy**: `npm run deploy:windows`
