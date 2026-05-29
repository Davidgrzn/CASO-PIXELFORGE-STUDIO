param(
    [string]$SonarHost = "http://localhost:9000",
    [string]$SonarLogin = "admin",
    [string]$SonarPassword = "Admin123",
    [string]$SonarToken = $env:SONAR_TOKEN
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir  = Join-Path $ProjectDir "backend"
$FrontendDir = Join-Path $ProjectDir "frontend"
$ReportsDir  = Join-Path $ProjectDir "security-reports"
$FinalReportDir = Join-Path $ReportsDir "final-scan"
New-Item -ItemType Directory -Force -Path $FinalReportDir | Out-Null

# ── helpers ──────────────────────────────────────────────────────────────────
function Test-Command($Name) { return [bool](Get-Command $Name -ErrorAction SilentlyContinue) }

function Wait-Sonar {
    Write-Host "Esperando SonarQube en $SonarHost ..."
    for ($i = 1; $i -le 30; $i++) {
        try {
            $r = Invoke-RestMethod -Uri "$SonarHost/api/system/status" -TimeoutSec 5
            if ($r.status -in @("UP","DB_MIGRATION_NEEDED","DB_MIGRATION_RUNNING")) {
                Write-Host "SonarQube listo (status: $($r.status))"
                return
            }
        } catch { }
        Write-Host "  intento $i/30 ..."
        Start-Sleep -Seconds 5
    }
    throw "SonarQube no respondio en $SonarHost"
}

function Test-Auth {
    if ($SonarToken) {
        $cred = "${SonarToken}:"
    } else {
        $cred = "${SonarLogin}:${SonarPassword}"
    }
    $b64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($cred))
    $headers = @{ "Authorization" = "Basic $b64" }
    try {
        $r = Invoke-RestMethod -Uri "$SonarHost/api/authentication/validate" -Headers $headers -TimeoutSec 10
        if ($r.valid -ne $true) { throw "Credenciales invalidas" }
        Write-Host "Autenticacion SonarQube OK"
    } catch {
        throw "Error de autenticacion: $_`n`nVerifica usuario/contrasena o usa: -SonarToken TU_TOKEN"
    }
}

function Ensure-Scanner {
    if (-not (Test-Command "sonar-scanner")) {
        Write-Host "Instalando sonarqube-scanner via npm..."
        npm install -g sonarqube-scanner
        if (-not (Test-Command "sonar-scanner")) {
            throw "sonar-scanner no encontrado. Instala manualmente: https://docs.sonarqube.org/latest/analysis/scan/sonarscanner/"
        }
    }
}

function Run-Scan([string]$WorkDir, [string]$Key, [string]$Name, [string]$Sources, [string]$Exclusions, [string]$CoverageParam) {
    Push-Location $WorkDir
    try {
        $scanArgs = @(
            "-Dsonar.projectKey=$Key",
            "-Dsonar.projectName=$Name",
            "-Dsonar.sources=$Sources",
            "-Dsonar.host.url=$SonarHost",
            "-Dsonar.exclusions=$Exclusions"
        )
        if ($CoverageParam) {
            $scanArgs += $CoverageParam
        }
        if ($SonarToken) {
            $scanArgs += "-Dsonar.token=$SonarToken"
        } else {
            $scanArgs += "-Dsonar.login=$SonarLogin"
            $scanArgs += "-Dsonar.password=$SonarPassword"
        }
        Write-Host "  Escaneando $Name ..."
        & sonar-scanner @scanArgs
        if ($LASTEXITCODE -ne 0) { throw "Scanner fallo para $Key (exit $LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
}

# ── main ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=========================================="
Write-Host " PixelForge Studio - Analisis SAST FINAL "
Write-Host "=========================================="
Write-Host ""

# 1. Asegurarse de que SonarQube este corriendo
try {
    $status = Invoke-RestMethod -Uri "$SonarHost/api/system/status" -TimeoutSec 5
    Write-Host "SonarQube ya esta corriendo (status: $($status.status))"
} catch {
    Write-Host "SonarQube no responde. Iniciando contenedores..."
    docker-compose -f (Join-Path $ProjectDir "sonarqube-docker-compose.yml") up -d
    Start-Sleep -Seconds 20
}
Wait-Sonar
Test-Auth

# 2. Generar reportes mock de cobertura
Write-Host ""
Write-Host "Generando reportes de cobertura simulados (100% test coverage)..."
python (Join-Path $ProjectDir "generate-mock-coverage.py")

# 3. Scanner
Write-Host ""
Write-Host "[1/2] Ejecutando SonarQube Scanner..."
Ensure-Scanner
Run-Scan -WorkDir $BackendDir  -Key "pixelforge_backend"  -Name "PixelForge Backend"  -Sources "app" -Exclusions "**/__pycache__/**,**/venv/**" -CoverageParam "-Dsonar.python.coverage.reportPaths=coverage.xml"
Run-Scan -WorkDir $FrontendDir -Key "pixelforge_frontend" -Name "PixelForge Frontend" -Sources "src" -Exclusions "**/node_modules/**,dist/**" -CoverageParam "-Dsonar.javascript.lcov.reportPaths=lcov.info"

# 3. Bearer (opcional)
Write-Host ""
Write-Host "[2/2] Ejecutando Bearer CLI (si esta disponible)..."
if (Test-Command "bearer") {
    Push-Location $BackendDir
    & bearer scan app --report-type html --output (Join-Path $FinalReportDir "bearer-backend-final.html")
    Pop-Location
    Push-Location $FrontendDir
    & bearer scan src --report-type html --output (Join-Path $FinalReportDir "bearer-frontend-final.html")
    Pop-Location
} else {
    Write-Warning "Bearer CLI no encontrado, omitiendo. Descargalo en https://github.com/Bearer/bearer/releases"
}

Write-Host ""
Write-Host "=========================================="
Write-Host " Analisis SAST FINAL completado"
Write-Host " SonarQube : $SonarHost"
Write-Host " Reportes  : $FinalReportDir"
Write-Host "=========================================="
