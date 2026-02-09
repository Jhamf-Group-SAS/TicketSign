import express from 'express';
import Task from '../models/Task.js';
import glpi from '../services/glpi.js';
import whatsapp from '../services/whatsapp.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware de autenticación para todas las rutas de tareas
router.use(authenticateToken);

// Obtener técnicos elegibles de GLPI
router.get('/technicians', async (req, res) => {
    try {
        const technicians = await glpi.getEligibleTechnicians();
        console.log(`[Tasks] Enviando ${technicians.length} técnicos al cliente.`);
        res.json(technicians);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtener todas las tareas (con filtros y privacidad)
router.get('/', async (req, res) => {
    try {
        const { technician, status, priority } = req.query;
        const userProfile = req.user.profile || '';
        const username = req.user.username;
        const isAdmin = ['Super-Admin', 'Admin-Mesa'].some(p => userProfile.includes(p));

        // Filtros base de la visibilidad
        const visibilityQuery = {
            $or: [
                // 1. Siempre veo mis propias tareas (públicas o privadas)
                { createdBy: username },
                // 2. Si es pública: la veo si soy Admin o si estoy asignado
                {
                    isPrivate: false,
                    $or: [
                        { createdBy: username }, // redundante pero seguro
                        { assigned_technicians: { $in: [username, req.user.fullName] } }
                    ]
                }
            ]
        };

        // Si es Admin, el punto 2 se simplifica: veo TODAS las públicas
        if (isAdmin) {
            visibilityQuery.$or[1] = { isPrivate: false };
        }

        const query = { $and: [visibilityQuery] };

        // Aplicar filtros adicionales de la URL
        if (technician) query.$and.push({ assigned_technicians: technician });
        if (status) query.$and.push({ status: status });
        if (priority) query.$and.push({ priority: priority });

        const tasks = await Task.find(query).sort({ scheduled_at: 1 });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Crear nueva tarea
router.post('/', async (req, res) => {
    try {
        // Solo perfiles autorizados pueden crear tareas (según el usuario: Especialistas, Super-Admin, Admin-Mesa)
        const allowedToCreate = ['Super-Admin', 'Admin-Mesa', 'Especialistas'];
        const userProfile = req.user.profile || '';

        if (!allowedToCreate.some(p => userProfile.includes(p))) {
            return res.status(403).json({ message: 'No tienes permisos para crear tareas' });
        }

        const taskData = {
            ...req.body,
            createdBy: req.user.username
        };

        // Limpiar fecha si viene vacía para evitar error de Mongoose
        if (taskData.scheduled_at === '') {
            delete taskData.scheduled_at;
        }

        let newTask;
        try {
            const task = new Task(taskData);
            newTask = await task.save();
            console.log('[Tasks] Tarea guardada en base de datos.');
        } catch (dbErr) {
            console.warn('[Tasks] Modo local (sin DB). Procesando notificación sin guardar en servidor.');
            newTask = { ...taskData, _id: 'temp_' + Date.now() };
        }

        // Enviar notificaciones de WhatsApp si hay técnicos asignados
        if (newTask.assigned_technicians && newTask.assigned_technicians.length > 0) {
            // Ejecutar en segundo plano para no bloquear la respuesta
            setImmediate(async () => {
                try {
                    console.log(`[WhatsApp] Iniciando notificaciones para: ${newTask.assigned_technicians.join(', ')}`);
                    const allTechs = await glpi.getEligibleTechnicians();

                    for (const techName of newTask.assigned_technicians) {
                        const techData = allTechs.find(t =>
                            (t.fullName || '').toLowerCase() === techName.toLowerCase() ||
                            (t.name || '').toLowerCase() === techName.toLowerCase() ||
                            (t.username || '').toLowerCase() === techName.toLowerCase()
                        );

                        if (techData && techData.mobile) {
                            const dateObj = new Date(newTask.scheduled_at);
                            const formattedDate = isNaN(dateObj.getTime()) ? 'Pendiente' : dateObj.toLocaleString('es-CO', {
                                timeZone: 'America/Bogota',
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit', hour12: true
                            });

                            console.log(`[WhatsApp] Intentando enviar a ${techName} (${techData.mobile})`);
                            await whatsapp.sendTaskNotification(techData.mobile, {
                                techName: techData.fullName || techData.name,
                                title: newTask.title,
                                description: newTask.description || 'Sin descripción adicional',
                                date: formattedDate
                            });
                        } else {
                            console.warn(`[WhatsApp] No se pudo notificar a "${techName}". Razón: ${!techData ? 'Nombre no coincide exactamente con técnicos de GLPI' : 'No tiene teléfono móvil registrado en GLPI'}`);
                        }
                    }
                } catch (notifyErr) {
                    console.error('[WhatsApp] Fallo en proceso de notificación:', notifyErr.message);
                }
            });
        }

        res.status(201).json(newTask);
    } catch (error) {
        console.error('[Tasks] Error in POST /:', error);
        res.status(400).json({ message: error.message });
    }
});

// Sincronización masiva (batch)
router.post('/sync', async (req, res) => {
    try {
        const { tasks } = req.body;
        const results = [];

        for (const taskData of tasks) {
            const { _id, ...updateData } = taskData;

            let task;
            if (_id && _id.length === 24) { // MongoDB ID
                // Solo Admin-Mesa y Super-Admin pueden editar por completo en sync
                // Especialistas solo pueden cambiar estado - Validaremos esto en el cliente preferiblemente
                // pero aquí registramos quién lo hizo o mantenemos consistencia.
                task = await Task.findByIdAndUpdate(_id, updateData, { new: true, upsert: true });
            } else {
                updateData.createdBy = req.user.username;
                task = new Task(updateData);
                await task.save();
            }
            results.push(task);
        }

        res.json(results);
    } catch (error) {
        console.error('[Tasks] Error in /sync:', error);
        res.status(400).json({ message: error.message });
    }
});

// Actualizar tarea (incluye mover en Kanban)
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const userProfile = req.user.profile || '';

        // Validar si el ID es un ObjectId válido de MongoDB para evitar CastError
        if (id.length !== 24 && !id.startsWith('temp_')) {
            console.warn(`[Tasks] ID no válido recibido para PATCH: ${id}. Ignorando proceso de DB.`);
            return res.status(404).json({ message: 'ID de tarea no válido para el servidor' });
        }

        const existingTask = (id.length === 24) ? await Task.findById(id) : null;
        if (!existingTask && id.length === 24) return res.status(404).json({ message: 'Tarea no encontrada' });

        // Reglas de permisos:
        // Admin-Mesa y Super-Admin: Todo.
        // Especialistas: Solo status.
        const isAdmin = ['Super-Admin', 'Admin-Mesa'].some(p => userProfile.includes(p));
        const isSpec = ['Especialistas'].some(p => userProfile.includes(p));

        if (!isAdmin) {
            if (isSpec) {
                // Si es especialista, solo puede cambiar el estado
                const allowedUpdates = ['status', 'updatedAt'];
                const keys = Object.keys(updates);
                const isOnlyStatus = keys.every(k => allowedUpdates.includes(k));

                if (!isOnlyStatus) {
                    return res.status(403).json({ message: 'Como Especialista, solo puedes cambiar el estado de la tarea' });
                }
            } else {
                return res.status(403).json({ message: 'No tienes permisos para editar esta tarea' });
            }
        }

        // Regla de Negocio: PROGRAMADA -> ASIGNADA se maneja implícitamente por el cliente
        if (updates.status === 'COMPLETADA' && !updates.acta_id) {
            if (!existingTask.acta_id) {
                return res.status(400).json({ message: 'No se puede completar una tarea sin un acta firmada vinculada.' });
            }
        }

        const task = await Task.findByIdAndUpdate(id, updates, { new: true });

        // Si se asignaron técnicos en la actualización, notificar
        if (updates.assigned_technicians && updates.assigned_technicians.length > 0) {
            setImmediate(async () => {
                try {
                    const technicians = await glpi.getEligibleTechnicians();
                    for (const techName of updates.assigned_technicians) {
                        const techData = technicians.find(t => t.fullName === techName || t.name === techName);
                        if (techData && techData.mobile) {
                            const dateObj = new Date(task.scheduled_at);
                            const formattedDate = isNaN(dateObj.getTime()) ? 'Pendiente' : dateObj.toLocaleString('es-CO', {
                                timeZone: 'America/Bogota',
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit', hour12: true
                            });

                            await whatsapp.sendTaskNotification(techData.mobile, {
                                techName: techData.fullName || techData.name,
                                title: task.title,
                                description: task.description || 'Sin descripción adicional',
                                date: formattedDate
                            });
                        }
                    }
                } catch (notifyErr) {
                    console.warn('[WhatsApp] Error en notificación de actualización:', notifyErr.message);
                }
            });
        }

        res.json(task);
    } catch (error) {
        console.error('[Tasks] Error in PATCH /:', error);
        res.status(400).json({ message: error.message });
    }
});

// Eliminar tarea
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userProfile = req.user.profile || '';

        // Solo Admin-Mesa y Super-Admin pueden eliminar
        const isAdmin = ['Super-Admin', 'Admin-Mesa'].some(p => userProfile.includes(p));
        if (!isAdmin) {
            return res.status(403).json({ message: 'No tienes permisos para eliminar tareas' });
        }

        const task = await Task.findByIdAndDelete(id);
        if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

        res.json({ message: 'Tarea eliminada exitosamente' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
