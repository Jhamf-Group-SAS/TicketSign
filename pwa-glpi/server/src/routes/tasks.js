import express from 'express';
import mongoose from 'mongoose';
import Task from '../models/Task.js';
import glpi from '../services/glpi.js';
import whatsapp from '../services/whatsapp.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Almacén temporal para pruebas en local sin DB
export const memoryTasks = [];

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
        console.log('[Tasks] GET / request received');
        const { technician, status, priority } = req.query;

        if (!req.user) {
            console.warn('[Tasks] No user in request');
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        console.log('[Tasks] User Authenticated:', JSON.stringify(req.user));

        const username = req.user.username || '';
        const userProfile = req.user.profile || '';
        // Normalizamos roles para comparación case-insensitive
        const isAdmin = ['super-admin', 'admin-mesa', 'admin'].some(role =>
            userProfile.toLowerCase().includes(role)
        );

        if (!username) {
            console.warn('[Tasks] Username is missing in token payload');
            // If username defines identity, we can't proceed safely for filters
            return res.status(400).json({ message: 'Token de usuario incompleto (falta username)' });
        }

        // Construir condiciones de visibilidad:
        // 1. Cualquier usuario autenticado ve las tareas PÚBLICAS (isPrivate: false).
        // 2. Un usuario ve sus propias tareas (createdBy).
        // 3. Un usuario ve las tareas donde está ASIGNADO (por username o nombre completo).

        const myIdentifiers = [username, req.user.displayName].filter(Boolean);

        const visibilityConditions = [
            { isPrivate: { $ne: true } }, // Tareas públicas
            { createdBy: username },      // Creadas por mí
            { assigned_technicians: { $in: myIdentifiers } } // Asignadas a mí (username o nombre completo)
        ];

        // Especial: Los Admins pueden ver todo lo no privado (ya está en la condición 1)
        // Si quisiéramos que los admins vean TODO incluso lo privado de otros, lo añadiríamos aquí.
        // Pero seguimos la regla del usuario: Privado es SOLO para creador y asignados.

        const query = {
            $and: [
                { $or: visibilityConditions }
            ]
        };

        // Aplicar filtros opcionales
        if (technician) {
            query.$and.push({ assigned_technicians: technician });
        }
        if (status) {
            query.$and.push({ status: status });
        }
        if (priority) {
            query.$and.push({ priority: priority });
        }

        console.log(`[Tasks] Querying DB. Username: ${username}, Admin: ${isAdmin}`);

        // CHECK DB CONNECTION STATUS
        // Avoid hanging on buffer if DB is down
        if (mongoose.connection.readyState !== 1) {
            console.warn('[Tasks] MongoDB is not connected (readyState !== 1). Returning empty task list.');
            return res.json([]);
        }

        const tasks = await Task.find(query).sort({ scheduled_at: 1 });
        console.log(`[Tasks] Found ${tasks.length} tasks`);
        res.json(tasks);
    } catch (error) {
        console.error('[Tasks] Error in GET handler:', error);
        res.status(500).json({
            message: 'Error interno del servidor al obtener tareas',
            details: error.message
        });
    }
});

