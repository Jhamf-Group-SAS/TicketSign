import express from 'express';
import glpi from '../services/glpi.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const upload = multer({ dest: 'uploads/' });

const router = express.Router();

// GET /api/glpi/tickets - Listar tickets
router.get('/tickets', async (req, res) => {
    try {
        const { range, status, technician_id } = req.query;
        // Se puede filtrar por usuario aquí si se desea, por ahora el servicio usa la sesión del token.
        const tickets = await glpi.getTickets({ range, status, technician_id });
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/glpi/tickets/:id - Detalle de ticket
router.get('/tickets/:id', async (req, res) => {
    try {
        const ticket = await glpi.getTicket(req.params.id);
        res.json(ticket);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/glpi/tickets/:id/followup - Agregar seguimiento
router.post('/tickets/:id/followup', async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) return res.status(400).json({ error: 'Content is required' });

        await glpi.addFollowup(req.params.id, content, 'Ticket');
        res.json({ success: true, message: 'Followup added' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/glpi/tickets/:id/solution - Solucionar ticket
router.post('/tickets/:id/solution', async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) return res.status(400).json({ error: 'Content is required' });

        await glpi.addSolution(req.params.id, content);
        res.json({ success: true, message: 'Solution added' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/glpi/categories - Listar categorías
router.get('/categories', async (req, res) => {
    try {
        const items = await glpi.getItems('ITILCategory');
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/glpi/locations - Listar ubicaciones
router.get('/locations', async (req, res) => {
    try {
        const items = await glpi.getItems('Location');
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/glpi/technicians - Listar técnicos elegibles
router.get('/technicians', async (req, res) => {
    try {
        const techs = await glpi.getEligibleTechnicians();
        res.json(techs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/glpi/entities - Listar entidades
router.get('/entities', async (req, res) => {
    try {
        const entities = await glpi.getItems('Entity');
        res.json(entities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/glpi/groups - Listar grupos asignables
router.get('/groups', async (req, res) => {
    try {
        const items = await glpi.getGroups();
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/glpi/users - Listar todos los usuarios
router.get('/users', async (req, res) => {
    try {
        const users = await glpi.getUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/glpi/tickets/:id/actors - Actualizar actor de ticket
router.post('/tickets/:id/actors', async (req, res) => {
    try {
        const { userId, type, isGroup } = req.body;
        const result = await glpi.updateActor(req.params.id, userId, type, isGroup);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/glpi/tickets/:id/document - Subir documento a ticket
router.post('/tickets/:id/document', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const result = await glpi.uploadDocument(
            req.params.id,
            req.file.path,
            req.file.originalname,
            'Ticket'
        );

        // Limpiar archivo temporal
        fs.unlinkSync(req.file.path);

        res.json(result);
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/glpi/tickets/:id - Actualizar ticket
router.put('/tickets/:id', async (req, res) => {
    try {
        const result = await glpi.updateTicket(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
