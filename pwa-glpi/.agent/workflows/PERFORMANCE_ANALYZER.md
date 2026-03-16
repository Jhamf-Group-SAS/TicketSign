---
description: Análisis de rendimiento, optimización de consultas, detección de cuellos de botella y operaciones bloqueantes en TicketSign. Sexta y última etapa del pipeline.
---

# PERFORMANCE_ANALYZER

## Propósito
Identificar y resolver **cuellos de botella de rendimiento** en el proyecto TicketSign, garantizando que la aplicación sea eficiente tanto en operaciones de servidor como en la experiencia de usuario del cliente PWA.

## Responsabilidades
- Detectar cuellos de botella en el servidor (queries lentas, operaciones bloqueantes)
- Optimizar consultas a la base de datos MongoDB
- Revisar uso de memoria (fugas, acumulación innecesaria)
- Revisar operaciones que bloquean el event loop de Node.js
- Analizar el rendimiento de la PWA en el cliente
- Evaluar el impacto de nuevas funcionalidades en el rendimiento general

---

## Contexto de Rendimiento de TicketSign

### Volúmenes Esperados
| Entidad | Volumen Esperado | Frecuencia de Consulta |
|---|---|---|
| Tareas (`tasks`) | ~500-2000 por empresa | Alta (cada 60s por polling) |
| Cotizaciones (`quotations`) | ~100-500 por empresa | Media (on-demand) |
| Actas de mantenimiento (`acts`) | ~2000-10000 histórico | Baja (sincronización) |
| Configuraciones (`configurations`) | ~20 entradas | Alta (cache 60s TTL) |
| Tickets GLPI | ~1500 en cache | Media (al inicio de sesión) |

### Operaciones Críticas de Rendimiento
| Operación | Frecuencia | Costo Actual |
|---|---|---|
| `Task.find(query)` | Cada 60s (polling) | MongoDB query + red |
| `configService.refreshCache()` | Cada 60s (TTL) | MongoDB query + decrypt N veces |
| `glpi.getEligibleTechnicians()` | Por cada recordatorio | HTTP request externo |
| `generateMaintenancePDF()` | On-demand | Puppeteer browser launch |
| `SyncService.syncPendingTasks()` | Cada 60s | HTTP + bulkPut Dexie |

---

## Checklist de Performance

### Base de Datos MongoDB
- [ ] ¿Las queries frecuentes tienen índices definidos en el schema?
- [ ] ¿Se usa `.lean()` cuando solo se necesita leer (no modificar) un documento?
- [ ] ¿Se usa `.select('campo1 campo2')` para traer solo los campos necesarios?
- [ ] ¿Operaciones en bucles usan `bulkWrite()` en lugar de saves individuales?
- [ ] ¿Las queries de búsqueda usan `$regex` con índices o `$text` search cuando sea posible?
- [ ] ¿No hay `.find()` sin límite en colecciones grandes? (usar `.limit(N)`)
- [ ] ¿Las queries de paginación usan cursor-based en lugar de `.skip()` en colecciones grandes?

### Event Loop de Node.js (Operaciones Bloqueantes)
- [ ] ¿No hay operaciones de archivo síncronas (`fs.readFileSync`, `fs.writeFileSync`) en request handlers?
- [ ] ¿Las operaciones de Puppeteer se ejecutan fuera del request-response cycle cuando es posible?
- [ ] ¿El `reminderService` tiene guard contra solapamiento (`if (this.isRunning) return`)?
- [ ] ¿Las notificaciones WhatsApp se envían con `setImmediate()` para no bloquear la respuesta?
- [ ] ¿No hay bucles síncronos sobre arrays grandes en el event loop principal?

### Memoria
- [ ] ¿El cache de `configService` tiene límite de tamaño (`MAX_CACHE_SIZE = 500`)?
- [ ] ¿Los listeners de eventos tienen cleanup (`removeEventListener`) cuando el componente React se desmonta?
- [ ] ¿Las instancias de Puppeteer se cierran correctamente después de generar el PDF?
- [ ] ¿`memoryTasks` en `tasks.js` no crece indefinidamente? (solo para modo sin-DB, temporal)
- [ ] ¿IndexedDB (Dexie) limpia entidades obsoletas? (reconciliación en SyncService)

### PWA Frontend
- [ ] ¿El polling de `SyncService` (60s) no acumula requests pendientes si el anterior no terminó?
- [ ] ¿Los componentes React no re-renderizan en exceso? (usar `useMemo`, `useCallback` donde aplique)
- [ ] ¿Las imágenes/logos del branding tienen tamaño razonable antes de almacenar en BD?
- [ ] ¿El `loginImage` en BD tiene límite de tamaño? (actualmente max 5000 chars, ~3.75KB base64)
- [ ] ¿`db.glpi_tickets.clear()` y `bulkAdd()` en SyncService son eficientes para 1500 tickets?

