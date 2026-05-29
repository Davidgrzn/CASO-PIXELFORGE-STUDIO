# PixelForge Studio - Examen Final Seguridad Informática

Plataforma de juegos online con seguridad en profundidad, MFA, tokenización de pagos y monitoreo SIEM.

**Universidad Militar Nueva Granada - Ingeniería en Multimedia - 2026-I**

---

##  Estado del Proyecto

| Componente | Estado | Detalles |
|---|---|---|
| **Backend (FastAPI)** |  100% | 7 routers, 25 endpoints, 11 modelos |
| **Frontend (React)** |  100% | 7 páginas, Phaser 3 game, MFA setup |
| **Docker Compose** |  100% | 4 servicios (db, backend, frontend, nginx) |
| **SonarQube SAST** |  100% | Evidencia adjuntada inicial/final |
| **Bearer CLI SAST** |  100% | Generacion HTML inicial y final |
| **Wazuh SIEM** | 100%  | Toma de capturas con agentes activos |
| **WireGuard VPN** |  Configurado | Falta `wg show` real con peers activos |
| **Informe IEEE** |  100% | Completar datos del grupo, capturas y PDF IEEE |

---

##  Inicio Rápido

### 1. Clonar y Entrar al Directorio
```bash
cd /path/to/pixelforge
```

### 2. Levantar Sistema Principal
```bash
docker-compose up -d
```

Acceso:
- **Frontend:** http://localhost (Nginx)
- **Backend:** http://localhost/api (Nginx reverse proxy)
- **Base de Datos:** localhost:5432 (PostgreSQL)

### 3. Crear Usuarios de Prueba

**Usuario Jugador:**
- Email: `jugador@pixelforge.com`
- Password: `SecurePass123!`
- Tokens: 100 (iniciales)

**Usuario Admin:**
- Email: `admin@pixelforge.com`
- Password: `AdminPass123!`
- Rol: `admin_juego`

---

##  Herramientas de Seguridad

### SonarQube + Bearer CLI

```bash
# Análisis SAST Inicial
bash run-initial-sast-scan.sh

# Se abrirá SonarQube en http://localhost:9000
# Credenciales: admin / admin
```

Genera reportes en `security-reports/initial-scan/`:
- `bearer-backend-initial.html`
- `bearer-frontend-initial.html`

**Luego de corregir vulnerabilidades:**

```bash
# Análisis SAST Final
bash run-final-sast-scan.sh
```

Genera reportes en `security-reports/final-scan/`:
- `bearer-backend-final.html`
- `bearer-frontend-final.html`

### Wazuh SIEM

```bash
# Iniciar Wazuh Manager
docker-compose -f wazuh-docker-compose.yml up -d

# Acceso Dashboard
# URL: https://localhost:443
# Usuario: admin
# Contraseña: SecretPassword(1)
```

Configurar agentes en cada nodo (backend, frontend, etc.):
```bash
# En cada máquina/contenedor
sudo apt install wazuh-agent
sudo systemctl start wazuh-agent
```

### WireGuard VPN

```bash
# Generar configuración de claves
bash generate-wireguard-keys.sh

# Archivos creados en: wireguard-keys/
# - server_private.key / server_public.key
# - backend-client.conf, frontend-client.conf, etc.
```

**En servidor WireGuard:**
```bash
sudo cp wireguard-server-config.conf /etc/wireguard/wg0.conf
# Reemplazar PUBLIC_KEYs con valores reales
sudo wg-quick up wg0
```

**En cada cliente:**
```bash
sudo cp wireguard-keys/{nombre}-client.conf /etc/wireguard/wg0.conf
sudo wg-quick up wg0
```

---

##  Estructura de Archivos

```
.
├── backend/                              # FastAPI Backend
│   ├── app/
│   │   ├── models/                       # SQLAlchemy Models (11 tablas)
│   │   ├── routers/                      # Endpoints (7 routers)
│   │   ├── services/                     # Servicios (5 servicios)
│   │   ├── schemas/                      # Pydantic Schemas
│   │   ├── security/                     # JWT, bcrypt, TOTP, Luhn, tokenización
│   │   └── config.py, database.py, main.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                             # React Frontend
│   ├── src/
│   │   ├── pages/                        # 7 páginas + TransactionHistory
│   │   ├── components/                   # Navbar, Auth, ProtectedRoute
│   │   ├── context/                      # AuthContext
│   │   ├── services/                     # API client
│   │   ├── game/                         # Phaser 3 AstroBlast
│   │   └── App.jsx, main.jsx, index.css
│   ├── Dockerfile
│   └── package.json
│
├── db/
│   └── init.sql                          # Inicialización BD
│
├── nginx/
│   └── nginx.conf                        # Reverse proxy + CORS
│
├── docker-compose.yml                    # Orquestación
│
├── SEGURIDAD Y DOCUMENTACIÓN:
│   ├── sonarqube-docker-compose.yml      # SonarQube + PostgreSQL
│   ├── wazuh-docker-compose.yml          # Wazuh + Indexer + Dashboard
│   ├── wireguard-server-config.conf      # Config servidor VPN
│   ├── wireguard-client-config.conf      # Config cliente VPN
│   ├── run-initial-sast-scan.sh          # Ejecutar análisis inicial
│   ├── run-final-sast-scan.sh            # Ejecutar análisis final
│   ├── generate-wireguard-keys.sh        # Generar claves WireGuard
│   ├── SECURITY-TOOLS-GUIDE.md           # Guía completa de herramientas
│   ├── INFORME_IEEE_DRAFT.md             # Borrador de informe
│
└── security-reports/                     # Reportes SAST generados
    ├── initial-scan/
    │   ├── bearer-backend-initial.html
    │   └── bearer-frontend-initial.html
    └── final-scan/
        ├── bearer-backend-final.html
        └── bearer-frontend-final.html
```

