import Dexie from 'dexie';

export const db = new Dexie('MaintenanceDB');

// Esquema de la base de datos local
db.version(7).stores({
    acts: '++id, glpi_ticket_id, status, type, client_name, technical_name, createdAt, updatedAt',
    assets_cache: '++id, serial, hostname, ticket_id',
    sync_logs: '++id, act_id, task_id, timestamp, status, error',
    tasks: '++id, status, priority, type, scheduled_at, reminder_at, reminder_sent, isPrivate, glpi_ticket_id, createdAt, updatedAt',
    notification_log: 'task_id, sent_at'
});

/**
 * Guarda o actualiza un acta en estado BORRADOR
 */
export const saveDraftAct = async (actData) => {
    const timestamp = new Date().toISOString();
    if (actData.id) {
        return await db.acts.update(actData.id, {
            ...actData,
            updatedAt: timestamp
        });
    }
    return await db.acts.add({
        ...actData,
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
export const updateSyncStatus = async (id, status, error = null) => {
    const timestamp = new Date().toISOString();
    await db.acts.update(id, { status, updatedAt: timestamp });
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
        .where('status')
        .anyOf('SINCRONIZADA', 'SINCRONIZADO') // Soportar ambos por compatibilidad
        .reverse()
        .sortBy('createdAt');
};

/**
 * Guarda actas provenientes del servidor
 */
export const saveRemoteActs = async (acts) => {
    const operations = acts.map(act => {
        // Aseguramos que el estado sea consistente localmente
        const localAct = {
            ...act,
            status: 'SINCRONIZADA', // Forzar estado correcto
            id: undefined // Dejar que IndexedDB maneje los IDs o usar el del server si es consistente
        };

        // Usamos put para insertar o actualizar basado en glpi_ticket_id si es único,
        // pero como los IDs locales y remotos pueden diferir, usamos glpi_ticket_id como clave lógica.
        // Nota: Si el schema no tiene glpi_ticket_id como key secundaria única, esto podría duplicar.
        // Revisando el schema: '++id, glpi_ticket_id...'

        return db.acts.where('glpi_ticket_id').equals(act.glpi_ticket_id).first()
            .then(existing => {
                if (existing) {
                    // Actualizar solo si es necesario, o ignorar si ya está local
                    return db.acts.update(existing.id, { ...localAct, id: existing.id });
                } else {
                    return db.acts.add(localAct);
                }
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
