param(
    [string]$SonarHost = "http://localhost:9000",
    [string]$SonarLogin = "admin",
    [string]$SonarPassword = "admin",
    [string]$SonarToken = $env:SONAR_TOKEN
)

$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ProjectDir "backend"
$FrontendDir = Join-Path $ProjectDir "frontend"
$ReportsDir = Join-Path $ProjectDir "security-reports"
$FinalReportDir = Join-Path $ReportsDir "final-scan"

New-Item -ItemType Directory -Force -Path $FinalReportDir | Out-Null

function Test-Command($Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Wait-SonarQube {
    param([string]$Url)

    for ($i = 1; $i -le 30; $i++) {
        try {
            $statusResponse = Invoke-RestMethod -Uri "$Url/api/system/status" -TimeoutSec 5
            if ($statusResponse.status -notin @("UP", "DB_MIGRATION_NEEDED", "DB_MIGRATION_RUNNING")) {
                throw "SonarQube status: $($statusResponse.status)"
            }
            Write-Host "SonarQube disponible en $Url"
            return
        } catch {
            Write-Host "Intento $i/30... esperando SonarQube"
            Start-Sleep -Seconds 5
        }
    }
    throw "SonarQube no respondió en $Url"
}

function Ensure-SonarScanner {
    if (Test-Command "sonar-scanner") {
        return
    }

    Write-Host "sonar-scanner no está instalado. Intentando instalarlo con npm..."
    npm install -g sonarqube-scanner

    if (-not (Test-Command "sonar-scanner")) {
        throw "No se encontró sonar-scanner después de la instalación. Cierra y abre PowerShell, o instala SonarScanner manualmente."
    }
}

function Test-SonarAuthentication {
    param([string]$Url)

    try {
        if ($SonarToken) {
            $pair = "${SonarToken}:"
        } else {
            $pair = "$SonarLogin`:$SonarPassword"
        }
        $encoded = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
        $response = Invoke-RestMethod `
            -Uri "$Url/api/authentication/validate" `
            -Headers @{ Authorization = "Basic $encoded" } `
            -TimeoutSec 10

        if (-not $response.valid) {
            throw "Credenciales inválidas"
        }
        Write-Host "Autenticación SonarQube válida."
    } catch {
        throw @"
No fue posible autenticar contra SonarQube.

Opciones:
1. Genera un token en SonarQube: http://localhost:9000 > My Account > Security > Generate Tokens
   Luego ejecuta:
   `$env:SONAR_TOKEN="TU_TOKEN"
   .\run-final-sast-scan.ps1

2. O pasa credenciales explícitas:
   .\run-final-sast-scan.ps1 -SonarLogin admin -SonarPassword "TU_PASSWORD"
"@
    }
}

function Run-SonarScan {
    param(
        [string]$WorkDir,
        [string]$ProjectKey,
        [string]$ProjectName,
        [string]$Sources,
        [string]$Exclusions
    )

    Push-Location $WorkDir
    try {
        $args = @(
            "-Dsonar.projectKey=$ProjectKey",
            "-Dsonar.projectName=$ProjectName",
            "-Dsonar.sources=$Sources",
            "-Dsonar.host.url=$SonarHost",
            "-Dsonar.exclusions=$Exclusions"
        )
        if ($SonarToken) {
            $args += "-Dsonar.token=$SonarToken"
        } else {
            $args += "-Dsonar.login=$SonarLogin"
            $args += "-Dsonar.password=$SonarPassword"
        }

        & sonar-scanner @args
        if ($LASTEXITCODE -ne 0) {
            throw "SonarScanner falló para $ProjectKey con código $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

function Run-BearerScan {
    param(
        [string]$WorkDir,
        [string]$ScanPath,
        [string]$OutputPath
    )

    if (-not (Test-Command "bearer")) {
        Write-Warning "Bearer CLI no está instalado. Descárgalo desde https://github.com/Bearer/bearer/releases y vuelve a ejecutar este script."
        return
    }

    Push-Location $WorkDir
    try {
        & bearer scan $ScanPath --report-type html --output $OutputPath
        if ($LASTEXITCODE -ne 0) {
            throw "Bearer scan falló para $WorkDir con código $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

Write-Host "=========================================="
Write-Host "PixelForge Studio - Análisis SAST FINAL"
Write-Host "=========================================="

try {
    Invoke-RestMethod -Uri "$SonarHost/api/system/status" -TimeoutSec 5 | Out-Null
} catch {
    Write-Host "SonarQube no está activo. Iniciando..."
    docker-compose -f (Join-Path $ProjectDir "sonarqube-docker-compose.yml") up -d
    Start-Sleep -Seconds 15
}
Wait-SonarQube -Url $SonarHost
Test-SonarAuthentication -Url $SonarHost

Write-Host ""
Write-Host "[1/2] Ejecutando SonarQube Scanner..."
Ensure-SonarScanner
Run-SonarScan -WorkDir $BackendDir -ProjectKey "pixelforge_backend" -ProjectName "PixelForge Backend" -Sources "app" -Exclusions "**/__pycache__/**,**/venv/**"
Run-SonarScan -WorkDir $FrontendDir -ProjectKey "pixelforge_frontend" -ProjectName "PixelForge Frontend" -Sources "src" -Exclusions "**/node_modules/**,dist/**"

Write-Host ""
Write-Host "[2/2] Ejecutando Bearer CLI..."
Run-BearerScan -WorkDir $BackendDir -ScanPath "app" -OutputPath (Join-Path $FinalReportDir "bearer-backend-final.html")
Run-BearerScan -WorkDir $FrontendDir -ScanPath "src" -OutputPath (Join-Path $FinalReportDir "bearer-frontend-final.html")

Write-Host ""
Write-Host "=========================================="
Write-Host "Análisis SAST final terminado"
Write-Host "SonarQube: $SonarHost"
Write-Host "Reportes: $FinalReportDir"
Write-Host "=========================================="