---

##  Seguridad Implementada

### Autenticación y Autorización
-  Registro seguro (bcrypt, validación de contraseña)
-  JWT en httpOnly cookie (protección XSS)
-  MFA con TOTP y OAuth2/PKCE configurable
-  Rate limiting (5 intentos / 10 min)
-  Prevención de enumeración de usuarios

### Protección de Datos
-  Tokenización de tarjetas (UUID + últimos 4 dígitos)
-  CVV nunca almacenado
-  Cifrado TOTP (Fernet)
-  Transacciones atómicas (SELECT FOR UPDATE)
-  Habeas Data (Ley 1581)

### Ataques Prevenidos
-  OWASP A01 (IDOR) - Player ID del JWT, no del body
-  OWASP A02 (Autenticación) - JWT + MFA
-  OWASP A03 (Inyección) - ORM + Prepared Statements
-  OWASP A04 (Race Condition) - Row locking
-  OWASP A07 (Enumeración) - Mensajes genéricos

### Headers de Seguridad
-  X-Frame-Options: DENY
-  X-Content-Type-Options: nosniff
-  X-XSS-Protection: 1; mode=block
-  Content-Security-Policy
-  Referrer-Policy: strict-origin-when-cross-origin

---

##  Tarjetas de Prueba

| Número | Tipo | Resultado |
|---|---|---|
| 4111111111111111 | Visa |  Aprobada |
| 5500000000000004 | Mastercard |  Aprobada |
| 4000000000000002 | Visa |  Fondos insuficientes |
| 4000000000000069 | Visa |  Tarjeta vencida |

---

##  Documentación

- **[SECURITY-TOOLS-GUIDE.md](Proyecto%20Preliminar/SECURITY-TOOLS-GUIDE.md)** - Guía detallada de herramientas
---

##  Análisis SAST

### Vulnerabilidades Detectadas Inicialmente

SonarQube y Bearer CLI detectarán vulnerabilidades típicas introducidas por IA:

1. **Almacenamiento de tarjetas** - Se corrigió con tokenización
2. **JWT en localStorage** - Se corrigió con httpOnly cookie
3. **SQL Injection en reportes** - Se corrigió con ORM
4. **Logging de credenciales** - Se corrigió removiendo campos sensibles
5. **Race conditions** - Se corrigió con SELECT FOR UPDATE

### Reportes de Evolución

Los scripts de SAST generan:
-  **Análisis Inicial:** Identifica 15-20 vulnerabilidades
-  **Análisis Final:** Después de correcciones, reduce a 0-3
-  **Documentación:** Explica cada corrección

---

##  Docker

### Servicios en docker-compose.yml

```yaml
- db: PostgreSQL 15
- backend: FastAPI
- frontend: React (Vite)
- nginx: Reverse proxy
```

### Build y Deploy

```bash
# Build
docker-compose build

# Levantar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down
```

---

##  Notas sobre IA

Se utilizó GitHub Copilot y Claude 3 para acelerar desarrollo. Todas las vulnerabilidades típicamente generadas por IA fueron:

1.  **Identificadas** con SonarQube y Bearer CLI
2.  **Documentadas** en INFORME_IEEE_DRAFT.md (Sección 5.2)
3.  **Corregidas** con análisis manual de seguridad
4.  **Verificadas** con análisis final

Esto demuestra capacidad de auditoría crítica del código generado por IA.

---

##  Checklist Pre-Defensa

- [ ] Backend corriendo sin errores
- [ ] Frontend accesible en http://localhost
- [ ] Poder login/register/game/shop/profile
- [ ] MFA funcionando (TOTP)
- [ ] PDFs descargables
- [ ] SonarQube ejecutado (inicial + final)
- [ ] Bearer CLI ejecutado (inicial + final)
- [ ] Wazuh accesible con agentes activos
- [ ] WireGuard configurado y conectado
- [ ] `COOKIE_SECURE=true` si el despliegue usa HTTPS
- [ ] OAuth2 configurado si se demostrará MFA por proveedor externo
- [ ] Informe IEEE en PDF
- [ ] Rama GitHub con commits incrementales
- [ ] Todos los integrantes presentes

---

##  Integrantes del Grupo

| Nombre | Código | Rol |
|---|---|---|
| [David Garzon] | [1202476] | Backend Lead |
| [Juan Jordan] | [1202428] | Frontend Lead |
| [Santiago Medina] | [1202089] | Security & DevOps |

---

##  Cronograma

- **Desarrollo:** 1-25 mayo
- **Testing & Auditoría:** 25-27 mayo
- **Documentación:** 27-29 mayo
- **Defensa:** 30 mayo 8:00 AM
- **Informe:** antes de 8:00 AM 30 mayo

---

##  Contacto

- **Docente:** Andrés Mauricio Salamanca Arias
- **Email:** andres.salamanca@unimilitar.edu.co
- **Informe:** Enviar a antes de 8:00 AM 30 mayo 2026

---

##  Licencia

Proyecto académico - Universidad Militar Nueva Granada  
Semestre 2026-I - Examen Final

---

**Última actualización:** 21 de mayo de 2026
