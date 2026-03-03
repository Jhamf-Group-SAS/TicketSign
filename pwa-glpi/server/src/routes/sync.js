import express from 'express';
import { generateMaintenancePDF } from '../services/pdf.js';
import glpi from '../services/glpi.js';
import fs from 'fs/promises';
import path from 'path';
import Act from '../models/Act.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Aplicar autenticación a todas las rutas de sincronización
router.use(authenticateToken);

// Nuevo endpoint para obtener historial
router.get('/maintenance', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        let acts = [];
        try {
            acts = await Act.find().sort({ createdAt: -1 }).limit(limit);
        } catch (dbErr) {
            console.warn('[Sync] No se pudo acceder a DB local, devolviendo lista vacía.');
        }
        res.json(acts);
    } catch (error) {
        console.error('Error obteniendo historial:', error);
        // [M-05] No exponer detalles internos al cliente
        res.status(500).json({ status: 'error', message: 'Error al obtener el historial de mantenimiento' });
    }
});

router.post('/maintenance', async (req, res) => {
    const actData = req.body;

    try {
        console.log(`Procesando sincronización para ticket #${actData.glpi_ticket_id}`);

        // 1. Generar PDF
        const pdfBuffer = await generateMaintenancePDF(actData);
        // AUDIT-002: Sanitización de hostname para evitar path traversal en nombre de archivo
        const hostname = (actData.equipment_hostname || 'S-H').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `Acta_${hostname}_${Date.now()}.pdf`;
        const tempPath = path.join(process.cwd(), 'temp', fileName);

        // Asegurar directorio temporal
        await fs.mkdir(path.dirname(tempPath), { recursive: true });
        await fs.writeFile(tempPath, pdfBuffer);

        // 0. Guardar en MongoDB
        try {
            let act = await Act.findOne({ glpi_ticket_id: actData.glpi_ticket_id });
            if (!act) {
                act = new Act(actData);
            } else {
                Object.assign(act, actData);
                act.updatedAt = new Date();
            }
            await act.save();
        } catch (dbErr) {
            console.warn('[Sync] Saltando guardado en DB (modo local)');
        }

        // 2. Subir a GLPI
        const docResult = await glpi.uploadDocument(actData.glpi_ticket_id, tempPath, fileName);

        // 3. Agregar seguimiento en GLPI
        await glpi.addFollowup(
            actData.glpi_ticket_id,
            `Se ha registrado el Acta de Mantenimiento Digital (${actData.type}). nombre Equipo: ${hostname} Documento ID: ${docResult.id}`
        );

        // 4. Limpiar temporal
        await fs.unlink(tempPath);

        res.status(200).json({
            status: 'success',
            glpiId: docResult.id
        });

    } catch (error) {
        console.error('Error en sincronización:', error);
        // [M-05] Mensaje genérico al cliente — detalles solo en logs del servidor
        res.status(500).json({
            status: 'error',
            message: 'Error al sincronizar el acta con GLPI. Revise los logs del servidor.'
        });
    }
});

export default router;
