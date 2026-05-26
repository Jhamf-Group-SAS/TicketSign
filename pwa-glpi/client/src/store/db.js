import Dexie from 'dexie';

export const db = new Dexie('MaintenanceDB');

// Esquema de la base de datos local
db.version(13).stores({
    acts: '++id, _id, glpi_ticket_id, status, type, client_name, technical_name, createdAt, updatedAt',
    assets_cache: '++id, serial, hostname, ticket_id',
    sync_logs: '++id, act_id, task_id, timestamp, status, error',
    tasks: '++id, _id, status, priority, type, scheduled_at, reminder_at, reminder_sent, isPrivate, glpi_ticket_id, createdAt, updatedAt',
    notification_log: 'task_id, sent_at',
    notifications: '++id, title, message, time, type, read, createdAt',
    glpi_entities: 'id, label, entityName',
    glpi_technicians: 'id, label, fullName',
    glpi_tickets: 'id, label',
    day_settings: 'date, color',
    settings: 'key, value'
});

/**
 * Guarda o actualiza un acta en estado BORRADOR
 */
export const saveDraftAct = async (actData) => {
    const timestamp = new Date().toISOString();
    if (actData.id) {
        await db.acts.update(actData.id, {
            ...actData,
            status: 'BORRADOR',
            updatedAt: timestamp
        });
        return actData.id;
    }
    return await db.acts.add({
        ...actData,
        glpi_ticket_id: actData.glpi_ticket_id ? String(actData.glpi_ticket_id) : '',
        status: 'BORRADOR',
        createdAt: timestamp,
        updatedAt: timestamp
    });
};

/**
 * Marca un acta como lista para sincronización
 */
export const markForSync = async (id) => {
    return await db.acts.update(id, {
        status: 'PENDIENTE_SINCRONIZACION',
        updatedAt: new Date().toISOString()
    });
};

/**
 * Obtiene todas las actas pendientes de sincronización
 */
export const getPendingSync = async () => {
    return await db.acts.where('status').equals('PENDIENTE_SINCRONIZACION').toArray();
};

/**
 * Actualiza el estado después de un intento de sincronización
 */
export const updateSyncStatus = async (id, status, error = null, extraData = {}) => {
    const timestamp = new Date().toISOString();
    await db.acts.update(id, {
        status,
        updatedAt: timestamp,
        ...extraData
    });
    await db.sync_logs.add({
        act_id: id,
        timestamp,
        status,
        error
    });
};

/**
 * Obtiene el historial de actas sincronizadas
 */
export const getHistory = async () => {
    return await db.acts
        .reverse()
        .sortBy('createdAt');
};

/**
 * Guarda actas provenientes del servidor de forma inteligente
 */
export const saveRemoteActs = async (acts) => {
    const operations = acts.map(async (remoteAct) => {
        // 1. Prioridad: Buscar por _id del servidor
        if (remoteAct._id) {
            const existingById = await db.acts.where('_id').equals(remoteAct._id).first();
            if (existingById) {
                return await db.acts.update(existingById.id, {
                    ...remoteAct,
                    id: existingById.id,
                    status: 'SINCRONIZADO'
                });
            }
        }

        // 2. Si no hay _id o no se encontró, buscar coincidencias locales pendientes
        // Usamos una combinación de ticket + técnico + fecha aproximada
        const tid = remoteAct.glpi_ticket_id ? String(remoteAct.glpi_ticket_id) : '';
        const createdAtDate = remoteAct.createdAt ? new Date(remoteAct.createdAt).toISOString() : '';

        // Buscamos un acta local PENDIENTE que coincida exactamente
        const localMatch = await db.acts
            .where('glpi_ticket_id').equals(tid)
            .and(a => a.status === 'PENDIENTE_SINCRONIZACION' &&
                      a.technical_name === remoteAct.technical_name &&
                      a.equipment_serial === remoteAct.equipment_serial)
            .filter(a => {
                // Si coinciden en un margen de 2 minutos, probablemente sean la misma
                return Math.abs(new Date(a.createdAt) - new Date(createdAtDate)) < 120000;
            })
            .first();

        if (localMatch) {
            return await db.acts.update(localMatch.id, {
                ...remoteAct,
                id: localMatch.id,
                status: 'SINCRONIZADO'
            });
        }

        // 3. Si no existe ninguna coincidencia razonable, añadir como nueva
        const { id, ...actWithoutDexieId } = remoteAct;
        return await db.acts.add({
            ...actWithoutDexieId,
            status: 'SINCRONIZADO'
        });
    });

    return Promise.all(operations);
};

/**
 * Cache de assets para consulta offline
 */
export const cacheAsset = async (assetData) => {
    const existing = await db.assets_cache.where('serial').equals(assetData.serial).first();
    if (!existing) {
        return await db.assets_cache.add(assetData);
    }
    return existing.id;
};
