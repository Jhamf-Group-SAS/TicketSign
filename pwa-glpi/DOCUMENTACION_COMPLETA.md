# Documentación Técnica Completa: TicketSign (Gestión de Actas Digitales - GLPI PRO)

## 1. Introducción y Descripción General
**TicketSign** es una Aplicación Web Progresiva (PWA) de nivel empresarial diseñada para digitalizar y optimizar el registro de mantenimientos TI. 
El núcleo de su funcionamiento es la estrategia **Offline-First**, lo cual permite a los técnicos en campo capturar firmas, evidencias fotográficas y datos de mantenimiento sin depender de una conexión a internet, para luego sincronizar de manera automática con el servidor principal.

TicketSign no es un sistema aislado; se integra profundamente de forma bidireccional con **GLPI** (como ITSM) y con la **Cloud API de Meta (WhatsApp)** para el envío de notificaciones y recordatorios.

## 2. Arquitectura del Sistema
El aplicativo sigue una arquitectura de cliente-servidor distribuida en contenedores, orquestada para producción en Docker Swarm/Portainer.

### Diagrama General
1. **Frontend (PWA):** Aplicación React servida estáticamente, pero que se instala en el dispositivo (móvil o desktop) usando Service Workers para acceso offline.
2. **Backend (API REST):** Servidor Node.js que maneja la lógica de negocio, validaciones de seguridad, cifrado de tokens y generación de documentos PDF.
3. **Persistencia de Datos:** MongoDB para el almacenamiento primario de tareas, actas, cotizaciones y configuraciones.
4. **Almacenamiento Local (Cliente):** IndexedDB (mediante Dexie.js) que replica la estructura de MongoDB para trabajar sin red.
5. **Integraciones (Vía API):** 
   - **GLPI:** Para extraer tickets, entidades, técnicos y subir los PDFs firmados.
   - **WhatsApp:** Para la notificación inmediata de tareas asignadas o seguimientos.

## 3. Stack Tecnológico y Dependencias

### Servidor (Backend)
- **Runtime:** Node.js (v18 o superior).
- **Framework Web:** Express.js (^4.18).
- **Base de Datos:** MongoDB (usando `Mongoose` ^8.0 como ODM).
- **Seguridad:**
  - `jsonwebtoken`: Para el manejo de sesiones (JWT).
  - `helmet`: Protección de cabeceras HTTP.
  - `express-rate-limit`: Prevención de ataques de fuerza bruta.
  - Módulo `crypto` nativo: Cifrado AES-256-CBC de credenciales GLPI/WhatsApp en la base de datos.
- **Generación PDF:** `puppeteer` (renderizado Headless Chrome para máxima fidelidad de PDFs).
- **Otros:** `multer` (procesamiento de imágenes/archivos) y `axios` (peticiones REST).

### Cliente (Frontend)
- **Framework de UI:** React (^18.2).
- **Construcción y DevServer:** Vite (^7.3).
- **PWA & Service Worker:** `vite-plugin-pwa`.
- **Almacenamiento Offline:** `dexie` y `dexie-react-hooks`.
- **Estilos e Interfaz:** Tailwind CSS (^3.4) + Lucide React (iconos).
- **Enrutamiento:** React Router DOM (^7.13).

## 4. Estructura del Código Base

```text
pwa-glpi/
├── client/                   # PWA (React + Vite)
│   ├── src/
│   │   ├── components/       # Módulos de la UI (Login, TaskBoard, Quotations, ConfigManager)
│   │   ├── services/         # Lógica de sincronización (SyncService.js, apiInterceptor.js)
│   │   └── store/            # Configuración de Dexie.js (db.js)
│   ├── .env.example          # Plantilla de variables frontend
│   └── package.json
│
├── server/                   # Backend Express
│   ├── src/
│   │   ├── index.js          # Punto de entrada (Express, CORS, Conexión BD)
│   │   ├── middleware/       # Autenticación JWT y Autorización de roles
│   │   ├── models/           # Mongoose schemas (Task, Quotation, Act, Configuration)
│   │   ├── routes/           # Endpoints (/api/tasks, /api/glpi, /api/sync)
│   │   ├── services/         # Lógica de negocio (pdf.js, glpi.js, whatsapp.js, reminder.js)
│   │   └── utils/            # Herramientas (crypto.js)
│   ├── .env.example          # Plantilla de secretos del backend
│   └── package.json
│
├── docs/                     # Memoria del Proyecto, Arquitectura de Seguridad
├── docker-compose.yml        # Archivo de despliegue principal
└── README.md
```

## 5. Lógica de Aplicación y Flujos Críticos

### Flujo de Sincronización (Offline-First)
- **Push (Local a Servidor):** Cuando un técnico firma un acta en un sótano sin señal, Dexie.js guarda el acta con el estado `PENDIENTE_SINCRONIZACION`. Un *listener* de red (o un polling periódico) detecta cuándo vuelve la señal e inyecta la información al backend.
- **Pull (Servidor a Local):** La PWA descarga las tareas asignadas periódicamente. 
- **Resolución de Conflictos:** El servidor es la fuente de verdad. Si una tarea es reasignada, el cliente la remueve localmente en el próximo pull.

