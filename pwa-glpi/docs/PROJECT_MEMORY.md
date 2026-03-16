# TicketSign — PROJECT MEMORY

> 🛡️ **ESTADO DE SEGURIDAD**: **APTO PARA PRODUCCIÓN** | Score: **90/100** | Última auditoría: 2026-03-11

> Documento vivo. Actualizar con cada cambio arquitectónico relevante.  
> Última actualización: **2026-03-11** | Auditoría avanzada de seguridad enterprise v2.0 + pipeline DevSecOps.
> 
> | Documento | Propósito |
> |---|---|
> | [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md) | Modelo de autenticación, CSP, threat model |
> | [THREAT_MODEL.md](./THREAT_MODEL.md) | Actores, activos, vectores de ataque, mitigaciones |
> | [AI_REVIEW_PIPELINE.md](./AI_REVIEW_PIPELINE.md) | Pipeline DevSecOps de 6 etapas para cada cambio |
> | [FINAL_SECURITY_AUDIT.md](./FINAL_SECURITY_AUDIT.md) | **Auditoría final** — Score 90/100, apto para producción |

---

## 1. ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET / TRAEFIK                       │
└────────────┬────────────────────────────────┬───────────────────┘
             │ HTTPS (443)                    │ HTTPS (443)
             ▼                               ▼
  ┌─────────────────────┐        ┌──────────────────────────┐
  │  ticketsign-client  │        │  ticketsign-server       │
  │  (Vite + React PWA) │◄──────►│  (Node.js + Express)     │
  │  ticketsign.jhamf.com│       │  api-ticketsign.jhamf.com│
  └─────────────────────┘        └──────────┬───────────────┘
                                             │
                                  ┌──────────▼───────────┐
                                  │  MongoDB              │
                                  │  (Docker: mongo:27017)│
                                  └──────────────────────┘
                                             │
                                  ┌──────────▼───────────┐
                                  │  GLPI API (externa)   │
                                  │  service.jhamf.com    │
                                  └──────────────────────┘
                                  ┌──────────────────────┐
                                  │  Meta WhatsApp Cloud  │
                                  │  API (externa)        │
                                  └──────────────────────┘
