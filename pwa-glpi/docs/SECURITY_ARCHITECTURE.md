# SECURITY_ARCHITECTURE.md — TicketSign

> Documento de arquitectura de seguridad. Última revisión: **2026-03-11** (Auditoría Avanzada v2.0)

---

## 1. MODELO DE AUTENTICACIÓN

### 1.1 Flujo Completo
```
Cliente                        Servidor                         GLPI API
  │                               │                                │
  │──── POST /api/auth/login ────►│                                │
  │   { username, password }      │                                │
  │                               │ 1. Validar formato/longitud    │
  │                               │    (tipo string, max 100/200)  │
  │                               │                                │
  │                               │ 2. Verificar usuario maestro   │
  │                               │    (timingSafeEqual)           │
  │                               │      ↓ Si coincide             │
  │                               │    Generar JWT (1d)            │
  │                               │                                │
  │                               │ 3. Si no es maestro:           │
  │                               │    Leer glpi_api_url de BD     │
  │                               │    ├── Validar HTTPS en prod   │
  │                               │────────── initSession ────────►│
  │                               │◄────── session_token ─────────│
  │                               │────── getFullSession ─────────►│
  │                               │◄──── perfil + userId ─────────│
  │                               │    Generar JWT (8h)            │
  │◄─── { token, user } ─────────│                                │
  │                               │                                │
  │ localStorage:                 │                                │
  │   glpi_pro_token = JWT        │                                │
  │   glpi_pro_user  = userData   │                                │
  │                               │                                │
  │──── Cada petición API ───────►│                                │
  │   Authorization: Bearer JWT   │ JWT verify(secret)             │
  │                               │ → req.user = payload           │
```

### 1.2 Tokens JWT
| Tipo | Expiración | Algoritmo | Contenido |
|---|---|---|---|
| Usuario GLPI | **8 horas** | HS256 | username, id, displayName, profile |
| Usuario Maestro | **24 horas** | HS256 | username, id='system-admin', profile='Super-Admin' |

**¿Por qué no `httpOnly cookie`?**  
La aplicación es una PWA diseñada para funcionar **offline**. Los tokens en `localStorage` son accesibles desde el Service Worker y el código JS, lo cual es requerido para sincronización en background. La protección se implementa a través de CSP estricta y sanitización de HTML para prevenir XSS (el vector principal contra localStorage).

### 1.3 Protecciones Anti-Brute Force
- **Rate Limit en `/api/auth/login`**: 10 intentos / 15 minutos por IP
- **Rate Limit general en `/api/`**: 2000 requests / 15 minutos por IP
- **Timing Attack Prevention**: `crypto.timingSafeEqual()` para comparar credenciales del usuario maestro
- **Logging de fallos**: Se registra IP + username intentado en cada fallo de autenticación

### 1.4 Invalidación de Sesión
- Actualmente: **Basada en expiración del JWT** (stateless)
- Al recibir `401`: El interceptor `apiInterceptor.js` limpia `localStorage` y redirige al login
- No hay blacklist de tokens (no existe revocación inmediata)

> ⚠️ **Limitación conocida y aceptada**: Sin refresh tokens ni blacklist, un token comprometido es válido hasta su expiración. Para el caso de uso (técnicos en campo, sesiones ≤8h), esto es aceptable dado que la expiración corta limita el daño.

---

## 2. CADENA DE CIFRADO DE SECRETOS EN BASE DE DATOS

```
Módulo Config (Frontend)
   │
   │ POST /api/config { glpi_app_token: "abc123", ... }
   ▼
config.js (backend)
   │ SENSITIVE_KEYS check
   │ encrypt("abc123")         ← AES-256-CBC
   │   IV = crypto.randomBytes(16)
   │   key = ENCRYPTION_KEY (32 bytes desde .env)
   │   output = IV_hex + ":" + encrypted_hex
   ▼
MongoDB (Configuration collection)
   │ { key: "glpi_app_token", value: "a1b2c3...:d4e5f6..." }
   ▼
configService.get("glpi_app_token")
   │ refreshCache() → decrypt(value) → plaintext
   ▼
services/glpi.js
   │ Usa el token en headers de GLPI API
```