// Crear nueva tarea
router.post('/', async (req, res) => {
    try {
        // Solo perfiles autorizados pueden crear tareas (según el usuario: Especialistas, Super-Admin, Admin-Mesa)
        const allowedToCreate = ['Super-Admin', 'Admin-Mesa', 'Especialistas', 'Admin', 'Administrativo'];
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
            console.warn('[Tasks] Modo local (sin DB). Guardando en memoria para pruebas de recordatorios.');
            newTask = { ...taskData, _id: 'temp_' + Date.now() };
            memoryTasks.push(newTask); // GUARDAR EN MEMORIA LOCAL
        }

        // NOTIFICACIÓN WHATSAPP
        const shouldSend = req.body.sendWhatsApp !== false && req.body.sendWhatsApp !== 'false';
        console.log(`[Tasks] Verificando envío de WhatsApp: Technicians: ${newTask.assigned_technicians?.length}, shouldSend: ${shouldSend}`);

        if (shouldSend && newTask.assigned_technicians && newTask.assigned_technicians.length > 0) {
            setImmediate(async () => {
                try {
                    console.log(`[WhatsApp] Obteniendo lista de técnicos desde GLPI...`);
                    const allTechs = await glpi.getEligibleTechnicians();

                    for (const techName of newTask.assigned_technicians) {
                        const n = (techName || '').toLowerCase().trim();
                        const techData = allTechs.find(t =>
                            (t.fullName || '').toLowerCase().trim() === n ||
                            (t.name || '').toLowerCase().trim() === n ||
                            (t.username || '').toLowerCase().trim() === n
                        );

                        if (techData && techData.mobile) {
                            let phone = techData.mobile.replace(/\D/g, '');
                            if (phone.length === 10) phone = '57' + phone;

                            const dateObj = new Date(newTask.scheduled_at);
                            const formattedDate = isNaN(dateObj.getTime()) ? 'Pendiente' : dateObj.toLocaleString('es-CO');

                            console.log(`[WhatsApp] Intentando enviar mensaje a ${techName} (${phone})`);
                            const result = await whatsapp.sendTaskNotification(phone, {
                                techName: techData.fullName || techData.name,
                                title: newTask.title,
                                description: (newTask.description || 'Sin descripción adicional').substring(0, 500),
                                date: formattedDate
                            });
                            console.log(`[WhatsApp] Resultado del envío a ${techName}: ${result ? 'EXITOSO' : 'FALLIDO'}`);
                        } else {
                            console.warn(`[WhatsApp] Saltando a ${techName}: ${!techData ? 'No coincide en GLPI' : 'No tiene celular'}`);
                        }
                    }
                } catch (err) {
                    console.error('[WhatsApp] Error crítico en el flujo de notificación:', err.message);
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

            let task = null;
            try {
                if (_id && _id.length === 24) { // MongoDB ID
                    task = await Task.findByIdAndUpdate(_id, updateData, { new: true, upsert: false });
                } else if (_id && _id.startsWith('temp_')) {
                    // Actualizar en memoria
                    const index = memoryTasks.findIndex(t => t._id === _id);
                    if (index !== -1) {
                        memoryTasks[index] = { ...memoryTasks[index], ...updateData };
                        task = memoryTasks[index];
                        console.log(`[Sync] Tarea en MEMORIA actualizada: ${_id}`);
                    }
                } else {
                    // Crear nueva (intento DB)
                    updateData.createdBy = req.user.username;
                    task = new Task(updateData);
                    await task.save();
                }
            } catch (err) {
                console.warn(`[Sync] Error en DB para ${_id || 'nueva'}. Usando memoria: ${err.message}`);
                if (!task) {
                    const newId = _id || 'temp_' + Date.now();
                    task = { ...updateData, _id: newId, createdBy: req.user.username };
                    // Evitar duplicados en memoria
                    const existingIdx = memoryTasks.findIndex(t => t._id === newId);
                    if (existingIdx !== -1) memoryTasks[existingIdx] = task;
                    else memoryTasks.push(task);
                }
            }
            if (task) results.push(task);
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

        let existingTask = null;
        if (id.length === 24) {
            existingTask = await Task.findById(id);
            if (!existingTask) return res.status(404).json({ message: 'Tarea no encontrada' });
        } else if (id.startsWith('temp_')) {
            existingTask = memoryTasks.find(t => t._id === id);
            if (!existingTask) return res.status(404).json({ message: 'Tarea en memoria no encontrada' });
        } else {
            return res.status(404).json({ message: 'ID de tarea no válido' });
        }

        // Reglas de permisos:
        // Admin-Mesa y Super-Admin: Todo.
        // Creador: Todo.
        // Asignado: Solo status y updatedAt.
        const isAdmin = ['Super-Admin', 'Admin-Mesa'].some(p => userProfile.includes(p));
        const isCreator = existingTask && existingTask.createdBy === req.user.username;

        // Verificar si el usuario está asignado (buscando por username o nombre completo/displayName)
        const isAssigned = (existingTask.assigned_technicians || []).some(tech =>
            tech === req.user.username || tech === req.user.displayName
        );

        if (!isAdmin && !isCreator) {
            if (isAssigned) {
                // Si es asignado pero no creador, solo puede cambiar el estado
                const allowedUpdates = ['status', 'updatedAt'];
                const keys = Object.keys(updates);
                const isOnlyStatus = keys.every(k => allowedUpdates.includes(k));

                if (!isOnlyStatus) {
                    return res.status(403).json({ message: 'Como usuario asignado, solo puedes cambiar el estado de la tarea' });
                }
            } else {
                return res.status(403).json({ message: 'No tienes permisos para editar esta tarea' });
            }
        }

        // Cancelar recordatorios si la tarea se marca como completada o cancelada
        if (updates.status === 'COMPLETADA' || updates.status === 'CANCELADA') {
            updates.reminder_sent = true; // Marcar como enviado para que no se dispare el recordatorio
        }

        const task = (id.startsWith('temp_'))
            ? null
            : await Task.findByIdAndUpdate(id, updates, { new: true });

        // Si estamos en modo memoria (sin DB)
        if (id.startsWith('temp_')) {
            const index = memoryTasks.findIndex(t => t._id === id);
            if (index !== -1) {
                memoryTasks[index] = { ...memoryTasks[index], ...updates };
                console.log(`[Tasks] Tarea en MEMORIA actualizada: ${id} (Status: ${updates.status})`);
            }
        }

        // Solo notificar si se agregaron técnicos nuevos que no estaban antes
        const oldTechs = existingTask ? (existingTask.assigned_technicians || []) : [];
        const newTechs = updates.assigned_technicians || [];

        // Determinar quiénes son realmente nuevos
        const trulyNewTechs = newTechs.filter(t => !oldTechs.includes(t));

        if (trulyNewTechs.length > 0) {
            setImmediate(async () => {
                try {
                    console.log(`[WhatsApp] Notificando a ${trulyNewTechs.length} técnicos nuevos asignados.`);
                    const technicians = await glpi.getEligibleTechnicians();
                    for (const techName of trulyNewTechs) {
                        const techData = technicians.find(t =>
                            (t.fullName || '').toLowerCase().trim() === (techName || '').toLowerCase().trim() ||
                            (t.name || '').toLowerCase().trim() === (techName || '').toLowerCase().trim()
                        );
                        if (techData && techData.mobile) {
                            const dateObj = new Date(task ? task.scheduled_at : existingTask.scheduled_at);
                            const formattedDate = isNaN(dateObj.getTime()) ? 'Pendiente' : dateObj.toLocaleString('es-CO', {
                                timeZone: 'America/Bogota',
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit', hour12: true
                            });

                            await whatsapp.sendTaskNotification(techData.mobile, {
                                techName: techData.fullName || techData.name,
                                title: updates.title || (task ? task.title : existingTask.title),
                                description: updates.description || (task ? task.description : existingTask.description) || 'Sin descripción adicional',
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
        console.error(`[Tasks] Error crítico en PATCH /${req.params.id}:`, {
            mensaje: error.message,
            stack: error.stack,
            body: req.body
        });
        res.status(400).json({
            message: 'Error al actualizar la tarea',
            details: error.message
        });
    }
});

// Eliminar tarea
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userProfile = req.user.profile || '';

        // Buscar tarea para verificar dueño
        const existingTask = (id.length === 24) ? await Task.findById(id) : null;
        if (!existingTask && id.length === 24) return res.status(404).json({ message: 'Tarea no encontrada' });

        // Solo Admin-Mesa, Super-Admin y Creador pueden eliminar
        const isAdmin = ['Super-Admin', 'Admin-Mesa'].some(p => userProfile.includes(p));
        const isCreator = existingTask && existingTask.createdBy === req.user.username;

        if (!isAdmin && !isCreator) {
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