```

### Flujo de Autenticación
1. Usuario ingresa credenciales en el cliente.
2. El servidor valida contra GLPI API (o User Maestro si ADMIN_USER/ADMIN_PASSWORD están definidos).
3. El servidor genera un JWT con perfil de 8h de vida.
4. El cliente almacena el token en `localStorage['glpi_pro_token']`.
5. El interceptor global de fetch valida el token en cada petición y redirige al login si recibe 401.

### Principio de Configuración de Integraciones
- **GLPI y WhatsApp SOLO se configuran desde la BD** (módulo de configuración del cliente).
- El archivo `.env` **NUNCA** debe contener credenciales de GLPI/WhatsApp.
- El `.env` solo contiene: `PORT`, `MONGO_URI`, `JWT_SECRET`, `ENCRYPTION_KEY`, `ADMIN_USER`, `ADMIN_PASSWORD`.

---

## 2. STACK TECNOLÓGICO

### Backend (Server)
| Tecnología | Versión | Propósito |
|---|---|---|
| Node.js | ≥18 LTS | Runtime |
| Express.js | ^4.18 | Framework HTTP |
| Mongoose | ^8.0 | ODM MongoDB |
| jsonwebtoken | ^9.0 | Autenticación JWT |
| bcryptjs | - | Hash de contraseñas (si aplica) |
| multer | ^2.1 | Upload de archivos |
| helmet | ^7.1 | Headers de seguridad HTTP |
| express-rate-limit | ^8.2 | Rate limiting |
| puppeteer | ^24 | Generación de PDFs |
| axios | ^1.6 | Llamadas HTTP a GLPI |
| dotenv | ^16 | Variables de entorno |
| cors | ^2.8 | Control de CORS |

### Frontend (Client)
| Tecnología | Versión | Propósito |
|---|---|---|
| React | ^18.2 | Framework de UI |
| Vite | ^7.3 | Bundler/Dev Server |
| Dexie.js | ^3.2 | IndexedDB (offline-first) |
| React Router DOM | ^7.13 | Enrutamiento SPA |
| Tailwind CSS | ^3.4 | Utilidades CSS |
| Lucide React | ^0.300 | Iconografía |
| jsPDF | ^4.2 | Generación PDF cliente |
| vite-plugin-pwa | ^1.2 | PWA y Service Worker |

### Infraestructura
| Componente | Tecnología |
|---|---|
| Orquestación | Docker Swarm + `docker-compose.yml` |
| Reverse Proxy | Traefik (TLS automático Let's Encrypt) |
| Base de datos | MongoDB (contenedor `mongo`) |
| Persistencia Uploads | Docker Volume `ticketsign_uploads` |
| Persistencia DB | Docker Volume `ticketsign_data` |
| CI/CD | GitHub Actions → GHCR → Docker Swarm |

---

## 3. ESTRUCTURA DEL PROYECTO

```
pwa-glpi/
├── client/                  # Frontend React PWA
│   ├── src/
│   │   ├── App.jsx           # Enrutador principal, estado global de sesión
│   │   ├── components/       # Componentes de UI (≥27 módulos)
│   │   │   ├── Login.jsx     # Pantalla de autenticación
│   │   │   ├── ConfigManager.jsx  # Panel admin de configuración
│   │   │   ├── TaskBoard.jsx # Kanban de tareas
│   │   │   ├── QuotationList/Form/Detail.jsx  # Módulo de cotizaciones
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── apiInterceptor.js  # Interceptor global fetch (logout en 401)
│   │   │   ├── SyncService.js     # Sincronización offline/online
│   │   │   └── NotificationService.js
│   │   ├── store/
│   │   │   └── db.js          # Esquema Dexie (IndexedDB)
│   │   └── utils/
│   │       └── cn.js          # Merge de clases CSS
│   ├── .env.example           # Plantilla de variables (sin valores reales)
│   └── package.json
│
├── server/                   # Backend Express
│   ├── src/
│   │   ├── index.js           # Entry point: DB, CORS, Rate Limit, rutas
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT auth + autorización por roles
│   │   ├── models/
│   │   │   ├── Task.js        # Schema Mongoose de tareas
│   │   │   ├── Quotation.js   # Schema Mongoose de cotizaciones
│   │   │   ├── Act.js         # Schema Mongoose de actas de mantenimiento
│   │   │   ├── Configuration.js # Schema para config del sistema
│   │   │   └── Counter.js     # Auto-incremento para número de cotización
│   │   ├── routes/
│   │   │   ├── auth.js        # POST /api/auth/login
│   │   │   ├── config.js      # GET/POST /api/config
│   │   │   ├── tasks.js       # CRUD /api/tasks
│   │   │   ├── quotations.js  # CRUD /api/quotations
│   │   │   ├── glpi.js        # Proxy /api/glpi/*
│   │   │   ├── reports.js     # POST /api/reports/*
│   │   │   └── sync.js        # POST /api/sync/maintenance
│   │   ├── services/
│   │   │   ├── glpi.js        # GlpiService (sesión, tickets, actores)
│   │   │   ├── glpi_historical.js  # Histórico de actas desde GLPI
│   │   │   ├── pdf.js         # Generación de PDFs con Puppeteer
│   │   │   ├── whatsapp.js    # WhatsApp Cloud API
│   │   │   ├── configService.js    # Cache de configuración desde BD
│   │   │   └── reminder.js    # Recordatorios automáticos programados
│   │   └── utils/
│   │       └── crypto.js      # AES-256-CBC encrypt/decrypt
│   ├── .env                   ← NUNCA subir a Git (excluido por .gitignore)
│   ├── .env.example           # Plantilla pública
│   ├── .gitignore
│   └── package.json
│
├── docker-compose.yml         # Producción: client + server + mongo
├── docker-compose.db.yml      # Solo MongoDB en local
├── PROJECT_MEMORY.md          ← Este archivo
├── SECURITY_ARCHITECTURE.md   ← Modelo de auth, CSP, threat model
├── THREAT_MODEL.md            ← Actores, activos, vectores de ataque STRIDE
├── AI_REVIEW_PIPELINE.md      ← Pipeline DevSecOps 6 etapas
├── .agent/
│   └── workflows/             ← Skills de calidad y seguridad
│       ├── SECURITY_GUARDIAN.md
│       ├── THREAT_MODEL_ANALYZER.md
│       ├── SENIOR_ENGINEER.md
│       ├── BEST_PRACTICES_ENFORCER.md
│       ├── DEPENDENCY_AUDITOR.md
│       ├── PERFORMANCE_ANALYZER.md
│       └── CODE_QUALITY.md    (combinado, mantenido por compatibilidad)
└── README.md
```

---

## 4. CONVENCIONES DE DESARROLLO

### Nomenclatura
- **Variables/funciones**: `camelCase`
- **Componentes React**: `PascalCase`
- **Constantes**: `UPPER_SNAKE_CASE`
- **Rutas API**: `/api/recurso` (kebab-case)
- **Colecciones MongoDB**: `plural lowercase` (mongoose lo hace automático)

### Estilo de Código
- ESM (`import/export`) exclusivamente, tanto en cliente como servidor.
- Arrow functions para handlers de rutas.
- `async/await` sobre callbacks/promesas encadenadas.
- Manejo de errores siempre con `try/catch`.
- Mensajes de error al cliente: **genéricos** (no exponer detalles internos).
- Logs en servidor: **detallados** con prefijo `[Módulo]`.

### Reglas Obligatorias de Seguridad en Código Nuevo
1. Todo endpoint protegido debe usar `authenticateToken`.
2. Todo endpoint con roles específicos debe usar `authorizeRoles(...)`.
3. Nunca usar `req.body` directamente en queries MongoDB sin convertir a `String()`.
4. Todo `req.params.id` debe validarse como ObjectId antes de usarlo.
5. Archivos servidos deben verificar que la ruta está dentro de `uploads/`.
6. Logs no deben incluir tokens, contraseñas, ni datos personales.

---

## 5. DECISIONES TÉCNICAS

| ID | Decisión | Razón | Fecha |
|---|---|---|---|
| D-01 | Integraciones GLPI/WhatsApp **solo en BD** | Permite venta del software sin modificar código | 2026-03-11 |
| D-02 | JWT en `localStorage` (no `HttpOnly cookie`) | PWA offline requiere acceso al token desde JS | 2026-02-27 |
| D-03 | Offline-first con Dexie/IndexedDB | Técnicos en campo sin conexión continua | 2026-02-27 |
| D-04 | Puppeteer para PDF en servidor | Fidelidad de render (vs jsPDF cliente) | 2026-02-27 |
| D-05 | AES-256-CBC para credenciales en BD | Tokens GLPI/WhatsApp no deben estar en texto plano | 2026-03-09 |
| D-06 | Rate Limiting: 10 req/15min en login | Prevenir ataques de fuerza bruta | 2026-03-10 |
| D-07 | CORS whitelist explícita | Evitar peticiones cross-origin no autorizadas | 2026-03-10 |
| D-08 | `ADMIN_USER`/`ADMIN_PASSWORD` solo en `.env` | Acceso de emergencia sin GLPI; no persistir en BD | 2026-03-11 |
| D-09 | Uploads protegidos (no servidos estáticamente) | Archivos solo accesibles con token válido | 2026-03-11 |
| D-10 | Token por query param SOLO en rutas `view/` | `<img src>` no puede enviar headers; excepción documentada | 2026-03-10 |
| D-11 | GLPI/WhatsApp eliminados del `docker-compose.yml` | Alinear infra con decisión D-01; evitar confusión | 2026-03-11 |
| D-12 | `timingSafeEqual` para credenciales maestro | Prevenir timing attacks en comparación de secrets | 2026-03-11 |
| D-13 | Whitelist en modelo `Configuration` (ALLOWED_CONFIG_KEYS) | Doble capa de validación; previene mass assignment | 2026-03-11 |

---

## 6. CONFIGURACIONES CRÍTICAS

### Variables de Entorno (servidor)
```env
# OBLIGATORIAS - Sin estas el servidor no arranca correctamente:
PORT=5001
MONGO_URI=mongodb://mongo:27017/ticketsign
JWT_SECRET=<hex 64+ chars>        # Firma de tokens JWT
ENCRYPTION_KEY=<hex exacto 64 chars>  # AES-256 para cifrar credenciales en BD