### Uploads y PDFs
- [ ] ¿El límite de files (20MB) es apropiado para el caso de uso?
- [ ] ¿Los archivos temporales de PDF se eliminan inmediatamente después de usarlos?
- [ ] ¿Los PDFs se generan con un solo launch de Puppeteer por request? (no concurrencia sin control)

---

## Índices MongoDB Recomendados

### Situación Actual
Los schemas de Mongoose no tienen índices explícitos más allá del `_id` y `unique` en algunos campos.

### Índices Recomendados para Añadir (Alta Prioridad si el volumen crece)

```javascript
// En Task.js — consultas frecuentes de listado y filtrado
taskSchema.index({ createdBy: 1, status: 1 });
taskSchema.index({ assigned_technicians: 1, status: 1 });
taskSchema.index({ scheduled_at: 1 });
taskSchema.index({ reminder_sent: 1, reminder_at: 1 }); // Para el ReminderService

// En Quotation.js — consultas de listado con filtros
quotationSchema.index({ createdBy: 1, status: 1 });
quotationSchema.index({ assigned_to: 1, status: 1 });
quotationSchema.index({ createdAt: -1 }); // Para sort por defecto

// En Act.js — sincronización histórica
actSchema.index({ glpi_ticket_id: 1 });
actSchema.index({ createdAt: -1 });
actSchema.index({ technical_name: 1 });
```

> **Nota**: Solo añadir si el volumen supera 1000+ documentos por colección. Los índices tienen costo de escritura.

---

## Optimizaciones Identificadas (Pendientes)

| ID | Área | Descripción | Prioridad | Impacto |
|---|---|---|---|---|
| PERF-01 | Server | `reminderService.getEligibleTechnicians()` hace HTTP a GLPI en cada ciclo (5 min) | Media | Cache resultado por 30min |
| PERF-02 | Server | `configService.refreshCache()` descifra TODOS los valores aunque solo se necesite uno | Baja | Cache por clave individual con TTL |
| PERF-03 | Client | `SyncService.syncPendingTasks()` envía TODAS las tareas locales cada 60s | Alta | Solo enviar modificadas desde último sync |
| PERF-04 | DB | Sin índices en fields de búsqueda frecuente | Media | Añadir índices si volumen > 1000 docs |
| PERF-05 | Client | `db.glpi_tickets.clear()` + `bulkAdd(1500)` cada sync GLPI | Baja | Usar upsert incremental |

---

## Proceso de Acción Correctiva

Si detectas un problema de rendimiento:

1. **ANUNCIA**: `⚡ PERFORMANCE_ANALYZER: [tipo de problema] en [archivo:función]`
2. **CUANTIFICA** el impacto si es posible (tiempo, memoria, frecuencia)
3. **PROPÓN** la optimización con el código corregido
4. Si requiere cambios no triviales, **DOCUMENTAR** en la tabla de optimizaciones con prioridad

---

## Reglas Obligatorias

1. **Nunca** lanzar Puppeteer en un request sin timeout configurado
2. **Siempre** usar `setImmediate()` para notificaciones WhatsApp (no bloquear response)
3. **Siempre** cerrar el browser de Puppeteer en `finally` tras generar PDF
4. **Siempre** poner `.limit(N)` en queries de colecciones que pueden crecer
5. **Nunca** usar `fs.readFileSync/writeFileSync` en request handlers de Express

---

## Problemas Comunes que Debe Detectar

```javascript
// ❌ INCORRECTO — Sin límite en colección grande
const allActs = await Act.find().sort({ createdAt: -1 });

// ✅ CORRECTO
const acts = await Act.find().sort({ createdAt: -1 }).limit(50).lean();

// ❌ INCORRECTO — Save individual en bucle
for (const task of tasks) {
    await Task.findByIdAndUpdate(task._id, task);
}

// ✅ CORRECTO — Bulk operation
const bulkOps = tasks.map(task => ({
    updateOne: { filter: { _id: task._id }, update: task, upsert: false }
}));
await Task.bulkWrite(bulkOps);

// ❌ INCORRECTO — Puppeteer sin cerrar
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setContent(html);
const pdf = await page.pdf();
return pdf; // ← Browser nunca se cierra

// ✅ CORRECTO
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
try {
    const page = await browser.newPage();
    await page.setContent(html);
    return await page.pdf();
} finally {
    await browser.close(); // ← Siempre se cierra
}

// ❌ INCORRECTO — Bloquear el event loop con crypto síncrono en loop
for (const config of configs) {
    config.value = decrypt(config.value); // si son 500 configs, bloquea 500 veces
}

// ✅ CORRECTO — Async parallel con límite de concurrencia
const decrypted = await Promise.all(configs.slice(0, 500).map(c => ({
    ...c, value: decrypt(c.value)
})));
```
