# Documentación Técnica - TicketSign

TicketSign es una aplicación web progresiva (PWA) diseñada para la gestión de actas de mantenimiento y tareas integradas con GLPI. Sigue una estrategia **Offline-First**, permitiendo a los técnicos trabajar sin conexión y sincronizar datos automáticamente cuando se restaura la red.

## 1. Arquitectura del Sistema

El sistema utiliza un stack MERN (MongoDB, Express, React, Node.js) adaptado con almacenamiento local avanzado.

### 1.1 Frontend
- **Framework**: React.js con Vite.
- **Estilos**: Tailwind CSS.
- **Almacenamiento Local**: Dexie.js (Wrapper de IndexedDB) para persistencia offline.
- **PWA**: `vite-plugin-pwa` para gestión de Service Workers y estrategias de caché.
- **Iconos**: Lucide React.
- **Estado**: Hooks de React y `useLiveQuery` de Dexie para actualizaciones en tiempo real.

### 1.2 Backend
- **Framework**: Node.js con Express.
- **Base de Datos**: MongoDB (usando Mongoose).
- **Servicios**:
  - `GLPIConnector`: Maneja la comunicación con la API REST de GLPI.
  - `ReminderService`: Motor de recordatorios programados.
  - `WhatsAppService`: Integración con Meta Cloud API para notificaciones.
  - `PDFService`: Generación dinámica de reportes en PDF.

## 2. Flujo de Sincronización (Offline-First)

El componente central es el `SyncService.js`.

### 2.1 Push (Sincronización hacia el Servidor)
- Al guardar un acta o tarea sin conexión, se marca como `PENDIENTE_SINCRONIZACION`.
- Un listener de red (`online`) dispara el intento de sincronización.
- Se reintenta periódicamente cada 60 segundos si el usuario tiene sesión activa.

### 2.2 Pull (Sincronización hacia el Cliente)
- La aplicación descarga cambios del servidor periódicamente.
- **Reconciliación**: Si una tarea existe localmente pero ya no está en el servidor, se elimina de la base de datos local para mantener la consistencia.

## 3. Integraciones Clave

### 3.1 GLPI
- Sincronización de tickets, técnicos y entidades.
- Cambio dinámico de entidad (Active Entity) según el contexto del ticket.
- Vinculación de documentos (Actas firmadas) directamente a los seguimientos del ticket en GLPI.

### 3.2 WhatsApp Cloud API
- Notificación inmediata al asignar técnicos.
- Recordatorios programados antes de la ejecución de una tarea.
- Control de duplicados: El servidor protege el estado de envío para evitar mensajes repetidos durante las sincronizaciones del cliente.

## 4. Estructura de Datos (Modelos Mongoose)

### 4.1 Task (Tarea)
- `title`, `description`, `status`, `priority`.
- `scheduled_at`: Fecha de ejecución.
- `reminder_at`: Fecha del recordatorio.
- `reminder_sent`: Flag de control para notificaciones.
- `assigned_technicians`: Array de técnicos asignados.

### 4.2 Act (Acta)
- Referencia al ticket de GLPI.
- Datos del cliente y del técnico.
- Firma digital (base64).
- Fotos adjuntas.

## 5. Instalación y Despliegue

### Requisitos
- Node.js >= 18.
- MongoDB Atlas o instancia local.
- App Token de GLPI y API Key de WhatsApp Cloud.

### Comandos
```bash
# Servidor
cd server
npm install
npm start

# Cliente
cd client
npm install
npm run dev
```
