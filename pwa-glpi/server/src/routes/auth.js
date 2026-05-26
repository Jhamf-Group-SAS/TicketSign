import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import configService from '../services/configService.js';

const router = express.Router();

// [SEC-T1] Comparación criptográficamente segura para evitar timing attacks
const timingSafeCompare = (a, b) => {
    try {
        return crypto.timingSafeEqual(Buffer.from(String(a)), Buffer.from(String(b)));
    } catch {
        return false;
    }
};

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // [SEC-I1] Sanitizar inputs — stríctamente solo strings, máx 100 chars
    if (typeof username !== 'string' || typeof password !== 'string' ||
        username.length > 100 || password.length > 200) {
        return res.status(400).json({ status: 'error', message: 'Credenciales inválidas' });
    }
    const cleanUsername = username.trim();
    if (!cleanUsername) {
        return res.status(400).json({ status: 'error', message: 'Credenciales incompletas' });
    }

    try {
        // [SEC-T1] Comprobar login maestro con comparación a tiempo constante
        // Credenciales de admin local: se toman de las variables de entorno.
        // Si no están configuradas, se usa el usuario 'admin' / 'admin' como valor por defecto
        // para permitir el primer ingreso y configurar las integraciones desde el módulo de Configuración.
        const MASTER_USER = process.env.ADMIN_USER || 'admin';
        const MASTER_PASS = process.env.ADMIN_PASSWORD || 'admin';

        if (timingSafeCompare(cleanUsername, MASTER_USER) &&
            timingSafeCompare(password, MASTER_PASS)) {
            const isDefault = !process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD;
            if (isDefault) {
                console.warn(`[AUTH] Login con credenciales de admin por defecto (admin/admin). IP: ${req.ip}. Configura ADMIN_USER y ADMIN_PASSWORD en las variables de entorno.`);
            } else {
                console.warn(`[AUTH] Acceso maestro de emergencia usado. IP: ${req.ip}`);
            }
            const token = jwt.sign(
                { username: cleanUsername, id: 'system-admin', displayName: 'Administrador del Sistema', profile: 'Super-Admin' },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );
            return res.status(200).json({
                status: 'success',
                token,
                user: { id: 'system-admin', username: cleanUsername, name: 'Administrador del Sistema', profile: 'Super-Admin' }
            });
        }

        const glpiUrl = await configService.get('glpi_api_url');
        const appToken = await configService.get('glpi_app_token');

        if (!glpiUrl || !appToken) {
            return res.status(503).json({
                status: 'error',
                message: 'La integración con GLPI no está configurada. Ingresa con el usuario administrador local (admin / admin por defecto) y configura la integración desde el módulo de Configuración.'
            });
        }

        // [SEC-SSRF] Validar que la URL de GLPI usa HTTPS en producción
        if (process.env.NODE_ENV === 'production' && !glpiUrl.startsWith('https://')) {
            console.error('[AUTH] Bloqueado: glpi_api_url no usa HTTPS en producción.');
            return res.status(503).json({ status: 'error', message: 'Configuración de GLPI insegura' });
        }

        console.log(`[AUTH] Autenticando usuario en GLPI: ${glpiUrl}/initSession`);

        // 1. Validar contra GLPI
        const response = await axios.get(`${glpiUrl}/initSession`, {
            headers: {
                'App-Token': appToken,
                'Authorization': `Basic ${Buffer.from(`${cleanUsername}:${password}`).toString('base64')}`
            },
            timeout: 10000 // [SEC-T2] Timeout de 10s para evitar hanging
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
        const clientIP = req.ip || req.headers['x-forwarded-for'] || 'desconocida';
        console.error(`[AUTH] Fallo de autenticación para "${cleanUsername}" desde IP ${clientIP}: ${error.response?.status || error.message}`);
        return res.status(401).json({
            status: 'error',
            message: 'Usuario o contraseña incorrectos'
        });
    }
});

export default router;
