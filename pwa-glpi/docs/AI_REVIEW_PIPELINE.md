# AI_REVIEW_PIPELINE.md — TicketSign

> Pipeline de validación obligatorio para cualquier cambio de código, configuración o dependencias.  
> Última revisión: **2026-03-11**

---

## Propósito

Garantizar que **todo cambio** en el proyecto TicketSign pase por un proceso sistemático de revisión antes de ser integrado o desplegado. Este pipeline convierte el proyecto en un entorno **DevSecOps** con control permanente de calidad, seguridad y rendimiento.

---

## Cuándo Aplicar el Pipeline

El pipeline se aplica en **cualquiera** de estos casos:

| Tipo de Cambio | ¿Pipeline Completo? |
|---|---|
| Nuevo endpoint de API | ✅ Sí — etapas 1, 2, 3, 4, 5 |
| Nuevo componente React | ✅ Sí — etapas 1, 3, 4 |
| Modificación de autenticación/autorización | ✅ Sí — **TODAS las etapas** |
| Nueva dependencia | ✅ Sí — etapas 1, 5 obligatorio |
| Cambio de configuración de Helmet / CORS | ✅ Sí — etapa 1 obligatorio |
| Refactorización de servicio | ✅ Sí — etapas 3, 4, 6 |
| Corrección de bug simple | Sí — etapas 1, 3, 4 mínimo |
| Cambio de UI (estilos, layout) | Sí — etapa 4 mínimo |
| Actualización de dependencias | ✅ Sí — etapa 5 obligatorio |

---

## 🔄 PIPELINE DE REVISIÓN

```
┌─────────────────────────────────────────────────────────────┐
│                 CAMBIO PROPUESTO (código/config)            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   ETAPA 1   │
                    │  SECURITY   │◄── Bloqueo inmediato si falla
                    │  GUARDIAN   │
                    └──────┬──────┘
                           │ ✅ APROBADO
                    ┌──────▼──────┐
                    │   ETAPA 2   │
                    │   THREAT    │◄── Bloqueo si nuevo vector sin mitigar
                    │   MODEL     │
                    │  ANALYZER   │
                    └──────┬──────┘
                           │ ✅ APROBADO
                    ┌──────▼──────┐
                    │   ETAPA 3   │
                    │   SENIOR    │◄── Bloqueo si viola SOLID o arquitectura
                    │  ENGINEER   │
                    └──────┬──────┘
                           │ ✅ APROBADO
                    ┌──────▼──────┐
                    │   ETAPA 4   │
                    │    BEST     │◄── Corrección antes de continuar
                    │ PRACTICES   │
                    │  ENFORCER   │
                    └──────┬──────┘
                           │ ✅ APROBADO
                    ┌──────▼──────┐
                    │   ETAPA 5   │
                    │ DEPENDENCY  │◄── Bloqueo si nueva dep con HIGH/CRITICAL
                    │  AUDITOR    │
                    └──────┬──────┘
                           │ ✅ APROBADO
                    ┌──────▼──────┐
                    │   ETAPA 6   │
                    │ PERFORMANCE │◄── Señalar si introduce regresión de perf
                    │  ANALYZER   │
                    └──────┬──────┘
                           │ ✅ APROBADO
                    ┌──────▼──────┐
                    │  CAMBIO     │
                    │ APROBADO ✅  │
                    │  (merge)    │
                    └─────────────┘
```

---

## Definición de Cada Etapa

### ETAPA 1 — SECURITY_GUARDIAN
**Objetivo**: Garantizar que el cambio no introduce ninguna vulnerabilidad de seguridad.

**Skill**: [SECURITY_GUARDIAN.md](.agent/workflows/SECURITY_GUARDIAN.md)

**Criterios de Bloqueo** (el cambio se detiene si):
- Falta `authenticateToken` en endpoint nuevo
- Input de usuario usado directamente en query MongoDB
- Secreto nuevo en código, `.env` o `docker-compose.yml` que debería ir en BD
- `unsafe-eval` re-añadido al CSP
- Path traversal posible en manejo de archivos
- URL externa sin validación de esquema HTTPS en producción

**Criterios de Advertencia** (documentar pero continuar):
- Log que podría exponer información sensible en contextos de debug
- Endpoint de alta sensibilidad sin rate limit propio

---

### ETAPA 2 — THREAT_MODEL_ANALYZER
**Objetivo**: Identificar si el cambio introduce nuevas superficies de ataque.

**Skill**: [THREAT_MODEL_ANALYZER.md](.agent/workflows/THREAT_MODEL_ANALYZER.md)

**Criterios de Bloqueo**:
- Nuevo endpoint que expone datos sin verificar identidad del propietario (IDOR potential)
- Campo `createdBy` o `profile` tomado del `req.body` en lugar de `req.user`
- Nueva URL externa configurable sin validación de SSRF
- Operación destructiva sin verificación de roles

**Criterios de Advertencia**:
- Nuevo endpoint público que podría usarse para fingerprinting
- Operación sin logging de auditoría

**Acción si se detecta amenaza nueva**:
→ Añadir el escenario al `THREAT_MODEL.md` con su mitigación propuesta

---

### ETAPA 3 — SENIOR_ENGINEER
**Objetivo**: Garantizar que el cambio sigue la arquitectura establecida.

**Skill**: [SENIOR_ENGINEER.md](.agent/workflows/SENIOR_ENGINEER.md)

**Criterios de Bloqueo**:
- Lógica de negocio en route handler (>15 líneas de lógica)
- Dependencia circular entre módulos
- Violación grave de SRP (función con múltiples responsabilidades)

