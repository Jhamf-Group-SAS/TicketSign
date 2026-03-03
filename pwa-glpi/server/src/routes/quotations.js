import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import pkg from 'json2csv';
const { Parser } = pkg;

import Quotation from '../models/Quotation.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { generateQuotationPDF } from '../services/pdf.js';

const router = express.Router();

// Multer — solo PDFs e imágenes, máximo 20MB
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const dir = 'uploads/quotations/';
        await fs.mkdir(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        allowed.includes(file.mimetype)
            ? cb(null, true)
            : cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
    }
});

// Todos los endpoints requieren autenticación
router.use(authenticateToken);

// ─── Helpers ─────────────────────────────────────────────────────────────────

// [A-04] SEGURIDAD: Comparación exacta de roles (no substring).
// Evita bypass con perfiles como 'Super-Admin-Fake' o 'Not-Admin-Mesa'.
const isAdminOrBuyer = (profile) => {
    const roles = (profile || '').split(',').map(r => r.trim());
    return ['Super-Admin', 'Admin-Mesa', 'Compras'].some(r => roles.includes(r));
};

// ─── GET /api/quotations ─────────────────────────────────────────────────────
// Lista con filtros: status, priority, assigned_to, desde, hasta
router.get('/', async (req, res) => {
    try {
        const { status, priority, assigned_to, from, to, search } = req.query;
        const userProfile = req.user.profile || '';
        const username = req.user.username;

        const query = {};

        // Filtros combinados para soportar Visibilidad y Búsqueda simultáneamente
        const andConditions = [];

        // Visibilidad Estricta: Solo creador o asignado pueden ver
        const userNames = [req.user.username, req.user.displayName, req.user.fullName, req.user.name].filter(Boolean);
        andConditions.push({
            $or: [
                { createdBy: { $in: userNames } },
                { createdByName: { $in: userNames } },
                { assigned_to: { $in: userNames } }
            ]
        });

        if (status) query.status = status;
        if (priority) query.priority = priority;
        if (assigned_to) query.assigned_to = assigned_to;
        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(from);
            if (to) query.createdAt.$lte = new Date(to);
        }
        if (search) {
            // [M-06] SEGURIDAD: Escapar caracteres especiales para prevenir ReDoS
            const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchNum = parseInt(search);
            const searchOr = [
                { title: { $regex: safeSearch, $options: 'i' } },
                { supplier: { $regex: safeSearch, $options: 'i' } },
                { company: { $regex: safeSearch, $options: 'i' } },
                { glpi_ticket_id: { $regex: safeSearch, $options: 'i' } }
            ];
            if (!isNaN(searchNum)) {
                searchOr.push({ quotation_number: searchNum });
            }
            andConditions.push({ $or: searchOr });
        }

        if (andConditions.length > 0) {
            query.$and = andConditions;
        }

        const quotations = await Quotation.find(query).sort({ createdAt: -1 });
        res.json(quotations);
    } catch (error) {
        console.error('[Quotations] Error en GET /', error);
        res.status(500).json({ message: 'Error al obtener cotizaciones' });
    }
});

