#!/bin/bash

# Script para ejecutar análisis de seguridad SAST en PixelForge Studio
# Ejecuta: SonarQube, Bearer CLI y genera reportes

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
REPORTS_DIR="$PROJECT_DIR/security-reports"
INITIAL_REPORT_DIR="$REPORTS_DIR/initial-scan"
FINAL_REPORT_DIR="$REPORTS_DIR/final-scan"

echo "=========================================="
echo "PixelForge Studio - Análisis SAST"
echo "=========================================="
echo "Directorio: $PROJECT_DIR"
mkdir -p "$INITIAL_REPORT_DIR" "$FINAL_REPORT_DIR"

# ========== PASO 1: SONARQUBE ==========
echo ""
echo "[1/3] Iniciando SonarQube en Docker..."
docker-compose -f "$PROJECT_DIR/sonarqube-docker-compose.yml" up -d

# Esperar a que SonarQube esté listo
echo "Esperando a que SonarQube esté disponible..."
sleep 15

for i in {1..30}; do
  if curl -s -f http://localhost:9000/api/system/health > /dev/null; then
    echo " SonarQube disponible"
    break
  fi
  echo "Intento $i/30... esperando SonarQube"
  sleep 5
done

# ========== PASO 2: SONAR SCANNER ==========
echo ""
echo "[2/3] Ejecutando SonarQube Scanner en Backend y Frontend..."

# Instalar sonar-scanner si no existe
if ! command -v sonar-scanner &> /dev/null; then
  echo "Instalando sonar-scanner..."
  npm install -g sonarqube-scanner 2>/dev/null || true
fi

# Backend Scan
cd "$BACKEND_DIR"
echo "Escaneando Backend (Python/FastAPI)..."
sonar-scanner \
  -Dsonar.projectKey=pixelforge_backend \
  -Dsonar.projectName="PixelForge Backend" \
  -Dsonar.sources=app \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.login=admin \
  -Dsonar.password=admin \
  -Dsonar.exclusions="**/__pycache__/**,**/venv/**" 2>/dev/null || echo " SonarScanner fallida (posible instalación)"

# Frontend Scan  
cd "$FRONTEND_DIR"
echo "Escaneando Frontend (React/JavaScript)..."
sonar-scanner \
  -Dsonar.projectKey=pixelforge_frontend \
  -Dsonar.projectName="PixelForge Frontend" \
  -Dsonar.sources=src \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.login=admin \
  -Dsonar.password=admin \
  -Dsonar.exclusions="**/node_modules/**" 2>/dev/null || echo " SonarScanner fallida (posible instalación)"

echo " Análisis SonarQube completado"
echo " Acceder a SonarQube: http://localhost:9000 (admin:admin)"

# ========== PASO 3: BEARER CLI ==========
echo ""
echo "[3/3] Ejecutando Bearer CLI para análisis SAST detallado..."

# Instalar Bearer CLI si no existe
if ! command -v bearer &> /dev/null; then
  echo "Instalando Bearer CLI..."
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    curl -sL https://raw.githubusercontent.com/Bearer/bearer/main/scripts/install.sh | bash 2>/dev/null || echo " Instalación de Bearer fallida"
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    brew install bearer/tap/bearer 2>/dev/null || echo " Instalación de Bearer fallida"
  elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    echo " Para Windows, descargar Bearer desde: https://github.com/Bearer/bearer/releases"
  fi
fi

# Ejecutar Bearer CLI
if command -v bearer &> /dev/null; then
  echo "Escaneando con Bearer CLI..."
  cd "$BACKEND_DIR"
  bearer scan app --report-type html --output "$INITIAL_REPORT_DIR/bearer-backend-initial.html" 2>/dev/null || echo " Bearer scan fallida"
  
  cd "$FRONTEND_DIR"  
  bearer scan src --report-type html --output "$INITIAL_REPORT_DIR/bearer-frontend-initial.html" 2>/dev/null || echo " Bearer scan fallida"
  
  echo " Bearer CLI completado"
  echo " Reportes en: $INITIAL_REPORT_DIR"
else
  echo " Bearer CLI no instalado. Descargarlo desde: https://github.com/Bearer/bearer"
fi

echo ""
echo "=========================================="
echo " Análisis SAST Inicial Completado"
echo "=========================================="
echo ""
echo " Próximos pasos:"
echo "1. Revisar reportes en: $REPORTS_DIR"
echo "2. SonarQube: http://localhost:9000"
echo "3. Corregir vulnerabilidades encontradas"
echo "4. Ejecutar script final: ./run-final-scan.sh"