### Flujo de Autenticación y Seguridad
TicketSign es altamente seguro (Audit Score: 90/100).
1. Se accede con credenciales de GLPI (o con un usuario maestro de emergencia configurado en el `.env`).
2. El servidor valida en GLPI y devuelve un JWT con una duración estricta de 8 horas.
3. El frontend almacena el JWT en `localStorage`. Todas las rutas protegidas son validadas con `authenticateToken`.
4. El sistema incluye controles **RBAC (Role-Based Access Control)** con roles granulares como: `Super-Admin`, `Admin-Mesa`, `Especialistas`, `Compras`, etc.

### Gestión de Cotizaciones y Tareas
Además de las actas de mantenimiento vinculadas a GLPI, la app gestiona *Tasks* internas y *Cotizaciones*. Estas pasan por estados de aprobación y disparan notificaciones programadas en WhatsApp usando el `ReminderService`.

## 6. Configuración de Variables y Secretos

TicketSign posee un diseño donde las credenciales de terceros (GLPI, WhatsApp) **NO se guardan en archivos .env**. Se configuran de manera segura desde la interfaz (Módulo de Configuración) y se cifran en MongoDB con una llave maestra (Decisión Arquitectónica D-01).

El archivo **`server/.env`** es minimalista pero requiere estrictamente lo siguiente:
```env
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb://mongo:27017/ticketsign
# JWT_SECRET: Hex string de +64 caracteres para firmar los tokens de sesión.
JWT_SECRET=b63c78a0f...
# ENCRYPTION_KEY: Obligatoriamente Hex string EXACTO de 64 caracteres (32 bytes) para cifrar integraciones.
ENCRYPTION_KEY=d7a8f9b...
# Credenciales de emergencia en caso de que GLPI caiga (Opcional pero recomendado)
ADMIN_USER=superadmin
ADMIN_PASSWORD=contrasena_super_segura
```

Para generar claves seguras:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 7. Despliegue en Portainer y Docker Swarm

El proyecto está dockerizado y listo para ser levantado con Traefik como reverse proxy mediante el archivo `docker-compose.yml` de la raíz.

### Paso 1: Prerrequisitos de Red y SSL
El archivo `docker-compose.yml` asume que posees un clúster de Docker Swarm y una red externa llamada `jhamfstack`, además de un proxy **Traefik** configurado (`letsencryptresolver`) para emitir certificados TLS.
Las URLs por defecto son:
- Frontend: `ticketsign.jhamf.com`
- API Backend: `api-ticketsign.jhamf.com`

### Paso 2: Creación del Stack en Portainer
1. Abre tu panel de Portainer y navega a la sección **Stacks** -> **Add stack**.
2. Ponle un nombre al stack, por ejemplo `ticketsign`.
3. Selecciona el método **Web editor** y pega todo el contenido del archivo `docker-compose.yml` que está en la raíz de tu proyecto.
4. En la parte inferior de la ventana de Portainer, en **Environment variables**, ingresa manualmente los secretos descritos anteriormente:
   - `MONGO_URI` (por defecto el YAML ya lo enlaza internamente si no lo pasas)
   - `JWT_SECRET`
   - `ENCRYPTION_KEY`
   - `ADMIN_USER`
   - `ADMIN_PASSWORD`
5. Da clic en **Deploy the stack**.

### Componentes que se Orquestan
1. **ticketsign-server:** Contenedor Node.js. Levanta el backend en el puerto 5000 y crea el volumen persistente `ticketsign_uploads` para resguardar firmas, fotos y PDFs generados.
2. **ticketsign-client:** Contenedor Nginx estático (ghcr.io) que sirve la PWA de React de forma óptima.
3. **mongo:** Contenedor oficial de MongoDB para persistir toda la configuración del negocio. Usa el volumen persistente `ticketsign_data`.

## 8. Pasos Post-Despliegue y Mantenimiento

1. **Configuración Inicial (Obligatoria):**
   Una vez levantado el sistema en Portainer, GLPI no estará enlazado. Debes:
   - Ingresar a la URL del frontend (`https://ticketsign.jhamf.com`).
   - Hacer login utilizando el `ADMIN_USER` y `ADMIN_PASSWORD` declarados en las variables de entorno de Portainer.
   - Ir al módulo **"Configuración"**.
   - Diligenciar la URL de tu GLPI, tu App Token y el User Token.
   - Diligenciar el ID de teléfono de WhatsApp y el Access Token (si posees integraciones).
   - Dar clic en Guardar. El servidor cifrará estas credenciales de inmediato.

2. **Visualización de Logs:**
   Si la sincronización offline falla o los PDFs no se renderizan, dirígete a Portainer -> Stacks -> `ticketsign` -> clic en el servicio `ticketsign-server` -> y revisa los **Logs**. El backend incluye un sistema detallado de logs pre-fijados (ej. `[GLPIService] Error 401...`).

3. **Mantenimiento y DevSecOps:**
   TicketSign cuenta con un pipeline estricto. Toda futura modificación de código debe pasar por auditorías automatizadas de seguridad (.agent/workflows) y ser compilada vía Github Actions hacia el `ghcr.io` antes de que Portainer halle la última actualización. No se debe insertar nunca una credencial directamente al código.