# OPCIONALES - Solo para acceso de emergencia (Usuario Maestro):
ADMIN_USER=admin
ADMIN_PASSWORD=<contraseña_segura>

# NUNCA poner aquí: GLPI_*, WHATSAPP_* → van en el módulo de Configuración de la app
```

### Generación de secretos seguros
```bash
# JWT_SECRET (64+ chars hex)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_KEY (exactamente 64 chars hex = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Configuración de Integraciones (desde la app)
Acceder como Super-Admin → Módulo de Configuración:
- `glpi_api_url`: URL completa de la API REST de GLPI
- `glpi_app_token`: App Token de GLPI 
- `glpi_user_token`: User Token de GLPI
- `whatsapp_phone_id`: Phone Number ID de Meta
- `whatsapp_token`: Access Token de WhatsApp Cloud API
- `whatsapp_template_name`: Nombre de la plantilla aprobada
- `whatsapp_lang`: Código de idioma (ej: `es_CO`)

### Headers de Seguridad (Helmet)
- `Content-Security-Policy`: restrictiva con excepciones documentadas
- `X-Frame-Options`: `frame-ancestors` whitelist
- `X-Content-Type-Options`: `nosniff`
- `Referrer-Policy`: `strict-origin-when-cross-origin`

---

## 7. ROLES Y PERMISOS

