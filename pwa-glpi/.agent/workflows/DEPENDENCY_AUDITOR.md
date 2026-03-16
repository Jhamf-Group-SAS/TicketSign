---
description: Auditoría de dependencias, detección de paquetes vulnerables o abandonados, y validación de actualizaciones de seguridad en TicketSign. Quinta etapa del pipeline.
---

# DEPENDENCY_AUDITOR

## Propósito
Garantizar que las dependencias del proyecto TicketSign están **actualizadas, seguras y sin vulnerabilidades conocidas**. Ejecutar siempre antes de un merge o deployment, y evaluar cualquier dependencia nueva propuesta.

## Responsabilidades
- Auditar dependencias del proyecto en `server/` y `client/`
- Detectar paquetes con vulnerabilidades publicadas (CVEs)
- Detectar dependencias abandonadas (sin mantenimiento >2 años)
- Sugerir versiones seguras y validar breaking changes
- Validar dependencias transitivas que escapen al `npm audit` estándar
- Evaluar el riesgo de añadir nuevas dependencias

---

## Estado Actual de Dependencias (2026-03-11)

### Server — `0 vulnerabilidades` ✅
```
npm audit: found 0 vulnerabilities
```

### Client — Vulnerabilidades existentes ⚠️
```
serialize-javascript ≤7.0.2  → HIGH (XSS via serialización)
Estado: Actualizado a 7.0.3 en package.json ✅

Vulnerabilidades restantes:
- 4 high (dependencias transitivas de vite/rollup)
- No corregibles sin breaking change de Vite
- Solo afectan entorno de BUILD (no producción en runtime)
- Riesgo clasificado como: BAJO (entorno controlado de CI/CD)
```

---

## Comandos de Auditoría

### Ejecución Básica
```powershell
# En /server:
cd server && npm audit

# En /client:
cd client && npm audit

# Para ver JSON detallado:
npm audit --json | ConvertFrom-Json | Select-Object -ExpandProperty vulnerabilities
```

### Corrección Automática (solo si es seguro)
```powershell
# Aplica solo fixes sin breaking changes:
npm audit fix

# NUNCA ejecutar sin revisar qué cambia:
# npm audit fix --force  ← Puede romper el proyecto
```

### Listar Dependencias Desactualizadas
```powershell
npm outdated
```

---

## Checklist de Auditoría

### Antes de Añadir una Dependencia Nueva
- [ ] ¿El paquete tiene >1000 stars en GitHub?
- [ ] ¿Tiene commits en los últimos 6 meses?
- [ ] ¿Tiene <10 dependencias propias? (menor superficie de ataque)
- [ ] ¿No tiene vulnerabilidades `high` o `critical`? (`npm audit` antes de instalar)
- [ ] ¿Existe alternativa nativa de Node.js que evite añadir la dependencia?
- [ ] ¿La licencia es compatible (MIT, Apache 2.0, ISC)? (no GPL en proyectos comerciales)
- [ ] ¿Se añade en `dependencies` o `devDependencies` según corresponda?

### Antes de un Merge / Deployment
- [ ] ¿`npm audit` en `/server` muestra `0 vulnerabilities`?
- [ ] ¿`npm audit` en `/client` no tiene nuevas `high` o `critical`?
- [ ] ¿Las dependencias `high` existentes están documentadas y evaluadas?
- [ ] ¿No hay dependencias en versión `*` o `latest` en `package.json`?
- [ ] ¿Las versiones de dependencias críticas tienen pin exacto o caret controlado?

### Validación de Dependencias Transitivas
- [ ] ¿El `npm audit` no reporta CVEs en dependencias de `helmet`, `express`, `mongoose`, `jsonwebtoken`?
- [ ] ¿`multer`, `axios`, `puppeteer` están en versiones estables recientes?
- [ ] ¿`serialize-javascript` está en `≥7.0.3` en client?

---

