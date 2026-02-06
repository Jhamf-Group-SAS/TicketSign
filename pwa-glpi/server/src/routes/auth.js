import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ status: 'error', message: 'Credenciales incompletas' });
    }

    try {
        const glpiUrl = process.env.GLPI_API_URL;
        const appToken = process.env.GLPI_APP_TOKEN;

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

                // Extraer perfil activo
                const activeProfile = glpiSession.glpiactiveprofile?.name || '';

                const token = jwt.sign(
                    {
                        username,
                        displayName: fullName,
                        profile: activeProfile,
                        glpi_session: sessionToken
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '30d' }
                );

                return res.status(200).json({
                    status: 'success',
                    token,
                    user: { username, name: fullName, profile: activeProfile }
                });
            } catch (pErr) {
                console.warn('No se pudo obtener el nombre completo o perfil, usando username:', pErr.message);

                const token = jwt.sign(
                    {
                        username,
                        displayName: fullName,
                        glpi_session: sessionToken
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '30d' }
                );

                return res.status(200).json({
                    status: 'success',
                    token,
                    user: { username, name: fullName }
                });
            }
        }

    } catch (error) {
        // Fallback para usuarios de prueba SOLAMENTE si falla GLPI
        if (username === 'admin' && password === 'admin123') {
            const token = jwt.sign(
                { username, displayName: 'Admin Prueba', profile: 'Super-Admin', is_test: true },
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );
            return res.status(200).json({
                status: 'success',
                token,
                user: { username, name: 'Admin Prueba', profile: 'Super-Admin' }
            });
        }

        if (username === 'especialista' && password === 'esp123') {
            const token = jwt.sign(
                { username, displayName: 'Técnico Especialista', profile: 'Especialistas', is_test: true },
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );
            return res.status(200).json({
                status: 'success',
                token,
                user: { username, name: 'Técnico Especialista', profile: 'Especialistas' }
            });
        }

        console.error('Error de Auth GLPI:', error.response?.data || error.message);
        return res.status(401).json({
            status: 'error',
            message: 'Usuario o contraseña de GLPI incorrectos'
        });
    }
});

export default router;
