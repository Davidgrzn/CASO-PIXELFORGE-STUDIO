#  Guía de Herramientas de Seguridad - PixelForge Studio

## Resumen Ejecutivo

Este documento describe cómo ejecutar y documentar los análisis de seguridad requeridos para el Examen Final del Caso B.

**Herramientas requeridas:**
-  SonarQube (SAST - Análisis de código estático)
-  Bearer CLI (SAST - Análisis específico para datos sensibles)
-  Wazuh (SIEM - Monitoreo de eventos de seguridad)
-  WireGuard (VPN - Red privada entre nodos)

---

## 1. SonarQube y Bearer CLI (SAST)

### Propósito
Analizar el código en busca de vulnerabilidades comunes (OWASP Top 10), debilidades de diseño, y exposición de datos sensibles.

### Ejecución - Análisis Inicial

```bash
cd /path/to/pixelforge
bash run-initial-sast-scan.sh
```

**Qué hace:**
1. Inicia SonarQube en Docker (puerto 9000)
2. Ejecuta Scanner de SonarQube en backend y frontend
3. Ejecuta Bearer CLI para análisis de datos sensibles
4. Genera reportes HTML en `security-reports/initial-scan/`

**Acceso SonarQube:**
- URL: http://localhost:9000
- Usuario: admin
- Contraseña: admin

### Reportes Iniciales Esperados

El análisis debe encontrar vulnerabilidades típicas que generaría IA:

| Componente | Vulnerabilidad Típica | OWASP | Severidad |
|---|---|---|---|
| Backend Auth | Logs con credenciales | A02 | Alta |
| Backend Payments | CVV o tarjetas en logs | A02 | Crítica |
| Backend Reports | SQL Injection en filtros | A03 | Alta |
| Backend MFA | Secreto TOTP en logs | A02 | Crítica |
| Frontend Auth | JWT en localStorage | A02 | Alta |
| Frontend Shop | Race condition comentada | A04 | Media |

### Correcciones Obligatorias

Implementar las siguientes correcciones en el código:

**Backend - auth.py:**
```python
# ANTES (vulnerable):
log_event(..., details={"password": user.password_hash})

# DESPUÉS (seguro):
log_event(..., details={"email": user.email})  # Sin contraseña
```

**Backend - payments.py:**
```python
# ANTES (vulnerable):
log_event(..., details={"card_number": card_data.card_number, "cvv": cvv})

# DESPUÉS (seguro):
log_event(..., details={"last_four": last_four, "card_type": detected_type})
```

**Frontend - AuthContext.jsx:**
```javascript
// ANTES (vulnerable - XSS risk):
localStorage.setItem('jwt', response.data.token)

// DESPUÉS (seguro - httpOnly en servidor):
// JWT se envía automáticamente via httpOnly cookie
```

### Ejecución - Análisis Final

Después de corregir vulnerabilidades:

```bash
bash run-final-sast-scan.sh
```

**Salida esperada:**
- Reducción de vulnerabilidades encontradas
- Reportes HTML comparativos
- Documentación de cambios realizados

---

## 2. Wazuh (SIEM)

### Propósito
Monitorear eventos de seguridad en todos los nodos del sistema en tiempo real.

### Iniciar Wazuh

```bash
docker-compose -f wazuh-docker-compose.yml up -d
```

**Esperar 5-10 minutos a que se inicialice**

Acceso:
- Dashboard: https://localhost:443
- Usuario: admin
- Contraseña: SecretPassword(1)

### Configurar Agentes Wazuh

**En cada máquina/contenedor (backend, frontend, db, dev):**

```bash
# 1. Instalar agente Wazuh
curl -s https://packages.wazuh.com/key/GPG-KEY-WAZUH | apt-key add -
echo "deb https://packages.wazuh.com/4.x/apt/ stable main" > /etc/apt/sources.list.d/wazuh.list
apt update && apt install -y wazuh-agent

# 2. Configurar manager
# En /var/ossec/etc/ossec.conf:
# <client>
#   <server-ip>WAZUH_MANAGER_IP</server-ip>
#   <server-port>1514</server-port>
# </client>

# 3. Iniciar agente
systemctl start wazuh-agent
systemctl enable wazuh-agent
```

### Eventos a Monitorear

El sistema debe generar alertas para:

-  Intentos de login fallidos (5+ en 10 min)
-  Cambios en MFA (activación/desactivación)
-  Transacciones de tokens (compras, gastos)
-  Accesos a PDFs administrativos
-  Rate limiting activado
-  Errores de validación de puntajes

### Captura de Eventos