// ─── GET /api/quotations/export/csv ──────────────────────────────────────────
router.get('/export/csv', authorizeRoles('Super-Admin', 'Admin-Mesa', 'Compras'), async (req, res) => {
    try {
        const quotations = await Quotation.find().sort({ createdAt: -1 }).lean();
        const fields = [
            { label: 'No.', value: 'quotation_number' },
            { label: 'Título', value: 'title' },
            { label: 'Empresa', value: 'company' },
            { label: 'Estado', value: 'status' },
            { label: 'Prioridad', value: 'priority' },
            { label: 'Asignado a', value: 'assigned_to' },
            { label: 'Creado por', value: 'createdByName' }, // También cambié 'createdBy' a 'createdByName' para mostrar el nombre
            { label: 'Ticket GLPI', value: 'glpi_ticket_id' },
            { label: 'Creado', value: (r) => new Date(r.createdAt).toLocaleDateString('es-CO') },
        ];
        const parser = new Parser({ fields, delimiter: ';' });
        const csv = parser.parse(quotations);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=Cotizaciones_${Date.now()}.csv`);
        res.send('\uFEFF' + csv); // BOM para Excel
    } catch (error) {
        console.error('[Quotations] Error exportando CSV:', error);
        res.status(500).json({ message: 'Error al exportar' });
    }
});

// ─── GET /api/quotations/:id ──────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const q = await Quotation.findById(req.params.id);
        if (!q) return res.status(404).json({ message: 'Cotización no encontrada' });

        // Solo el creador o el asignado puede ver el detalle (Visibilidad Estricta)
        const userNames = [req.user.username, req.user.displayName, req.user.fullName, req.user.name].filter(Boolean);

        const isOwnerOrAssignee = userNames.includes(q.createdBy) ||
            userNames.includes(q.createdByName) ||
            (q.assigned_to && userNames.includes(q.assigned_to));

        if (!isOwnerOrAssignee) {
            return res.status(403).json({ message: 'Sin permiso para ver esta cotización' });
        }

        res.json(q);
    } catch (error) {
        console.error('[Quotations] Error en GET /:id:', error);
        res.status(500).json({ message: 'Error al obtener la cotización' });
    }
});

// ─── POST /api/quotations ─────────────────────────────────────────────────────
router.post('/', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'images', maxCount: 10 }]), async (req, res) => {
    try {
        // Asegurar directorio de uploads
        await fs.mkdir(path.join(process.cwd(), 'uploads', 'quotations'), { recursive: true });

        const {
            title, description, amount, currency, supplier,
            glpi_ticket_id, priority, assigned_to, tags, company
        } = req.body;

        if (!title) return res.status(400).json({ message: 'El título es obligatorio' });

        const quotationData = {
            title,
            description,
            amount: parseFloat(amount) || 0,
            currency: currency || 'COP',
            supplier,
            glpi_ticket_id,
            priority: priority || 'MEDIA',
            assigned_to,
            company,
            tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
            createdBy: req.user.username,
            createdByName: req.user.name || req.user.fullName || req.user.displayName || req.user.username,
            status: 'PENDIENTE',
            history: [{
                from: null,
                to: 'PENDIENTE',
                by: req.user.name || req.user.fullName || req.user.displayName || req.user.username,
                note: 'Cotización creada'
            }],
            images: []
        };

        // Archivo principal (PDF o imagen de referencia)
        if (req.files?.['file']?.[0]) {
            const f = req.files['file'][0];
            quotationData.file_url = f.path;
            quotationData.file_name = f.originalname;
            quotationData.file_type = f.mimetype;
        }

        // Imágenes adicionales para el PDF
        if (req.files?.['images']) {
            quotationData.images = req.files['images'].map(img => ({
                url: img.path,
                name: img.originalname,
                mimetype: img.mimetype
            }));
        }

        const quotation = new Quotation(quotationData);
        await quotation.save();

        console.log(`[Quotations] Nueva cotización creada: ${quotation._id} por ${req.user.username}`);
        res.status(201).json(quotation);
    } catch (error) {
        // Cleanup all files if error
        if (req.files) {
            Object.values(req.files).flat().forEach(f => {
                fs.unlink(f.path).catch(() => { });
            });
        }
        console.error('[Quotations] Error en POST /:', error);
        res.status(400).json({ message: 'Error al crear la cotización' });
    }
});

// ─── PATCH /api/quotations/:id ────────────────────────────────────────────────
// Actualizar estado, asignado, motivo rechazo, OC, etc. Permite Compras/Admin y Asignados
router.patch('/:id', async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id);
        if (!quotation) return res.status(404).json({ message: 'Cotización no encontrada' });

        const userProfile = req.user.profile || '';
        const userNames = [req.user.username, req.user.displayName, req.user.fullName, req.user.name].filter(Boolean);
        const isAssignee = userNames.includes(quotation.assigned_to) || userNames.some(name => quotation.assigned_to?.includes(name));

        if (!isAdminOrBuyer(userProfile) && !isAssignee) {
            return res.status(403).json({ message: 'Sin permiso para modificar esta cotización' });
        }

        const {
            status, assigned_to, rejection_reason,
            purchase_order, purchase_date, priority, title, description, supplier
        } = req.body;

        // Registrar cambio de estado en el historial
        if (status && status !== quotation.status) {
            if (status === 'RECHAZADA' && !rejection_reason) {
                return res.status(400).json({ message: 'Se requiere un motivo de rechazo' });
            }
            quotation.history.push({
                from: quotation.status,
                to: status,
                by: req.user.name || req.user.fullName || req.user.displayName || req.user.username,
                note: rejection_reason || ''
            });
            quotation.status = status;
        }

        if (assigned_to !== undefined) quotation.assigned_to = assigned_to;
        if (rejection_reason !== undefined) quotation.rejection_reason = rejection_reason;
        if (purchase_order !== undefined) quotation.purchase_order = purchase_order;
        if (purchase_date !== undefined) quotation.purchase_date = purchase_date;
        if (priority !== undefined) quotation.priority = priority;
        if (title !== undefined) quotation.title = title;
        if (description !== undefined) quotation.description = description;
        if (supplier !== undefined) quotation.supplier = supplier;

        await quotation.save();
        res.json(quotation);
    } catch (error) {
        console.error('[Quotations] Error en PATCH /:id:', error);
        res.status(400).json({ message: 'Error al actualizar la cotización' });
    }
});

// ─── POST /api/quotations/:id/upload ─────────────────────────────────────────
router.post('/:id/upload', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'images', maxCount: 10 }]), async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id);
        if (!quotation) return res.status(404).json({ message: 'Cotización no encontrada' });

        const userProfile = req.user.profile || '';
        const userNames = [req.user.username, req.user.displayName, req.user.fullName, req.user.name].filter(Boolean);
        const isOwnerOrAssignee = userNames.includes(quotation.createdBy) ||
            userNames.includes(quotation.createdByName) ||
            userNames.includes(quotation.assigned_to) ||
            userNames.some(name => quotation.assigned_to?.includes(name));

        if (!isAdminOrBuyer(userProfile) && !isOwnerOrAssignee) {
            return res.status(403).json({ message: 'Sin permiso para subir archivos' });
        }

        let updated = false;

        // Archivo principal
        if (req.files?.['file']?.[0]) {
            const f = req.files['file'][0];
            quotation.file_url = f.path;
            quotation.file_name = f.originalname;
            quotation.file_type = f.mimetype;
            updated = true;
        }

        // Imágenes adicionales
        if (req.files?.['images']) {
            const newImages = req.files['images'].map(img => ({
                url: img.path,
                name: img.originalname,
                mimetype: img.mimetype
            }));
            quotation.images = [...(quotation.images || []), ...newImages];
            updated = true;
        }

        if (updated) {
            await quotation.save();
        }

        res.json(quotation);
    } catch (error) {
        console.error('[Quotations] Error en POST /:id/upload:', error);
        res.status(500).json({ message: 'Error al subir archivos' });
    }
});

// ─── POST /api/quotations/:id/comments ───────────────────────────────────────
router.post('/:id/comments', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text?.trim()) return res.status(400).json({ message: 'El comentario no puede estar vacío' });

        const quotation = await Quotation.findById(req.params.id);
        if (!quotation) return res.status(404).json({ message: 'Cotización no encontrada' });

        // Verificar acceso (creador, asignado o Compras/Admin)
        const userProfile = req.user.profile || '';
        const userNames = [req.user.username, req.user.displayName, req.user.fullName, req.user.name].filter(Boolean);
        const isOwnerOrAssignee = userNames.includes(quotation.createdBy) ||
            userNames.includes(quotation.createdByName) ||
            userNames.includes(quotation.assigned_to) ||
            userNames.some(name => quotation.assigned_to?.includes(name));

        if (!isAdminOrBuyer(userProfile) && !isOwnerOrAssignee) {
            return res.status(403).json({ message: 'Sin permiso para comentar en esta cotización' });
        }

        quotation.comments.push({
            author: req.user.name || req.user.fullName || req.user.displayName || req.user.username,
            text: text.trim()
        });

        await quotation.save();
        res.status(201).json(quotation.comments[quotation.comments.length - 1]);
    } catch (error) {
        console.error('[Quotations] Error en POST /:id/comments:', error);
        res.status(500).json({ message: 'Error al agregar el comentario' });
    }
});

// ─── DELETE /api/quotations/:id ───────────────────────────────────────────────
router.delete('/:id', authorizeRoles('Super-Admin', 'Admin-Mesa'), async (req, res) => {
    try {
        const quotation = await Quotation.findByIdAndDelete(req.params.id);
        if (!quotation) return res.status(404).json({ message: 'Cotización no encontrada' });

        // Eliminar archivo adjunto si existe
        if (quotation.file_url) {
            fs.unlink(quotation.file_url).catch(() => { });
        }

        res.json({ message: 'Cotización eliminada exitosamente' });
    } catch (error) {
        console.error('[Quotations] Error en DELETE /:id:', error);
        res.status(500).json({ message: 'Error al eliminar la cotización' });
    }
});

// ─── GET /api/quotations/view/:filename ──────────────────────────────────────
// [A-01 + C-04] SEGURIDAD: Requiere auth y previene Path Traversal
router.get('/view/:filename', authenticateToken, async (req, res) => {
    try {
        // [C-04] Sanitizar el nombre para prevenir path traversal (ej: ../../etc/passwd)
        const safeFilename = path.basename(req.params.filename);
        const uploadsDir = path.resolve(process.cwd(), 'uploads', 'quotations');
        const filePath = path.resolve(uploadsDir, safeFilename);

        // Verificar que el path resultante está DENTRO del directorio permitido
        if (!filePath.startsWith(uploadsDir + path.sep)) {
            return res.status(403).json({ message: 'Ruta de archivo no permitida.' });
        }

        await fs.access(filePath);

        const ext = path.extname(safeFilename).toLowerCase();
        let mimetype = 'application/octet-stream';

        const mimetypes = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp'
        };

        if (mimetypes[ext]) {
            mimetype = mimetypes[ext];
        } else {
            // Si no tiene extensión, leer los primeros bytes para detectar PDF
            const handle = await fs.open(filePath, 'r');
            const { buffer } = await handle.read(Buffer.alloc(5), 0, 5, 0);
            await handle.close();
            if (buffer.toString() === '%PDF-') {
                mimetype = 'application/pdf';
            }
        }

        res.setHeader('Content-Type', mimetype);
        if (req.query.download === '1') {
            const downloadName = req.query.name || safeFilename;
            res.setHeader('Content-Disposition', `attachment; filename="${downloadName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
        } else {
            res.setHeader('Content-Disposition', 'inline');
        }

        res.sendFile(filePath);
    } catch (error) {
        res.status(404).json({ message: 'Archivo no encontrado' });
    }
});