## Dependencias Críticas del Proyecto

### Server — Dependencias de Alta Importancia de Seguridad
| Paquete | Versión Actual | Función | Riesgo si Vulnerable |
|---|---|---|---|
| `express` | ^4.18 | HTTP server | RCE, DoS |
| `jsonwebtoken` | ^9.0 | JWT signing/verify | Auth bypass |
| `mongoose` | ^8.0 | ODM MongoDB | Data injection |
| `helmet` | ^7.1 | HTTP security headers | XSS, clickjacking |
| `express-rate-limit` | ^8.2 | Rate limiting | DoS |
| `multer` | ^2.1 | File uploads | Path traversal |
| `puppeteer` | ^24 | PDF generation | RCE (Chrome sandbox) |
| `axios` | ^1.6 | HTTP client para GLPI | SSRF |
| `dotenv` | ^16 | Env var loader | Config exposure |

### Client — Dependencias de Alta Importancia
| Paquete | Versión Actual | Función | Riesgo si Vulnerable |
|---|---|---|---|
| `dexie` | ^3.2 | IndexedDB ORM | Data corruption |
| `serialize-javascript` | ^7.0.3 | Serialización | XSS (≤7.0.2 vulnerable) |
| `vite` | ^7.3 | Build tool | Supply chain attack |
| `react` | ^18.2 | UI framework | XSS |

---

## Política de Respuesta a Vulnerabilidades

### Severidad CRITICAL
**Tiempo de respuesta**: Inmediato (bloquear deployment)
1. Verificar si hay fix disponible
2. Si hay fix: actualizar y probar en staging
3. Si no hay fix: evaluar workaround o remover dependencia
4. Si no hay alternativa: documentar el riesgo y mitigar con controles adicionales

### Severidad HIGH
**Tiempo de respuesta**: 24-48 horas
1. Evaluar si el vector de ataque aplica al proyecto
2. Si aplica: tratar como CRITICAL
3. Si no aplica (ej: solo build-time): documentar y monitorear

### Severidad MODERATE / LOW
**Tiempo de respuesta**: Próximo ciclo de mantenimiento (sprint/semana)
1. Planificar actualización sin urgencia
2. Incluir en el next `npm update`

---

## Dependencias Evaluadas y Decisiones Tomadas

| Paquete | CVE | Decisión | Fecha | Razón |
|---|---|---|---|---|
| `serialize-javascript` ≤7.0.2 | XSS | ✅ Actualizado a 7.0.3 | 2026-03-11 | Vulnerabilidad en serialización de funciones |
| `vite/rollup` (transitivo) | HIGH | ⚠️ Aceptado temporalmente | 2026-03-11 | Solo afecta build env, no runtime. Sin fix disponible sin breaking change |

---

## Proceso de Acción Correctiva

Si detectas una vulnerabilidad en una dependencia:

1. **ANUNCIA**: `📦 DEPENDENCY_AUDITOR: Vulnerabilidad [severidad] en [paquete@versión]`
2. **MUESTRA** el CVE y el vector de ataque
3. **EVALÚA** si el vector aplica al proyecto TicketSign
4. **PROPÓN** la actualización: `npm install paquete@version --save`
5. **VERIFICA** que la actualización no rompe el proyecto
6. **DOCUMENTAR** en esta tabla de dependencias evaluadas
7. Si debe ACEPTARSE el riesgo, documentar con fecha y razón

---

## Reglas Obligatorias

1. **Nunca** ejecutar `npm audit fix --force` sin revisar el output manualmente
2. **Siempre** instalar dependencias con versión exacta o caret controlado (no `*` ni `latest`)
3. **Siempre** separar `dependencies` de `devDependencies` (lo que va a producción vs. solo build)
4. **Nunca** añadir una dependencia nueva sin pasar el checklist de evaluación
5. **Siempre** ejecutar `npm audit` en AMBOS proyectos (server y client) antes de deployments