**Criterios de Advertencia**:
- Función >50 líneas (sugerir refactorización)
- Duplicación de lógica que ya existe en otro lugar
- Patrón inconsistente con el resto del proyecto

---

### ETAPA 4 — BEST_PRACTICES_ENFORCER
**Objetivo**: Garantizar Clean Code y convenciones del proyecto.

**Skill**: [BEST_PRACTICES_ENFORCER.md](.agent/workflows/BEST_PRACTICES_ENFORCER.md)

**Criterios de Bloqueo**:
- `console.log` con token, contraseña o dato personal
- Código en carpeta incorrecta (ej: lógica de negocio en `utils/`)
- `require()` en lugar de `import/export` (rompe ESM)

**Criterios de Advertencia**:
- Nombre de variable críptico o abreviado
- Log sin prefijo `[Módulo]`
- Comentario que explica el "qué" en lugar del "por qué"
- Magic numbers sin constante nombrada

---

### ETAPA 5 — DEPENDENCY_AUDITOR
**Objetivo**: Garantizar que las dependencias son seguras y actualizadas.

**Skill**: [DEPENDENCY_AUDITOR.md](.agent/workflows/DEPENDENCY_AUDITOR.md)

**Criterios de Bloqueo**:
- Nueva dependencia con vulnerabilidad `high` o `critical` conocida
- Dependencia sin mantenimiento (último commit > 2 años)
- `npm audit` en server muestra nueva vulnerabilidad `high`

**Criterios de Advertencia**:
- Dependencia con >10 sub-dependencias (mayor superficie)
- Versión `latest` o `*` en `package.json`
- `npm audit` en client muestra nueva vulnerabilidad (evaluar contexto)

---

### ETAPA 6 — PERFORMANCE_ANALYZER
**Objetivo**: Garantizar que el cambio no introduce regresiones de rendimiento.

**Skill**: [PERFORMANCE_ANALYZER.md](.agent/workflows/PERFORMANCE_ANALYZER.md)

**Criterios de Bloqueo**:
- Query MongoDB sin `.limit()` en colección que puede crecer >1000 docs
- Puppeteer sin `browser.close()` en `finally`
- Operación síncrona de I/O (`fs.readFileSync`) en request handler

**Criterios de Advertencia**:
- Nueva operación dentro del polling de 60s que no existía antes
- `Promise.all()` sobre un array potencialmente grande sin límite de concurrencia
- Índice MongoDB necesario no definido

---

## Protocolo Si una Etapa Falla

```
1. DETENER el cambio propuesto
   ↓
2. ANUNCIAR la falla con el skill correspondiente:
   "[SKILL_NAME] BLOQUEÓ: [descripción del problema]"
   ↓
3. GENERAR un informe breve:
   - Qué archivo/función está afectado
   - Qué regla o criterio se viola
   - Cuál es el riesgo si se ignora
   ↓
4. PROPONER la corrección con código completo
   ↓
5. IMPLEMENTAR la corrección
   ↓
6. RE-EJECUTAR la etapa que falló
   ↓
7. Si pasa → continuar al siguiente paso del pipeline
   Si falla de nuevo → escalar con documentación del problema
```

---

## Plantilla de Informe de Revisión

Al completar el pipeline, generar una nota tipo:

```
## Revisión Pipeline — [Fecha] — [Descripción del cambio]

| Etapa | Skill | Resultado | Notas |
|---|---|---|---|
| 1 | SECURITY_GUARDIAN | ✅ APROBADO | Sin observaciones |
| 2 | THREAT_MODEL_ANALYZER | ✅ APROBADO | Sin nuevas superficies de ataque |
| 3 | SENIOR_ENGINEER | ⚠️ ADVERTENCIA | Función X tiene 45 líneas — refactorizar en próxima iteración |
| 4 | BEST_PRACTICES_ENFORCER | ✅ APROBADO | Sin observaciones |
| 5 | DEPENDENCY_AUDITOR | ✅ APROBADO | npm audit: 0 vulns en server |
| 6 | PERFORMANCE_ANALYZER | ✅ APROBADO | Sin regresiones |

**Estado final**: ✅ APROBADO CON ADVERTENCIAS
**Deuda técnica registrada**: Refactorizar función X en PERFORMANCE_ANALYZER PERF-06
```

---

## Registro de Revisiones Completadas

| Fecha | Cambio | Resultado | Deuda Técnica |
|---|---|---|---|
| 2026-03-11 | Auditoría v1.0 — Correcciones SEC-01 a SEC-05 | ✅ | Índices MongoDB pendientes |
| 2026-03-11 | Auditoría v2.0 — HSTS, timingSafeEqual, whitelist config | ✅ | SSRF IP privada sin validar (R-06) |
| 2026-03-11 | Separación de skills en módulos independientes | ✅ | Ninguna |

---

## Integración con CI/CD (Recomendación Futura)

Para automatizar el pipeline en GitHub Actions:

```yaml
# .github/workflows/security-review.yml
name: Security & Quality Review

on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # ETAPA 5 — DEPENDENCY_AUDITOR (automatizable)
      - name: npm audit server
        run: cd server && npm audit --audit-level=high
        
      - name: npm audit client
        run: cd client && npm audit --audit-level=high
      
      # ETAPA 1 — SECURITY_GUARDIAN (parcialmente automatizable)
      - name: Secret Scanning
        uses: gitleaks/gitleaks-action@v2
      
      # SAST
      - name: CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          languages: javascript
```
