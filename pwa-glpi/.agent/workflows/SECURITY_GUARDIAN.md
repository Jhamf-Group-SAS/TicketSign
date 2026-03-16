---
description: Auditoría de seguridad enterprise para el proyecto TicketSign. Aplica OWASP Top 10, Secure by Default, y valida seguridad antes de cualquier cambio.
---

# SECURITY_GUARDIAN

## Propósito
Garantizar que **toda** modificación al proyecto cumple con los estándares de seguridad OWASP Top 10 y Secure by Default. Este skill actúa como **primera barrera** antes de cualquier cambio en código, configuración o dependencias.

## Responsabilidades
- Validar OWASP Top 10 en el código afectado
- Detectar inyecciones (NoSQL, Command, SSRF)
- Validar sanitización de inputs en endpoints
- Revisar manejo de secretos y variables de entorno
- Validar autenticación y autorización en rutas nuevas o modificadas
- Revisar headers de seguridad HTTP (Helmet)
- Revisar configuración CORS
- Validar almacenamiento seguro de tokens y credenciales

---

## Contexto del Proyecto TicketSign

| Variable | Valor |
|---|---|
| Auth | JWT `HS256` — 8h usuarios GLPI, 24h maestro |
| Cifrado en reposo | AES-256-CBC (clave de 32 bytes desde `ENCRYPTION_KEY`) |
| Rate limiting | `loginLimiter` 10/15min — `apiLimiter` 2000/15min — `uploadLimiter` 100/h |
| Uploads path safe | `path.basename()` + boundary check contra `uploads/` |
| Config keys | Solo `ALLOWED_CONFIG_KEYS` (whitelist en modelo) |
| Integraciones | **Solo via BD** — nunca en `.env` ni `docker-compose.yml` |

---

## Checklist Obligatorio

### A. Autenticación y Autorización
- [ ] ¿El endpoint usa `authenticateToken` de `middleware/auth.js`?
- [ ] ¿Si requiere roles, usa `authorizeRoles('Super-Admin', ...)`?
- [ ] ¿No se usa `req.user` sin verificar su existencia primero?
- [ ] ¿El JWT no contiene datos sensibles (contraseñas, tokens de GLPI)?
- [ ] ¿Endpoints públicos NO retornan datos privados de usuarios?

### B. Validación de Inputs — NoSQL / Command Injection
- [ ] ¿`req.query.*` se convierte a `String()` antes de usarlo en MongoDB?
- [ ] ¿`req.params.id` se valida con `/^[a-fA-F0-9]{24}$/` antes de `findById()`?
- [ ] ¿Booleanos de `req.body` se comparan estrictamente (`=== true`)?
- [ ] ¿Búsquedas con regex escapan caracteres: `search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`?
- [ ] ¿Parámetros de tipo numérico usan `parseInt()` con validación `isNaN()`?
- [ ] ¿Ningún input del usuario llega directamente a `exec()`, `spawn()`, `eval()`?

### C. XSS — Frontend
- [ ] ¿HTML de fuentes externas (GLPI) pasa por `sanitizeHTML()` en `TicketDetail.jsx`?
- [ ] ¿El sanitizador bloquea `on*`, `javascript:`, `data:`, `vbscript:`?
- [ ] ¿No se usa `dangerouslySetInnerHTML` sin sanitización previa?
- [ ] ¿URLs de redirección se validan antes de `window.location`?

### D. CSRF
- [ ] ¿Las mutaciones usan `Authorization: Bearer JWT` en header (no cookies)?
- [ ] ¿El header CORS permite solo orígenes en `allowedOrigins`?

### E. SSRF
- [ ] ¿URLs externas configuradas por el usuario se validan como `https://` en prod?
- [ ] ¿No se permite que un parámetro de usuario defina una URL que el servidor consuma directamente?
- [ ] ¿Llamadas axios/fetch a GLPI tienen `timeout` definido (≤10s)?

### F. Manejo de Archivos — Path Traversal
- [ ] ¿Filenames sanitizados con `path.basename(req.params.filename)`?
- [ ] ¿El path resultante verifica `normalizedPath.startsWith(normUploads + sep)`?
- [ ] ¿Tipo MIME validado en `fileFilter` de Multer (whitelist explícita)?
- [ ] ¿El directorio `uploads/` NO está servido con `express.static()`?
- [ ] ¿Archivos temporales se eliminan en `finally` o en el `catch`?