| Rol | Permisos |
|---|---|
| `Super-Admin` | Todo: config, eliminar, reportes, GLPI |
| `Admin-Mesa` | Todo excepto config del sistema |
| `Compras` | Gestión de cotizaciones |
| `Especialistas` | Crear/editar tareas propias, ticketss GLPI |
| `Administrativo` | Tickets GLPI, followups |
| Usuario asignado | Solo cambiar estado de tareas asignadas |
| `system-admin` (virtual) | ID especial para ADMIN_USER de emergencia |

---

## 8. SEGURIDAD — CONTROLES IMPLEMENTADOS (OWASP Top 10)

| OWASP | Control | Implementación |
|---|---|---|
| A01 - Broken Access Control | Roles en cada endpoint | `authorizeRoles()`, visibilidad estricta por usuario |
| A02 - Cryptographic Failures | AES-256 para secretos, HTTPS obligatorio | `crypto.js`, Traefik TLS, HSTS en producción |
| A03 - Injection | Sanitización NoSQL | Conversión a `String()` en queries, `validateObjectId()`, ALLOWED_CONFIG_KEYS |
| A04 - Insecure Design | Principio de mínimo privilegio | Roles granulares, uploads no públicos, whitelist de claves |
| A05 - Security Misconfiguration | Helmet, CORS whitelist, .env en .gitignore | `index.js`, `.gitignore`, eliminado `unsafe-eval` de CSP |
| A06 - Vulnerable Components | `npm audit` en CI/CD | `serialize-javascript@7.0.3` actualizado |
| A07 - Auth Failures | JWT con expiración, Rate Limit, interceptor 401, timingSafeEqual | `auth.js`, `loginLimiter`, `apiInterceptor.js` |
| A08 - Software Integrity | GHCR con SHA pinning | `docker-compose.yml` usa `sha-XXXXXXX` |
| A09 - Logging Failures | Logs en servidor + IP en fallos, errores genéricos al cliente | Prefijo `[Módulo]`, logging de IP en auth fallos |
| A10 - SSRF | Validación URL GLPI solo HTTPS en producción | `auth.js` validación pre-llamada |

---

## 9. DEPENDENCIAS CLAVE Y SU PROPÓSITO

### Server
| Paquete | Propósito | Riesgo si se elimina |
|---|---|---|
| `helmet` | Headers de seguridad HTTP | Exposición a clickjacking, MIME sniffing |
| `express-rate-limit` | Rate limiting de endpoints | Fuerza bruta en login |
| `jsonwebtoken` | JWT sign/verify | Autenticación rota |
| `mongoose` | ODM MongoDB con schema validation | Acceso inseguro a BD |
| `multer` | Upload de archivos con filtros | Path traversal en uploads |
| `puppeteer` | Generación de PDFs server-side | PDFs sin soporte |
| `dotenv` | Carga de `.env` al arrancar | Config no cargada |

### Client
| Paquete | Propósito | Riesgo si se elimina |
|---|---|---|
| `dexie` | IndexedDB offline-first | Pérdida de funcionalidad offline |
| `react-router-dom` | SPA routing | Navegación rota |
| `serialize-javascript` | ≥7.0.3 requerido (vulnerabilidad XSS en ≤7.0.2) | XSS via serialización |