// ─── GET /api/quotations/:id/pdf ──────────────────────────────────────────
router.get('/:id/pdf', async (req, res) => {
    try {
        console.log(`[PDF] Iniciando generación para cotización: ${req.params.id}`);
        const q = await Quotation.findById(req.params.id);
        if (!q) {
            console.error(`[PDF] Cotización no encontrada: ${req.params.id}`);
            return res.status(404).json({ message: 'Cotización no encontrada' });
        }

        const pdfBuffer = await generateQuotationPDF(q);

        if (!pdfBuffer || pdfBuffer.length === 0) {
            console.error(`[PDF] Buffer vacío generado para cotización: ${req.params.id}`);
            throw new Error('Buffer de PDF vacío');
        }

        console.log(`[PDF] PDF generado exitosamente (${pdfBuffer.length} bytes)`);

        // Verificación básica: Los archivos PDF deben empezar con %PDF- (0x25 0x50 0x44 0x46 0x2d)
        if (pdfBuffer[0] !== 0x25 || pdfBuffer[1] !== 0x50) {
            console.error('[PDF] ATENCIÓN: El buffer generado no parece ser un PDF válido (firma incorrecta)');
        }

        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length,
            'Content-Disposition': `attachment; filename="Cotizacion_${q.quotation_number || q._id}.pdf"`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end(Buffer.from(pdfBuffer), 'binary');
    } catch (error) {
        console.error('[Quotations] Error exportando PDF:', error);
        // [M-05] No exponer detalles internos al cliente
        res.status(500).json({ message: 'Error al generar el PDF de la cotización' });
    }
});

export default router;
