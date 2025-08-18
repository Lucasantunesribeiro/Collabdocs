# CollabDocs - Cloudflare Setup Script (PowerShell)
# Este script configura todos os recursos necessarios na Cloudflare

param(
    [string]$Environment = "production"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Configurando recursos Cloudflare para CollabDocs..." -ForegroundColor Green

# Verificar se Wrangler esta instalado
if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
    Write-Host "Wrangler nao encontrado. Instalando..." -ForegroundColor Yellow
    npm install -g wrangler@latest
}

# Login (se necessario)
Write-Host "Verificando autenticacao Cloudflare..." -ForegroundColor Blue
try {
    wrangler whoami | Out-Null
    Write-Host "Ja autenticado na Cloudflare" -ForegroundColor Green
} catch {
    Write-Host "Por favor, faca login na Cloudflare:" -ForegroundColor Yellow
    wrangler login
}

# Criar D1 Database
Write-Host "Configurando D1 Database..." -ForegroundColor Blue
$DB_NAME = "collab-docs-db"

$dbExists = wrangler d1 list | Select-String $DB_NAME
if (-not $dbExists) {
    Write-Host "Criando database $DB_NAME..." -ForegroundColor Yellow
    wrangler d1 create $DB_NAME
    Write-Host "Database criado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "Database $DB_NAME ja existe." -ForegroundColor Green
}

# Obter ID do database
$DB_ID = (wrangler d1 list | Select-String $DB_NAME | ForEach-Object { ($_ -split '\s+')[1] })
Write-Host "Database ID: $DB_ID" -ForegroundColor Cyan

# Atualizar wrangler.toml com ID real do database
$wranglerContent = Get-Content "wrangler.toml" -Raw
$wranglerContent = $wranglerContent -replace 'database_id = "placeholder"', "database_id = `"$DB_ID`""
Set-Content "wrangler.toml" $wranglerContent

# Executar migrations
Write-Host "Executando migrations D1..." -ForegroundColor Blue
wrangler d1 migrations apply $DB_NAME
Write-Host "Migrations aplicadas com sucesso!" -ForegroundColor Green

# Criar R2 Bucket (comentado - precisa habilitar R2 primeiro)
Write-Host "Configurando R2 Bucket..." -ForegroundColor Blue
Write-Host "NOTA: R2 precisa ser habilitado no Cloudflare Dashboard primeiro" -ForegroundColor Yellow
Write-Host "Pule esta etapa por enquanto e habilite R2 em: https://dash.cloudflare.com" -ForegroundColor Yellow

# Criar KV Namespace
Write-Host "Configurando KV Namespace..." -ForegroundColor Blue
$KV_NAME = "collab-docs-cache"

# Usar comando correto para listar KV namespaces
try {
    $kvExists = wrangler kv namespace list | Select-String $KV_NAME
} catch {
    Write-Host "Erro ao listar KV namespaces. Tentando criar..." -ForegroundColor Yellow
    $kvExists = $null
}

if (-not $kvExists) {
    Write-Host "Criando KV namespace $KV_NAME..." -ForegroundColor Yellow
    try {
        $kvOutput = wrangler kv namespace create $KV_NAME
        # Extrair ID do output (formato pode variar)
        if ($kvOutput -match 'id.*?"([^"]+)"') {
            $KV_ID = $matches[1]
        } else {
            # Tentar formato alternativo
            $KV_ID = ($kvOutput | Select-String 'id' | ForEach-Object { 
                if ($_ -match '"([^"]+)"') { $matches[1] } else { $null }
            } | Where-Object { $null -ne $_ } | Select-Object -First 1)
        }
        
        if ($KV_ID) {
            # Atualizar wrangler.toml com ID real do KV
            $wranglerContent = Get-Content "wrangler.toml" -Raw
            $wranglerContent = $wranglerContent -replace 'id = "placeholder"', "id = `"$KV_ID`""
            Set-Content "wrangler.toml" $wranglerContent
            
            Write-Host "KV Namespace criado com sucesso! ID: $KV_ID" -ForegroundColor Green
        } else {
            Write-Host "AVISO: KV Namespace criado mas ID nao foi extraido automaticamente" -ForegroundColor Yellow
            Write-Host "Atualize manualmente o wrangler.toml com o ID correto" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Erro ao criar KV namespace: $_" -ForegroundColor Red
        Write-Host "Crie manualmente via Cloudflare Dashboard ou tente novamente" -ForegroundColor Yellow
    }
} else {
    Write-Host "KV Namespace $KV_NAME ja existe." -ForegroundColor Green
}

