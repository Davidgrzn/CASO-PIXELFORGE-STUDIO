#!/bin/bash

# Script para ejecutar análisis SAST FINAL en PixelForge Studio
# Compara con el scan inicial y genera reportes de evolución

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
REPORTS_DIR="$PROJECT_DIR/security-reports"
FINAL_REPORT_DIR="$REPORTS_DIR/final-scan"

mkdir -p "$FINAL_REPORT_DIR"

echo "=========================================="
echo "PixelForge Studio - Análisis SAST FINAL"
echo "=========================================="
echo ""

# Verificar que SonarQube está activo
if ! curl -s -f http://localhost:9000/api/system/health > /dev/null; then
  echo " SonarQube no está activo. Iniciando..."
  docker-compose -f "$PROJECT_DIR/sonarqube-docker-compose.yml" up -d
  sleep 15
fi

echo "[1/2] Ejecutando SonarQube Scanner (Escaneo Final)..."

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
  -Dsonar.exclusions="**/__pycache__/**,**/venv/**" 2>/dev/null || echo " SonarScanner fallida"

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
  -Dsonar.exclusions="**/node_modules/**" 2>/dev/null || echo " SonarScanner fallida"

echo " Escaneo SonarQube Completo"

# Bearer CLI Final Scan
echo ""
echo "[2/2] Ejecutando Bearer CLI (Escaneo Final)..."

if command -v bearer &> /dev/null; then
  cd "$BACKEND_DIR"
  bearer scan app --report-type html --output "$FINAL_REPORT_DIR/bearer-backend-final.html" 2>/dev/null || echo " Bearer scan fallida"
  
  cd "$FRONTEND_DIR"
  bearer scan src --report-type html --output "$FINAL_REPORT_DIR/bearer-frontend-final.html" 2>/dev/null || echo " Bearer scan fallida"
  
  echo " Bearer CLI Completado"
else
  echo " Bearer CLI no disponible"
fi

echo ""
echo "=========================================="
echo " Análisis SAST Final Completado"
echo "=========================================="
echo ""
echo " Comparar Reportes:"
echo "Inicial Backend:  $REPORTS_DIR/initial-scan/bearer-backend-initial.html"
echo "Final Backend:    $FINAL_REPORT_DIR/bearer-backend-final.html"
echo "Inicial Frontend: $REPORTS_DIR/initial-scan/bearer-frontend-initial.html"
echo "Final Frontend:   $FINAL_REPORT_DIR/bearer-frontend-final.html"
echo ""
echo " SonarQube: http://localhost:9000"
echo ""
echo " Ya puede proceder a documentar cambios en el informe IEEE"
