# MEMORY_TICKETSIGN.md
> Archivo de memoria del proyecto TicketSign — Contexto completo para futuras sesiones de trabajo.

---

## 1. Identidad del Proyecto

| Campo | Detalle |
|---|---|
| **Nombre** | TicketSign |
| **Organización** | Jhamf Group SAS — Cali, Colombia |
| **Responsable / Admin** | Cristian Gongora |
| **Repositorio** | `Jhamf-Group-SAS/TicketSign` (GitHub) |
| **URL Producción** | `ticketsign.jhamf.com` |
| **URL Servicio GLPI** | `service.jhamf.com` |

**Propósito:** TicketSign es una Progressive Web App (PWA) que permite a los técnicos de campo de Jhamf Group SAS gestionar actas de mantenimiento de TI (preventivo, correctivo y entrega de equipos) de forma digital, capturando firmas, fotos y observaciones, e integrándolas directamente con el sistema GLPI corporativo.

**Problema que resuelve:** Elimina el papel en el proceso de mantenimiento TI, garantiza evidencia digital firmada, y permite que los técnicos trabajen en campo sin conexión a internet, sincronizando toda la información automáticamente cuando vuelve la red.

**Usuarios objetivo:** Técnicos de campo, especialistas y administradores de mesa de servicio del área TI de Jhamf Group SAS.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Rol Específico |
|---|---|---|
| Frontend Framework | React.js + Vite | SPA con hot-reload y build optimizado |
| Enrutamiento | react-router-dom | Rutas dinámicas estilo GLPI con deep linking |
| Estilos | Tailwind CSS + Glassmorphism | Sistema de diseño premium con temas claro/oscuro |
| Estado Global | React Hooks + Context API | Manejo de vista activa, usuario, tema |
| Estado DB Local | Dexie.js (IndexedDB) + useLiveQuery | Persistencia offline y actualizaciones reactivas |
| PWA | vite-plugin-pwa | Service Workers, caché, instalación en dispositivo |
| Iconos | Lucide React | Íconos SVG consistentes en toda la UI |
| Backend | Node.js + Express | API REST, webhooks, lógica de negocio |
| Base de Datos | MongoDB + Mongoose | Modelos de datos persistentes en la nube |
| Integración GLPI | GLPI API REST (App Token) | Sync tickets, técnicos, entidades, adjuntos |
| Notificaciones | WhatsApp Cloud API (Meta) | Mensajes de asignación y recordatorios |
| PDF | PDFService (Puppeteer) | Generación dinámica de reportes de actas |
| Audio | Notificacion.mp3 | Sonido personalizado para alertas in-app |

---

## 3. Arquitectura y Carpetas

