# Script para verificar variáveis de ambiente no Vercel
Write-Host "🔍 Verificando variáveis de ambiente no Vercel..." -ForegroundColor Yellow

# Verificar se o Vercel CLI está instalado
try {
    $vercelVersion = vercel --version
    Write-Host "✅ Vercel CLI encontrado: $vercelVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel CLI não encontrado. Instalando..." -ForegroundColor Red
    npm install -g vercel
}

# Verificar se o projeto está linkado
try {
    $projectInfo = vercel project ls --json | ConvertFrom-Json
    Write-Host "✅ Projeto Vercel encontrado" -ForegroundColor Green
    Write-Host "   Nome: $($projectInfo.name)" -ForegroundColor Cyan
    Write-Host "   ID: $($projectInfo.id)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Projeto não encontrado. Linkando..." -ForegroundColor Red
    vercel link
}

# Verificar variáveis de ambiente
Write-Host "`n🔑 Verificando variáveis de ambiente..." -ForegroundColor Yellow

try {
    $envVars = vercel env ls --json | ConvertFrom-Json
    Write-Host "✅ Variáveis de ambiente encontradas:" -ForegroundColor Green
    
    foreach ($env in $envVars) {
        $status = if ($env.value) { "✅ Configurada" } else { "❌ Não configurada" }
        $color = if ($env.value) { "Green" } else { "Red" }
        Write-Host "   $($env.key): $status" -ForegroundColor $color
    }
} catch {
    Write-Host "❌ Erro ao verificar variáveis de ambiente" -ForegroundColor Red
    Write-Host "   Execute: vercel env ls" -ForegroundColor Yellow
}

Write-Host "`n📋 Variáveis necessárias:" -ForegroundColor Yellow
Write-Host "   GITHUB_CLIENT_ID" -ForegroundColor Cyan
Write-Host "   GITHUB_CLIENT_SECRET" -ForegroundColor Cyan
Write-Host "   GOOGLE_CLIENT_ID" -ForegroundColor Cyan
Write-Host "   GOOGLE_CLIENT_SECRET" -ForegroundColor Cyan
Write-Host "   NEXTAUTH_URL" -ForegroundColor Cyan
Write-Host "   NEXTAUTH_SECRET" -ForegroundColor Cyan

Write-Host "`n🚀 Para configurar variáveis:" -ForegroundColor Yellow
Write-Host "   vercel env add GITHUB_CLIENT_ID" -ForegroundColor Cyan
Write-Host "   vercel env add GITHUB_CLIENT_SECRET" -ForegroundColor Cyan
Write-Host "   vercel env add GOOGLE_CLIENT_ID" -ForegroundColor Cyan
Write-Host "   vercel env add GOOGLE_CLIENT_SECRET" -ForegroundColor Cyan
Write-Host "   vercel env add NEXTAUTH_URL" -ForegroundColor Cyan
Write-Host "   vercel env add NEXTAUTH_SECRET" -ForegroundColor Cyan
