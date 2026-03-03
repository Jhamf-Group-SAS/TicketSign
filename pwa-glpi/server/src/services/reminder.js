import mongoose from 'mongoose';
import glpi from './glpi.js';
import whatsapp from './whatsapp.js';
import Task from '../models/Task.js';
// [A-05] memoryTasks fue privatizado en tasks.js — en prod siempre se usa MongoDB
const memoryTasks = [];

class ReminderService {
    constructor() {
        this.intervalId = null;
        this.CHECK_INTERVAL = 60000; // Revisar cada minuto
        this.isRunning = false;
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
        if (this.isRunning) return;
        this.isRunning = true;
        try {
            const now = new Date();
            let allWithReminders = [];

            if (mongoose.connection.readyState === 1) {
                // 1. MARCAR TAREAS VENCIDAS (automático)
                // Aquellas que estén en estado inicial y ya pasaron su fecha programada
                const result = await Task.updateMany(
                    {
                        status: { $in: ['PROGRAMADA', 'ASIGNADA'] },
                        scheduled_at: { $lt: now }
                    },
                    { $set: { status: 'VENCIDA' } }
                );
                if (result.modifiedCount > 0) {
                    console.log(`[ReminderService] Se marcaron ${result.modifiedCount} tareas como VENCIDAS.`);
                }

                allWithReminders = await Task.find({
                    reminder_at: { $exists: true },
                    status: { $nin: ['COMPLETADA', 'CANCELADA', 'VENCIDA'] }
                });
            } else {
                // Modo Memoria
                (memoryTasks || []).forEach(t => {
                    const sched = new Date(t.scheduled_at);
                    if (['PROGRAMADA', 'ASIGNADA'].includes(t.status) && sched < now) {
                        t.status = 'VENCIDA';
                        console.log(`[ReminderService] Tarea Memoria "${t.title}" marcada como VENCIDA.`);
                    }
                });

                allWithReminders = (memoryTasks || []).filter(t =>
                    t.reminder_at &&
                    !['COMPLETADA', 'CANCELADA', 'VENCIDA'].includes(t.status)
                );
            }

            if (allWithReminders.length === 0) {
                console.log('  - No hay ninguna tarea con recordatorio programado.');
                return;
            }

            console.log(`  - Total tareas con recordatorio: ${allWithReminders.length}`);

            const tasksToRemind = [];

            for (const task of allWithReminders) {
                const reminderDate = new Date(task.reminder_at);
                const isPast = reminderDate <= now;

                // IMPORTANTE: Ventana de expiración de 24 horas.
                // Si el recordatorio es de hace más de 24 horas, ya expiró y no se debe enviar.
                const isExpired = (now - reminderDate) > (24 * 60 * 60 * 1000);

                const notSent = task.reminder_sent !== true;
                const currentStatus = (task.status || '').toUpperCase();

                // Las notificaciones no se deben enviar si el estado es Completada, Cancelada o Vencida
                const activeStatus = !['COMPLETADA', 'CANCELADA', 'VENCIDA'].includes(currentStatus);
                const hasTechs = task.assigned_technicians && task.assigned_technicians.length > 0;

                if (isPast && !isExpired && notSent && activeStatus && hasTechs) {
                    tasksToRemind.push(task);
                    console.log(`  - ✅ Tarea "${task.title}" cumple criterios. AGREGADA.`);
                } else if (isPast) {
                    const reason = isExpired ? 'EXPIRADA (>24h)' :
                        !notSent ? 'YA ENVIADA' :
                            !activeStatus ? `ESTADO INACTIVO (${currentStatus})` :
                                !hasTechs ? 'SIN TECNICOS' : 'DESCONOCIDO';
                    console.log(`  - ❌ Saltando "${task.title}": ${reason}`);
                }
            }

            if (tasksToRemind.length > 0) {
                const allTechs = await glpi.getEligibleTechnicians();
                for (const task of tasksToRemind) {
                    await this.sendReminder(task, allTechs);
                }
                console.log('--- [ReminderService] Escaneo Finalizado ---\n');
            }

        } catch (error) {
            console.error('[ReminderService] Error crítico:', error.message);
        } finally {
            this.isRunning = false;
        }
    }

    async sendReminder(task, allTechs) {
        try {
            console.log(`[ReminderService] Procesando recordatorio para tarea: ${task.title}`);

            let sentCount = 0;

            for (const techName of task.assigned_technicians) {
                const techData = allTechs.find(t => {
                    const searchName = (techName || '').toLowerCase().trim();
                    return (t.fullName || '').toLowerCase().trim() === searchName ||
                        (t.name || '').toLowerCase().trim() === searchName ||
                        (t.username || '').toLowerCase().trim() === searchName;
                });

                if (techData && techData.mobile) {
                    const dateObj = new Date(task.scheduled_at);
                    const formattedDate = isNaN(dateObj.getTime()) ? 'Pendiente' : dateObj.toLocaleString('es-CO', {
                        timeZone: 'America/Bogota',
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                    });

                    // Asegurar código de país 57 si no lo tiene (Colombia)
                    let phone = techData.mobile.replace(/\D/g, '');
                    if (phone.length === 10) phone = '57' + phone;

                    console.log(`[ReminderService] Enviando recordatorio a ${techName} (${phone})`);

                    const sent = await whatsapp.sendTaskNotification(phone, {
                        techName: techData.fullName || techData.name,
                        title: `🔔 RECORDATORIO: ${task.title}`,
                        description: `[Alerta Programada] ${(task.description || '').substring(0, 800)}`,
                        date: formattedDate
                    });

                    if (sent) sentCount++;
                } else {
                    console.warn(`[ReminderService] No se pudo recordar a "${techName}". Razón: ${!techData ? 'Técnico no hallado' : 'Sin móvil registrado'}`);
                }
            }

            // Marcar como enviado para no repetir
            if (sentCount > 0 || task.assigned_technicians.length > 0) {
                task.reminder_sent = true; // Flag local en modelo (debe agregarse al schema si se desea persistencia estricta, o usar un campo existente)
                // Nota: Mongoose permite guardar campos no definidos si strict es false, pero mejor agregarlo al modelo.
                // En este paso asumimos que ya agregamos el campo o que el modelo lo soporta.
                // Si el modelo es estricto, hay que agregar 'reminder_sent' al Schema de Task.js

                // Si es una tarea real de BD (no temporal), actualizar en BD
                const idStr = task._id.toString();
                if (!idStr.startsWith('temp_') && mongoose.connection.readyState === 1) {
                    await Task.findByIdAndUpdate(task._id, { reminder_sent: true });
                    console.log(`[ReminderService] Recordatorio marcado como enviado en BD para ${idStr}`);
                } else {
                    console.log(`[ReminderService] Recordatorio marcado como enviado en MEMORIA para ${idStr}`);
                }
            }

        } catch (error) {
            console.error(`[ReminderService] Fallo enviando recordatorio para ${task._id}:`, error);
        }
    }
}

export default new ReminderService();