```
pwa-glpi/
├── client/                     # Frontend React + Vite
│   ├── public/
│   │   └── Notificacion.mp3    # Sonido de notificación por defecto
│   └── src/
│       ├── App.jsx             # Orquestador principal: rutas, estado global, layout
│       ├── components/
│       │   ├── Login.jsx               # Autenticación con GLPI
│       │   ├── Sidebar.jsx             # Menú lateral de navegación
│       │   ├── Topbar.jsx              # Barra superior (notificaciones, tema, usuario)
│       │   ├── TaskBoard.jsx           # Calendario mensual con Drag & Drop
│       │   ├── TaskList.jsx            # Vista listado de tareas
│       │   ├── TaskForm.jsx            # Formulario creación/edición de tareas
│       │   ├── MaintenanceForm.jsx     # Formulario de acta (Preventivo/Correctivo/Entrega)
│       │   ├── MaintenancePreview.jsx  # Vista previa del acta antes de guardar
│       │   ├── TicketList.jsx          # Lista de tickets GLPI
│       │   ├── TicketDetail.jsx        # Detalle de un ticket GLPI
│       │   ├── HistoricalActs.jsx      # Historial de actas sincronizadas
│       │   ├── QuotationList.jsx       # Lista de cotizaciones
│       │   ├── QuotationForm.jsx       # Formulario de cotización
│       │   ├── QuotationDetail.jsx     # Detalle de cotización
│       │   ├── DashboardSummary.jsx    # Resumen KPIs del dashboard
│       │   ├── ClientConsolidated.jsx  # Vista consolidada por cliente
│       │   ├── ConfigManager.jsx       # Gestión de configuración local/global
│       │   ├── SyncManager.jsx         # Panel de sincronización manual
│       │   ├── SignaturePad.jsx        # Captura de firma digital
│       │   ├── PhotoCapture.jsx        # Captura de fotos
│       │   ├── CustomDatePicker.jsx    # Selector de fecha/hora premium
│       │   ├── CustomSelect.jsx        # Selector personalizado estilo Glassmorphism
│       │   ├── Toast.jsx               # Sistema de alertas visuales in-app
│       │   ├── TaskBoard.jsx           # Cronograma con drag-and-drop
│       │   └── AutomaticUpdateHandler.jsx # Gestión de actualizaciones PWA
│       ├── services/
│       │   ├── SyncService.js          # Motor de sincronización GLPI ↔ IndexedDB ↔ Server
│       │   └── NotificationService.js  # Motor de alertas: sonido, toasts, recordatorios
│       ├── store/
│       │   └── db.js                   # Esquema Dexie.js (IndexedDB) con todas las tablas
│       └── utils/
│           ├── cn.js                   # Helper clsx para clases condicionales
│           └── holidays.js             # Utilidad para detectar festivos Colombia
│
├── server/                     # Backend Node.js + Express
│   ├── index.js                # Punto de entrada del servidor
│   ├── routes/
│   │   ├── tasks.js            # CRUD y sync de tareas
│   │   ├── acts.js             # CRUD y sync de actas
│   │   ├── glpi.js             # Proxy hacia la API de GLPI
│   │   ├── quotations.js       # CRUD de cotizaciones
│   │   └── config.js           # Configuración pública y privada
│   ├── models/
│   │   ├── Task.js             # Modelo Mongoose de tarea
│   │   ├── Act.js              # Modelo Mongoose de acta
│   │   └── Quotation.js        # Modelo Mongoose de cotización
│   └── services/
│       ├── GLPIConnector.js    # Cliente GLPI API REST
│       ├── ReminderService.js  # Cron de recordatorios
│       ├── WhatsAppService.js  # Integración Meta Cloud API
│       └── PDFService.js       # Generación PDF con Puppeteer
│
├── docs/
│   ├── MEMORY_TICKETSIGN.md    # Este archivo
│   ├── Technical_Documentation.md
│   └── User_Manual.md
├── docker-compose.yml
└── README.md
```

---

## 4. Funcionalidades Implementadas

| Estado | Funcionalidad |
|---|---|
| ✅ | Autenticación con credenciales GLPI |
| ✅ | Dashboard con KPIs de actas y tareas |
| ✅ | Lista de tickets GLPI con detalle |
| ✅ | Formulario de Acta Preventiva |
| ✅ | Formulario de Acta Correctiva |
| ✅ | Formulario de Acta de Entrega de Equipo |
| ✅ | Captura de firma digital (técnico y cliente) |
| ✅ | Captura de fotos de evidencia |
| ✅ | Generación de PDF profesional con Puppeteer |
| ✅ | Adjuntar acta PDF al seguimiento del ticket GLPI |
| ✅ | Historial de actas sincronizadas |
| ✅ | Trabajar sin conexión (Offline-First con Dexie.js) |
| ✅ | Sincronización automática al recuperar red |
| ✅ | Cronograma mensual (TaskBoard con calendario) |
| ✅ | Drag & Drop de tareas entre días del calendario |
| ✅ | Recálculo automático de recordatorio al reprogramar |
| ✅ | Formulario de creación/edición de tareas |
| ✅ | Tareas recurrentes (Diaria, Semanal, Mensual) |
| ✅ | Alertas WhatsApp al asignar técnicos |
| ✅ | Recordatorios WhatsApp antes de ejecución |
| ✅ | Notificaciones in-app con toasts y sonido |
| ✅ | Módulo de Cotizaciones (lista, formulario, detalle) |
| ✅ | Enrutamiento estilo GLPI con deep linking |
| ✅ | Temas claro / oscuro |
| ✅ | Coloreado de días del calendario |
| ✅ | Vista consolidada por cliente |
| ✅ | Panel de sincronización manual |
| ✅ | Instalable como PWA (ícono en pantalla de inicio) |
| ✅ | Actualizaciones automáticas de versión PWA |
| 📋 | (Sin funcionalidades pendientes documentadas actualmente) |

---

## 5. Modelos de Datos

### 5.1 Task (Tarea) — MongoDB + Dexie