Para el informe:
1. Generar actividad en el sistema (login, compras, etc.)
2. Esperar a que Wazuh procese eventos (1-2 min)
3. Capturar pantalla del Dashboard de Wazuh
4. Incluir en el informe IEEE

---

## 3. WireGuard (VPN)

### Propósito
Crear una red privada segura entre todos los nodos del sistema.

### Generar Configuraciones

```bash
bash generate-wireguard-keys.sh
```

Crea en `wireguard-keys/`:
- Claves servidor y peers
- Configuraciones de cliente
- Pre-Shared Keys

### Instalar WireGuard

**En Linux:**
```bash
sudo apt install wireguard wireguard-tools
```

**En macOS:**
```bash
brew install wireguard-tools
```

**En Windows:**
Descargar desde: https://www.wireguard.com/install/

### Configuración del Servidor

1. Copiar `wireguard-server-config.conf` a `/etc/wireguard/wg0.conf`
2. Reemplazar `SERVIDOR_PRIVATE_KEY_AQUI` con contenido de `wireguard-keys/server_private.key`
3. Reemplazar PUBLIC_KEYs de peers con sus valores respectivos
4. Activar:
   ```bash
   sudo wg-quick up wg0
   ```

### Configuración de Clientes

Para cada nodo (backend, frontend, dev1, dev2, etc.):

1. Copiar archivo `{nombre}-client.conf` a `/etc/wireguard/wg0.conf`
2. Activar:
   ```bash
   sudo wg-quick up wg0
   ```

### Verificar Conectividad

```bash
# Ver estado de WireGuard
wg show

# Verificar IP privada
ip addr show wg0

# Ping entre peers (ej: desde backend a frontend)
ping 10.0.0.3

# Ver tabla de rutas
ip route
```

### Captura para Informe

```bash
# Capturar topología de red
wg show > wg-topology.txt

# Capturar tabla de rutas
ip route > wg-routes.txt

# Capturar peers conectados
wg show all peers > wg-peers.txt
```

---

## 4. Flujo Completo de Seguridad

```
┌─────────────────────────────────────────┐
│  1. Análisis SAST Inicial               │
│  - SonarQube + Bearer CLI               │
│  - Identificar vulnerabilidades         │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  2. Corregir Código                     │
│  - Implementar fixes                    │
│  - Validar cambios                      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  3. Análisis SAST Final                 │
│  - Re-ejecutar SonarQube                │
│  - Re-ejecutar Bearer CLI               │
│  - Documentar mejoras                   │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  4. Configurar Wazuh                    │
│  - Iniciar Manager                      │
│  - Conectar agentes                     │
│  - Capturar eventos                     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  5. Configurar WireGuard                │
│  - Generar claves                       │
│  - Activar en todos los nodos           │
│  - Verificar conectividad               │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  6. Documentar en Informe IEEE          │
│  - Tablas SAST                          │
│  - Capturas Wazuh                       │
│  - Topología WireGuard                  │
└─────────────────────────────────────────┘
```

---

## Checklist de Entregables

- [ ] Reporte inicial de SonarQube (HTML)
- [ ] Reporte inicial de Bearer CLI Backend (HTML)
- [ ] Reporte inicial de Bearer CLI Frontend (HTML)
- [ ] Vulnerabilidades corregidas en código
- [ ] Reporte final de SonarQube (HTML)
- [ ] Reporte final de Bearer CLI Backend (HTML)
- [ ] Reporte final de Bearer CLI Frontend (HTML)
- [ ] Dashboard de Wazuh con eventos activos (captura)
- [ ] Topología de WireGuard (captura + config)
- [ ] Todos los agentes Wazuh conectados (captura)
- [ ] Informe IEEE con evolución SAST
- [ ] Rama GitHub con commits incrementales

---

## Troubleshooting

### SonarQube no inicia
```bash
# Ver logs
docker logs sonarqube_pixelforge

# Reiniciar
docker-compose -f sonarqube-docker-compose.yml restart sonarqube
```

### Bearer CLI no encontrado
```bash
# Instalar manualmente
npm install -g sonarqube-scanner
# O descargar desde: https://github.com/Bearer/bearer
```

### Wazuh sin eventos
```bash
# Verificar agente está corriendo
sudo systemctl status wazuh-agent

# Ver logs del agente
sudo tail -f /var/ossec/logs/ossec.log
```

### WireGuard no conecta
```bash
# Verificar interfaz
ip link show wg0

# Ver errores
sudo dmesg | grep wireguard

# Reiniciar
sudo wg-quick down wg0
sudo wg-quick up wg0
```
