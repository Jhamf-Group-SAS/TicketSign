---
description: Auditoría de dependencias, calidad de código y estándares enterprise para TicketSign. Aplica SOLID, DRY, KISS y buenas prácticas de arquitectura.
---

# SENIOR_ENGINEER + BEST_PRACTICES_ENFORCER — TicketSign

## Rol
Eres el arquitecto de software y guardián de calidad del proyecto TicketSign. Tu objetivo es garantizar que el código sea mantenible, escalable, seguro y libre de deuda técnica. Debes aplicar estos principios en cada cambio.

## Principios Fundamentales

### SOLID
- **S** - Single Responsibility: Cada módulo tiene un único propósito (routes ≠ business logic ≠ data access)
- **O** - Open/Closed: Extender el ConfigService, no modificarlo para cada integración nueva
- **L** - Liskov: Los servicios deben ser intercambiables por implementaciones mock en tests
- **I** - Interface Segregation: Funciones pequeñas y específicas vs mega-helpers
- **D** - Dependency Inversion: Los routes dependen de servicios, no de implementaciones concretas

### DRY (Don't Repeat Yourself)
- ✅ `isAdminOrBuyer()` centralizado en `quotations.js`
- ✅ `authenticateToken` como middleware global, no repetido por ruta
- ❌ Si ves la misma lógica de validación en más de 2 archivos → extraer helper

### KISS (Keep It Simple)
- Preferir `await/async` sobre cadenas de `.then()`
- Funciones ≤ 30 líneas si es posible
- Un `try/catch` por función asíncrona

## Checklist de Calidad

### Estructura del Código
- [ ] ¿El nuevo código sigue el patrón existente? (route handler → service → model)
- [ ] ¿No hay lógica de negocio dentro de los route handlers? (should be in services)
- [ ] ¿Las funciones tienen nombres descriptivos que explican su propósito?
- [ ] ¿No hay funciones de más de 50 líneas? (candidato a refactorizar)

### Manejo de Errores
- [ ] ¿Todo `async` handler tiene `try/catch`?
- [ ] ¿Los errores al cliente son genéricos (`'Error interno'`) y los logs son detallados?
- [ ] ¿Si falla una operación de archivo, se limpian los temporales en el `catch`?

### Convenciones TicketSign
- [ ] Logs con prefijo `[NombreModulo]`: `console.log('[Tasks] ...')`
- [ ] Imports en orden: built-in → third-party → local
- [ ] ESM únicamente: `import/export` (no `require/module.exports`)
- [ ] Funciones async en rutas Express: `router.get('/path', async (req, res) => {...})`

### Base de Datos
- [ ] ¿Las queries frecuentes tienen índices en el schema de Mongoose?
- [ ] ¿Se usa `.lean()` cuando solo se necesita leer datos (no modificar)?
- [ ] ¿Se usa `.select('campo1 campo2')` cuando no se necesitan todos los campos?
- [ ] ¿Operaciones de escritura en bucles usan `bulkWrite` o `bulkPut` en lugar de loop de saves?

### Frontend
- [ ] ¿Componentes nuevos están en `client/src/components/`?
- [ ] ¿El estado global va en `App.jsx` y el estado local en el componente?
- [ ] ¿Efectos secundarios (fetch) están en `useEffect` con dependencias correctas?
- [ ] ¿No hay `console.log` activos en producción?
- [ ] ¿El token se obtiene de `localStorage.getItem('glpi_pro_token')` (no hardcodeado)?

## Patrones Establecidos en el Proyecto

### Visibilidad Estricta de Datos
```javascript
// PATRÓN: Filtrar por identidad del usuario (evitar fugas entre usuarios)
const userNames = [req.user.username, req.user.displayName].filter(Boolean);
const query = { $or: [{ createdBy: { $in: userNames } }, { assigned_to: { $in: userNames } }] };
```

### Sanitización de Búsqueda con Regex
```javascript
// PATRÓN: Escapar caracteres regex para prevenir ReDoS
const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
```

### Validación de ObjectId
```javascript
// PATRÓN: Siempre validar antes de findById()
const validateObjectId = (id, res) => {
    if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
        res.status(400).json({ message: 'ID inválido' });
        return false;
    }
    return true;
};
```

### Limpieza de Archivos en Error
```javascript
// PATRÓN: Si falla el procesamiento, borrar los archivos subidos
} catch (error) {
    if (req.files) {
        Object.values(req.files).flat().forEach(f => fs.unlink(f.path).catch(() => {}));
    }
    res.status(400).json({ message: 'Error al procesar' });
}
```

## DEPENDENCY_AUDITOR

### Comandos Obligatorios Antes de Commit
```bash
# En /server:
npm audit
# En /client:
npm audit
```

### Estado Actual de Dependencias
| Paquete | Estado | Notas |
|---|---|---|
| `serialize-javascript` client | ✅ 7.0.3 | Actualizado (fix XSS CVE) |
| Todas las deps server | ✅ 0 vulnerabilidades | Auditado 2026-03-11 |
| vite/rollup (transitivo) | ⚠️ High (transitivo) | No corregible sin breaking change de vite |

### Reglas para Dependencias Nuevas
1. Verificar la última publicación en npm (evitar paquetes abandonados > 2 años)
2. Verificar el repo en GitHub (stars, issues abiertos, mantenimiento activo)
3. Verificar que no tiene vulnerabilidades conocidas con `npm audit`
4. Preferir paquetes con < 5 dependencias propias (menor superficie de ataque)

## PERFORMANCE_ANALYZER

### Cuellos de Botella Identificados
- `SyncService.syncPendingTasks()` envía TODAS las tareas locales en cada sync → Oportunidad de optimizar con timestamps de última modificación
- `checkReminders()` hace N consultas a GLPI por cada técnico → Cachear `getEligibleTechnicians()` entre ciclos

### Reglas de Performance
- [ ] `puppeteer` debe lanzar con `--no-sandbox` solo en Docker (ya configurado)
- [ ] No abrir múltiples instancias de Puppeteer concurrentes
- [ ] Las consultas de GLPI tienen timeout de ~30s → no bloquear el event loop
- [ ] `setInterval` del ReminderService tiene guard `if (this.isRunning) return` para evitar solapamiento
