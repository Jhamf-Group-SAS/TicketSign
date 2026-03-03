import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import configService from '../services/configService.js';

const router = express.Router();

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ status: 'error', message: 'Credenciales incompletas' });
    }

    try {
        const glpiUrl = await configService.get('glpi_api_url');
        const appToken = await configService.get('glpi_app_token');

        // ESCENARIO: Acceso de emergencia si GLPI no está configurado
        if (!glpiUrl || !appToken) {
            const MASTER_USER = process.env.ADMIN_USER;
            const MASTER_PASS = process.env.ADMIN_PASSWORD;

            if (MASTER_USER && MASTER_PASS && username === MASTER_USER && password === MASTER_PASS) {
                console.warn('[AUTH] Usando login maestro de emergencia (definido en ENV)');
                const token = jwt.sign(
                    { username, id: 'system-admin', displayName: 'Administrador del Sistema', profile: 'super-admin' },
                    process.env.JWT_SECRET,
                    { expiresIn: '1d' } // Sesión más corta para emergencia
                );
                return res.status(200).json({
                    status: 'success',
                    token,
                    user: { id: 'system-admin', username, name: 'Administrador del Sistema', profile: 'super-admin' }
                });
            } else {
                return res.status(503).json({
                    status: 'error',
                    message: 'El sistema no está configurado y no se definió una cuenta de administración de emergencia.'
                });
            }
        }

        console.log(`Intentando autenticar en GLPI: ${glpiUrl}/initSession`);

        // 1. Validar contra GLPI
        const response = await axios.get(`${glpiUrl}/initSession`, {
            headers: {
                'App-Token': appToken,
                'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
            }
        });

        if (response.data.session_token) {
            const sessionToken = response.data.session_token;

            // 1.1 Obtener datos del perfil completo desde GLPI
            let fullName = username;
            try {
                const profileResponse = await axios.get(`${glpiUrl}/getFullSession`, {
                    headers: {
                        'App-Token': appToken,
                        'Session-Token': sessionToken
                    }
                });

                const glpiSession = profileResponse.data.session;
                if (glpiSession.glpifirstname || glpiSession.glpirealname) {
                    fullName = `${glpiSession.glpifirstname || ''} ${glpiSession.glpirealname || ''}`.trim();
                }

                // Extraer perfil activo e ID de usuario de forma robusta
                const activeProfile = glpiSession.glpiactiveprofile?.name || '';
                const userId = glpiSession.glpiID || glpiSession.glpiid || null;

                console.log(`[AUTH] Usuario autenticado: ${fullName} (ID GLPI: ${userId})`);

                const token = jwt.sign(
                    {
                        username,
                        id: userId,
                        displayName: fullName,
                        profile: activeProfile
                        // AUDIT-004: glpi_session eliminado del token por seguridad
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '8h' } // [A-02] SEGURIDAD: 8h máximo para sesiones de trabajo
                );

                return res.status(200).json({
                    status: 'success',
                    token,
                    user: { id: userId, username, name: fullName, profile: activeProfile }
                });
            } catch (pErr) {
                console.warn('No se pudo obtener el nombre completo o perfil, usando username:', pErr.message);

                const token = jwt.sign(
                    {
                        username,
                        displayName: fullName
                        // AUDIT-004: glpi_session eliminado del token por seguridad
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '8h' } // [A-02] SEGURIDAD: 8h máximo para sesiones de trabajo
                );

                return res.status(200).json({
                    status: 'success',
                    token,
                    user: { username, name: fullName }
                });
            }
        }

    } catch (error) {
        console.error('Error de Auth GLPI:', error.response?.status || error.message);
        return res.status(401).json({
            status: 'error',
            message: 'Usuario o contraseña incorrectos'
        });
    }
});

export default router;