### 2.1 Parámetros de Cifrado
| Parámetro | Valor |
|---|---|
| Algoritmo | AES-256-CBC |
| Tamaño de clave | 256 bits (32 bytes = 64 chars hex) |
| IV | 16 bytes aleatorios por cifrado (único por valor) |
| Representación | `hex(IV):hex(ciphertext)` |
| Cache de clave | Lazy-loaded + singleton en `crypto.js` |

### 2.2 Protección de la ENCRYPTION_KEY
- Almacenada **solo en `.env`** (nunca en código ni BD)
- `.env` está en **`.gitignore`** (excluido del repositorio)
- Validada al primer uso: debe tener exactamente 64 chars hex
- Se aplica `.trim()` para evitar errores por espacios ocultos

---

## 3. HEADERS DE SEGURIDAD HTTP (HELMET)

| Header | Valor Configurado | Propósito |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'`, sin `unsafe-eval` | Prevenir XSS inline y eval |
| `X-Frame-Options` | Deshabilitado (`frameguard: false`) | Necesario para preview PDF en iframe |
| `frame-ancestors` (CSP) | Solo `'self'` + orígenes permitidos | Control granular de iframes via CSP |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Forzar HTTPS (solo en prod) |
| `X-Content-Type-Options` | `nosniff` (default Helmet) | Prevenir MIME sniffing |
| `X-XSS-Protection` | `0` (modern browsers, via Helmet) | Desactivado (obsoleto, CSP lo reemplaza) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` (Helmet) | Minimizar info en Referer |
| `Permissions-Policy` | Default Helmet | Deshabilitar APIs sensibles del navegador |

### 3.1 Directivas CSP Completas
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: blob: https:;
font-src 'self' data: https://fonts.gstatic.com;
media-src 'self' https://assets.mixkit.co https:;
connect-src 'self' [allowedOrigins] https://graph.facebook.com;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'self' [allowedOrigins];
```

> **Nota**: `'unsafe-inline'` en `script-src` es requerido por React/Vite en desarrollo. En producción, el bundle compilado no lo necesita idealmente, pero se mantiene por compatibilidad con el sistema de estilos inline de Tailwind.

---

## 4. THREAT MODEL — ACTORES Y MITIGACIONES

### 4.1 Actores de Amenaza

| Actor | Nivel | Vector Principal |
|---|---|---|
| Usuario interno malicioso | Alto | Acceso a tokens, manipulación de datos propios |
| Atacante externo autenticado | Medio | Escalación de privilegios, IDOR |
| Atacante externo no autenticado | Bajo-Medio | Brute force, SSRF, injection en endpoints públicos |
| Insider con acceso a servidor | Crítico | Acceso a `.env`, a la BD |

### 4.2 Threat Model por Endpoint

```
/api/auth/login (público)
 ├─ Amenaza: Brute force → Mitigación: loginLimiter (10/15min)
 ├─ Amenaza: Timing attack (maestro) → Mitigación: timingSafeEqual
 ├─ Amenaza: Injection en username → Mitigación: typeof + maxlength
 └─ Amenaza: SSRF via glpi_api_url → Mitigación: forzar HTTPS en prod

/api/config (Admin only)
 ├─ Amenaza: Mass assignment → Mitigación: ALLOWED_CONFIG_KEYS whitelist
 ├─ Amenaza: Token leak → Mitigación: Valores sensibles enmascarados en GET
 └─ Amenaza: Sobrescribir con clave arbitraria → Mitigación: Validación en modelo

/api/quotations/:id (Auth required)
 ├─ Amenaza: IDOR → Mitigación: Visibilidad estricta (creador/asignado)
 ├─ Amenaza: BOLA (ObjectId injection) → Mitigación: validateObjectId()
 └─ Amenaza: Path traversal en uploads → Mitigación: path.basename() + boundary check

/api/quotations/view/:filename (URL token)
 ├─ Amenaza: Path traversal → Mitigación: basename + startsWith(uploadsDir)
 ├─ Amenaza: Token leak en logs → Mitigación: Token en URL solo para rutas view/
 └─ Amenaza: MIME confusion → Mitigación: Verificación de firma de archivo (PDF magic bytes)

/api/tasks (Auth required)
 ├─ Amenaza: NoSQL Injection via query params → Mitigación: String() cast
 ├─ Amenaza: Privilege escalation → Mitigación: isAdmin/isCreator/isAssigned checks
 └─ Amenaza: Data leak entre usuarios → Mitigación: $or visibility conditions
```

