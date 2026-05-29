

Este documento recopila de manera centralizada las funcionalidades clave de la plataforma **PixelForge Studio**, junto con todas las credenciales de prueba, roles del sistema y tarjetas de prueba configuradas en el entorno local.

---

## 1. Credenciales de Acceso (Usuarios Sembrados en Base de Datos)

El sistema cuenta con usuarios de prueba creados automáticamente por el backend al iniciar la base de datos (`backend/app/database.py`). Todos los usuarios utilizan la contraseña por defecto de administración:

* **Contraseña común:** `Admin@2026!`

| Rol | Correo Electrónico (Email) | Usuario (Username) | Descripción / Nivel de Acceso |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@pixelforge.gg` | `admin` | Acceso completo. Gestión de cuentas (suspender/activar), descarga de reportes financieros y de auditoría detallados, y visualización de métricas críticas. |
| **Moderador** | `mod@pixelforge.gg` | `moderador1` | Permisos limitados. Puede suspender o activar cuentas de jugadores, y visualizar la lista de usuarios. No tiene acceso a reportes avanzados ni de auditoría. |
| **Jugador de Prueba** | *(Registrar vía UI)* | *(Cualquiera)* | Nivel base. Acceso al juego, registro de puntajes, tienda de ítems, compra de tokens y descarga de datos personales (Habeas Data). |

*Nota: Para pruebas de flujo de jugador, se recomienda registrar un nuevo usuario desde el formulario de registro (ej. `jugador@pixelforge.com` con contraseña `SecurePass123!`).*

---

## 💳 2. Pasarela de Pago Simulada (Tarjetas de Prueba)

El backend implementa un simulador de pagos inteligente (`backend/app/services/payment_service.py`) que valida la lógica del negocio basándose en la terminación de la tarjeta (últimos 4 dígitos).

### Comportamiento de Tarjetas:

| Número de Tarjeta | Franquicia | Últimos 4 Dígitos | Resultado de la Transacción | Detalle / Mensaje |
| :--- | :--- | :--- | :--- | :--- |
| **`4111 1111 1111 1111`** | Visa | `1111` | ✅ **Aprobada** | Compra exitosa. Agrega tokens al saldo del jugador. |
| **`5500 0000 0000 0004`** | Mastercard | `0004` | ✅ **Aprobada** | Compra exitosa. Agrega tokens al saldo del jugador. |
| **`4000 0000 0000 0002`** | Visa | `0002` | ❌ **Rechazada** | Transacción rechazada: **Fondos insuficientes**. |
| **`4000 0000 0000 0069`** | Visa | `0069` | ❌ **Rechazada** | Transacción rechazada: **Tarjeta vencida o bloqueada**. |
| *Cualquier otro número* | Cualquiera | *Cualquiera* | ❌ **Rechazada** | Transacción rechazada por el banco emisor (motivo: otro). |

###  Características de Seguridad en Pagos:
1. **Tokenización:** El número de tarjeta completo se tokeniza en el backend (se genera un `UUID` único y solo se guardan los últimos 4 dígitos y la franquicia).
2. **CVV Excluido:** El código de seguridad (CVV) nunca se almacena bajo ninguna circunstancia, cumpliendo estándares internacionales.

---

##  3. Resumen de Funcionalidades por Rol

###  Jugadores (`jugador`)
* **Registro e Inicio de Sesión Seguro:** Autenticación protegida con hashing de contraseñas (bcrypt con 12 rondas de salting) y almacenamiento del token JWT en una cookie `httpOnly` para mitigar ataques XSS.
* **Autenticación de Doble Factor (MFA/2FA):** Configuración de autenticación mediante TOTP (compatible con Google Authenticator/Authy). Opcionalmente se puede habilitar autenticación externa OAuth2 (Google) con PKCE.
* **AstroBlast (Videojuego):** Juego dinámico interactivo en Phaser 3 donde el jugador acumula puntaje eliminando asteroides y naves enemigas.
* **Envío Seguro de Puntajes:** Endpoints protegidos que validan que el puntaje registrado sea lógico (rango 0 - 10,000) y que no se repitan peticiones maliciosas de manera masiva.
* **Tienda de Tokens:** Adquisición de paquetes de tokens (Básico, Estándar, Premium) simulando compras seguras en COP.
* **Tienda de Ítems (Cosméticos y Mejoras):**
  * *Skins de Nave:* Phoenix Ship (30 tokens), Galaxy Ship (50 tokens), Stealth Ship (80 tokens).
  * *Estelas de Vuelo:* Fire Trail (20 tokens), Ice Trail (20 tokens), Rainbow Trail (35 tokens).
  * *Escudos de Protección:* Energy Shield (25 tokens), Plasma Shield (45 tokens).
  * *Potenciadores:* Score Boost x2 (15 tokens), Mega Boost x3 (40 tokens).
* **Descarga de Datos Personales (Habeas Data):** Generación automática de un reporte en PDF que consolida toda la información personal guardada, cumpliendo con la Ley 1581 de 2012 (Colombia).

###  Moderadores (`moderador`)
* **Gestión de Jugadores:** Visualización de la lista de jugadores registrados y capacidad de **suspender** o **reactivar** cuentas.
* **Visualización de Reportes Básicos:** Acceso al ranking global e historial de puntajes.

###  Administradores (`admin_juego`)
* **Dashboard Administrativo:** Acceso a métricas consolidadas sobre el número de jugadores activos y suspendidos.
* **Visualización de Historial de Auditoría (SIEM):** Interfaz para consultar y buscar en la bitácora de logs de auditoría interna (`audit_logs`), la cual registra inicios de sesión, cambios de roles, compras y activaciones de MFA.
* **Reportes de Negocio:** Generación y descarga de reportes PDF que contienen estadísticas globales de tokens y comportamiento de los usuarios en la tienda.

---

##  4. Credenciales de Infraestructura y Herramientas de Seguridad

Para la evaluación del proyecto y auditorías de seguridad, se integran contenedores y servicios específicos con las siguientes credenciales de acceso local:

###  SonarQube (Auditoría de Código Estático - SAST)
* **URL de acceso:** `http://localhost:9000`
* **Usuario:** `admin`
* **Contraseña:** `admin` *(Se solicita cambio en el primer inicio de sesión)*

###  Wazuh (Monitoreo de Eventos - SIEM)
* **URL de acceso:** `https://localhost:443`
* **Usuario:** `admin`
* **Contraseña:** `SecretPassword(1)`

###  Base de Datos (PostgreSQL)
* **Host:** `localhost` (puerto `5432`)
* **Usuario:** `pixelforge`
* **Contraseña:** `pixelforge_local_2026`
* **Base de Datos:** `pixelforge`

###  Llaves Criptográficas (Cifrado Interno)
* Las llaves de cifrado para la base de datos (JWT Secret, Fernet key para TOTP) están declaradas en el archivo local [.env](file:///c:/Users/mateo/Desktop/Escritorio/Final%20Jordan/.env).
