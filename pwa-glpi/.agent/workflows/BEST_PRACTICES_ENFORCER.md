---
description: Aplicación de estándares Clean Code, naming conventions, estructura de carpetas y consistencia en el proyecto TicketSign. Cuarta etapa del pipeline de validación.
---

# BEST_PRACTICES_ENFORCER

## Propósito
Garantizar que el código de TicketSign sigue los estándares de **Clean Code**, convenciones de nomenclatura y estructura consistente. Este skill actúa como guardián de la legibilidad y mantenibilidad cotidiana del código.

## Responsabilidades
- Aplicar estándares de Clean Code (nombres, funciones, comentarios)
- Validar naming conventions en todos los archivos
- Validar estructura de carpetas del proyecto
- Garantizar consistencia del estilo de código en todo el proyecto
- Detectar code smells comunes
- Garantizar logging estructurado y útil

---

## Convenciones de TicketSign

### Nomenclatura
| Contexto | Convención | Ejemplo |
|---|---|---|
| Variables / funciones | `camelCase` | `getUserProfile`, `authToken` |
| Constantes | `UPPER_SNAKE_CASE` | `ALLOWED_CONFIG_KEYS`, `MAX_RETRIES` |
| Componentes React | `PascalCase` | `QuotationDetail`, `TaskBoard` |
| Archivos de componentes | `PascalCase.jsx` | `ConfigManager.jsx` |
| Archivos de servicios | `camelCase.js` | `configService.js`, `glpi.js` |
| Archivos de rutas | `camelCase.js` | `quotations.js`, `auth.js` |
| Modelos Mongoose | `PascalCase.js` | `Quotation.js`, `Task.js` |
| Rutas API | `kebab-case` | `/api/quotations`, `/api/glpi/tickets` |
| Colecciones MongoDB | `plural lowercase` (automático Mongoose) | `quotations`, `tasks` |
| IDs de elementos HTML | `kebab-case` | `btn-submit-quotation`, `input-username` |

### Estructura de Imports
```javascript
// 1. Módulos Built-in de Node.js
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

// 2. Dependencias Third-party
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// 3. Módulos locales del proyecto
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import Quotation from '../models/Quotation.js';
import { encrypt } from '../utils/crypto.js';
```

---

## Checklist de Clean Code

### Naming
- [ ] ¿Variables/funciones tienen nombres descriptivos que explican su propósito?
- [ ] ¿No hay abreviaciones crípticas (`q`, `d`, `aux`) excepto en bucles cortos (`i`, `j`)?
- [ ] ¿Los booleanos tienen nombre de predicado (`isAdmin`, `hasPermission`, `shouldSend`)?
- [ ] ¿Las funciones tienen nombre de verbo (`getTickets`, `validateObjectId`, `sendNotification`)?
- [ ] ¿Las constantes exportadas son `UPPER_SNAKE_CASE`?

### Funciones
- [ ] ¿Cada función tiene un único propósito (máximo 1 nivel de abstracción interno)?
- [ ] ¿Las funciones tienen ≤30 líneas? (excepciones documentadas)
- [ ] ¿No hay funciones con más de 4 parámetros? (usar objeto de opciones si hay más)
- [ ] ¿Las funciones async siempre tienen `try/catch`?
- [ ] ¿No hay funciones anónimas largas inline en el JSX? (extraer como función nombrada)

### Comentarios y Documentación
- [ ] ¿El código complejo tiene comentarios que explican el *por qué*, no el *qué*?
- [ ] ¿Los comentarios de auditoría siguen el patrón `// [AUDIT-001]` o `// [SEC-XX]`?
- [ ] ¿No hay código comentado sin explicar por qué está comentado?
- [ ] ¿Las funciones públicas de servicios tienen JSDoc básico?

### Logging Estructurado
```javascript
// ✅ PATRÓN CORRECTO — Prefijo con módulo, nivel apropiado
console.log('[Tasks] GET / request received');
console.warn('[AUTH] Acceso maestro de emergencia usado. IP: 192.168.1.1');
console.error('[Quotations] Error en POST /:', error.message);

// ❌ INCORRECTO — Sin contexto, sin módulo
console.log('request received');
console.log(error);
console.log(token);  // ← JAMÁS loguear tokens/contraseñas
```

- [ ] ¿Todos los `console.log/warn/error` tienen prefijo `[NombreModulo]`?
- [ ] ¿Los logs de error incluyen datos adicionales del contexto (ID, usuario, acción)?
- [ ] ¿No hay `console.log` con tokens, contraseñas, ni datos personales?
- [ ] ¿Los logs de producción no revelan rutas internas del sistema?