### 4.3 Datos Sensibles y su Protección

| Dato | En Tránsito | En Reposo | Acceso |
|---|---|---|---|
| Contraseñas GLPI | HTTPS + Basic Auth (Base64) | No almacenadas | Solo en memoria durante auth |
| Contraseña maestro (ADMIN_PASSWORD) | No viaja por red | `.env` en servidor | Solo proceso Node.js |
| GLPI App/User Token | HTTPS | AES-256-CBC en MongoDB | Solo servicios del servidor |
| WhatsApp Token | HTTPS | AES-256-CBC en MongoDB | Solo servicios del servidor |
| JWT del usuario | HTTPS en header | `localStorage` en cliente | JS del cliente (limitado por CSP) |
| ENCRYPTION_KEY | No viaja | `.env` + memoria | Solo proceso Node.js |

---

## 5. CONTROLES DE SEGURIDAD IMPLEMENTADOS

### 5.1 Autenticación & Sesiones
- [x] JWT con expiración corta (8h usuarios, 24h maestro)
- [x] Rate limiting específico en login (10 intentos/15 min)
- [x] Timing-safe comparison para credenciales maestro
- [x] Validación de tipo y longitud de inputs en login
- [x] Logging de intentos fallidos con IP
- [x] Logout automático en 401 (interceptor en cliente)
- [ ] Refresh tokens ← **No implementado** (pendiente si se requiere mayor seguridad)
- [ ] MFA ← **No implementado** (GLPI no lo soporta nativamente)

