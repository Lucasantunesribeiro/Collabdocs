# Script para aplicar a migration 0002_add_content_column.sql
# Execute este script apos iniciar o ambiente de desenvolvimento

Write-Host "Aplicando migration 0002_add_content_column.sql..." -ForegroundColor Green

# Navegar para o diretorio do projeto
Set-Location $PSScriptRoot/..

# Verificar se o wrangler esta instalado
if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
    Write-Host "Wrangler nao encontrado. Instale com: npm install -g wrangler" -ForegroundColor Red
    exit 1
}

# Aplicar a migration
try {
    Write-Host "Aplicando migration..." -ForegroundColor Yellow
    wrangler d1 execute collabdocs-db --file=./migrations/0002_add_content_column.sql
    
    Write-Host "Migration aplicada com sucesso!" -ForegroundColor Green
    Write-Host "Coluna 'content' adicionada a tabela documents" -ForegroundColor Green
    
} catch {
    Write-Host "Erro ao aplicar migration: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Migration concluida! O sistema agora suporta conteudo de documentos." -ForegroundColor Green
