import glpi from './glpi.js';
import whatsapp from './whatsapp.js';
import Task from '../models/Task.js';

class ReminderService {
    constructor() {
        this.intervalId = null;
        this.CHECK_INTERVAL = 60000; // Revisar cada minuto
    }

    start() {
        console.log('[ReminderService] Iniciando servicio de recordatorios...');
        // Ejecutar inmediatamente y luego cada intervalo
        this.checkReminders();
        this.intervalId = setInterval(() => this.checkReminders(), this.CHECK_INTERVAL);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[ReminderService] Servicio detenido.');
        }
    }

    async checkReminders() {
        try {
            const now = new Date();
            // Buscar tareas que tengan recordatorio programado
            // que ya haya pasado (o sea ahora)
            // y que NO tengan el flag de reminder_sent
            // y que NO estén completadas o canceladas
            const tasksToRemind = await Task.find({
                reminder_at: { $lte: now },
                reminder_sent: { $ne: true }, // Evita duplicados
                status: { $nin: ['COMPLETADA', 'CANCELADA'] },
                assigned_technicians: { $not: { $size: 0 } } // Que tengan técnicos asignados
            });

            if (tasksToRemind.length > 0) {
                console.log(`[ReminderService] Encontradas ${tasksToRemind.length} tareas para recordar.`);

                // Obtener técnicos una sola vez para eficiencia
                const allTechs = await glpi.getEligibleTechnicians();

                for (const task of tasksToRemind) {
                    await this.sendReminder(task, allTechs);
                }
            }
        } catch (error) {
            console.error('[ReminderService] Error chequeando recordatorios:', error);
        }
    }

    async sendReminder(task, allTechs) {
        try {
            console.log(`[ReminderService] Procesando recordatorio para tarea: ${task.title}`);

            let sentCount = 0;

            for (const techName of task.assigned_technicians) {
                const techData = allTechs.find(t =>
                    (t.fullName || '').toLowerCase() === techName.toLowerCase() ||
                    (t.name || '').toLowerCase() === techName.toLowerCase() ||
                    (t.username || '').toLowerCase() === techName.toLowerCase()
                );

                if (techData && techData.mobile) {
                    const dateObj = new Date(task.scheduled_at);
                    const formattedDate = isNaN(dateObj.getTime()) ? 'Pendiente' : dateObj.toLocaleString('es-CO', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                    });

                    // Modificamos ligeramente el título o descripción para indicar que es un RECORDATORIO
                    await whatsapp.sendTaskNotification(techData.mobile, {
                        techName: techData.fullName || techData.name,
                        title: `🔔 RECORDATORIO: ${task.title}`,
                        description: `[Alerta Programada] ${task.description || ''}`,
                        date: formattedDate
                    });
                    sentCount++;
                }
            }

            // Marcar como enviado para no repetir
            if (sentCount > 0 || task.assigned_technicians.length > 0) {
                task.reminder_sent = true; // Flag local en modelo (debe agregarse al schema si se desea persistencia estricta, o usar un campo existente)
                // Nota: Mongoose permite guardar campos no definidos si strict es false, pero mejor agregarlo al modelo.
                // En este paso asumimos que ya agregamos el campo o que el modelo lo soporta.
                // Si el modelo es estricto, hay que agregar 'reminder_sent' al Schema de Task.js

                // Actualizamos en BD
                await Task.findByIdAndUpdate(task._id, { reminder_sent: true });
                console.log(`[ReminderService] Recordatorio enviado y marcado para tarea ${task._id}`);
            }

        } catch (error) {
            console.error(`[ReminderService] Fallo enviando recordatorio para ${task._id}:`, error);
        }
    }
}

export default new ReminderService();