```js
{
  // Identificadores
  _id: String,           // ID del servidor MongoDB
  id: Number,            // ID local de Dexie (auto-incremental)

  // Contenido
  title: String,         // Requerido — Título descriptivo de la tarea
  description: String,   // Detalle técnico opcional

  // Clasificación
  type: String,          // 'CORRECTIVO' | 'PREVENTIVO' | 'MEJORA'
  priority: String,      // 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'
  status: String,        // 'PROGRAMADA' | 'ASIGNADA' | 'EN_EJECUCION' | 'CANCELADA' | 'COMPLETADA' | 'VENCIDA'

  // Programación
  scheduled_at: String,  // ISO String — Fecha y hora de ejecución
  recurrence: String,    // 'NINGUNA' | 'DIARIA' | 'SEMANAL' | 'MENSUAL'
  start_date: String,    // ISO String — Inicio del rango de recurrencia
  end_date: String,      // ISO String — Fin del rango de recurrencia

  // Notificaciones
  reminder_at: String,   // ISO String — Fecha y hora del recordatorio
  reminder_sent: Boolean,// Flag — true si la notificación ya fue disparada
  sendWhatsApp: Boolean, // Flag — si el usuario desea notificación WhatsApp

  // Asignación
  assigned_technicians: [String], // Array de nombres de técnicos asignados
  glpi_ticket_id: String,         // Referencia al ticket de GLPI (opcional)
  equipment_service: String,      // Equipo o servicio relacionado

  // Visibilidad y auditoría
  isPrivate: Boolean,    // true = solo visible al creador y asignados
  createdBy: String,     // Username del creador
  createdAt: String,     // ISO String
  updatedAt: String,     // ISO String
}
```

### 5.2 Act (Acta) — MongoDB + Dexie

```js
{
  // Identificadores
  _id: String,           // ID del servidor MongoDB
  id: Number,            // ID local de Dexie (auto-incremental)

  // Referencia GLPI
  glpi_ticket_id: String, // ID del ticket en GLPI

  // Tipo y estado
  type: String,          // 'PREVENTIVO' | 'CORRECTIVO' | 'ENTREGA'
  status: String,        // 'BORRADOR' | 'PENDIENTE_SINCRONIZACION' | 'SINCRONIZADO' | 'ERROR'

  // Partes involucradas
  client_name: String,   // Entidad / cliente del servicio
  technical_name: String,// Técnico que realizó el mantenimiento
  assigned_user: String, // Usuario final del equipo

  // Datos del equipo (para PREVENTIVO/CORRECTIVO)
  equipment_type: String,      // 'COMPUTADOR' | 'IMPRESORA' | 'REDES' | 'PERIFERICO' | 'OTRO'
  equipment_serial: String,
  equipment_hostname: String,
  equipment_model: String,
  equipment_ram: String,
  equipment_disk: String,
  equipment_disk_type: String, // 'SSD' | 'HDD' | 'NVMe'
  equipment_processor: String,
  inventory_number: String,

  // Fecha programada
  scheduled_date: String, // ISO String

  // Checklists (objetos clave-valor booleano)
  checklist: Object,     // Varía según el tipo de acta (preventivo/entrega/correctivo)

  // Narrativo (para CORRECTIVO)
  // Dentro de checklist: { diagnostico, falla_reportada, accion_realizada, repuestos_usados, estado_final }

  // Evidencias
  signatures: {
    technical: String,   // Base64 de la firma del técnico
    client: String       // Base64 de la firma del cliente
  },
  photos: [String],      // Array de imágenes en base64 o URL

  // Texto libre
  observations: String,
  recommendations: String,

  // Auditoría
  createdAt: String,     // ISO String
  updatedAt: String,     // ISO String
}
```

### 5.3 Quotation (Cotización) — MongoDB

```js
{
  _id: String,
  title: String,
  status: String,        // 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
  assigned_to: String,   // Responsable de compras
  items: [Object],       // Líneas de la cotización
  total: Number,
  createdAt: String,
  updatedAt: String,
}
```

### 5.4 IndexedDB — Tablas Dexie (db.js, versión 13)

