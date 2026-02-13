import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

class GLPIConnector {
    constructor() {
        this.sessionToken = null;
        this.userCache = new Map(); // id -> { fullName, name }
        this.loginCache = new Map(); // login/name -> { fullName, id }
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

            for (const entry of response.data) {
                // Con expand_dropdowns=true, profiles_id suele traer el nombre del perfil
                const profileLabel = (entry.profiles_id || '').toString();

                // Intentar obtener el ID del usuario de forma robusta
                let userId = entry.users_id_id;

                // Si no hay users_id_id, intentar extraer del link "User"
                if (!userId && entry.links) {
                    const userLink = entry.links.find(l => l.rel === 'User');
                    if (userLink) {
                        const parts = userLink.href.split('/');
                        const lastPart = parts[parts.length - 1];
                        if (!isNaN(lastPart)) userId = parseInt(lastPart);
                    }
                }

                // Fallback al "id" si es número (en algunas versiones este es el user id si viene filtrado)
                if (!userId && !isNaN(entry.id)) {
                    userId = parseInt(entry.id);
                }

                if (!userId) continue;

                // Validar contra perfiles objetivo (por nombre de perfil)
                const matches = targetProfiles.some(tp =>
                    profileLabel.toLowerCase().includes(tp.toLowerCase()) ||
                    (entry.profiles_id_name && entry.profiles_id_name.toLowerCase().includes(tp.toLowerCase()))
                );

                if (matches) {
                    if (!eligibleUsersMap.has(userId)) {
                        eligibleUsersMap.set(userId, {
                            id: userId,
                            name: (entry.users_id || 'Usuario').toString(),
                            fullName: (entry.users_id || 'Usuario').toString()
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

    /**
     * Obtiene tickets (filtro básico)
     */
    /**
     * Obtiene tickets (filtro básico)
     */
    async getTickets(criteria = {}) {
        if (!this.sessionToken) await this.initSession();
        const { apiUrl, appToken } = this.config;

        try {
            console.log(`[GLPI] Consultando tickets... Criteria:`, criteria);

            const params = {
                'range': criteria.range || '0-1000',
                'sort': 'id',
                'order': 'DESC',
                'is_deleted': 0,
                'status': criteria.status || undefined,
                'expand_dropdowns': true
            };

            if (this.userCache.size < 10) {
                await this.getUsers();
            }

            const response = await axios.get(`${apiUrl}/Ticket`, {
                params,
                headers: {
                    'App-Token': appToken,
                    'Session-Token': this.sessionToken
                }
            });

            if (!Array.isArray(response.data)) {
                console.warn('[GLPI] Respuesta no es un array:', response.data);
                return [];
            }

            const getTechName = (val) => {
                const getNameFromCache = (item) => {
                    if (!item) return '';
                    const idOrLogin = (typeof item === 'object') ? (item.id || item.name) : item;
                    let cached = this.userCache.get(idOrLogin) || this.userCache.get(String(idOrLogin)) || this.userCache.get(Number(idOrLogin));
                    if (!cached && typeof idOrLogin === 'string') cached = this.loginCache.get(idOrLogin.toLowerCase());
                    if (cached && cached.fullName) return cached.fullName;
                    if (typeof item === 'object') return item.fullName || item.completename || item.realname || item.name || '';
                    return String(item);
                };
                if (Array.isArray(val) && val.length > 0) return val.map(getNameFromCache).join(', ');
                const name = getNameFromCache(val);
                return (name === '0' || name === 0) ? '' : name;
            };

            let tickets = response.data.map(t => {
                const getId = (val) => (val && typeof val === 'object' && val.id) ? val.id : val;
                const techId = getId(Array.isArray(t.users_id_technician) ? t.users_id_technician[0] : t.users_id_technician);
                const reqId = getId(Array.isArray(t.users_id_recipient) ? t.users_id_recipient[0] : t.users_id_recipient);

                return {
                    id: t.id,
                    title: t.name,
                    date: t.date,
                    date_mod: t.date_mod,
                    status: typeof t.status === 'object' ? t.status.id : t.status,
                    status_desc: typeof t.status === 'object' ? t.status.name : null,
                    priority: t.priority,
                    urgency: t.urgency,
                    description: t.content
                        ? t.content.replace(/<[^>]*>?/gm, '').substring(0, 150) + (t.content.length > 150 ? '...' : '')
                        : 'Sin descripción',

                    entity: t.entities_id,
                    category: t.itilcategories_id,
                    requester: t.users_id_recipient,
                    technician: t.users_id_technician,

                    entity_name: typeof t.entities_id === 'string' ? t.entities_id : (t.entities_id?.name || 'N/A'),
                    category_name: typeof t.itilcategories_id === 'string' ? t.itilcategories_id : (t.itilcategories_id?.name || ''),
                    requester_name: getTechName(t.users_id_recipient) || 'N/A',
                    technician_name: getTechName(t.users_id_technician) || '',
                    technician_id_raw: techId,
                    requester_id_raw: reqId
                };
            });

            tickets.sort((a, b) => b.id - a.id);

            try {
                const ticketsToEnrich = tickets.slice(0, 50);
                const BATCH_SIZE = 5;

                for (let i = 0; i < ticketsToEnrich.length; i += BATCH_SIZE) {
                    const batch = ticketsToEnrich.slice(i, i + BATCH_SIZE);

                    await Promise.all(batch.map(async (t) => {
                        let actors = [];
                        let groupActors = [];

                        try {
                            const aRes = await axios.get(`${apiUrl}/Ticket/${t.id}/Ticket_User`, { headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken } });
                            actors = Array.isArray(aRes.data) ? aRes.data : (aRes.data ? [aRes.data] : []);
                        } catch (e) {
                            try {
                                const aResAlt = await axios.get(`${apiUrl}/Ticket_User`, {
                                    params: { searchText: { tickets_id: t.id } },
                                    headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken }
                                });
                                actors = Array.isArray(aResAlt.data) ? aResAlt.data : [];
                            } catch (e2) { }
                        }
                        try {
                            const gaRes = await axios.get(`${apiUrl}/Ticket/${t.id}/Ticket_Group`, { headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken } });
                            groupActors = Array.isArray(gaRes.data) ? gaRes.data : (gaRes.data ? [gaRes.data] : []);
                        } catch (e) {
                            try {
                                const gaResAlt = await axios.get(`${apiUrl}/Ticket_Group`, {
                                    params: { searchText: { tickets_id: t.id } },
                                    headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken }
                                });
                                groupActors = Array.isArray(gaResAlt.data) ? gaResAlt.data : [];
                            } catch (e2) { }
                        }

                        const getActorType = (a) => {
                            const type = a.type || a["4"] || a["8"];
                            if (!type) return 0;
                            return typeof type === 'object' ? (type.id || type) : type;
                        };

                        const getActorName = (a, isGroup) => {
                            const directName = a.completename || a.name || a.fullName || a.groups_id_name || a.users_id_name ||
                                (a["9"] ? (a["34"] ? `${a["9"]} ${a["34"]}` : a["9"]) : null);
                            if (directName && typeof directName === 'string' && directName.length > 0) return directName;
                            const id = (isGroup ? a.groups_id : a.users_id) || a.id || a["2"] || a["5"];
                            if (isGroup) return typeof id === 'object' ? (id.completename || id.name || String(id.id)) : String(id);
                            return getTechName(id);
                        };

                        const techUsers = actors.filter(a => getActorType(a) == 2);
                        if (techUsers.length > 0) {
                            const techId = (typeof techUsers[0].users_id === 'object') ? techUsers[0].users_id.id : techUsers[0].users_id;
                            t.technician_id_raw = techId;
                        }

                        const reqNames = [...actors.filter(a => getActorType(a) == 1).map(a => getActorName(a, false)), ...groupActors.filter(a => getActorType(a) == 1).map(a => getActorName(a, true))].filter(Boolean).join(', ');
                        if (reqNames) t.requester_name = reqNames;

                        const techNames = [...techUsers.map(a => getActorName(a, false)), ...groupActors.filter(a => getActorType(a) == 2).map(a => getActorName(a, true))].filter(Boolean).join(', ');
                        if (techNames) t.technician_name = techNames;
                    }));
                }
            } catch (enrichErr) {
                console.warn('[GLPI] Error en enriquecimiento parcial:', enrichErr.message);
            }

            // --- FILTRADO FINAL EN MEMORIA ---

            // 1. Estados
            if (criteria.status && criteria.status !== 'all' && criteria.status !== 'undefined' && criteria.status !== 'null') {
                const beforeStatus = tickets.length;
                if (criteria.status === 'pending') {
                    // Pendientes = No cerrados ni resueltos
                    tickets = tickets.filter(t => t.status != 5 && t.status != 6);
                } else if (!isNaN(criteria.status)) {
                    tickets = tickets.filter(t => t.status == criteria.status);
                }
                console.log(`[DEBUG-SRV] Filtro Estado (${criteria.status}): ${beforeStatus} -> ${tickets.length}`);
            }

            // 2. Mis Tickets (Filtro inclusivo: Técnico o Solicitante)
            const techFilterId = criteria.technician_id || criteria.technicianId;
            if (techFilterId && techFilterId !== 'undefined' && techFilterId !== 'null' && techFilterId !== 'all') {
                const targetId = String(techFilterId);
                const beforeCount = tickets.length;

                // Intentar obtener el nombre del técnico de nuestro cache para un fallback por nombre
                const cachedUser = this.userCache.get(targetId) || this.userCache.get(Number(targetId));
                const targetName = cachedUser ? (cachedUser.fullName || '').toLowerCase() : null;
                const targetUsername = cachedUser ? (cachedUser.name || '').toLowerCase() : null;

                console.log(`[DEBUG-SRV] Aplicando filtro "Mis Tickets" para ID: ${targetId}. Nombres buscados: "${targetName}", "${targetUsername}"`);

                tickets = tickets.filter(t => {
                    const isMyTech = String(t.technician_id_raw) === targetId;
                    const isMyReq = String(t.requester_id_raw) === targetId;

                    // Fallback por nombre (importante si expand_dropdowns nos quitó el ID en el objeto principal)
                    const techNameStr = (t.technician_name || '').toLowerCase();
                    const reqNameStr = (t.requester_name || '').toLowerCase();
                    const isNamed = (targetName && (techNameStr.includes(targetName) || reqNameStr.includes(targetName))) ||
                        (targetUsername && (techNameStr.includes(targetUsername) || reqNameStr.includes(targetUsername)));

                    // También buscamos en los arrays de IDs originales por si acaso
                    const inTechs = Array.isArray(t.technician) && t.technician.some(id => String(typeof id === 'object' ? id.id : id) === targetId);
                    const inReqs = Array.isArray(t.requester) && t.requester.some(id => String(typeof id === 'object' ? id.id : id) === targetId);

                    return isMyTech || isMyReq || isNamed || inTechs || inReqs;
                });

                console.log(`[DEBUG-SRV] Filtro "Mis Tickets" (${targetId}): ${beforeCount} -> ${tickets.length} tickets`);
            }

            console.log(`[DEBUG-SRV] Finalizado getTickets. Retornando ${tickets.length}/${response.data.length} items. Filtro técnico: ${techFilterId || 'no'}`);
            return tickets;

        } catch (error) {
            console.error('[GLPI] Error getTickets:', error.message, error.response?.data);
            return [];
        }
    }

    /**
     * Obtiene detalle completo de un ticket
     */
    async getTicket(id) {
        if (!this.sessionToken) await this.initSession();
        const { apiUrl, appToken } = this.config;

        try {
            console.log(`[GLPI] Obteniendo detalle Ticket #${id}`);

            // Asegurar que tenemos la lista base de usuarios para resolver logins a nombres reales
            if (this.userCache.size < 10) {
                await this.getUsers();
            }

            const headers = { 'App-Token': appToken, 'Session-Token': this.sessionToken };

            // 1. Ticket Base
            const ticketRes = await axios.get(`${apiUrl}/Ticket/${id}`, {
                params: { expand_dropdowns: true },
                headers
            });

            // 2. Seguimientos (Followups)
            let followups = [];
            try {
                const fRes = await axios.get(`${apiUrl}/Ticket/${id}/ITILFollowup`, {
                    params: { expand_dropdowns: true, range: '0-100' },
                    headers
                });
                followups = Array.isArray(fRes.data) ? fRes.data : [];
            } catch (e) { console.warn('No followups or error', e.message); }

            // 3. Soluciones (Solutions)
            let solutions = [];
            try {
                const sRes = await axios.get(`${apiUrl}/Ticket/${id}/ITILSolution`, {
                    params: { expand_dropdowns: true },
                    headers
                });
                solutions = Array.isArray(sRes.data) ? sRes.data : [];
            } catch (e) { console.warn('No solutions or error', e.message); }

            // 4. Documentos
            let documents = [];
            try {
                const dRes = await axios.get(`${apiUrl}/Ticket/${id}/Document_Item`, {
                    params: { expand_dropdowns: true },
                    headers
                });
                documents = Array.isArray(dRes.data) ? dRes.data : [];
            } catch (e) { console.warn('No documents or error', e.message); }

            let actors = [];
            let groupActors = [];

            // 5a. Usuarios vinculados
            try {
                const aRes = await axios.get(`${apiUrl}/Ticket/${id}/Ticket_User`, { headers });
                actors = Array.isArray(aRes.data) ? aRes.data : (aRes.data ? [aRes.data] : []);
            } catch (e) {
                console.warn(`[GLPI] Ticket_User NO disponible mediante ruta anidada. Intentando búsqueda alternativa...`);
                try {
                    // Intento alternativo via búsqueda filtrada
                    const aResAlt = await axios.get(`${apiUrl}/Ticket_User`, {
                        params: { searchText: { tickets_id: id } },
                        headers
                    });
                    actors = Array.isArray(aResAlt.data) ? aResAlt.data : [];
                } catch (e2) {
                    console.error(`[GLPI] Fallo total obteniendo Ticket_User para #${id}`);
                }
            }

            // 5b. Grupos vinculados
            try {
                const gaRes = await axios.get(`${apiUrl}/Ticket/${id}/Ticket_Group`, { headers });
                groupActors = Array.isArray(gaRes.data) ? gaRes.data : (gaRes.data ? [gaRes.data] : []);
            } catch (e) {
                console.warn(`[GLPI] Ticket_Group NO disponible mediante ruta anidada. Intentando búsqueda alternativa...`);
                try {
                    const gaResAlt = await axios.get(`${apiUrl}/Ticket_Group`, {
                        params: { searchText: { tickets_id: id } },
                        headers
                    });
                    groupActors = Array.isArray(gaResAlt.data) ? gaResAlt.data : [];
                } catch (e2) {
                    console.error(`[GLPI] Fallo total obteniendo Ticket_Group para #${id}`);
                }
            }

            // 5. Normalización básica inicial para enriquecimiento
            const t = ticketRes.data;

            // 6. Enrich all users in timeline and actors with real names
            const userIdsToFetch = new Set();
            const getUserId = (val) => {
                if (!val) return null;
                if (typeof val === 'object') return val.id || val["2"] || val["8"] || null;
                return val;
            };

            if (t.users_id_recipient) userIdsToFetch.add(getUserId(t.users_id_recipient));
            if (t.users_id_technician) userIdsToFetch.add(getUserId(t.users_id_technician));
            actors.forEach(a => {
                const uid = getUserId(a.users_id || a["5"]);
                if (uid) userIdsToFetch.add(uid);
            });
            followups.forEach(f => {
                const uid = getUserId(f.users_id || f["5"]);
                if (uid) userIdsToFetch.add(uid);
            });
            solutions.forEach(s => {
                const uid = getUserId(s.users_id || s["5"]);
                if (uid) userIdsToFetch.add(uid);
            });

            // Fetch missing users from cache
            await Promise.all(Array.from(userIdsToFetch).map(async (uid) => {
                if (!uid) return;
                const uidStr = String(uid);
                const isStored = this.userCache.has(uid) || this.userCache.has(uidStr) || this.loginCache.has(uidStr.toLowerCase());

                if (!isStored) {
                    try {
                        const uRes = await axios.get(`${apiUrl}/User/${uid}`, {
                            headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken }
                        });
                        const u = uRes.data;

                        // Soporte para formato numérico de GLPI (1=login, 9=firstname, 34=realname)
                        const fname = (u.firstname || u["9"] || '').trim();
                        const rname = (u.realname || u["34"] || '').trim();

                        let fullName = `${fname} ${rname}`.trim();
                        if (!fullName) fullName = u.completename || u.name || u.login || u["1"] || String(u.id || u["2"] || uid);

                        const userObj = {
                            id: u.id || u["2"] || uid,
                            name: u.name || u.login || u["1"] || String(u.id || uid),
                            fullName
                        };

                        this.userCache.set(String(userObj.id), userObj);
                        this.userCache.set(Number(userObj.id), userObj);
                        if (userObj.name) this.loginCache.set(String(userObj.name).toLowerCase(), userObj);
                    } catch (e) {
                        // Si falla, al menos registramos el ID/Login en el cache para no re-intentar infinitamente
                        this.userCache.set(uidStr, { id: uid, name: uidStr, fullName: uidStr });
                    }
                }
            }));

            const getCachedName = (val) => {
                if (!val) return 'Sistema';

                // Si ya es un objeto enriquecido por GLPI (expand_dropdowns), intentamos usarlo
                if (typeof val === 'object') {
                    // Soporte para formato estándar y formato numérico (1=login, 9=firstname, 34=realname)
                    const fname = (val.firstname || val["9"] || '').trim();
                    const rname = (val.realname || val["34"] || '').trim();
                    let nameFromObj = `${fname} ${rname}`.trim();

                    if (!nameFromObj) {
                        nameFromObj = val.fullName || val.completename || val.realname || val.name || val.login || val["1"];
                    }

                    if (nameFromObj) {
                        // Si tenemos el objeto, también lo guardamos en cache para futuras referencias
                        const objId = val.id || val["2"] || val["8"];
                        if (objId && !this.userCache.has(objId)) {
                            const obj = { id: objId, name: val.name || val["1"], fullName: nameFromObj };
                            this.userCache.set(String(objId), obj);
                            if (obj.name) this.loginCache.set(String(obj.name).toLowerCase(), obj);
                        }
                        return nameFromObj;
                    }
                }

                const idOrLogin = (typeof val === 'object') ? (val.id || val.name) : val;
                if (!idOrLogin) return 'Sistema';

                // Buscar en caches
                let cached = this.userCache.get(idOrLogin) || this.userCache.get(String(idOrLogin)) || this.userCache.get(Number(idOrLogin));
                if (!cached && typeof idOrLogin === 'string') {
                    cached = this.loginCache.get(idOrLogin.toLowerCase());
                }

                if (cached && cached.fullName) return cached.fullName;

                return String(idOrLogin);
            };

            // 7. Construct Unified Timeline
            const timeline = [
                ...followups.map(f => ({ ...f, type: 'followup', date_creation: f.date_creation })),
                ...solutions.map(s => ({ ...s, type: 'solution', date_creation: s.date_creation }))
            ].sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation));

            // 8. Normalize main ticket fields for frontend reliability
            const categoryObj = t.itilcategories_id;
            const locationObj = t.locations_id;

            const getActorType = (a) => {
                // Buscamos tipo en 'type' (REST standard), '4' (Search standard) u '8' (formato usuario)
                const type = a.type || a["4"] || a["8"];
                if (!type) return 0;
                return typeof type === 'object' ? (type.id || type) : type;
            };

            const getActorName = (a, isGroup) => {
                // 1. Intentar obtener nombre directo si ya viene en el objeto (ej: búsqueda expandida)
                const directName = a.completename || a.name || a.fullName || a.groups_id_name || a.users_id_name ||
                    (a["9"] ? (a["34"] ? `${a["9"]} ${a["34"]}` : a["9"]) : null);

                if (directName && typeof directName === 'string' && directName.length > 0) return directName;

                // 2. Si no hay nombre, buscar ID para consultar el caché
                const id = (isGroup ? a.groups_id : a.users_id) || a.id || a["2"] || a["5"];

                if (isGroup) {
                    return typeof id === 'object' ? (id.completename || id.name || String(id.id)) : String(id);
                }
                return getCachedName(id);
            };

            // 1. Technicians (Type 2)
            const technicianNames = [
                ...actors.filter(a => getActorType(a) == 2).map(a => getActorName(a, false)),
                ...groupActors.filter(a => getActorType(a) == 2).map(a => getActorName(a, true))
            ].filter(Boolean);

            let technicianName = technicianNames.join(', ');

            // 2. Requesters (Type 1)
            const requesterNames = [
                ...actors.filter(a => getActorType(a) == 1).map(a => getActorName(a, false)),
                ...groupActors.filter(a => getActorType(a) == 1).map(a => getActorName(a, true))
            ].filter(Boolean);

            let requesterName = requesterNames.join(', ');

            // Fallback a campos del ticket si no hay actores explícitos
            if (!requesterName && t.users_id_recipient) requesterName = getCachedName(t.users_id_recipient);
            if (!technicianName && t.users_id_technician) technicianName = getCachedName(t.users_id_technician);

            const responseData = {
                ...t,
                followups,
                solutions,
                documents,
                actors,
                groupActors,
                timeline: timeline.map(item => ({
                    ...item,
                    users_id_name: getCachedName(item.users_id)
                })),
                // Robust names for the frontend
                category_name: categoryObj?.completename || categoryObj?.name || (typeof categoryObj === 'object' ? '' : String(categoryObj || '')),
                location_name: locationObj?.completename || locationObj?.name || (typeof locationObj === 'object' ? '' : String(locationObj || '')),
                technician_name: technicianName,
                requester_name: requesterName
            };

            return responseData;

        } catch (error) {
            console.error(`[GLPI] Error getTicket(${id}):`, error.message);
            throw error;
        }
    }

    /**
     * Agrega una solución al ticket
     */
    async addSolution(ticketId, content) {
        if (!this.sessionToken) await this.initSession();
        const { apiUrl, appToken } = this.config;

        try {
            console.log(`[GLPI] Creando solución para Ticket #${ticketId}`);
            // Tipo de solución por defecto (puede requerir ajuste según configuración GLPI)
            const solutionType = 1;

            const response = await axios.post(`${apiUrl}/ITILSolution`, {
                input: {
                    items_id: ticketId,
                    itemtype: 'Ticket',
                    content: content,
                    status: 2, // Aprobada/Propuesta
                    solutiontypes_id: solutionType
                }
            }, {
                headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken }
            });

            return response.data;
        } catch (error) {
            console.error(`[GLPI] Error addSolution:`, error.message);
            throw error;
        }
    }
    /**
     * Actualiza un ticket
     */
    async updateTicket(id, input) {
        if (!this.sessionToken) await this.initSession();
        const { apiUrl, appToken } = this.config;

        try {
            console.log(`[GLPI] Actualizando Ticket #${id}`, input);
            const response = await axios.put(`${apiUrl}/Ticket/${id}`, {
                input: {
                    id: id,
                    ...input
                }
            }, {
                headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken }
            });

            return response.data;
        } catch (error) {
            console.error(`[GLPI] Error updateTicket:`, error.message);
            throw error;
        }
    }

    /**
     * Obtiene todos los usuarios (para solicitantes)
     */
    async getUsers() {
        if (!this.sessionToken) await this.initSession();
        const { apiUrl, appToken } = this.config;

        try {
            const response = await axios.get(`${apiUrl}/User`, {
                params: {
                    range: '0-1000',
                    is_active: 1,
                    is_deleted: 0
                },
                headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken }
            });

            const data = Array.isArray(response.data) ? response.data : [];
            const result = data.map(u => {
                // Soporte para formato estándar y formato numérico
                const fname = (u.firstname || u.first_name || u["9"] || '').trim();
                const rname = (u.realname || u.lastname || u.last_name || u["34"] || '').trim();

                let fullName = `${fname} ${rname}`.trim();
                if (!fullName) fullName = u.completename || u.name || u.login || u["1"] || String(u.id || u["2"] || 'N/A');

                const userObj = {
                    id: u.id || 'N/A',
                    name: u.name || u.login || (u.id || 'N/A'),
                    fullName
                };

                this.userCache.set(String(userObj.id), userObj);
                this.userCache.set(Number(userObj.id), userObj);
                if (userObj.name) this.loginCache.set(String(userObj.name).toLowerCase(), userObj);

                return userObj;
            });
            return result;
        } catch (error) {
            console.error('[GLPI] Error getUsers:', error.message);
            return [];
        }
    }
    /**
     * Obtiene una lista genérica de GLPI (Categorías, Ubicaciones, etc)
     */
    async getItems(itemtype, criteria = {}) {
        if (!this.sessionToken) await this.initSession();
        const { apiUrl, appToken } = this.config;

        try {
            const response = await axios.get(`${apiUrl}/${itemtype}`, {
                params: {
                    range: '0-500',
                    is_deleted: 0,
                    ...criteria
                },
                headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken }
            });
            return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            console.error(`[GLPI] Error getItems(${itemtype}):`, error.message);
            return [];
        }
    }

    /**
     * Obtiene grupos (para asignación)
     */
    async getGroups() {
        if (!this.sessionToken) await this.initSession();
        const { apiUrl, appToken } = this.config;

        try {
            const response = await axios.get(`${apiUrl}/Group`, {
                params: {
                    range: '0-500',
                    is_assign: 1, // Solo grupos asignables
                    is_deleted: 0
                },
                headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken }
            });

            const data = Array.isArray(response.data) ? response.data : [];
            return data.map(g => ({
                id: g.id,
                name: g.name,
                fullName: g.completename || g.name,
                isGroup: true
            }));
        } catch (error) {
            console.error('[GLPI] Error getGroups:', error.message);
            return [];
        }
    }

    /**
     * Actualiza o añade un actor a un ticket
     */
    async updateActor(ticketId, actorId, type, isGroup = false) {
        if (!this.sessionToken) await this.initSession();
        const { apiUrl, appToken } = this.config;

        const itemtype = isGroup ? 'Ticket_Group' : 'Ticket_User';
        const idField = isGroup ? 'groups_id' : 'users_id';

        try {
            // Primero buscamos si ya existe un actor de ese tipo para no duplicar
            const actorsRes = await axios.get(`${apiUrl}/Ticket/${ticketId}/${itemtype}`, {
                headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken }
            });
            const existingActors = Array.isArray(actorsRes.data) ? actorsRes.data : [];
            const existing = existingActors.find(a => a.type == type);

            if (existing) {
                // Actualizar existente
                await axios.put(`${apiUrl}/Ticket/${ticketId}/${itemtype}/${existing.id}`, {
                    input: { id: existing.id, [idField]: actorId, type: type }
                }, {
                    headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken }
                });
            } else {
                // Crear nuevo
                await axios.post(`${apiUrl}/Ticket/${ticketId}/${itemtype}`, {
                    input: { tickets_id: ticketId, [idField]: actorId, type: type }
                }, {
                    headers: { 'App-Token': appToken, 'Session-Token': this.sessionToken }
                });
            }
            return { success: true };
        } catch (error) {
            console.error(`[GLPI] Error updateActor:`, error.response?.data || error.message);
            throw error;
        }
    }
}

export default new GLPIConnector();
