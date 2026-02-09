# Manual de Usuario - PWA Gestión de Mantenimiento

Este manual describe el uso de la aplicación web progresiva (PWA) para la gestión y reporte de mantenimientos preventivos y correctivos.

## 1. Acceso y Primeros Pasos

### 1.1. Inicio de Sesión
1. Abra la aplicación en su navegador o desde el icono instalado en su dispositivo.
2. Ingrese sus credenciales (mismas de GLPI, si está integrado, o locales).
3. Si el login es exitoso, accederá al **Panel Principal**.
   
> **Nota:** La primera vez debe tener conexión a internet para descargar los datos básicos. Posteriormente, podrá iniciar sesión incluso sin internet si "Recordar sesión" está activo.

### 1.2. Interfaz Principal (Dashboard)
El panel principal le muestra:
- **Resumen de Actividades:** Estadísticas rápidas.
- **Navegación Rápida:** Botones para ir a Preventivo, Correctivo, Tareas, etc.
- **Estado de Conexión:** Un indicador (verde/rojo) muestra si está En Línea o Sin Conexión.
- **Menú Lateral/Usuario:** Acceso a perfil, historial y cierre de sesión.

## 2. Gestión de Tareas (Kanban)

En la sección **Tareas** (icono de tablero), verá un flujo de trabajo visual:
- **Columnas:** Programada, Asignada, En Ejecución, Completada.
- **Crear Tarea:** Pulse el botón "+" para agendar un nuevo servicio.
- **Mover Tarea:** Arrastre y suelte las tarjetas para cambiar su estado (o use el menú de opciones).
- **Detalle:** Haga clic en una tarjeta para ver la descripción completa o editarla.

## 3. Realizar un Mantenimiento

Desde el inicio, elija **Preventivo** (Azul) o **Correctivo** (Naranja).

### 3.1. Formulario de Acta
Complete los campos requeridos:
1. **Ticket GLPI:** Número del ticket asociado (si aplica).
2. **Empresa:** Nombre del cliente.
3. **Datos del Equipo:** Serial, Modelo, Hostname (obligatorios).
4. **Checklist:**
   - *Preventivo:* Marque las casillas de limpieza física, lógica, antivirus, etc.
   - *Correctivo:* Describa el diagnóstico, falla y solución aplicada.
5. **Observaciones:** Notas adicionales relevantes.

### 3.2. Evidencias Fotográficas
Use la sección de fotos para:
- Capturar imagen directamente con la cámara.
- Subir imágenes desde la galería.
- *Recomendación:* Tome fotos del antes y después.

### 3.3. Firmas Digitales
Al final del formulario:
- **Firma Técnico:** Su firma como responsable.
- **Firma Cliente:** Solicite al encargado que firme en pantalla para dar conformidad.

### 3.4. Guardar y Sincronizar
- **Botón "Finalizar Acta":** Guarda el reporte.
  - *Con Internet:* Se envía inmediatamente al servidor/GLPI.
  - *Sin Internet:* Se guarda localmente como "Pendiente" y se enviará automáticamente cuando recupere la conexión.

## 4. Historial y Reportes

En la sección **Historial**:
- Verá una lista de todos los servicios realizados.
- **Estados:**
  - 🟢 *Sincronizado:* Ya está en el servidor.
  - 🟡 *Pendiente:* Aún no se ha subido (requiere internet).
- Haga clic en un item para ver el detalle.
- **Descargar PDF:** Si está sincronizado, podrá descargar el acta en formato PDF firmada.

## 5. Funcionamiento Sin Conexión (Offline)

La aplicación está diseñada para trabajar sin internet. Puede:
- Consultar tareas previamente cargadas.
- Crear nuevas actas de mantenimiento.
- Tomar fotos y firmas.

Cuando su dispositivo detecte internet nuevamente, verá un mensaje de "Sincronizando..." y sus datos se actualizarán en el servidor central.