| Tabla | Índices | Descripción |
|---|---|---|
| `acts` | `++id, _id, glpi_ticket_id, status, type, client_name, technical_name, createdAt, updatedAt` | Actas locales |
| `tasks` | `++id, _id, status, priority, type, scheduled_at, reminder_at, reminder_sent, isPrivate, glpi_ticket_id, createdAt, updatedAt` | Tareas locales |
| `notifications` | `++id, title, message, time, type, read, createdAt` | Historial de alertas in-app |
| `notification_log` | `task_id, sent_at` | Control de recordatorios ya enviados |
| `glpi_entities` | `id, label, entityName` | Caché de entidades GLPI |
| `glpi_technicians` | `id, label, fullName` | Caché de técnicos GLPI |
| `glpi_tickets` | `id, label` | Caché de tickets GLPI |
| `day_settings` | `date, color` | Colores personalizados del calendario |
| `settings` | `key, value` | Configuración general (ej. notificationSound) |
| `sync_logs` | `++id, act_id, task_id, timestamp, status, error` | Log de sincronizaciones |
| `assets_cache` | `++id, serial, hostname, ticket_id` | Caché de activos GLPI |

---

## 6. Flujos Críticos

### 6.1 Flujo Offline → Sincronización con GLPI
```
1. Técnico crea/edita acta o tarea sin conexión.
2. El dato se guarda localmente en IndexedDB (Dexie) con status 'PENDIENTE_SINCRONIZACION'.
3. SyncService.js escucha el evento 'online' del navegador.
4. Al recuperar red, intenta subir los datos pendientes al servidor Express.
5. El servidor autentica con GLPI (initSession), sube el PDF, lo adjunta al ticket.
6. Si tiene éxito, actualiza el status local a 'SINCRONIZADO'.
7. SyncService también corre un pull periódico para descargar cambios del servidor.
8. En el pull, si una tarea local ya no existe en el servidor, se elimina localmente (reconciliación).
```

### 6.2 Flujo Creación de Acta → PDF → Adjunto en Ticket GLPI
```
1. Técnico completa el formulario de mantenimiento (MaintenanceForm.jsx).
2. Captura firma digital del cliente y del técnico (SignaturePad.jsx).
3. Adjunta fotos de evidencia opcionales (PhotoCapture.jsx).
4. Al guardar: se llama a saveDraftAct() → IndexedDB.
5. Al marcar como lista: se llama a markForSync() → status 'PENDIENTE_SINCRONIZACION'.
6. SyncService envía el acta al servidor.
7. El servidor genera el PDF via PDFService (Puppeteer).
8. GLPIConnector.js realiza initSession() para autenticarse en GLPI.
9. Para tickets en entidades diferentes a la principal: se gestiona ActiveEntity dinámicamente.
10. Se sube el PDF como documento (uploadDocument) y se asigna al seguimiento del ticket (addFollowup).
11. El acta local se actualiza a status 'SINCRONIZADO' y queda en historial (HistoricalActs).
```

### 6.3 Flujo Notificación WhatsApp al Asignar Técnico
```
1. Admin/especialista crea una tarea y asigna uno o más técnicos (TaskForm.jsx).
2. Al guardar, si sendWhatsApp !== false y el usuario es el asignado, se llama a NotificationService.notify().
3. El servidor (ReminderService / WhatsAppService) envía mensaje via Meta Cloud API al número del técnico.
4. Control de duplicados: el servidor registra el estado de envío en MongoDB para no repetir el mensaje.
5. En sincronizaciones posteriores del cliente, el flag reminder_sent del servidor toma precedencia.
```

### 6.4 Flujo Reprogramación de Tarea con Recálculo de Recordatorio
```
1. Usuario arrastra una tarea a un nuevo día en TaskBoard (Drag & Drop HTML5).
2. handleDrop() captura el taskId y la nueva fecha destino (date).
3. Se calcula la nueva scheduled_at manteniendo la hora/minutos originales.
4. Se calcula el desplazamiento: diffRem = reminder_at - old_scheduled_at.
5. Se calcula nueva reminder_at = new_scheduled_at + diffRem.
6. Si la nueva reminder_at es en el futuro:
   - reminder_sent = false
   - Se elimina el registro de notification_log para ese taskId
   - Esto permite que el recordatorio vuelva a dispararse.
7. Se actualiza IndexedDB localmente.
8. Si hay conexión y el task tiene _id de servidor, se envía PATCH al servidor.
9. Toast de confirmación: "Tarea reprogramada correctamente".
```

---

## 7. Integraciones Externas

### 7.1 GLPI API REST

