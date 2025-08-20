# CollabDocs - Deploy Script para Vercel (PowerShell)
# Deploy para producao no Vercel

param(
    [string]$Environment = "production"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Deploy CollabDocs para Vercel ($Environment)..." -ForegroundColor Green

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

# Verificar se o Vercel CLI esta instalado
try {
    $vercelVersion = vercel --version
    Write-Host "Vercel CLI encontrado: $vercelVersion" -ForegroundColor Green
} catch {
    Write-Host "Vercel CLI nao encontrado. Instalando..." -ForegroundColor Yellow
    npm install -g vercel
}

# Commit das mudancas se necessario
if ($gitStatus) {
    Write-Host "Fazendo commit das mudancas..." -ForegroundColor Blue
    git add .
    git commit -m "feat: implement Auth.js authentication system"
    Write-Host "Commit realizado!" -ForegroundColor Green
}

# Push para o repositorio remoto
Write-Host "Fazendo push para o repositorio..." -ForegroundColor Blue
git push origin main
Write-Host "Push realizado!" -ForegroundColor Green

# Navegar para o diretorio web
Push-Location "apps/web"

# Verificar se o projeto esta linkado ao Vercel
if (-not (Test-Path ".vercel")) {
    Write-Host "Projeto nao esta linkado ao Vercel. Linkando..." -ForegroundColor Yellow
    vercel link
}

# Deploy para producao
Write-Host "Fazendo deploy para producao..." -ForegroundColor Blue
vercel --prod

Pop-Location

# Git tag para producao
if ($Environment -eq "production") {
    Write-Host "Criando git tag..." -ForegroundColor Blue
    $VERSION = "v$(Get-Date -Format 'yyyy.MM.dd-HHmmss')"
    git tag $VERSION
    git push origin $VERSION
    Write-Host "Tag $VERSION criada!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Deploy para Vercel completo!" -ForegroundColor Green
Write-Host ""
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "   Frontend: https://collabdocs-app.vercel.app" -ForegroundColor Gray
Write-Host "   API Auth: https://collabdocs-app.vercel.app/api/auth/[...nextauth]" -ForegroundColor Gray
Write-Host ""
Write-Host "Monitoramento:" -ForegroundColor Cyan
Write-Host "   - Vercel Dashboard: https://vercel.com/dashboard" -ForegroundColor Gray
Write-Host "   - Logs: vercel logs" -ForegroundColor Gray
Write-Host ""

if ($Environment -eq "production") {
    Write-Host "CollabDocs esta LIVE no Vercel!" -ForegroundColor Green
    Write-Host "Sistema de autenticação Auth.js ativo!" -ForegroundColor Green
}
