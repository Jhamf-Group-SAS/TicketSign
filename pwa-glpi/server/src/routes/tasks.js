import express from 'express';
import Task from '../models/Task.js';

const router = express.Router();

// Obtener todas las tareas (con filtros)
router.get('/', async (req, res) => {
    try {
        const { technician, status, priority } = req.query;
        const query = {};
        
        if (technician) query.assigned_technicians = technician;
        if (status) query.status = status;
        if (priority) query.priority = priority;

        const tasks = await Task.find(query).sort({ scheduled_at: 1 });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Crear nueva tarea
router.post('/', async (req, res) => {
    try {
        const task = new Task(req.body);
        const newTask = await task.save();
        res.status(201).json(newTask);
    } catch (error) {
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
                task = await Task.findByIdAndUpdate(_id, updateData, { new: true, upsert: true });
            } else {
                task = new Task(updateData);
                await task.save();
            }
            results.push(task);
        }

        res.json(results);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Actualizar tarea (incluye mover en Kanban)
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Regla de Negocio: PROGRAMADA -> ASIGNADA se maneja implícitamente por el cliente
        // Pero validaremos el completado aquí también por seguridad
        if (updates.status === 'COMPLETADA' && !updates.acta_id) {
             const existingTask = await Task.findById(id);
             if (!existingTask.acta_id) {
                return res.status(400).json({ message: 'No se puede completar una tarea sin un acta firmada vinculada.' });
             }
        }

        const task = await Task.findByIdAndUpdate(id, updates, { new: true });
        if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });
        
        res.json(task);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

export default router;
