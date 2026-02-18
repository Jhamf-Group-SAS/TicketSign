import express from 'express';
import { generateConsolidatedPDF, generateMaintenancePDF, CHECKLIST_LABELS } from '../services/pdf.js';
import pkg from 'json2csv';
const { Parser } = pkg;
import glpi from '../services/glpi.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

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
        res.status(500).json({ status: 'error', message: error.message });
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

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=Consolidado_${client_name.replace(/\s+/g, '_')}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Error exportando CSV:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.post('/export-consolidated', async (req, res) => {
    const { client_name, acts } = req.body;
    try {
        const pdfBuffer = await generateConsolidatedPDF(client_name, acts);
        res.contentType('application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error exportando consolidado:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.post('/individual', async (req, res) => {
    const actData = req.body;
    try {
        const pdfBuffer = await generateMaintenancePDF(actData);
        res.contentType('application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generando PDF individual:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

export default router;