---

## 10. SISTEMA DE SKILLS Y PIPELINE DEVSEOPS

### Skills Independientes (en `.agent/workflows/`)

| Skill | Etapa | Responsabilidad Principal | Archivo |
|---|---|---|---|
| `SECURITY_GUARDIAN` | 1 | OWASP Top 10, inputs, secretos, headers HTTP, CORS | [SECURITY_GUARDIAN.md](.agent/workflows/SECURITY_GUARDIAN.md) |
| `THREAT_MODEL_ANALYZER` | 2 | STRIDE, superficies de ataque, IDOR, escalación de privilegios | [THREAT_MODEL_ANALYZER.md](.agent/workflows/THREAT_MODEL_ANALYZER.md) |
| `SENIOR_ENGINEER` | 3 | Arquitectura, SOLID, modularidad, acoplamiento | [SENIOR_ENGINEER.md](.agent/workflows/SENIOR_ENGINEER.md) |
| `BEST_PRACTICES_ENFORCER` | 4 | Clean Code, naming, logging, estructura de carpetas | [BEST_PRACTICES_ENFORCER.md](.agent/workflows/BEST_PRACTICES_ENFORCER.md) |
| `DEPENDENCY_AUDITOR` | 5 | npm audit, CVEs, dependencias abandonadas | [DEPENDENCY_AUDITOR.md](.agent/workflows/DEPENDENCY_AUDITOR.md) |
| `PERFORMANCE_ANALYZER` | 6 | Queries, event loop, memoria, cuellos de botella | [PERFORMANCE_ANALYZER.md](.agent/workflows/PERFORMANCE_ANALYZER.md) |

### Pipeline de Validación

Ver [`AI_REVIEW_PIPELINE.md`](./AI_REVIEW_PIPELINE.md) para el flujo completo.

Resumen del pipeline para cada cambio:
```
[Cambio] → SECURITY_GUARDIAN → THREAT_MODEL_ANALYZER → SENIOR_ENGINEER
         → BEST_PRACTICES_ENFORCER → DEPENDENCY_AUDITOR → PERFORMANCE_ANALYZER
         → [Aprobado]
```

**Criterio de bloqueo**: Si cualquier etapa detecta un problema BLOQUEANTE, el cambio se detiene, se genera un informe y se implementa una corrección antes de continuar.

### Modelo de Seguridad Implementado

Ver [`SECURITY_ARCHITECTURE.md`](./SECURITY_ARCHITECTURE.md) para detalles completos.

