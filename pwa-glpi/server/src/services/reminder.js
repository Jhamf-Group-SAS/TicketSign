import mongoose from 'mongoose';
import glpi from './glpi.js';
import whatsapp from './whatsapp.js';
import Task from '../models/Task.js';
import { memoryTasks } from '../routes/tasks.js';

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
            let allWithReminders = [];

            if (mongoose.connection.readyState === 1) {
                // En producción con DB conectada, solo registramos si hay algo que hacer para no saturar logs
                allWithReminders = await Task.find({ reminder_at: { $exists: true } });
            } else {
                // En local o sin DB, el log es útil para saber que el modo memoria está activo
                console.log(`\n--- [ReminderService] Escaneando Memoria Local (Modo sin DB) [${now.toLocaleTimeString()}] ---`);
                allWithReminders = (memoryTasks || []).filter(t => t.reminder_at);
            }

            if (allWithReminders.length === 0) {
                console.log('  - No hay ninguna tarea con recordatorio programado.');
                return;
            }

            console.log(`  - Total tareas con recordatorio: ${allWithReminders.length}`);

            const tasksToRemind = [];

            for (const task of allWithReminders) {
                const isPast = new Date(task.reminder_at) <= now;
                const notSent = task.reminder_sent !== true;
                const currentStatus = (task.status || '').toUpperCase();
                const activeStatus = !['COMPLETADA', 'CANCELADA'].includes(currentStatus);
                const hasTechs = task.assigned_technicians && task.assigned_technicians.length > 0;

                if (isPast && notSent && activeStatus && hasTechs) {
                    tasksToRemind.push(task);
                    console.log(`  - ✅ Tarea "${task.title}" cumple criterios. AGREGADA.`);
                } else if (isPast) {
                    console.log(`  - ❌ Saltando "${task.title}": Sent=${task.reminder_sent}, Status=${currentStatus}, Techs=${task.assigned_technicians?.length}`);
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