### Manejo de Errores
```javascript
// ✅ PATRÓN CORRECTO
try {
    const result = await operation();
    res.json(result);
} catch (error) {
    console.error('[Módulo] Error en operación:', error.message, { contexto: req.params.id });
    res.status(500).json({ message: 'Error interno al procesar la solicitud' });
}

// ❌ INCORRECTO — Exponer detalles internos al cliente
} catch (error) {
    res.status(500).json({ message: error.stack }); // stack trace al cliente
}
```

- [ ] ¿El mensaje al cliente es genérico?
- [ ] ¿El log del servidor tiene el detalle completo del error?
- [ ] ¿Los archivos temporales se limpian en caso de error?
- [ ] ¿Los `Promise.all()` con múltiples operaciones tienen manejo individual de errores?

### Estructura de Archivos
```
server/src/
├── middleware/    ← Solo middleware de Express
├── models/        ← Solo schemas de Mongoose
├── routes/        ← Solo definición de rutas
├── services/      ← Solo lógica de negocio
└── utils/         ← Solo helpers reutilizables

client/src/
├── components/    ← Componentes React (UI)
├── services/      ← Servicios de datos (fetch, sync)
├── store/         ← Estado persistente (IndexedDB)
└── utils/         ← Helpers de UI
```

- [ ] ¿El archivo nuevo está en la carpeta correcta según la estructura?
- [ ] ¿No hay componentes React en `services/`?
- [ ] ¿No hay lógica de negocio en `utils/`?
- [ ] ¿No hay queries de MongoDB en `routes/` cuando existe un `service/` equivalente?

### Consistencia de Código
- [ ] ¿Se usa ESM (`import/export`) exclusivamente? (sin `require/module.exports`)
- [ ] ¿Se usa `async/await` en lugar de `.then()/.catch()` encadenados?
- [ ] ¿Las arrow functions se usan para callbacks y funciones cortas?
- [ ] ¿Las funciones de Express router siguen el patrón: `router.VERB('/path', async (req, res) => { ... })`?

---

## Code Smells — Señales de Alerta

| Smell | Ejemplo | Acción |
|---|---|---|
| Magic Numbers | `if (status === 4)` | Extraer constante: `const STATUS_ASSIGNED = 4` |
| Deep Nesting | 4+ niveles de `if/for` anidados | Extraer funciones, usar early return |
| Long Method | Función >50 líneas | Dividir en sub-funciones |
| God Object | Un archivo que hace todo | Dividir en módulos especializados |
| Shotgun Surgery | Un cambio requiere editar 5+ archivos | Centralizar la responsabilidad |
| Dead Code | Variables o funciones declaradas pero no usadas | Eliminar |
| Console.log en prod | `console.log(token)` | Eliminar o convertir a log estructurado |

---

## Proceso de Acción Correctiva

Si detectas una violación de buenas prácticas:

1. **ANUNCIA**: `📋 BEST_PRACTICES_ENFORCER: [tipo de problema] en [archivo:línea]`
2. **MUESTRA** el código problemático
3. **EXPLICA** por qué viola Clean Code
4. **PROPÓN** el código refactorizado
5. Si el refactor es extenso, **DOCUMENTA** como deuda técnica con prioridad (Alta/Media/Baja)

---

## Problemas Comunes que Debe Detectar

```javascript
// ❌ INCORRECTO — Nombre críptico
const q = await Quotation.findById(id);
const u = req.user;
const isA = u.profile.includes('Admin');

// ✅ CORRECTO
const quotation = await Quotation.findById(id);
const userProfile = req.user.profile;
const isAdmin = userProfile.includes('Admin');

// ❌ INCORRECTO — Magic number sin contexto
if (key.length > 100) continue;
if (value.length > 5000) return badRequest();

// ✅ CORRECTO
const MAX_CONFIG_KEY_LENGTH = 100;
const MAX_CONFIG_VALUE_LENGTH = 5000;
if (key.length > MAX_CONFIG_KEY_LENGTH) continue;

// ❌ INCORRECTO — Import sin orden
import Task from '../models/Task.js';
import express from 'express';
import path from 'path';
import { authenticateToken } from '../middleware/auth.js';

// ✅ CORRECTO
import path from 'path';                                    // built-in
import express from 'express';                              // third-party
import { authenticateToken } from '../middleware/auth.js'; // local
import Task from '../models/Task.js';                       // local model
```
