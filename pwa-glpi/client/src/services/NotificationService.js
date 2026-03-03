import { db } from '../store/db';
import { toast } from '../components/Toast';

class NotificationService {
    constructor() {
        this.pollInterval = null;
        this.reminderInterval = null;
        this.audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        this.lastCheckedReminders = 0;
        this.notifyingSet = new Set(); // Prevent race conditions
    }

    async start() {
        if (this.reminderInterval) return;

        // Cargar audio personalizado si existe
        try {
            const customSound = await db.settings.get('notificationSound');
            if (customSound?.value) {
                this.audio.src = customSound.value;
            } else {
                // Audio por defecto si no hay uno subido por el usuario
                this.audio.src = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
            }
        } catch (e) {
            console.warn('[NotificationService] Error cargando settings de audio:', e);
            // Fallback robusto al default
            this.audio.src = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
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
                await this.notify({
                    title: 'Nueva Tarea Asignada',
                    message: task.title,
                    type: 'TASK',
                    task: task
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
                            await this.notify({
                                title: '🔔 Recordatorio de Tarea',
                                message: `${task.title} - Programada para: ${new Date(task.scheduled_at).toLocaleTimeString()}`,
                                type: 'REMINDER',
                                task: task
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
    async notify({ title, message, type = 'INFO', task = null }) {
        const now = new Date();
        const wantsNotifications = task ? (task.sendWhatsApp !== false) : true;

        // 1. Guardar en Historial de Notificaciones (Siempre se guarda en registro interno)
        await db.notifications.add({
            title,
            message,
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type,
            read: 0,
            createdAt: now.toISOString()
        });

        // Si el usuario desactivó notificaciones para esta tarea, salimos antes de hacer ruido/visuales
        if (!wantsNotifications) return;

        // 2. Ejecutar Sonido
        try {
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

        // 4. Notificación Nativa del Navegador - ELIMINADA por solicitud del usuario
        // Se utilizan únicamente las notificaciones propias del sistema (Toasts + Registro interno)
    }
}

export default new NotificationService();