### G. Secretos y Variables de Entorno
- [ ] ¿El `.env` NO contiene `GLPI_*` ni `WHATSAPP_*`?
- [ ] ¿El `.env` está en `.gitignore`?
- [ ] ¿Credenciales nuevas en BD se cifran con `encrypt()` de `crypto.js`?
- [ ] ¿Los logs NO imprimen tokens, contraseñas, ni claves?
- [ ] ¿El `docker-compose.yml` NO contiene variables de integración?

### H. Headers de Seguridad HTTP
- [ ] ¿Helmet está configurado con CSP que NO incluye `unsafe-eval`?
- [ ] ¿HSTS activo en producción (`NODE_ENV === 'production'`)?
- [ ] ¿`object-src: none` en CSP?
- [ ] ¿`base-uri: self` en CSP?
- [ ] ¿CORS usa `allowedOrigins` whitelist?

### I. Rate Limiting
- [ ] ¿Login protegido por `loginLimiter` (10/15min)?
- [ ] ¿API general protegida por `apiLimiter`?
- [ ] ¿Uploads protegidos por `uploadLimiter` (100/h)?
- [ ] ¿Endpoints nuevos de alta frecuencia tienen su propio limiter?

### J. Información Expuesta
- [ ] ¿Errores al cliente son genéricos (sin stack traces, rutas internas)?
- [ ] ¿El endpoint `/health` NO expone versiones, configuración ni estado interno?
- [ ] ¿Logs de servidor tienen el detalle suficiente sin datos personales?

---

## Vulnerabilidades Históricas Corregidas (No Reincidir)

| ID | OWASP | Archivo | Descripción |
|---|---|---|---|
| SEC-01 | A03 | `tasks.js`, `quotations.js` | `req.query` sin sanitizar en queries MongoDB |
| SEC-02 | A01 | `quotations.js` | Sin `validateObjectId()` antes de `findById()` |
| SEC-03 | A10 | `auth.js` | `glpi_api_url` sin validar esquema HTTPS en prod |
| SEC-04 | A03 | `TicketDetail.jsx` | Sanitizador no bloqueaba `data:` / `vbscript:` |
| SEC-05 | A05 | `.env`, `docker-compose.yml` | Secretos de integración en archivos versionados |
| SEC-06 | A07 | `auth.js` | Comparación de credenciales con `===` (timing attack) |
| SEC-07 | A05 | `index.js` | CSP con `unsafe-eval` habilitado |
| SEC-08 | A05 | — | HSTS ausente en producción |
| SEC-09 | A04 | `config.js` | Sin whitelist de claves de configuración (mass assignment) |
| SEC-10 | A05 | `index.js` | Sin rate limit para endpoints de upload |

---

## Proceso de Acción Correctiva

Si detectas un problema de seguridad:

1. **DETÉN** el cambio propuesto
2. **ANUNCIA**: `⚠️ SECURITY_GUARDIAN BLOQUEÓ: [tipo] en [archivo:línea]`
3. **MUESTRA** el fragmento de código inseguro
4. **JUSTIFICA** el riesgo con la referencia OWASP o CWE correspondiente
5. **PROPÓN** la corrección segura con código completo
6. **IMPLEMENTA** la corrección
7. **REGISTRA** como `SEC-XX` en este archivo y en `SECURITY_ARCHITECTURE.md`
8. **CONTINÚA** el pipeline de revisión

---

## Problemas Comunes que Debe Detectar

```javascript
// ❌ INCORRECTO — NoSQL Injection
const docs = await Model.find({ field: req.query.value });

// ✅ CORRECTO
const docs = await Model.find({ field: String(req.query.value) });

// ❌ INCORRECTO — sin validar ObjectId
const doc = await Model.findById(req.params.id);

// ✅ CORRECTO
if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) return res.status(400).json({...});
const doc = await Model.findById(req.params.id);

// ❌ INCORRECTO — credencial en texto plano en BD
await Configuration.create({ key: 'glpi_app_token', value: token });

// ✅ CORRECTO
await Configuration.create({ key: 'glpi_app_token', value: encrypt(token) });

// ❌ INCORRECTO — SSRF sin validación
const url = req.body.glpi_url;
const response = await axios.get(url);

// ✅ CORRECTO
if (!url.startsWith('https://')) throw new Error('URL insegura');
const response = await axios.get(url, { timeout: 10000 });

// ❌ INCORRECTO — comparación de secretos vulnerable a timing attack
if (password === process.env.ADMIN_PASSWORD) { ... }

// ✅ CORRECTO
if (crypto.timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASS))) { ... }
```
