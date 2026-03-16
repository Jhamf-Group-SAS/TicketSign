---
description: Identificación de superficies de ataque, vectores de intrusión y escalación de privilegios en TicketSign. Segunda etapa del pipeline de validación, complementa SECURITY_GUARDIAN.
---

# THREAT_MODEL_ANALYZER

## Propósito
Analizar sistemáticamente las **amenazas y vectores de ataque** específicos al proyecto TicketSign, evaluar riesgos de escalación de privilegios y detectar posibles abusos de la API. Genera y mantiene actualizado el `THREAT_MODEL.md`.

## Responsabilidades
- Identificar superficies de ataque en endpoints nuevos o modificados
- Detectar posibles vectores de intrusión
- Evaluar riesgos de escalación de privilegios
- Analizar abuso potencial de APIs (rate abuse, IDOR, mass assignment)
- Mantener actualizado el modelo de amenazas del proyecto
- Proponer mitigaciones para riesgos no cubiertos

---

## Marco de Análisis: STRIDE

Cada cambio debe analizarse contra las 6 categorías STRIDE:

| Categoría | Descripción | Ejemplos en TicketSign |
|---|---|---|
| **S**poofing | Suplantar identidad | Usar token expirado, manipular `req.user`, fake JWT |
| **T**ampering | Modificar datos | Editar tarea de otro usuario, modificar `reminder_sent` |
| **R**epudiation | Negar acciones | Borrar un acta sin log de auditoría |
| **I**nformation Disclosure | Exposición de datos | Error con stack trace, log con token, IDOR |
| **D**enial of Service | Denegación de servicio | Uploads masivos, polling abusivo, body payload enorme |
| **E**levation of Privilege | Escalación de roles | Técnico accediendo a config, bypass de `authorizeRoles` |

---

## Checklist de Análisis de Amenazas

### Por cada Endpoint Nuevo o Modificado:

**Spoofing**
- [ ] ¿Puede un usuario falsificar el `req.user` si el middleware falla?
- [ ] ¿Las rutas de `view/:filename` con token-en-URL pueden ser adivinadas?
- [ ] ¿El endpoint asume confianza en datos del cliente que debería verificar en servidor?

**Tampering**
- [ ] ¿Puede un usuario modificar datos de otro usuario via el endpoint?
- [ ] ¿Los campos `createdBy`, `reminder_sent`, `_id` vienen del cliente y se usan directamente?
- [ ] ¿Un usuario asignado puede cambiar más campos de los permitidos?

**Repudiation**
- [ ] ¿Las operaciones destructivas (DELETE) tienen algún log de auditoría?
- [ ] ¿Se registra quién cambió el estado de una cotización?

**Information Disclosure**
- [ ] ¿El endpoint devuelve más datos de los necesarios? (usar `.select()`)
- [ ] ¿Los errores revelan rutas, versiones o detalles del stack?
- [ ] ¿Los tokens o secretos pueden filtrarse en los logs?
- [ ] ¿Puede un usuario inferir la existencia de datos de otro usuario ("user enumeration")?

**Denial of Service**
- [ ] ¿Hay un límite de tamaño en el body (`express.json({ limit: '1mb' })`)?
- [ ] ¿Los uploads tienen límite de tamaño y tipo?
- [ ] ¿Las operaciones de Puppeteer tienen timeout para evitar hanging indefinido?
- [ ] ¿El endpoint tiene rate limiting apropiado?

**Elevation of Privilege**
- [ ] ¿El endpoint verifica explícitamente el rol antes de operaciones sensibles?
- [ ] ¿Los parámetros de rol (`req.user.profile`) vienen del JWT (server-signed) y no del body?
- [ ] ¿Un usuario con rol inferior puede forzar un cambio que solo debería hacer un Admin?

---

## Superficies de Ataque del Proyecto

### Endpoints Públicos (Sin Autenticación)
| Endpoint | Superficie | Mitigación |
|---|---|---|
| `POST /api/auth/login` | Brute force, credential stuffing, timing attack | Rate limit 10/15min, timingSafeEqual |
| `GET /api/config/public` | Info disclosure mínima (loginImage, theme) | Solo devuelve campos no sensibles |
| `GET /health` | Fingerprinting, DoS | Solo devuelve status: 'ok' y timestamp |

### Endpoints con Token en URL (Excepción Documentada)
| Endpoint | Riesgo | Mitigación |
|---|---|---|
| `GET /api/quotations/view/:filename?token=` | Token en logs de servidor/proxy | Solo en rutas view/, path sanitizado, boundary check |

### Endpoints de Alta Sensibilidad
| Endpoint | Amenaza Principal | Mitigación |
|---|---|---|
| `POST /api/config` | Mass assignment de claves arbitrarias | ALLOWED_CONFIG_KEYS whitelist |
| `DELETE /api/quotations/:id` | IDOR, eliminación no autorizada | authorizeRoles('Super-Admin', 'Admin-Mesa') |
| `POST /api/reports/consolidated` | SSRF via GLPI uploadDocument | URL GLPI validada en BD, https-only en prod |
| `POST /api/sync/maintenance` | Payload enorme (PDF data), DoS | json limit 1MB, multer 20MB |

---

## Proceso de Acción Correctiva

Si detectas una amenaza no mitigada:

1. **CLASIFICA** con STRIDE: `🎯 THREAT_MODEL_ANALYZER: [STRIDE categoría] en [endpoint]`
2. **DESCRIBE** el vector de ataque concreto (paso a paso cómo se explotaría)
3. **EVALÚA** probabilidad (Alta/Media/Baja) e impacto (Crítico/Alto/Medio/Bajo)
4. **PROPÓN** la mitigación con código o configuración
5. **ACTUALIZA** el `THREAT_MODEL.md` con el nuevo escenario y su resolución

---

## Reglas Obligatorias

1. **Siempre** analizar con STRIDE cualquier endpoint nuevo
2. **Nunca** confiar en datos que vienen del cliente para decisiones de autorización
3. **Siempre** verificar que campos como `createdBy` se establecen desde `req.user` en servidor, no del `req.body`
4. **Nunca** exponeer si un recurso existe o no a usuarios no autorizados (usar 404 en lugar de 403)
5. **Siempre** actualizar `THREAT_MODEL.md` cuando se añade una superficie de ataque nueva

---

## Problemas Comunes que Debe Detectar

```javascript
// ❌ INCORRECTO — createdBy viene del cliente (TAMPERING)
const quotation = new Quotation({
    ...req.body, // req.body podría tener createdBy: 'admin'
});

// ✅ CORRECTO — createdBy siempre del token JWT
const quotation = new Quotation({
    ...req.body,
    createdBy: req.user.username // Imposible de falsificar desde el cliente
});

// ❌ INCORRECTO — 403 revela existencia del recurso (INFORMATION DISCLOSURE)
const doc = await Model.findById(id);
if (!doc) return res.status(404).json({ message: 'No encontrado' });
if (doc.createdBy !== req.user.username) return res.status(403).json({ message: 'Sin permiso' });

// ✅ CORRECTO — 404 en ambos casos para no revelar existencia
const doc = await Model.findOne({ _id: id, createdBy: req.user.username });
if (!doc) return res.status(404).json({ message: 'No encontrado' });

// ❌ INCORRECTO — Rol tomado del body (ELEVATION OF PRIVILEGE)
const token = jwt.sign({ username, profile: req.body.profile }, secret);

// ✅ CORRECTO — Rol tomado de la fuente autorizada (GLPI)
const token = jwt.sign({ username, profile: glpiActiveProfile }, secret);
```
