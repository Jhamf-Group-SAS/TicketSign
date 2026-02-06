import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

class GLPIConnector {
    constructor() {
        this.sessionToken = null;
    }

    get config() {
        return {
            apiUrl: process.env.GLPI_API_URL,      // Debe ser https://service.jhamf.com/apirest.php
            appToken: process.env.GLPI_APP_TOKEN,
            userToken: process.env.GLPI_USER_TOKEN
        };
    }

    /**
     * Inicializa la sesión en GLPI
     */
    async initSession() {
        const { apiUrl, appToken, userToken } = this.config;
        console.log(`[GLPI] Iniciando sesión en: ${apiUrl}`);

        if (!apiUrl) throw new Error('GLPI_API_URL no configurado');

        try {
            console.log(`[GLPI] Intentando conectar con App-Token: ${appToken ? 'OK' : 'MISSING'} y User-Token: ${userToken ? 'OK' : 'MISSING'}`);

            const response = await axios.get(`${apiUrl}/initSession`, {
                params: {
                    get_full_session: true
                },
                headers: {
                    'App-Token': appToken,
                    'Authorization': `user_token ${userToken}`
                }
            });

            this.sessionToken = response.data.session_token;
            const currentProfile = response.data.session?.glpiprofiles?.name || 'Desconocido';
            const activeProfileId = response.data.session.glpiactiveprofile?.id;
            const activeProfileName = response.data.session.glpiactiveprofile?.name;

            console.log(`[GLPI] Sesión establecida. ID Sesión: ${this.sessionToken?.substring(0, 10)}...`);
            console.log(`[GLPI] Perfil Activo: ${activeProfileName} (ID: ${activeProfileId})`);

            // Auto-switch profile logic
            let profiles = response.data.session?.glpiprofiles || [];

            // Si profiles no es un array (ej: un objeto si solo hay uno), convertirlo
            if (!Array.isArray(profiles)) {
                // Si es un objeto, lo ponemos en un array. Si es null/undefined, array vacío.
                profiles = profiles ? [profiles] : [];
            }

            const currentProfileName = (activeProfileName || '').toLowerCase();
            const allowedProfiles = ['especialistas', 'super-admin', 'admin'];

            // Verificar si el perfil actual ya es de alto privilegio
            const isAlreadyAllowed = allowedProfiles.some(p => currentProfileName.includes(p));

            if (isAlreadyAllowed) {
                console.log(`[GLPI] Perfil actual '${activeProfileName}' tiene privilegios suficientes. No se requiere cambio.`);
            } else {
                // Intentar encontrar un perfil de alto privilegio en la lista
                const targetProfile = profiles.find(p =>
                    p.name && allowedProfiles.some(hp => p.name.toLowerCase().includes(hp))
                );

                if (targetProfile && targetProfile.id !== activeProfileId) {
                    console.log(`[GLPI] Cambiando a perfil con mayores privilegios: ${targetProfile.name} (ID: ${targetProfile.id})`);
                    await axios.post(`${apiUrl}/changeActiveProfile`, {
                        profiles_id: targetProfile.id
                    }, {
                        headers: {
                            'App-Token': appToken,
                            'Session-Token': this.sessionToken
                        }
                    });
                    console.log('[GLPI] Perfil cambiado exitosamente.');
                } else {
                    console.log(`[GLPI] No se encontró un perfil mejor. Operando con: ${activeProfileName}`);
                }
            }

            return this.sessionToken;
        } catch (error) {
            console.error('[GLPI] Error FATAL en initSession:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Busca un activo (Computadora) por Numero de Inventario o Serial
     */
    async findComputer(query) {
        if (!this.sessionToken) await this.initSession();
        const { apiUrl, appToken } = this.config;

        try {
            const response = await axios.get(`${apiUrl}/Computer`, {
                params: {
                    searchText: query,
                    is_deleted: 0
                },
                headers: {
                    'App-Token': appToken,
                    'Session-Token': this.sessionToken
                }
            });
            return response.data[0] || null;
        } catch (error) {
            console.error('[GLPI] Error en findComputer:', error.message);
            return null;
        }
    }

    /**
     * Sube un documento y lo asocia a un ítem (Ticket o Project)
     */
    async uploadDocument(itemId, filePath, fileName, itemtype = 'Ticket') {
        if (!this.sessionToken) await this.initSession();
        const { apiUrl, appToken } = this.config;

        try {
            // 0. Diagnóstico previo (solo para Tickets)
            if (false && itemtype === 'Ticket') {
                try {
                    const ticketResponse = await axios.get(`${apiUrl}/Ticket/${itemId}`, {
                        headers: {
                            'App-Token': appToken,
                            'Session-Token': this.sessionToken
                        }
                    });
                    const ticket = ticketResponse.data;
                    console.log(`[GLPI] Diagnóstico Ticket #${itemId}: Estado=${ticket.status}, Entidad=${ticket.entities_id}`);

                    // Verificar Entidad Activa
                    const sessionResponse = await axios.get(`${apiUrl}/getMyProfiles`, {
                        headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken }
                    });
                    // Nota: getMyProfiles no da la entidad activa, usamos session token info si fuera posible o asumimos la default.
                    // Mejor intentar cambiar entidad si difiere

                } catch (ticketError) {
                    console.error(`[GLPI] Error al consultar Ticket #${itemId}:`, ticketError.message);
                }
            }

            console.log(`[GLPI] Subiendo archivo a: ${apiUrl}/Document`);
            const form = new FormData();
            form.append('uploadManifest', JSON.stringify({
                input: {
                    name: `Consolidado - ${fileName}`,
                    _filename: [fileName]
                }
            }));
            form.append('filename', fs.createReadStream(filePath));

            // 1. Subir documento
            const response = await axios.post(`${apiUrl}/Document`, form, {
                headers: {
                    ...form.getHeaders(),
                    'App-Token': appToken,
                    'Session-Token': this.sessionToken
                }
            });

            const docId = response.data.id;
            console.log(`[GLPI] Documento creado (ID: ${docId}). Vinculando al ${itemtype} #${itemId}...`);

            // 2. Asociar al Ítem
            await axios.post(`${apiUrl}/Document_Item`, {
                input: {
                    documents_id: docId,
                    items_id: itemId,
                    itemtype: itemtype
                }
            }, {
                headers: {
                    'App-Token': appToken,
                    'Session-Token': this.sessionToken
                }
            });

            return { id: docId, success: true };
        } catch (error) {
            console.error(`[GLPI] ERROR DETALLADO en uploadDocument:`, {
                status: error.response?.status,
                data: error.response?.data,
                itemtype,
                itemId,
                url: this.config.apiUrl
            });
            const errorMessage = JSON.stringify(error.response?.data) || error.message;
            throw new Error(`GLPI Upload Error: ${errorMessage}`);
        }
    }

    /**
     * Agrega un seguimiento al ítem
     */
    async addFollowup(itemId, content, itemtype = 'Ticket') {
        if (!this.sessionToken) await this.initSession();
        const { apiUrl, appToken } = this.config;

        // GLPI usa ITILFollowup para Tickets, pero para Projects podría variar. 
        // Si es Project, solemos usar un comentario o el Document_Item es suficiente.
        // Mantenemos ITILFollowup solo para Tickets por ahora.
        if (itemtype !== 'Ticket') return;

        try {
            await axios.post(`${apiUrl}/ITILFollowup`, {
                input: {
                    items_id: itemId,
                    itemtype: itemtype,
                    content: content,
                    is_private: 0
                }
            }, {
                headers: {
                    'App-Token': appToken,
                    'Session-Token': this.sessionToken
                }
            });
            console.log(`[GLPI] Seguimiento añadido al ${itemtype} #${itemId}`);
        } catch (error) {
            console.error(`[GLPI] Error en addFollowup para ${itemtype}:`, error.response?.data || error.message);
        }
    }

    /**
     * Obtiene técnicos elegibles basados en sus perfiles
     */
    async getEligibleTechnicians() {
        if (!this.sessionToken) await this.initSession();
        const { apiUrl, appToken } = this.config;

        try {
            console.log('[GLPI] Buscando técnicos mediante Profile_User...');
            const targetProfiles = ['Super-Admin', 'Especialistas', 'Admin-Mesa', 'Administrativo'];

            // 1. Obtener todas las asociaciones de perfiles
            // Expandimos dropdowns para tener los nombres de perfiles y usuarios
            const response = await axios.get(`${apiUrl}/Profile_User`, {
                params: {
                    range: '0-1000',
                    expand_dropdowns: true
                },
                headers: {
                    'App-Token': appToken,
                    'Session-Token': this.sessionToken
                }
            });

            if (!Array.isArray(response.data)) {
                // Si la respuesta no es un array directo, puede que esté envuelta (v1 de la API antigua)
                const data = Array.isArray(response.data) ? response.data : (response.data.data || []);
                if (!Array.isArray(data)) {
                    console.error('[GLPI] Error: /Profile_User no devolvió un array');
                    return [];
                }
                response.data = data;
            }

            const eligibleUsersMap = new Map();

            if (response.data && response.data.length > 0) {
                console.log('[GLPI] Debug - Primera entrada de Profile_User:', JSON.stringify(response.data[0]));
            }

            for (const entry of response.data) {
                // Probamos varias formas de obtener el nombre del perfil y el ID del usuario
                const profileLabel = (entry.profiles_id || entry.profiles_id_name || '').toString();
                const userId = entry.users_id_id || entry.users_id;

                if (!userId) continue;

                // Validar contra perfiles objetivo
                const matches = targetProfiles.some(tp =>
                    profileLabel.toLowerCase().includes(tp.toLowerCase()) ||
                    (entry.profiles_id_name && entry.profiles_id_name.toLowerCase().includes(tp.toLowerCase()))
                );

                if (matches) {
                    if (!eligibleUsersMap.has(userId)) {
                        eligibleUsersMap.set(userId, {
                            id: userId,
                            name: (entry.users_id || 'Técnico').toString(),
                            fullName: (entry.users_id || 'Técnico').toString()
                        });
                    }
                }
            }

            const eligibleUsers = Array.from(eligibleUsersMap.values());
            console.log(`[GLPI] Identificados ${eligibleUsers.length} técnicos por perfil. Obteniendo detalles adicionales (móvil)...`);

            // Obtener detalles (especialmente el móvil) para cada técnico encontrado
            // Lo hacemos en batches para no saturar
            const BATCH_SIZE = 10;
            for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
                const batch = eligibleUsers.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (tech) => {
                    try {
                        const userRes = await axios.get(`${apiUrl}/User/${tech.id}`, {
                            headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken }
                        });
                        const userData = userRes.data;

                        // Construir nombre completo (Nombre Apellido)
                        const fname = userData.firstname || '';
                        const lname = userData.realname || '';
                        tech.fullName = `${fname} ${lname}`.trim() || userData.name;
                        tech.name = userData.name; // Username
                        tech.username = userData.name;

                        // GLPI suele guardar el móvil en mobile, phone, o phone2. Probamos mobile primero.
                        tech.mobile = userData.mobile || userData.phone || '';
                    } catch (err) {
                        console.warn(`[GLPI] No se pudo obtener detalle para técnico ${tech.id}`);
                    }
                }));
            }

            console.log(`[GLPI] Búsqueda finalizada. ${eligibleUsers.length} técnicos listos.`);
            return eligibleUsers;
        } catch (error) {
            console.error('[GLPI] Error en getEligibleTechnicians:', error.response?.data || error.message);
            return [];
        }
    }
}

export default new GLPIConnector();