| Aspecto | Detalle |
|---|---|
| **Autenticación** | `initSession` con `App-Token` + credenciales de usuario |
| **Tickets** | `GET /Ticket` — lista de tickets asignados al técnico |
| **Técnicos** | `GET /User` — lista completa de usuarios/técnicos |
| **Entidades** | `GET /Entity` — jerarquía de entidades disponibles |
| **Cambio de entidad** | `PUT /changeActiveEntities` para tickets cross-entity |
| **Documentos** | `POST /Document` — sube el PDF del acta |
| **Seguimientos** | `POST /ITILFollowup` — adjunta el documento al ticket |
| **Sesión** | `GET /killSession` al finalizar operaciones |
| **Manejo Cross-Entity** | Para Super-Admin: recursividad + cambio dinámico de ActiveEntity antes de cada operación de escritura |

### 7.2 WhatsApp Cloud API (Meta)

| Aspecto | Detalle |
|---|---|
| **Endpoint** | `https://graph.facebook.com/v17.0/{phone_number_id}/messages` |
| **Autenticación** | Bearer token con API Key de Meta |
| **Eventos de disparo** | (1) Nueva tarea asignada a técnico; (2) Recordatorio de tarea programado |
| **Control de duplicados** | El servidor marca `reminder_sent = true` en MongoDB; el cliente respeta ese flag y no reenvía |
| **Tareas sin notificación** | Si `sendWhatsApp === false` o tarea está `COMPLETADA`/`CANCELADA`, el mensaje no se envía |
| **Recordatorios tardíos** | Si el recordatorio tiene más de 12 horas de retraso, se marca como silencioso (sin mensaje) |

---

## 8. Rutas y Navegación

| URL | Parámetros | Componente / Vista | Descripción |
|---|---|---|---|
| `/front/login` | — | `Login.jsx` | Inicio de sesión |
| `/front/dashboard` | — | `DashboardSummary.jsx` | Pantalla de inicio con KPIs |
| `/front/ticket` | — | `TicketList.jsx` | Lista de tickets GLPI |
| `/front/ticket-form` | `?id=[ID]` | `TicketDetail.jsx` | Detalle de un ticket específico |
| `/front/maintenance-create` | `?type=PREVENTIVO` | `MaintenanceForm.jsx` | Formulario de acta preventiva |
| `/front/maintenance-create` | `?type=CORRECTIVO` | `MaintenanceForm.jsx` | Formulario de acta correctiva |
| `/front/maintenance-create` | `?type=ENTREGA` | `MaintenanceForm.jsx` | Formulario de entrega de equipo |
| `/front/maintenance-form` | `?id=[ID_LOCAL]` | `MaintenancePreview.jsx` | Pre-visualización del acta |
| `/front/historical` | — | `HistoricalActs.jsx` | Historial de actas sincronizadas |
| `/front/kanban` | — | `TaskBoard.jsx` | Cronograma mensual con Drag & Drop |
| `/front/task-list` | — | `TaskList.jsx` | Lista de tareas |
| `/front/quotation` | — | `QuotationList.jsx` | Módulo de cotizaciones |
| `/front/quotation-form` | `?id=[ID]` | `QuotationDetail.jsx` | Detalle de una cotización |
| `/front/consolidated` | — | `ClientConsolidated.jsx` | Vista consolidada por cliente |
| `/front/sync` | — | `SyncManager.jsx` | Panel de sincronización manual |
| `/front/config` | — | `ConfigManager.jsx` | Configuración de la aplicación |

> **Nota técnica**: `App.jsx` usa los mapeos `VIEW_TO_PATH` y `PATH_TO_VIEW` para sincronizar el estado interno `view` con la URL del navegador. La prop `key={view}` en `<MaintenanceForm>` fuerza el re-montado completo al cambiar el tipo de formulario.

---

## 9. Configuración y Variables de Entorno

### Variables del Servidor (`server/.env`)

| Variable | Descripción | Requerida |
|---|---|---|
| `PORT` | Puerto del servidor Express (default: 5001) | ✅ |
| `MONGODB_URI` | Cadena de conexión a MongoDB Atlas o local | ✅ |
| `JWT_SECRET` | Clave secreta para tokens de autenticación | ✅ |
| `GLPI_URL` | URL base de la instancia GLPI (ej. `https://service.jhamf.com`) | ✅ |
| `GLPI_APP_TOKEN` | Token de aplicación (App Token) generado en GLPI | ✅ |
| `GLPI_USER` | Usuario de servicio en GLPI | ✅ |
| `GLPI_PASSWORD` | Contraseña del usuario de servicio en GLPI | ✅ |
| `WHATSAPP_API_KEY` | Bearer token de la Meta Cloud API (WhatsApp) | ✅ |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono en Meta Business | ✅ |
| `NOTIFICATION_SOUND_URL` | URL del sonido de notificación (override del defecto) | ❌ |

