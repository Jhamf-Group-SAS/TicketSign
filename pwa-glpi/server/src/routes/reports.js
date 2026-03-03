import express from 'express';
import { generateConsolidatedPDF, generateMaintenancePDF, CHECKLIST_LABELS } from '../services/pdf.js';
import pkg from 'json2csv';
const { Parser } = pkg;
import glpi from '../services/glpi.js';
import fs from 'fs/promises';
import path from 'path';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// [C-03] SEGURIDAD: Todas las rutas de reportes requieren autenticación
router.use(authenticateToken);

router.post('/consolidated', async (req, res) => {
    const { client_name, acts, projectId } = req.body;

    if (!projectId) {
        return res.status(400).json({ status: 'error', message: 'El ID de Proyecto es obligatorio para consolidados' });
    }

    try {
        console.log(`Generando reporte consolidado para: ${client_name} (Proyecto: ${projectId})`);

        // 1. Generar PDF Maestro
        const pdfBuffer = await generateConsolidatedPDF(client_name, acts);
        const fileName = `Consolidado_${client_name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
        const tempPath = path.join(process.cwd(), 'temp', fileName);

        await fs.mkdir(path.dirname(tempPath), { recursive: true });
        await fs.writeFile(tempPath, pdfBuffer);

        // 2. Subir a la tarea de proyecto especificada estrictamente como 'ProjectTask'
        const docResult = await glpi.uploadDocument(projectId, tempPath, fileName, 'ProjectTask');

        await fs.unlink(tempPath);

        res.status(200).json({
            status: 'success',
            glpiId: docResult.id
        });

    } catch (error) {
        console.error('Error en reporte consolidado:', error);
        // [M-05] SEGURIDAD: No exponer detalles internos del error al cliente
        res.status(500).json({ status: 'error', message: 'Error al generar el reporte consolidado' });
    }
});

router.post('/export-csv', async (req, res) => {
    const { client_name, acts } = req.body;
    try {
        const fields = [
            { label: 'Fecha', value: (row) => new Date(row.createdAt).toLocaleDateString() },
            { label: 'Ticket', value: 'glpi_ticket_id' },
            { label: 'Técnico', value: 'technical_name' },
            { label: 'Usuario', value: 'assigned_user' },
            { label: 'Tipo', value: 'type' },
            { label: 'Hostname', value: 'equipment_hostname' },
            { label: 'Activo', value: (row) => CHECKLIST_LABELS[row.equipment_type] || row.equipment_type || '-' },
            { label: 'Modelo', value: 'equipment_model' },
            { label: 'Serial', value: 'equipment_serial' },
            { label: 'Inventario', value: 'inventory_number' },
            { label: 'Procesador', value: 'equipment_processor' },
            { label: 'RAM', value: (row) => row.equipment_ram === 'OTRO' ? (row.equipment_ram_other ? `${row.equipment_ram_other}GB` : 'OTRO') : (row.equipment_ram || '-') },
            {
                label: 'Disco', value: (row) => {
                    const size = row.equipment_disk === 'OTRO' ? (row.equipment_disk_other ? `${row.equipment_disk_other}GB` : 'OTRO') : (row.equipment_disk || '-');
                    return `${size} ${row.equipment_disk_type || ''}`;
                }
            },
            { label: 'Estado', value: (row) => row.type === 'PREVENTIVO' ? 'COMPLETADO' : row.type === 'ENTREGA' ? 'ENTREGADO' : (row.checklist?.estado_final || 'FINALIZADO') }
        ];

        const json2csvParser = new Parser({ fields, delimiter: ';' }); // Usamos punto y coma para que Excel lo abra directo según región
        const csv = json2csvParser.parse(acts);

        const safeName = (client_name || 'Reporte').replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.csv"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.send(csv);
    } catch (error) {
        console.error('Error exportando CSV:', error);
        // [M-05] SEGURIDAD: No exponer detalles internos del error al cliente
        res.status(500).json({ status: 'error', message: 'Error al exportar el CSV' });
    }
});

router.post('/export-consolidated', async (req, res) => {
    const { client_name, acts } = req.body;
    try {
        const pdfBuffer = await generateConsolidatedPDF(client_name, acts);
        const safeName = (client_name || 'Consolidado').replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
        res.contentType('application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Consolidado_${safeName}.pdf"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.send(Buffer.from(pdfBuffer));
    } catch (error) {
        console.error('Error exportando consolidado:', error);
        // [M-05] SEGURIDAD: No exponer detalles internos del error al cliente
        res.status(500).json({ status: 'error', message: 'Error al generar el PDF consolidado' });
    }
});

router.post('/individual', async (req, res) => {
    const actData = req.body;
    try {
        const pdfBuffer = await generateMaintenancePDF(actData);
        const hostname = actData.equipment_hostname || 'S-H';
        const safeName = hostname.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
        res.contentType('application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Acta_${safeName}.pdf"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.send(Buffer.from(pdfBuffer));
    } catch (error) {
        console.error('Error generando PDF individual:', error);
        // [M-05] SEGURIDAD: No exponer detalles internos del error al cliente
        res.status(500).json({ status: 'error', message: 'Error al generar el PDF' });
    }
});

export default router;
