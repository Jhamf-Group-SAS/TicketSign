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
        // Aumentado a 5000 para evitar truncar listas grandes de actas y técnicos activos
        const limit = parseInt(req.query.limit) || 5000;
        let acts = [];
        try {
            acts = await Act.find().sort({ createdAt: -1 }).limit(limit);
        } catch (dbErr) {
            console.warn('[Sync] No se pudo acceder a DB, devolviendo lista vacía.');
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
        // BUG FIX: Hacemos la operación idempotente.
        // Verificamos si ya existe el acta por _id (si viene del cliente y es válido)
        // o si es la misma acta para el mismo equipo en el mismo ticket y mismo tipo de mantenimiento.
        let savedAct = null;
        try {
            const { _id: clientId, id: dexieId, ...cleanData } = actData;
            const isValidObjectId = clientId && /^[a-fA-F0-9]{24}$/.test(String(clientId));
            let query = {};
            
            if (isValidObjectId) {
                query = { _id: clientId };
            } else if (cleanData.glpi_ticket_id && cleanData.equipment_serial && cleanData.type) {
                // Prevenir duplicados en envíos múltiples sin ID
                query = {
                    glpi_ticket_id: String(cleanData.glpi_ticket_id),
                    equipment_serial: cleanData.equipment_serial,
                    type: cleanData.type
                };
            }

            if (Object.keys(query).length > 0) {
                savedAct = await Act.findOneAndUpdate(
                    query,
                    { ...cleanData, updatedAt: new Date() },
                    { new: true, upsert: true } // Upsert: inserta si no existe, actualiza si existe
                );
            } else {
                 // Fallback si por alguna razón no tiene ticket, serial o tipo válido
                 savedAct = await new Act(cleanData).save();
            }
        } catch (dbErr) {
            console.warn('[Sync] Error guardando en DB:', dbErr.message);
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

        // BUG FIX: Retornar el _id del documento guardado para que el cliente
        // pueda asociar el acta local con su contraparte en MongoDB.
        // Sin esto, result._id era undefined y el acta nunca quedaba correctamente
        // vinculada, impidiendo que otros dispositivos la vieran.
        res.status(200).json({
            status: 'success',
            glpiId: docResult.id,
            _id: savedAct?._id ?? null
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

router.delete('/maintenance/:id', async (req, res) => {
    // [V-01 FIX] Validar ObjectId antes de findByIdAndDelete para prevenir CastError
    if (!req.params.id || !/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
        return res.status(400).json({ status: 'error', message: 'ID de acta inválido' });
    }
    try {
        const deletedAct = await Act.findByIdAndDelete(req.params.id);
        if (!deletedAct) {
            return res.status(404).json({ status: 'error', message: 'Acta no encontrada en la base central' });
        }
        res.json({ status: 'success', message: 'Acta eliminada permanentemente del sistema' });
    } catch (error) {
        console.error('Error eliminando acta:', error);
        res.status(500).json({ status: 'error', message: 'No se pudo eliminar el acta' });
    }
});

export default router;
