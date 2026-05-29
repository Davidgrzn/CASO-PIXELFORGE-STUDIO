#!/bin/bash

# Script para generar configuración de WireGuard para PixelForge Studio
# Genera claves privadas/públicas para servidor y peers

set -e

WG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/wireguard-keys"
mkdir -p "$WG_DIR"

echo "=========================================="
echo "WireGuard Key Generation for PixelForge"
echo "=========================================="
echo "Ubicación: $WG_DIR"
echo ""

# Función para generar un par de claves
generate_keypair() {
  local name=$1
  local private_key=$(wg genkey)
  local public_key=$(echo $private_key | wg pubkey)
  
  echo "$private_key" > "$WG_DIR/${name}_private.key"
  echo "$public_key" > "$WG_DIR/${name}_public.key"
  
  echo " Generado: $name"
  echo "  Private: $private_key"
  echo "  Public:  $public_key"
  echo ""
}

# Verificar que wg-tools está instalado
if ! command -v wg &> /dev/null; then
  echo " WireGuard tools no instalado. Instalar:"
  echo "  Ubuntu/Debian: sudo apt install wireguard-tools"
  echo "  Fedora: sudo dnf install wireguard-tools"
  echo "  macOS: brew install wireguard-tools"
  exit 1
fi

# Generar claves para servidor y nodos
echo "Generando pares de claves..."
echo ""

generate_keypair "server"
generate_keypair "backend"
generate_keypair "frontend"
generate_keypair "database"
generate_keypair "wazuh"
generate_keypair "dev1"
generate_keypair "dev2"
generate_keypair "dev3"

# Pre-shared keys (PSK) para seguridad adicional
echo "Generando Pre-Shared Keys (PSK)..."
wg genpsk > "$WG_DIR/server-backend.psk"
wg genpsk > "$WG_DIR/server-frontend.psk"
wg genpsk > "$WG_DIR/server-database.psk"
wg genpsk > "$WG_DIR/server-wazuh.psk"

echo " Pre-Shared Keys generadas"
echo ""

# Generar archivos de configuración de cliente
echo "Generando configuraciones de cliente..."
echo ""

generate_client_config() {
  local name=$1
  local ip=$2
  local server_pubkey=$(cat "$WG_DIR/server_public.key")
  local server_endpoint="SERVIDOR_WIREGUARD_PUBLIC_IP:51820"
  
  local config_file="$WG_DIR/${name}-client.conf"
  
  cat > "$config_file" << EOF
[Interface]
# Configuración de $name
Address = $ip/24
PrivateKey = $(cat "$WG_DIR/${name}_private.key")
DNS = 8.8.8.8, 8.8.4.4

[Peer]
# Servidor WireGuard
PublicKey = $server_pubkey
Endpoint = $server_endpoint:51820
AllowedIPs = 10.0.0.0/24
PersistentKeepalive = 25
EOF

  echo " Generado: $config_file"
}

generate_client_config "backend" "10.0.0.2"
generate_client_config "frontend" "10.0.0.3"
generate_client_config "database" "10.0.0.4"
generate_client_config "wazuh" "10.0.0.5"
generate_client_config "dev1" "10.0.0.100"
generate_client_config "dev2" "10.0.0.101"
generate_client_config "dev3" "10.0.0.102"

echo ""
echo "=========================================="
echo " WireGuard Configuration Complete"
echo "=========================================="
echo ""
echo " Archivos generados en: $WG_DIR"
echo ""
echo " Próximos pasos:"
echo "1. Copiar wireguard-server-config.conf a servidor WireGuard"
echo "2. Reemplazar PUBLIC_KEYs y PREFIXs con valores de $WG_DIR"
echo "3. Distribuir configuraciones de cliente a cada nodo"
echo "4. Activar WireGuard en todos los nodos:"
echo "   sudo wg-quick up /path/to/config.conf"
echo ""
echo " Verificar conexión:"
echo "   wg show"
echo "   ip addr show wg0"
echo ""
