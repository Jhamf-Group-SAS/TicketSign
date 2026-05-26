# TicketSign — Gestión Digital de Actas de Mantenimiento

> **PWA empresarial Offline-First** para digitalizar, firmar y sincronizar actas de mantenimiento TI, integrada con GLPI y WhatsApp Cloud API.

---

## 📋 Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Arquitectura](#arquitectura)
- [Stack Tecnológico](#stack-tecnológico)
- [Módulos y Funcionalidades](#módulos-y-funcionalidades)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalación y Desarrollo Local](#instalación-y-desarrollo-local)
- [Variables de Entorno](#variables-de-entorno)
- [Despliegue en Producción (Docker Swarm / Portainer)](#despliegue-en-producción-docker-swarm--portainer)
- [Configuración Post-Despliegue](#configuración-post-despliegue)
- [Base de Datos](#base-de-datos)
- [Seguridad](#seguridad)
- [Contribuir](#contribuir)

---

## Descripción General

**TicketSign** es una Aplicación Web Progresiva (PWA) de nivel empresarial diseñada para digitalizar y optimizar el registro de mantenimientos TI. Su núcleo es una estrategia **Offline-First** que permite a los técnicos en campo capturar firmas digitales, evidencias fotográficas y datos de mantenimiento sin depender de conexión a internet, para luego sincronizar automáticamente con el servidor.

### Integraciones
| Sistema | Tipo | Uso |
|---|---|---|
| **GLPI** | Bidireccional | Lectura de tickets, entidades y técnicos; escritura de PDFs firmados y soluciones |
| **WhatsApp (Meta Cloud API)** | Saliente | Notificaciones automáticas de tareas y recordatorios programados |
| **MongoDB** | Persistencia | Almacenamiento principal en servidor |
| **Dexie (IndexedDB)** | Offline | Réplica local en cliente para modo sin red |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTE (PWA)                          │
│           React 18 + Vite + Tailwind + Dexie                │
│                                                             │
│  ┌──────────────────────┐   ┌────────────────────────────┐  │
│  │   Almacén Offline    │   │  Service Worker (Workbox)  │  │
│  │   Dexie / IndexedDB  │◄──┤  Cache + Background Sync   │  │
│  └──────────────────────┘   └────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / REST API
┌──────────────────────────▼──────────────────────────────────┐
│               SERVIDOR (Node.js + Express)                  │
│       JWT Auth · AES-256 · PDF (Puppeteer) · Multer         │
│                                                             │
│  ┌──────────┐  ┌─────────────┐  ┌────────────────────────┐  │
│  │ MongoDB  │  │  GLPI API   │  │  WhatsApp Cloud API    │  │
│  │ (datos)  │  │  (ITSM)     │  │  (notificaciones)      │  │
│  └──────────┘  └─────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
        ↑ Docker Swarm + Traefik + Let's Encrypt (producción)
```

### Flujo Offline-First

1. **Push (Local → Servidor):** El técnico firma un acta sin red. Dexie guarda el registro como `PENDIENTE_SINCRONIZACION`. Al recuperar conexión, el `SyncService` lo envía automáticamente al backend.
2. **Pull (Servidor → Local):** La PWA descarga tareas asignadas periódicamente. El servidor es la fuente de verdad — si una tarea es reasignada, el cliente la actualiza en el próximo pull.
3. **Resolución de conflictos:** Se resuelve por `_id` del servidor + `glpi_ticket_id` + técnico + fecha (tolerancia: 2 minutos).

---

## Stack Tecnológico

### Frontend (`client/`)
| Tecnología | Versión | Uso |
|---|---|---|
| React | 18.2 | UI framework |
| Vite | 7.x | Build tool + Dev server (puerto 3000) |
| Tailwind CSS | 3.4 | Estilos + sistema de design tokens |
| Dexie | 3.2 | IndexedDB wrapper — almacenamiento offline |
| lucide-react | 0.300 | Iconografía |
| react-router-dom | 7.x | Enrutamiento SPA |
| jsPDF + AutoTable | 4.x | Generación de PDFs en cliente |
| vite-plugin-pwa | 1.x | Service Worker (Workbox) + PWA manifest |

### Backend (`server/`)
| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | 18–20 | Runtime |
| Express | 4.18 | HTTP framework |
| MongoDB + Mongoose | 8.x | Base de datos principal |
| jsonwebtoken | — | Sesiones JWT (duración: 8h) |
| helmet | — | Protección de cabeceras HTTP |
| express-rate-limit | — | Prevención de fuerza bruta |
| `crypto` (nativo) | — | Cifrado AES-256-CBC de credenciales |
| Puppeteer | — | Generación de PDFs con Headless Chrome |
| Multer | — | Subida de imágenes y archivos |
| Axios | — | Peticiones a APIs externas (GLPI, WhatsApp) |

### Infraestructura
| Tecnología | Uso |
|---|---|
| Docker Swarm | Orquestación de contenedores |
| Traefik | Reverse proxy + TLS automático (Let's Encrypt) |
| Nginx | Servidor estático del cliente (dentro del contenedor) |
| GHCR | Registro de imágenes Docker (GitHub Container Registry) |

**Imágenes Docker:**
- `ghcr.io/jhamfgit/ticketsign-client:latest`
- `ghcr.io/jhamfgit/ticketsign-server:latest`

---

## Módulos y Funcionalidades

### 🔐 Autenticación y Control de Acceso (RBAC)
- Login vía credenciales GLPI (configuradas desde el módulo de Configuración)
- Login de emergencia con usuario admin local (sin GLPI) — se activa sólo si se define `ADMIN_USER`/`ADMIN_PASSWORD`
- JWT con duración de 8 horas, validado en cada request
- **Roles**: `Super-Admin`, `Admin-Mesa`, `Especialistas`, `Compras` y roles granulares configurables

### 📝 Actas de Mantenimiento
- **Tipos**: Preventivo · Correctivo · Entrega de equipos
- Captura de datos del equipo (hostname, serial, modelo, tipo)
- Checklist dinámico según el tipo de acta
- **Firma digital** en canvas (técnico + cliente)
- **Captura fotográfica** desde cámara o galería
- **Modo offline total** — se persiste en Dexie, se sincroniza al recuperar red

### 🔄 Sincronización
- Service Worker con Background Sync (Workbox `skipWaiting + clientsClaim`)
- Cola de pendientes con reintentos automáticos
- Resolución de conflictos inteligente por `_id` + ticket + técnico + fecha
- Log completo de sincronizaciones con estado y error

### 📊 Consolidado de Empresas
- Vista centralizada de todas las actas agrupadas por cliente
- Estadísticas globales (distribución preventivo/correctivo/entrega)
- Filtros por tipo, fecha y búsqueda de texto
- Paginación de clientes: 5 / 10 / 25 / 50 por página
- Paginación de registros por cliente: 5 / 10 / 25 / 50 por página
- Panel expandible por acta con detalle técnico y estado de firmas
- Exportación a **PDF** y **CSV/Excel**
- Sincronización directa a proyecto de GLPI

### 📋 Tareas (Tablero Kanban)
- Tablero Kanban: Pendiente → En Proceso → Completado
- Prioridades: Baja · Media · Alta · Crítica
- Recordatorios con notificación automática vía WhatsApp
- Tareas privadas (solo visibles para el técnico asignado)
- Vista de lista alternativa al tablero

### 💬 Notificaciones WhatsApp
- Envío automático de recordatorios de mantenimientos programados
- Notificaciones de tareas próximas a vencer (`ReminderService`)
- Configuración de número y API key desde el módulo de Configuración (cifrado en BD)

### 💰 Cotizaciones
- Creación y gestión de cotizaciones con estados de aprobación
- Subida de archivos adjuntos (PDFs, imágenes)
- Notificaciones automáticas de estado

### 📜 Histórico
- Consulta del historial completo de actas con búsqueda y filtros
- Integración con datos históricos de GLPI (`glpi_historical.js`)

### ⚙️ Configuración
- Panel de administración para configurar GLPI (URL, App Token, User Token)
- Configuración de WhatsApp Cloud API
- Gestión de entidades y técnicos cacheados desde GLPI
- Theme claro / oscuro

---

## Estructura del Proyecto

```
pwa-glpi/
├── client/                           # Frontend React PWA
│   ├── src/
│   │   ├── App.jsx                   # Router principal + gestión de sesión
│   │   ├── components/
│   │   │   ├── ClientConsolidated.jsx  # Consolidado por empresa (paginación, filtros, export)
│   │   │   ├── MaintenanceForm.jsx     # Formulario de actas (offline-first)
│   │   │   ├── MaintenancePreview.jsx  # Preview + firma digital en canvas
│   │   │   ├── TaskBoard.jsx           # Tablero Kanban
│   │   │   ├── TaskList.jsx            # Vista lista de tareas
│   │   │   ├── TaskForm.jsx            # Formulario de tareas + recordatorios WA
│   │   │   ├── DashboardSummary.jsx    # Resumen de indicadores
│   │   │   ├── HistoricalActs.jsx      # Histórico de actas
│   │   │   ├── QuotationList.jsx       # Módulo de cotizaciones
│   │   │   ├── SyncManager.jsx         # UI de sincronización
│   │   │   ├── ConfigManager.jsx       # Panel de configuración GLPI/WA
│   │   │   ├── PhotoCapture.jsx        # Captura fotográfica
│   │   │   ├── Topbar.jsx              # Barra superior + navegación
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── SyncService.js          # Lógica sync offline→servidor
│   │   │   └── NotificationService.js  # Notificaciones locales
│   │   ├── store/
│   │   │   └── db.js                   # Dexie schema (versión 13)
│   │   ├── hooks/                      # Custom React hooks
│   │   ├── utils/                      # Helpers (cn, download, etc.)
│   │   └── index.css                   # Design tokens CSS (light/dark)
│   ├── tailwind.config.js              # Tailwind + tokens de color/borde
│   ├── vite.config.js                  # Vite + PWA (Workbox) config
│   ├── .env.example                    # Plantilla de variables frontend
│   ├── Dockerfile                      # Build: Vite → Nginx
│   └── nginx.conf                      # Nginx SPA config
│
├── server/                           # Backend Node.js + Express
│   ├── src/
│   │   ├── index.js                  # Entry point (Express, CORS, MongoDB)
│   │   ├── middleware/
│   │   │   └── auth.js               # JWT auth + RBAC por roles
│   │   ├── models/
│   │   │   ├── Act.js                # Schema: Actas
│   │   │   ├── Configuration.js      # Schema: Configuración cifrada
│   │   │   ├── Counter.js            # Schema: Auto-incrementos
│   │   │   ├── Quotation.js          # Schema: Cotizaciones
│   │   │   └── Task.js               # Schema: Tareas
│   │   ├── routes/
│   │   │   ├── auth.js               # POST /api/auth/login, refresh, etc.
│   │   │   ├── config.js             # GET/POST /api/config
│   │   │   ├── glpi.js               # /api/glpi (tickets, entidades, técnicos)
│   │   │   ├── reports.js            # /api/reports (PDF, CSV, consolidated)
│   │   │   ├── sync.js               # /api/sync (recepción de actas offline)
│   │   │   ├── tasks.js              # /api/tasks (CRUD + recordatorios)
│   │   │   └── quotations.js         # /api/quotations (CRUD + archivos)
│   │   ├── services/
│   │   │   ├── glpi.js               # Integración GLPI API (~49KB)
│   │   │   ├── glpi_historical.js    # Datos históricos GLPI (~95KB)
│   │   │   ├── pdf.js                # Generación PDF con Puppeteer (~38KB)
│   │   │   ├── whatsapp.js           # WhatsApp Cloud API
│   │   │   ├── reminder.js           # Scheduler de recordatorios WA
│   │   │   └── configService.js      # Carga/cache de configuración
│   │   └── utils/
│   │       └── crypto.js             # AES-256-CBC helpers
│   ├── uploads/                      # Archivos subidos (excluido del git)
│   ├── .env.example                  # Plantilla de variables del servidor
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml                # Despliegue Docker Swarm (producción)
├── docker-compose.db.yml             # Solo MongoDB (desarrollo local)
├── node-local.bat                    # Script para usar Node.js portable local
├── .gitignore
├── DOCUMENTACION_COMPLETA.md         # Documentación técnica extendida
└── README.md
```

---

## Instalación y Desarrollo Local

### Pre-requisitos
- **Node.js 18–20** — el proyecto incluye Node.js portable en `node-root/`. Usar `node-local.bat` en lugar de `npm` directamente.
- **MongoDB** corriendo localmente o via Docker

### 1. Clonar el repositorio
```bash
git clone https://github.com/Jhamf-Group-SAS/TicketSign.git
cd "TicketSign/pwa-glpi"
```

### 2. Iniciar MongoDB local (con Docker)
```bash
docker-compose -f docker-compose.db.yml up -d
```

### 3. Configurar e iniciar el servidor
```powershell
cd server
copy .env.example .env
# Editar .env con tus valores reales (ver sección Variables de Entorno)

..\node-local.bat npm install
..\node-local.bat npm run dev
# → Servidor escuchando en http://localhost:5001
```

### 4. Configurar e iniciar el cliente
```powershell
cd ..\client
copy .env.example .env
# Verificar que VITE_API_URL=http://localhost:5001/api

..\node-local.bat npm install
..\node-local.bat npm run dev
# → Cliente disponible en http://localhost:3000
```

### 5. Acceder a la aplicación
```
http://localhost:3000/front
```

> **Primera vez**: El login de GLPI no funcionará hasta configurar las credenciales. Usa el usuario de emergencia (`ADMIN_USER` / `ADMIN_PASSWORD`) para entrar y luego ve al módulo de **Configuración**.

---

## Variables de Entorno

### Servidor (`server/.env`)

| Variable | Requerido | Descripción |
|---|---|---|
| `PORT` | ✅ | Puerto del servidor. Dev: `5001`, Docker: `5000` |
| `NODE_ENV` | ✅ | `development` o `production` |
| `MONGO_URI` | ✅ | URI de conexión a MongoDB |
| `JWT_SECRET` | ✅ | Secreto JWT — mínimo 64 caracteres aleatorios |
| `ENCRYPTION_KEY` | ✅ | Clave AES-256 en hex — **exactamente 64 caracteres**. El servidor **no arranca** sin ella. |
| `ADMIN_USER` | ⚠️ Opcional | Usuario de emergencia (sin GLPI). Si no se define, el login de emergencia queda desactivado. |
| `ADMIN_PASSWORD` | ⚠️ Opcional | Password del usuario de emergencia |

> **Decisión arquitectónica D-01**: Las credenciales de **GLPI y WhatsApp NO van en el `.env`**. Se configuran desde la UI del módulo de Configuración y se almacenan **cifradas en MongoDB** con `ENCRYPTION_KEY`.

#### Generar secretos seguros
```bash
# JWT_SECRET (64+ bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_KEY (exactamente 32 bytes = 64 chars hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Cliente (`client/.env`)

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base de la API. Dev: `http://localhost:5001/api` · Prod: `https://api-ticketsign.jhamf.com/api` |

---

## Despliegue en Producción (Docker Swarm / Portainer)

### Pre-requisitos
- Clúster Docker Swarm activo con un nodo `manager`
- Red externa `jhamfstack` creada: `docker network create --driver overlay --attachable jhamfstack`
- **Traefik** configurado con `letsencryptresolver` para TLS automático
- Acceso a `ghcr.io` para pull de imágenes

### URLs de producción
| Servicio | URL |
|---|---|
| Frontend | `https://ticketsign.jhamf.com` |
| API Backend | `https://api-ticketsign.jhamf.com` |

### Despliegue desde Portainer
1. Abre Portainer → **Stacks** → **Add stack**
2. Nombre: `ticketsign`
3. Método: **Web editor** — pega el contenido de `docker-compose.yml`
4. En **Environment variables** agrega:
   - `JWT_SECRET` → (valor generado)
   - `ENCRYPTION_KEY` → (valor generado, exactamente 64 chars hex)
   - `ADMIN_USER` → usuario de emergencia
   - `ADMIN_PASSWORD` → contraseña segura
   - `MONGO_URI` → (opcional si usas el Mongo del stack)
5. Clic en **Deploy the stack**

### Comandos CLI
```bash
# Desplegar / actualizar stack
docker stack deploy -c docker-compose.yml ticketsign

# Ver estado de servicios
docker stack services ticketsign

# Forzar re-deploy (nueva imagen)
docker service update --force ticketsign_ticketsign-client
docker service update --force ticketsign_ticketsign-server

# Ver logs en tiempo real
docker service logs -f ticketsign_ticketsign-server
```

### Build y push de imágenes (CI manual)
```bash
# Cliente
cd client
docker build -t ghcr.io/jhamfgit/ticketsign-client:latest .
docker push ghcr.io/jhamfgit/ticketsign-client:latest

# Servidor
cd ../server
docker build -t ghcr.io/jhamfgit/ticketsign-server:latest .
docker push ghcr.io/jhamfgit/ticketsign-server:latest
```

---

## Configuración Post-Despliegue

Después del primer despliegue, **GLPI no estará configurado**. Sigue estos pasos:

1. Abre `https://ticketsign.jhamf.com`
2. Inicia sesión con `ADMIN_USER` / `ADMIN_PASSWORD` (definidos en las variables del stack)
3. Ve al módulo **Configuración**
4. Completa los campos de **GLPI**: URL de tu instancia, App Token y User Token
5. Completa los campos de **WhatsApp**: ID de teléfono y Access Token (opcional)
6. Guarda — el servidor cifra las credenciales de inmediato con AES-256

> A partir de este punto los usuarios podrán autenticarse directamente con sus credenciales de GLPI.

---

## Base de Datos

### MongoDB (Servidor)
| Colección | Descripción |
|---|---|
| `acts` | Actas de mantenimiento sincronizadas |
| `tasks` | Tareas del tablero Kanban |
| `configurations` | Configuración cifrada (GLPI, WhatsApp) |
| `quotations` | Cotizaciones con estados de aprobación |
| `counters` | Auto-incrementos (IDs de cotizaciones) |

### Dexie / IndexedDB (Cliente — Offline)
Schema en `client/src/store/db.js` — **versión actual: 13**

| Store | Índices principales |
|---|---|
| `acts` | `id, _id, glpi_ticket_id, status, type, client_name, technical_name, createdAt` |
| `tasks` | `id, _id, status, priority, type, scheduled_at, reminder_sent` |
| `notifications` | `id, title, read, createdAt` |
| `settings` | `key` |
| `glpi_entities` | `id, label, entityName` |
| `glpi_technicians` | `id, label, fullName` |
| `glpi_tickets` | `id, label` |
| `assets_cache` | `id, serial, hostname, ticket_id` |
| `sync_logs` | `id, act_id, task_id, timestamp, status` |
| `day_settings` | `date, color` |

> ⚠️ Al cambiar la versión del schema Dexie se ejecuta la migración automáticamente en el cliente. Los datos existentes no se pierden.

---

## Seguridad

| Medida | Implementación |
|---|---|
| **Autenticación** | JWT firmado (8h expiración), validado en cada request |
| **Cifrado en reposo** | AES-256-CBC para credenciales GLPI/WhatsApp en MongoDB |
| **Clave maestra** | `ENCRYPTION_KEY` — obligatoria, el servidor no inicia sin ella |
| **Cabeceras HTTP** | `helmet` en todas las rutas |
| **Rate limiting** | `express-rate-limit` — previene fuerza bruta en `/api/auth` |
| **RBAC** | Roles granulares: Super-Admin, Admin-Mesa, Especialistas, Compras |
| **TLS** | HTTPS obligatorio via Traefik + Let's Encrypt en producción |
| **Secretos** | `.env`, `server/uploads/`, logs y scripts temporales excluidos del git |
| **GLPI/WA creds** | **No van en `.env`** — se configuran desde la UI y se cifran en BD (D-01) |

---

## Contribuir

1. Crear rama desde `main`: `git checkout -b feat/nombre-del-cambio`
2. Hacer cambios y verificar el build: `cd client && ..\node-local.bat npm run build`
3. Commit descriptivo siguiendo la convención:

```
feat:     Nueva funcionalidad
fix:      Corrección de bug
style:    Cambios de UI/CSS sin lógica de negocio
refactor: Refactorización sin cambio de comportamiento
docs:     Documentación
chore:    Configuración, dependencias, gitignore
```

4. Push y abrir Pull Request hacia `main`
5. Toda modificación crítica debe incluir auditoría de seguridad antes de merge

---

*TicketSign · Desarrollado para **Jhamf Group SAS***