| Capa | Control Principal |
|---|---|
| Red | HTTPS (Traefik + Let's Encrypt), HSTS en prod |
| HTTP | Helmet (CSP sin unsafe-eval, HSTS, X-Content-Type, etc.) |
| Autenticación | JWT 8h, rate limit 10/15min, timingSafeEqual, SSRF check |
| Autorización | `authorizeRoles()`, visibilidad estricta por usuario |
| Datos en tránsito | HTTPS + CORS whitelist |
| Datos en reposo | AES-256-CBC para secretos de integración |
| Uploads | Multer whitelist MIME, path.basename(), boundary check, uploadLimiter |
| Frontend | CSP, sanitizador HTML, interceptor 401 |
| BD | ALLOWED_CONFIG_KEYS whitelist, validateObjectId(), String() cast |

---

## 11. PIPELINE DE VALIDACIÓN QUICK-REFERENCE

Antes de hacer commit, verificar (ver skills para detalles completos):

### ✅ SECURITY_GUARDIAN
- [ ] Ningún secreto nuevo en código o `.env` que deba ir a la BD
- [ ] Todo endpoint nuevo usa `authenticateToken`
- [ ] Inputs de usuario están sanitizados o convertidos a String
- [ ] IDs de MongoDB validados con `/^[a-fA-F0-9]{24}$/`
- [ ] Archivos servidos verifican que el path esté en `uploads/`
- [ ] Logs no contienen tokens, contraseñas ni datos personales

### ✅ THREAT_MODEL_ANALYZER
- [ ] Nuevo endpoint analizado con STRIDE
- [ ] `createdBy` / `profile` vienen de `req.user`, no de `req.body`
- [ ] Sin nuevo vector IDOR posible
- [ ] THREAT_MODEL.md actualizado si hay nueva superficie de ataque

### ✅ SENIOR_ENGINEER
- [ ] Separación de responsabilidades (route ≠ business logic ≠ data access)
- [ ] Sin código duplicado (DRY)
- [ ] Funciones con propósito único (SRP)
- [ ] Errores manejados con try/catch en todos los async handlers

### ✅ BEST_PRACTICES_ENFORCER
- [ ] Naming conventions respetadas (camelCase, PascalCase, UPPER_SNAKE)
- [ ] Imports con ESM (`import/export`), sin `require()`
- [ ] Logs con prefijo `[Módulo]`
- [ ] Sin `console.log` con datos sensibles

### ✅ DEPENDENCY_AUDITOR
- [ ] `npm audit` ejecutado en server y client
- [ ] Sin dependencias nuevas con vulnerabilidades `high` o `critical`
- [ ] Nueva dep evaluada con checklist completo

### ✅ PERFORMANCE_ANALYZER
- [ ] Queries MongoDB tienen `.limit()` en colecciones grandes
- [ ] Puppeteer cierra en `finally`
- [ ] Sin operaciones síncronas de I/O en request handlers

---

## 12. PROCEDIMIENTO DE DESPLIEGUE

```bash
# 1. Asegurarse de que .env NO está en git
git ls-files | Select-String "\.env"  # No debe mostrar nada excepto .env.example

# 2. Ejecutar auditoría de dependencias
npm audit  # En /server y /client

# 3. Generar imagen y hacer push
git add .
git commit -m "feat|fix|security: descripción clara"
git push origin main

# 4. En el servidor de producción (Docker Swarm)
docker stack deploy -c docker-compose.yml jhamfstack --with-registry-auth

# 5. Verificar arranque
docker service logs jhamfstack_ticketsign-server --follow
```

---

## 13. VALIDACIÓN FINAL DE SEGURIDAD (Audit Ready)

| Fecha | Auditoría | Resultado | Score | Estado |
|---|---|---|---|---|
| 2026-03-11 | Final Security Audit v2.0 | ✅ Aprobado | **90/100** | **PRODUCCIÓN READY** |

### Resumen de Hallazgos Finales
- **Autenticación**: Robusta con `HS256`, expiración controlada y protección contra `timing attacks`.
- **Infraestructura**: Secretos eliminados de archivos versionados, red aislada en Docker.
- **Vulnerabilidades Corregidas**: Se aplicó validación de `ObjectId` en todos los endpoints críticos (`sync.js`, `quotations.js`).
- **Riesgos Aceptados**: JWT en `localStorage` (requerido por PWA) y dependencias transitivas de build-time en el cliente.

Ver el informe detallado en [FINAL_SECURITY_AUDIT.md](./FINAL_SECURITY_AUDIT.md).

---

## 14. PROBLEMAS CONOCIDOS Y SOLUCIONES

| Problema | Causa | Solución |
|---|---|---|
| `ENCRYPTION_KEY must be 64 chars` | Clave truncada o con espacios en `.env` | Regenerar clave con `crypto.randomBytes(32).toString('hex')` |
| `.env` en git history | Fue commiteado antes del `.gitignore` | `git rm --cached server/.env && git commit` |
| Archivos 404 tras deployment | `uploads/` no persiste entre deployments | Usar Docker Volume `ticketsign_uploads` (ya configurado) |
| GLPI 401 al iniciar | Sesión expirada o configuración no encontrada | Reconfigurar tokens en módulo de Configuración |
| Token expirado > redirige login | JWT de 8h expiró | Normal, usuario debe re-autenticarse |
| Aviso "Configuración Requerida" persiste | ENCRYPTION_KEY incorrecta o BD sin configurar | Verificar `.env`, reconfigurar integraciones |

---

*Este archivo debe actualizarse cuando:*
- *Se añade un nuevo módulo o ruta de API*
- *Se cambia una decisión técnica (agregar fila en sección 5)*
- *Se descubre y corrige una vulnerabilidad (agregar en sección 8)*
- *Se actualiza una dependencia crítica de seguridad*
- *Se añade una nueva superficie de ataque al THREAT_MODEL.md*
- *Una nueva skill se crea o actualiza en `.agent/workflows/`*
