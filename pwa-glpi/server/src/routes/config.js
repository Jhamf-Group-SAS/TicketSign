import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import Configuration from '../models/Configuration.js';

import { encrypt } from '../utils/crypto.js';

const router = express.Router();

const SENSITIVE_KEYS = [
    'glpi_app_token',
    'glpi_user_token',
    'whatsapp_token',
    'whatsapp_phone_id',
    'whatsapp_business_id'
];

const MASK = '********';

// Obtener todas las configuraciones configuradas
router.get('/', authenticateToken, authorizeRoles('Super-Admin', 'Admin-Mesa'), async (req, res) => {
    try {
        const configs = await Configuration.find();
        const configMap = {};
        configs.forEach(c => {
            // Enmascarar datos sensibles para el frontend
            if (SENSITIVE_KEYS.includes(c.key) && c.value) {
                configMap[c.key] = MASK;
            } else {
                configMap[c.key] = c.value;
            }
        });
        res.json(configMap);
    } catch (error) {
        console.error('[Config] Error en GET /:', error.message);
        // [M-05] No exponer detalles internos al cliente
        res.status(500).json({ message: 'Error al obtener la configuración' });
    }
});

// Obtener configuraciones públicas sin auth
router.get('/public', async (req, res) => {
    try {
        const keys = ['loginImage', 'theme', 'pdfLogo', 'notificationSound'];
        const configs = await Configuration.find({ key: { $in: keys } });
        const configMap = {};
        configs.forEach(c => configMap[c.key] = c.value);
        res.json(configMap);
    } catch (error) {
        res.json({});
    }
});

// Guardar/Actualizar configuraciones
router.post('/', authenticateToken, authorizeRoles('Super-Admin', 'Admin-Mesa'), async (req, res) => {
    const updates = req.body; // { key: value, ... }

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        return res.status(400).json({ message: 'Formato de actualización inválido' });
    }

    try {
        const results = [];
        for (let [key, value] of Object.entries(updates)) {
            // Validaciones básicas
            if (typeof key !== 'string' || key.length > 100) continue;
            if (value && typeof value === 'string' && value.length > 5000) {
                if (!['loginImage', 'notificationSound', 'pdfLogo'].includes(key)) {
                    return res.status(400).json({ message: `Valor demasiado largo para la clave: ${key}` });
                }
            }
            // Si es un campo sensible
            if (SENSITIVE_KEYS.includes(key)) {
                // Si el valor es el MASK, el usuario no lo cambió, ignorar
                if (value === MASK) continue;

                // Si hay un nuevo valor, cifrarlo antes de guardar
                if (value) {
                    value = encrypt(value);
                }
            }

            const result = await Configuration.findOneAndUpdate(
                { key },
                { value, updatedAt: new Date() },
                { upsert: true, new: true }
            );
            results.push(result);
        }
        res.json({ message: 'Configuración actualizada correctamente', results });
    } catch (error) {
        console.error('[Config] Error en POST /:', error.message);
        // [M-05] No exponer detalles internos al cliente
        res.status(500).json({ message: 'Error al guardar la configuración' });
    }
});

// Eliminar una configuración específica
router.delete('/:key', authenticateToken, authorizeRoles('Super-Admin', 'Admin-Mesa'), async (req, res) => {
    try {
        await Configuration.findOneAndDelete({ key: req.params.key });
        res.json({ message: `Configuración ${req.params.key} eliminada` });
    } catch (error) {
        console.error('[Config] Error en DELETE /:key:', error.message);
        // [M-05] No exponer detalles internos al cliente
        res.status(500).json({ message: 'Error al eliminar la configuración' });
    }
});

export default router;