# Configurar secrets (se nao existirem)
Write-Host "Configurando secrets..." -ForegroundColor Blue

$GITHUB_CLIENT_ID = Read-Host "GitHub Client ID (OAuth)"
wrangler secret put GITHUB_CLIENT_ID
[Console]::WriteLine($GITHUB_CLIENT_ID)

$GITHUB_CLIENT_SECRET = Read-Host "GitHub Client Secret (OAuth)" -AsSecureString
$GITHUB_CLIENT_SECRET_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($GITHUB_CLIENT_SECRET))
wrangler secret put GITHUB_CLIENT_SECRET
[Console]::WriteLine($GITHUB_CLIENT_SECRET_PLAIN)

$GOOGLE_CLIENT_ID = Read-Host "Google Client ID (OAuth)"
wrangler secret put GOOGLE_CLIENT_ID
[Console]::WriteLine($GOOGLE_CLIENT_ID)

$GOOGLE_CLIENT_SECRET = Read-Host "Google Client Secret (OAuth)" -AsSecureString
$GOOGLE_CLIENT_SECRET_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($GOOGLE_CLIENT_SECRET))
wrangler secret put GOOGLE_CLIENT_SECRET
[Console]::WriteLine($GOOGLE_CLIENT_SECRET_PLAIN)

# Gerar JWT Secret se nao fornecido
$JWT_SECRET = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
wrangler secret put JWT_SECRET
[Console]::WriteLine($JWT_SECRET)

# Frontend URL
$FRONTEND_URL = Read-Host "Frontend URL (ex: https://collabdocs.pages.dev)"
wrangler secret put FRONTEND_URL
[Console]::WriteLine($FRONTEND_URL)

Write-Host "Secrets configurados com sucesso!" -ForegroundColor Green

# Deploy inicial
Write-Host "Fazendo deploy inicial..." -ForegroundColor Blue
npm run build

# Deploy Workers
wrangler deploy

Write-Host ""
Write-Host "Setup completo!" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "1. Configure seu OAuth Apps no GitHub/Google com as URLs:" -ForegroundColor White
Write-Host "   - Callback GitHub: [YOUR_WORKER_URL]/auth/github/callback" -ForegroundColor Gray
Write-Host "   - Callback Google: [YOUR_WORKER_URL]/auth/google/callback" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Configure o frontend (Cloudflare Pages):" -ForegroundColor White
Write-Host "   - Conecte seu repositorio" -ForegroundColor Gray
Write-Host "   - Configure build command: cd apps/web && npm run build" -ForegroundColor Gray
Write-Host "   - Configure build output: apps/web/dist" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Configure variaveis de ambiente no Pages:" -ForegroundColor White
Write-Host "   - NEXT_PUBLIC_API_URL: [YOUR_WORKER_URL]" -ForegroundColor Gray
Write-Host "   - NEXT_PUBLIC_WS_URL: wss://[YOUR_WORKER_DOMAIN]" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Para development local:" -ForegroundColor White
Write-Host "   - npm run dev (backend)" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Habilite R2 no Cloudflare Dashboard:" -ForegroundColor White
Write-Host "   - Vá para: https://dash.cloudflare.com" -ForegroundColor Gray
Write-Host "   - Habilite R2 Object Storage" -ForegroundColor Gray
Write-Host ""
Write-Host "URLs importantes:" -ForegroundColor Cyan
try {
    $accountInfo = wrangler whoami 2>$null
    $accountId = ($accountInfo | Select-String "Account ID" | ForEach-Object { ($_ -split ':')[1].Trim() })
    Write-Host "   - Worker: $accountId.workers.dev" -ForegroundColor Gray
} catch {
    Write-Host "   - Worker: [ACCOUNT_ID].workers.dev" -ForegroundColor Gray
}
Write-Host "   - Dashboard: https://dash.cloudflare.com" -ForegroundColor Gray
Write-Host ""
Write-Host "CollabDocs esta pronto para uso!" -ForegroundColor Green