### 5.2 Cifrado
- [x] AES-256-CBC en reposo para secretos de integraciones
- [x] IV aleatorio por cada cifrado (IV único por valor)
- [x] HTTPS en tránsito (via Traefik + Let's Encrypt)
- [x] HSTS habilitado en producción
- [x] Validación de ENCRYPTION_KEY (longitud, hex, trim)

### 5.3 Autorización
- [x] JWT verificado en todos los endpoints protegidos
- [x] Control de roles granular (Super-Admin, Admin-Mesa, Compras, etc.)
- [x] Visibilidad estricta de datos por usuario (IDOR protection)
- [x] Validación de ObjectId antes de consultas MongoDB

### 5.4 Validación de Inputs
- [x] Whitelist de claves en configuración (ALLOWED_CONFIG_KEYS)
- [x] Sanitización de `req.query` a `String()`
- [x] Validación de ObjectId con regex `/^[a-fA-F0-9]{24}$/`
- [x] Escape de regex en búsquedas
- [x] Límite de tamaño en JSON body (1MB)
- [x] Límite de uploads (20MB por archivo, 100/hora por IP)

### 5.5 Manejo de Archivos
- [x] Filtro MIME en Multer (whitelist: PDF, JPG, PNG, WebP)
- [x] `path.basename()` en nombres de archivo
- [x] Verificación de boundary (path debe estar en `uploads/`)
- [x] Verificación de firma mágica (PDF magic bytes `%PDF-`)
- [x] Directorio `uploads/` NO servido estáticamente
- [x] Token requerido para acceder a archivos

### 5.6 Headers HTTP
- [x] Helmet con CSP restrictiva
- [x] HSTS en producción
- [x] CORS whitelist de orígenes
- [x] `object-src: none` (bloquear Flash/Silverlight)
- [x] `base-uri: self` (bloquear base tag hijacking)
- [x] Eliminado `unsafe-eval` de CSP

### 5.7 Protección de Base de Datos
- [x] Sanitización NoSQL (no usar inputs directamente en queries)
- [x] Schema validation de MongoDB (enum, required, maxlength)
- [x] Whitelist de claves en modelo Configuration
- [x] Timeout de conexión MongoDB (5 segundos)
- [x] Volúmenes Docker para persistencia sin exposición de puertos
- [ ] Autenticación MongoDB ← **No implementada en local** (recomendada en prod)

### 5.8 XSS Prevention
- [x] Sanitizador en `TicketDetail.jsx` (DOMParser + allowlist)
- [x] Bloqueo de `on*` atributos, `javascript:`, `data:`, `vbscript:`
- [x] CSP como capa adicional de protección
- [x] React escapa HTML por defecto en `{variable}` (no `dangerouslySetInnerHTML`)

---

## 6. CONFIGURACIÓN DEVSECOPS

### 6.1 Control de Secretos en Git
- `.env` archivos: **excluidos** por `.gitignore` ✅
- `.env.example`: Plantilla pública sin valores ✅
- `ENCRYPTION_KEY`, `JWT_SECRET`, `ADMIN_PASSWORD`: **solo en `.env` local** o en secretos del CI/CD

### 6.2 Estado del Pipeline CI/CD
```
GitHub Actions → build → GHCR push → Docker Swarm deploy
     │               │
     │   ¿Tiene SAST?    → ❌ No implementado
     │   ¿Dep scanning?  → ✅ npm audit (manual)
     │   ¿Secret scan?   → ❌ No implementado (ver Recomendaciones)
     └──────────────────────────────────────
```

### 6.3 Recomendaciones DevSecOps (No Implementadas)
Estas mejoras son sugeridas para mayor madurez de seguridad:

```yaml
# Añadir a .github/workflows/main.yml:

- name: Dependency Audit
  run: |
    cd server && npm audit --audit-level=high
    cd client && npm audit --audit-level=high

- name: Secret Scanning
  uses: gitleaks/gitleaks-action@v2

- name: SAST - Node.js
  uses: github/codeql-action/analyze@v3
  with:
    languages: javascript
```

---

## 7. ANÁLISIS DE RIESGOS RESIDUALES

| Riesgo | Probabilidad | Impacto | Mitigación Existente | Riesgo Residual |
|---|---|---|---|---|
| XSS via HTML de GLPI | Media | Alto | Sanitizador + CSP | **Bajo** |
| IDOR en cotizaciones | Baja | Alto | Visibilidad estricta | **Muy bajo** |
| Brute force en login | Alta | Alto | Rate limit | **Bajo** |
| Exfiltración de token | Baja | Alto | CSP + HTTPS + 8h exp | **Bajo** |
| MongoDB sin auth | Baja local | Crítico | Red Docker privada | **Medio en prod** |
| Token en URL (view/) | Baja | Medio | Solo rutas específicas, logs | **Aceptado** |
| Secret en git history | Muy baja | Crítico | `git rm --cached` ejecutado | **Muy bajo** |
| Dep. transitivas vite | Baja | Medio | Afecta solo build dev | **Bajo** |

---

## 8. CHECKLIST DE SEGURIDAD PARA PRODUCCIÓN

Antes de desplegar en producción, verificar:

```bash
# 1. Verificar que .env no está en git
git ls-files server/.env client/.env
# → No debe retornar nada

# 2. Generar secretos de producción fuertes
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # ENCRYPTION_KEY

# 3. Auditoría de dependencias
cd server && npm audit
cd ../client && npm audit

# 4. Verificar configuración en la app
# → Abrir módulo de Configuración como Super-Admin
# → Introducir credenciales GLPI y WhatsApp
# → Verificar que el aviso de "Configuración Requerida" desaparece

# 5. Verificar HSTS (en producción)
curl -I https://api-ticketsign.jhamf.com/health | grep strict-transport-security

# 6. Verificar que MongoDB no expone puerto externamente
docker service ls | grep mongo  # No debe tener puerto publicado
```

---

## 9. REFERENCIAS

- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Helmet.js Docs](https://helmetjs.github.io/)
- [Express Rate Limit](https://www.npmjs.com/package/express-rate-limit)
- [Node.js Crypto - timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)
- [CWE-307: Brute Force](https://cwe.mitre.org/data/definitions/307.html)
- [CWE-327: Weak Cryptography](https://cwe.mitre.org/data/definitions/327.html)
