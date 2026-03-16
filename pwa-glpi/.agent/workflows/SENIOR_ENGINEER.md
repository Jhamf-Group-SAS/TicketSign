---
description: Revisión de arquitectura enterprise, principios SOLID, modularidad y mantenibilidad del código TicketSign. Segunda etapa del pipeline de validación.
---

# SENIOR_ENGINEER

## Propósito
Garantizar que el código de TicketSign mantiene una **arquitectura limpia, desacoplada y escalable**. Revisar que los cambios siguen los principios SOLID y no introducen deuda técnica que comprometa el futuro del proyecto.

## Responsabilidades
- Revisar la arquitectura del sistema en cada cambio
- Aplicar y verificar principios SOLID
- Garantizar modularidad entre capas (route → service → model)
- Evitar acoplamiento fuerte entre módulos
- Mejorar la mantenibilidad y legibilidad del código
- Identificar oportunidades de refactorización

---

## Principios SOLID Aplicados al Proyecto

### S — Single Responsibility
> Cada módulo/función tiene **un único motivo para cambiar**

| Capa | Responsabilidad única |
|---|---|
| `routes/*.js` | Parsear request/response, delegar al servicio |
| `services/*.js` | Lógica de negocio (GLPI, WhatsApp, PDF, Config) |
| `models/*.js` | Schema de datos y validaciones de BD |
| `middleware/auth.js` | Validación de token y roles |
| `utils/crypto.js` | Cifrado/descifrado AES-256 |
| `store/db.js` | Esquema IndexedDB y operaciones CRUD locales |

**Señal de violación**: Una ruta que hace query a MongoDB directamente sin pasar por un service.

### O — Open/Closed
> Abierto para extensión, cerrado para modificación

- `configService.js`: Para añadir una nueva integración, se agregan sus claves a `ALLOWED_CONFIG_KEYS` — no se modifica la lógica del servicio.
- `authorizeRoles()`: Acepta cualquier combinación de roles sin modificar el middleware.

**Señal de violación**: Añadir un `if (key === 'nueva_integracion')` dentro de `configService.js`.

### L — Liskov Substitution
> Los servicios deben poder ser reemplazados por mocks en tests

- `glpi.js` y `whatsapp.js` son servicios con interfaz estable.
- Si se añade un test, se puede intercambiar por un mock sin cambiar la ruta.

### I — Interface Segregation
> Funciones pequeñas y específicas vs. mega-helpers

- `isAdminOrBuyer()` separado de `authenticateToken()`
- `validateObjectId()` como helper independiente
- `timingSafeCompare()` separado de la lógica de login

**Señal de violación**: Una función que hace más de una cosa y recibe más de 4 parámetros.

### D — Dependency Inversion
> Depender de abstracciones, no de implementaciones concretas

- Las rutas dependen de `configService.get()`, no de `process.env` directamente.
- Los componentes React consumen datos via props o fetch, no accediendo al `localStorage` directamente (excepto el interceptor).

---

## Checklist de Arquitectura

### Estructura de Capas
- [ ] ¿La nueva ruta delega lógica de negocio a un servicio o helper? (no en el handler)
- [ ] ¿Los servicios no importan módulos de rutas? (no dependencia circular)
- [ ] ¿Los modelos no contienen lógica de negocio más allá de validaciones de schema?
- [ ] ¿Los componentes React son puros (reciben props) o contenedores (gestionan estado)?

### Modularidad
- [ ] ¿La función nueva tiene un único propósito claro?
- [ ] ¿Puede probarse de forma aislada sin depender de estado global?
- [ ] ¿No hay más de 50 líneas por función? (señal de refactorizar)
- [ ] ¿No hay más de 300 líneas por archivo? (señal de dividir módulo)

### Acoplamiento y Cohesión
- [ ] ¿El módulo nuevo no crea dependencias circulares?
- [ ] ¿Los helpers compartidos están en `utils/` (server) o `utils/` (client)?
- [ ] ¿No se repite la misma validación en más de 2 lugares? → Extraer helper
- [ ] ¿Las constantes compartidas están centralizadas? (ej: `ALLOWED_CONFIG_KEYS` en el modelo)

### Manejo de Errores
- [ ] ¿Todo async handler tiene `try/catch`?
- [ ] ¿El `catch` tiene logging detallado para el servidor?
- [ ] ¿El `catch` retorna mensajes genéricos al cliente?
- [ ] ¿Los archivos temporales se limpian en el `catch` si el proceso falla?
- [ ] ¿Los errores de BD se diferencian de errores de negocio en el handling?

### Escalabilidad
- [ ] ¿La nueva funcionalidad puede activarse/desactivarse sin cambiar código? (via config en BD)
- [ ] ¿El patrón es consistente con módulos similares existentes?
- [ ] ¿Si se añade un segundo tenant en el futuro, qué cambiaría? (diseño multi-tenant prep)

---

## Patrones Establecidos en TicketSign

### Route Handler Pattern
```javascript
// PATRÓN CORRECTO: Route delega a servicio
router.get('/resource/:id', async (req, res) => {
    try {
        if (!validateObjectId(req.params.id, res)) return;
        const result = await resourceService.getById(req.params.id, req.user);
        res.json(result);
    } catch (error) {
        console.error('[Resource] Error en GET /:id:', error);
        res.status(500).json({ message: 'Error al obtener el recurso' });
    }
});

// ❌ INCORRECTO: Lógica de negocio en route handler
router.get('/resource/:id', async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (doc.status === 'ACTIVE' && new Date() > doc.expiresAt) {
        doc.status = 'EXPIRED';
        await doc.save();
        // ... 50 líneas más de lógica
    }
});
```

### Visibilidad Estricta de Datos
```javascript
// PATRÓN: Siempre filtrar por identidad del usuario
const userNames = [req.user.username, req.user.displayName].filter(Boolean);
const query = {
    $or: [
        { createdBy: { $in: userNames } },
        { assigned_to: { $in: userNames } }
    ]
};
```

### Helper de Validación de ID
```javascript
// PATRÓN: Centralizado y reutilizable
const validateObjectId = (id, res) => {
    if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
        res.status(400).json({ message: 'ID inválido' });
        return false;
    }
    return true;
};
```

---

## Proceso de Acción Correctiva

Si detectas una violación arquitectónica:

1. **IDENTIFICA** el principio SOLID violado
2. **ANUNCIA**: `🏗️ SENIOR_ENGINEER: [principio] violado en [archivo:línea]`
3. **EXPLICA** el impacto: qué se dificulta a futuro con este diseño
4. **PROPÓN** la refactorización con el patrón correcto
5. **IMPLEMENTA** si el refactor es de bajo riesgo, o documenta como deuda técnica controlada

---

## Problemas Comunes que Debe Detectar

- Lógica de negocio dentro de route handlers (>15 líneas de lógica)
- Queries MongoDB directas en componentes React (deben ir a través de SyncService)
- Importación de `mongoose` o `Model.*` desde una ruta que ya tiene un servicio disponible
- Funciones con más de 5 parámetros (señal de que necesita un objeto de configuración)
- Archivos de más de 400 líneas sin estructura de clases o sub-módulos
- Duplicación de la misma query de MongoDB en más de una ruta
- Estado global mutado directamente sin pasar por un setter centralizado
