# CollabDocs - Development Script (PowerShell)
# Inicia todos os servicos necessarios para desenvolvimento

param(
    [string]$Environment = "development"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Iniciando CollabDocs em modo development..." -ForegroundColor Green

# Verificar se esta no diretorio correto
if (-not (Test-Path "package.json")) {
    Write-Host "Execute este script na raiz do projeto CollabDocs" -ForegroundColor Red
    exit 1
}

# Instalar dependencias se necessario
if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependencias..." -ForegroundColor Blue
    npm install
}

# Build packages
Write-Host "Building packages..." -ForegroundColor Blue
npm run build

# Verificar se Wrangler esta configurado
if (-not (Test-Path "wrangler.toml")) {
    Write-Host "wrangler.toml nao encontrado. Execute setup-cloudflare.ps1 primeiro." -ForegroundColor Red
    exit 1
}

# Funcao para cleanup ao sair
function Cleanup {
    Write-Host ""
    Write-Host "Parando servicos..." -ForegroundColor Yellow
    
    # Parar processos em background
    Get-Job | Stop-Job
    Get-Job | Remove-Job
    
    # Parar processos especificos se ainda estiverem rodando
    $processes = @("wrangler", "node")
    foreach ($proc in $processes) {
        Get-Process -Name $proc -ErrorAction SilentlyContinue | Stop-Process -Force
    }
    
    exit
}

# Registrar handler para Ctrl+C
Register-EngineEvent PowerShell.Exiting -Action { Cleanup }
trap { Cleanup }

Write-Host "Iniciando servicos..." -ForegroundColor Blue

# Iniciar Wrangler dev (backend)
Write-Host "Iniciando Cloudflare Workers..." -ForegroundColor Blue
Start-Job -ScriptBlock { 
    Set-Location $using:PWD
    wrangler dev --port 8787 --local 
} -Name "Worker"

# Aguardar worker iniciar
Start-Sleep -Seconds 3

# Iniciar frontend
Write-Host "Iniciando frontend Next.js..." -ForegroundColor Blue
Start-Job -ScriptBlock { 
    Set-Location "$using:PWD\apps\web"
    npm run dev 
} -Name "Frontend"

Write-Host ""
Write-Host "CollabDocs rodando!" -ForegroundColor Green
Write-Host ""
Write-Host "URLs disponiveis:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor Gray
Write-Host "   Backend:  http://localhost:8787" -ForegroundColor Gray
Write-Host "   WebSocket: ws://localhost:8787/ws" -ForegroundColor Gray
Write-Host ""
Write-Host "Logs:" -ForegroundColor Cyan
Write-Host "   - Frontend e Backend serao exibidos aqui" -ForegroundColor Gray
Write-Host "   - Use Ctrl+C para parar todos os servicos" -ForegroundColor Gray
Write-Host ""

# Monitorar jobs
try {
    while ($true) {
        $jobs = Get-Job
        $runningJobs = $jobs | Where-Object { $_.State -eq "Running" }
        
        if ($runningJobs.Count -eq 0) {
            Write-Host "Todos os servicos pararam" -ForegroundColor Yellow
            break
        }
        
        # Mostrar status dos jobs
        foreach ($job in $jobs) {
            $status = switch ($job.State) {
                "Running" { "OK" }
                "Completed" { "OK" }
                "Failed" { "ERRO" }
                default { "PEND" }
            }
            Write-Host "$status $($job.Name): $($job.State)" -ForegroundColor Gray
        }
        
        Start-Sleep -Seconds 5
        Clear-Host
        Write-Host "CollabDocs - Status dos Servicos" -ForegroundColor Green
        Write-Host "=====================================" -ForegroundColor Gray
    }
} catch {
    Write-Host "Erro ao monitorar servicos: $_" -ForegroundColor Red
} finally {
    Cleanup
}