### Variables del Cliente (`client/.env`)

| Variable | Descripción | Requerida |
|---|---|---|
| `VITE_API_URL` | URL base del servidor Express (ej. `http://localhost:5001/api`) | ✅ |

---

## 10. Decisiones Técnicas

### ¿Por qué Offline-First con Dexie.js?
Los técnicos trabajan en campo con conectividad inestable. Dexie.js provee un wrapper TypeScript-friendly sobre IndexedDB con soporte a transacciones, queries reactivos (`useLiveQuery`) y esquemas versionados. Garantiza que ninguna acta se pierda aunque el técnico cierre la app o pierda la conexión durante el proceso.

### ¿Por qué estructura de URLs estilo GLPI?
El cliente solicitó que las URLs reflejen el módulo activo para mejorar la trazabilidad (ej. `/front/ticket-form?id=586` en lugar de una ruta genérica). Esto permite compartir enlaces directos a tickets o tareas por chat, y es coherente con el ecosistema GLPI que ya usa el equipo. Se eliminó la extensión `.php` ya que la app es React puro.

### ¿Por qué `key={view}` para re-montado de formularios?
Los formularios de Acta Preventiva, Correctiva y Entrega comparten el mismo componente `MaintenanceForm.jsx` pero tienen checklist y lógica interna completamente distinta. Sin `key={view}`, React reutilizaba el componente y el estado previo contaminaba el nuevo formulario. Usar una `key` diferente por cada variante fuerza un montado limpio garantizando la correcta inicialización del estado.

### ¿Por qué Glassmorphism como sistema de diseño?
Se buscó un diseño premium, moderno y diferente del look estándar de las tools corporativas. El Glassmorphism (transparencias, blur, bordes sutiles) crea una jerarquía visual clara sin depender de colores sólidos pesados. Es compatible con los temas claro/oscuro mediante variables CSS y permite que la aplicación se vea profesional tanto en escritorio como en dispositivos móviles de campo.

---

## 11. Contexto del Entorno

| Dato | Detalle |
|---|---|
| **Organización** | Jhamf Group SAS |
| **Ciudad** | Cali, Colombia (UTC-5) |
| **Administrador** | Cristian Gongora |
| **ITSM** | GLPI (helpdesk corporativo) |
| **Monitoreo** | Zabbix |
| **Networking** | Mikrotik |
| **Cloud** | Microsoft Azure |
| **Containerización** | Docker / docker-compose |
| **Automatización** | N8N (workflows) |
| **Idioma de la UI** | Español |
| **Idioma de código** | Inglés (identificadores) / Español (comentarios y mensajes UI) |

### Convenciones del Proyecto
- Commits siempre en **español**.
- Los IDs de servidor vienen de MongoDB (`_id`); los IDs locales son auto-incrementales de Dexie (`id`).
- Las funciones de sincronización del servidor siempre verifican conectividad con `navigator.onLine` antes de intentar requests.
- Las notificaciones nativas del navegador están **desactivadas** por decisión del cliente — se usan exclusivamente toasts in-app y el sonido personalizado.
- Los perfiles de acceso GLPI relevantes: `Super-Admin`, `Admin-Mesa`, `Especialistas`, `Administrativo`.

---

## 12. Resumen Ejecutivo

TicketSign es una PWA de gestión de mantenimiento TI desarrollada para Jhamf Group SAS (Cali, Colombia), administrada por Cristian Gongora. Permite a técnicos de campo registrar actas de mantenimiento preventivo, correctivo y de entrega de equipos con firma digital y fotos, incluso sin internet (Offline-First con Dexie.js/IndexedDB). Se integra con GLPI para la gestión de tickets y adjunta automáticamente las actas PDF al sistema de helpdesk. Las notificaciones se envían vía WhatsApp Cloud API (Meta). El calendario mensual soporta Drag & Drop para reprogramar tareas, recalculando recordatorios automáticamente. Las rutas siguen la estructura `/front/[modulo]?id=...`, inspirada en GLPI. Stack: React + Vite (frontend), Node.js + Express + MongoDB (backend). Repositorio: `Jhamf-Group-SAS/TicketSign`.

---

> Memoria generada: 2026-03-04 | Proyecto: TicketSign | Org: Jhamf Group SAS | Admin: Cristian Gongora
