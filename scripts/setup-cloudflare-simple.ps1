# CollabDocs - Cloudflare Setup Script Simplificado (PowerShell)
# Este script configura apenas os recursos essenciais na Cloudflare

param(
    [string]$Environment = "production"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Configurando recursos essenciais Cloudflare para CollabDocs..." -ForegroundColor Green

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

# Configurar secrets basicos
Write-Host "Configurando secrets basicos..." -ForegroundColor Blue

$GITHUB_CLIENT_ID = Read-Host "GitHub Client ID (OAuth)"
wrangler secret put GITHUB_CLIENT_ID
[Console]::WriteLine($GITHUB_CLIENT_ID)

$GITHUB_CLIENT_SECRET = Read-Host "GitHub Client Secret (OAuth)" -AsSecureString
$GITHUB_CLIENT_SECRET_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($GITHUB_CLIENT_SECRET))
wrangler secret put GITHUB_CLIENT_SECRET
[Console]::WriteLine($GITHUB_CLIENT_SECRET_PLAIN)

# Gerar JWT Secret
$JWT_SECRET = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
wrangler secret put JWT_SECRET
[Console]::WriteLine($JWT_SECRET)

Write-Host "Secrets basicos configurados com sucesso!" -ForegroundColor Green

# Deploy inicial
Write-Host "Fazendo deploy inicial..." -ForegroundColor Blue
npm run build

# Deploy Workers
wrangler deploy

Write-Host ""
Write-Host "Setup basico completo!" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "1. Configure seu OAuth App no GitHub com a URL:" -ForegroundColor White
Write-Host "   - Callback: [YOUR_WORKER_URL]/auth/github/callback" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Para recursos adicionais (R2, KV):" -ForegroundColor White
Write-Host "   - Habilite R2 no Cloudflare Dashboard" -ForegroundColor Gray
Write-Host "   - Crie KV namespace manualmente se necessario" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Para development local:" -ForegroundColor White
Write-Host "   - npm run dev (backend)" -ForegroundColor Gray
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
Write-Host "CollabDocs esta pronto para uso basico!" -ForegroundColor Green
