import { db } from '../store/db';
import { toast } from '../components/Toast';

class NotificationService {
    constructor() {
        this.pollInterval = null;
        this.reminderInterval = null;
        this.audio = new Audio('/Notificacion.mp3');
        this.lastCheckedReminders = 0;
        this.notifyingSet = new Set(); // Prevent race conditions
    }

    async start() {
        if (this.reminderInterval) return;

        // Cargar audio personalizado
        try {
            // Prioridad 1: Backend
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/config/public`);
            if (res.ok) {
                const data = await res.json();
                if (data.notificationSound) {
                    this.audio.src = data.notificationSound;
                    // Actualizar cache
                    db.settings.put({ key: 'notificationSound', value: data.notificationSound }).catch(() => { });
                    console.log('[NotificationService] Iniciando monitoreo sistema...');
                    this.reminderInterval = setInterval(() => this.checkReminders(), 20000);
                    this.checkReminders();
                    return;
                }
            }
        } catch (e) { }

        try {
            // Prioridad 2: Local Cache (fallback)
            const customSound = await db.settings.get('notificationSound');
            if (customSound?.value) {
                this.audio.src = customSound.value;
            } else {
                this.audio.src = '/Notificacion.mp3';
            }
        } catch (e) {
            console.warn('[NotificationService] Error cargando settings de audio:', e);
            this.audio.src = '/Notificacion.mp3';
        }

        console.log('[NotificationService] Iniciando monitoreo sistema...');

        // Monitor local reminders (Fast check)
        this.reminderInterval = setInterval(() => this.checkReminders(), 20000);
        this.checkReminders();
    }

    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        if (this.reminderInterval) {
            clearInterval(this.reminderInterval);
            this.reminderInterval = null;
        }
    }

    /**
     * Procesa una lista de tareas nuevas detectadas por el SyncService para disparar notificaciones
     */
    async handleNewRemoteTasks(newTasks) {
        if (!newTasks || newTasks.length === 0) return;

        const userJson = localStorage.getItem('glpi_pro_user');
        if (!userJson) return;
        const user = JSON.parse(userJson);

        for (const task of newTasks) {
            const isAssignedToMe = (task.assigned_technicians || []).some(tech =>
                tech === user.username || tech === user.name || tech === user.displayName
            );

            if (isAssignedToMe) {
                // Si la tarea se creó hace más de 1 hora, se considera una sincronización de "tareas viejas"
                // No emitimos sonido ni popup para evitar saturar al usuario, pero la registramos.
                const createdDate = new Date(task.createdAt || new Date());
                const isOld = (new Date().getTime() - createdDate.getTime()) > (60 * 60 * 1000);

                await this.notify({
                    title: 'Nueva Tarea Asignada',
                    message: task.title,
                    type: 'TASK',
                    task: task,
                    silent: isOld
                });
            }
        }
    }

    /**
     * Escanea tareas locales buscando recordatorios que deban dispararse AHORA
     */
    async checkReminders() {
        if (this._checkingReminders) return;
        this._checkingReminders = true;

        const now = new Date();
        const userJson = localStorage.getItem('glpi_pro_user');
        if (!userJson) return;
        const user = JSON.parse(userJson);

        try {
            // Buscamos tareas con recordatorio pendiente
            const tasks = await db.tasks
                .filter(t =>
                    t.reminder_at &&
                    new Date(t.reminder_at) <= now &&
                    !['COMPLETADA', 'CANCELADA', 'VENCIDA'].includes(t.status)
                ).toArray();

            // 1.5 Auto-marcar VENCIDAS localmente para feedback inmediato
            const overdueTasks = await db.tasks
                .filter(t =>
                    ['PROGRAMADA', 'ASIGNADA'].includes(t.status) &&
                    t.scheduled_at && new Date(t.scheduled_at) < now
                ).toArray();

            for (const ot of overdueTasks) {
                await db.tasks.update(ot.id, { status: 'VENCIDA' });
                console.log(`[NotificationService] Tarea local ${ot.id} marcada como VENCIDA.`);
            }

            for (const task of tasks) {
                const taskId = task._id || `local_${task.id}`;

                // Verificar si ya notificamos o si estamos en proceso de notificar (lock preventivo)
                if (this.notifyingSet.has(taskId)) continue;

                const alreadyNotified = await db.notification_log.get(taskId);

                if (!alreadyNotified) {
                    const isAssignedToMe = (task.assigned_technicians || []).some(tech =>
                        tech === user.username || tech === user.name || tech === user.displayName
                    );

                    // Solo notificar si el usuario desea recibir notificaciones (sendWhatsApp flag)
                    const wantsNotifications = task.sendWhatsApp !== false;

                    if (isAssignedToMe && wantsNotifications) {
                        this.notifyingSet.add(taskId); // Bloquear
                        try {
                            const reminderDate = new Date(task.reminder_at);
                            // Si el recordatorio fue hace más de 12 horas, lo silenciamos (es atrasado)
                            const isOld = (now.getTime() - reminderDate.getTime()) > (12 * 60 * 60 * 1000);

                            await this.notify({
                                title: '🔔 Recordatorio de Tarea',
                                message: `${task.title} - Programada para: ${new Date(task.scheduled_at).toLocaleTimeString()}`,
                                type: 'REMINDER',
                                task: task,
                                silent: isOld
                            });

                            // Registrar que ya se notificó
                            await db.notification_log.put({
                                task_id: taskId,
                                sent_at: now.toISOString()
                            });
                        } finally {
                            // No liberamos el lock inmediatamente para evitar duplicados en el siguiente loop rápido
                            // Se queda en el Set durante la sesión actual para máxima seguridad
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[NotificationService] Error checkReminders:', error);
        } finally {
            this._checkingReminders = false;
        }
    }

    /**
     * Dispara una notificación inmediata (In-App + Browser + Sound + DB)
     */
    async notify({ title, message, type = 'INFO', task = null, silent = false }) {
        const now = new Date();
        const wantsNotifications = task ? (task.sendWhatsApp !== false) : true;

        // 1. Guardar en Historial de Notificaciones (Siempre se guarda en registro interno de la UI)
        await db.notifications.add({
            title,
            message,
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type,
            read: 0,
            createdAt: now.toISOString()
        });

        // Si el usuario desactivó notificaciones para esta tarea O se solicitó silencio (ej. sync tardío), salimos.
        if (!wantsNotifications || silent) return;

        // 2. Ejecutar Sonido (Dinamico)
        try {
            const customSound = await db.settings.get('notificationSound');
            if (customSound?.value) {
                this.audio.src = customSound.value;
            } else {
                this.audio.src = '/Notificacion.mp3';
            }
            this.audio.currentTime = 0;
            const playPromise = this.audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => { /* Autoplay block */ });
            }
        } catch (e) {
            console.warn('[NotificationService] No sound:', e);
        }

        // 3. Toast Visual (In-App)
        if (type === 'TASK') {
            toast.task('Nueva Tarea Asignada', message, { duration: 8000 });
        } else if (type === 'REMINDER') {
            toast.warning('Recordatorio: ' + message);
        } else {
            toast.info(title + ': ' + message);
        }

        // 4. Notificación Nativa del Navegador (Desactivada a petición para usar solo las propias)
        /*
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification(title, { body: message });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification(title, { body: message });
                    }
                });
            }
        }
        */
    }
}

export default new NotificationService();

