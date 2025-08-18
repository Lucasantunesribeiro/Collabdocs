# CollabDocs - Deploy Script (PowerShell)
# Deploy para producao na Cloudflare

param(
    [string]$Environment = "production"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Deploy CollabDocs para $Environment..." -ForegroundColor Green

# Verificar se esta no diretorio correto
if (-not (Test-Path "package.json")) {
    Write-Host "Execute este script na raiz do projeto CollabDocs" -ForegroundColor Red
    exit 1
}

# Verificar se ha mudancas nao commitadas
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "Ha mudancas nao commitadas. Deseja continuar? (y/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -notmatch "^[Yy]$") {
        exit 1
    }
}

# Instalar dependencias
Write-Host "Instalando dependencias..." -ForegroundColor Blue
npm ci

# Build do projeto
Write-Host "Building projeto..." -ForegroundColor Blue
npm run build

# Executar testes
Write-Host "Executando testes..." -ForegroundColor Blue
npm run test

# Lint check
Write-Host "Verificando code quality..." -ForegroundColor Blue
npm run lint
npm run typecheck

Write-Host "Quality checks passaram!" -ForegroundColor Green

# Executar migrations D1
Write-Host "Aplicando migrations D1..." -ForegroundColor Blue
wrangler d1 migrations apply COLLAB_DOCS_DB --env $Environment

# Deploy Workers
Write-Host "Fazendo deploy dos Workers..." -ForegroundColor Blue
wrangler deploy --env $Environment

# Deploy Frontend
Write-Host "Fazendo deploy do Frontend..." -ForegroundColor Blue
Push-Location "apps/web"

if ($Environment -eq "production") {
    $PROJECT_NAME = "collab-docs"
    $API_URL = "https://collab-docs.workers.dev"
    $WS_URL = "wss://collab-docs.workers.dev"
} else {
    $PROJECT_NAME = "collab-docs-staging"
    $API_URL = "https://collab-docs-staging.workers.dev"
    $WS_URL = "wss://collab-docs-staging.workers.dev"
}

# Build frontend com variaveis de ambiente corretas
$env:NEXT_PUBLIC_API_URL = $API_URL
$env:NEXT_PUBLIC_WS_URL = $WS_URL
npm run build

# Deploy para Cloudflare Pages
npx wrangler pages deploy dist --project-name $PROJECT_NAME

Pop-Location

# Health check
Write-Host "Verificando saude da aplicacao..." -ForegroundColor Blue
Start-Sleep -Seconds 5

$HEALTH_URL = "$API_URL/health"
try {
    $response = Invoke-WebRequest -Uri $HEALTH_URL -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "Health check passou!" -ForegroundColor Green
    } else {
        Write-Host "Health check falhou com status: $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Health check falhou: $_" -ForegroundColor Red
    exit 1
}

# Git tag para producao
if ($Environment -eq "production") {
    Write-Host "Criando git tag..." -ForegroundColor Blue
    $VERSION = "v$(Get-Date -Format 'yyyy.MM.dd-HHmmss')"
    git tag $VERSION
    git push origin $VERSION
    Write-Host "Tag $VERSION criada!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Deploy completo para $Environment!" -ForegroundColor Green
Write-Host ""
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "   Frontend: https://$PROJECT_NAME.pages.dev" -ForegroundColor Gray
Write-Host "   API:      $API_URL" -ForegroundColor Gray
Write-Host "   WebSocket: $WS_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "Monitoramento:" -ForegroundColor Cyan
Write-Host "   - Cloudflare Dashboard: https://dash.cloudflare.com" -ForegroundColor Gray
Write-Host "   - Logs: wrangler tail" -ForegroundColor Gray
Write-Host ""

if ($Environment -eq "production") {
    Write-Host "CollabDocs esta LIVE em producao!" -ForegroundColor Green
} else {
    Write-Host "CollabDocs esta rodando em $Environment!" -ForegroundColor Green
}
