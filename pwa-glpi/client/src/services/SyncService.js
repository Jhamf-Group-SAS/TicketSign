import { db, updateSyncStatus, getPendingSync } from '../store/db';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const SyncService = {
    /**
     * Intenta sincronizar todas las actas pendientes
     */
    async syncPendingActs() {
        if (!navigator.onLine) return;

        const token = localStorage.getItem('glpi_pro_token');
        if (!token || token === 'undefined' || token.length < 20) return;

        const pending = await getPendingSync();
        if (pending.length === 0) return;

        console.log(`Iniciando sincronización de ${pending.length} actas...`);

        for (const act of pending) {
            try {
                const response = await fetch(`${API_BASE_URL}/sync/maintenance`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(act)
                });

                if (response.ok) {
                    const result = await response.json();
                    await updateSyncStatus(act.id, 'SINCRONIZADA');
                    console.log(`Acta ${act.id} sincronizada correctamente. GLPI ID: ${result.glpiId}`);
                } else {
                    const error = await response.text();
                    await updateSyncStatus(act.id, 'ERROR', error);
                }
            } catch (err) {
                console.error(`Error sincronizando acta ${act.id}:`, err);
                await updateSyncStatus(act.id, 'ERROR', err.message);
            }
        }
    },

    /**
     * Trae cambios del servidor al cliente
     */
    async pullRemoteChanges() {
        if (!navigator.onLine) return;

        const token = localStorage.getItem('glpi_pro_token');
        if (!token || token.split('.').length !== 3) return;

        try {
            // Sincronizar Actas
            const responseActs = await fetch(`${API_BASE_URL}/sync/maintenance?limit=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (responseActs.ok) {
                const remoteActs = await responseActs.json();
                if (remoteActs && remoteActs.length > 0) {
                    const { saveRemoteActs } = await import('../store/db');
                    await saveRemoteActs(remoteActs);
                    console.log(`Sincronizados ${remoteActs.length} registros de actas del servidor.`);
                }
            }

            // Sincronizar Tareas
            const responseTasks = await fetch(`${API_BASE_URL}/tasks`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (responseTasks.ok) {
                const remoteTasks = await responseTasks.json();
                if (remoteTasks && remoteTasks.length > 0) {
                    const { db } = await import('../store/db');

                    // Estrategia Anti-Duplicados:
                    // 1. Obtener todas las tareas locales que tengan _id (para mapear)
                    const localTasksWithServerId = await db.tasks.where('_id').notEqual('').toArray();
                    const serverIdToLocalIdMap = new Map();
                    localTasksWithServerId.forEach(t => {
                        if (t._id) serverIdToLocalIdMap.set(t._id, t.id);
                    });

                    // 2. Preparar tareas remotas preservando el ID local si existe
                    const tasksToSave = remoteTasks.map(remote => {
                        const localId = serverIdToLocalIdMap.get(remote._id);
                        if (localId) {
                            // Si ya existe localmente, usamos su ID local (PK) para actualizar
                            return { ...remote, id: localId };
                        } else {
                            // Si es nueva, dejamos que Dexie asigne ID (o usamos remote.id si existiera y fuera integer, pero mejor dejar undefined)
                            // Nota: remote.id suele ser string (Mongo ID) o undefined. Si es string, Dexie ++id lo ignorará o fallará.
                            // Mejor asegurarnos que NO tenga 'id' si es string
                            const { id, _id, ...rest } = remote;
                            return { ...remote, id: undefined }; // Forzamos undefined para auto-increment
                        }
                    });

                    await db.tasks.bulkPut(tasksToSave);

                    // Eliminar localmente las tareas que ya no existen en el servidor
                    // Solo consideramos tareas que ya tenían ID de servidor (_id)
                    const remoteIds = new Set(remoteTasks.map(t => t._id));
                    const localTasks = await db.tasks.toArray();
                    const tasksToDelete = localTasks
                        .filter(t => t._id && !remoteIds.has(t._id)) // Tiene ID server pero no vino en la respuesta
                        .map(t => t.id); // Usamos ID local para borrar

                    if (tasksToDelete.length > 0) {
                        await db.tasks.bulkDelete(tasksToDelete);
                        console.log(`Eliminadas ${tasksToDelete.length} tareas locales que ya no existen en el servidor.`);
                    }

                    console.log(`Sincronizadas ${remoteTasks.length} tareas del servidor.`);
                }
            }
        } catch (error) {
            console.error('Error obteniendo datos remotos:', error);
        }
    },

    /**
     * Sincroniza tareas locales modificadas al servidor
     */
    async syncPendingTasks() {
        if (!navigator.onLine) return;

        const { db } = await import('../store/db');
        const token = localStorage.getItem('glpi_pro_token');

        // Por ahora enviamos todas las tareas locales para asegurar consistencia
        const localTasks = await db.tasks.toArray();
        if (localTasks.length === 0) return;

        try {
            const response = await fetch(`${API_BASE_URL}/tasks/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ tasks: localTasks })
            });

            if (response.ok) {
                const syncedTasks = await response.json();

                // Actualizar tareas locales con los IDs del servidor y otros datos
                // PERO conservando el ID local (dexie PK)
                const updates = [];
                for (const remote of syncedTasks) {
                    // Buscar tarea local que coincida (por id "temporal" o si ya tenia _id)
                    // Como syncedTasks viene del servidor, DEBERÍA tener _id
                    if (remote._id) {
                        try {
                            const localMatch = await db.tasks.get({ _id: remote._id });
                            if (localMatch) {
                                updates.push({ ...remote, id: localMatch.id });
                            } else {
                                // Si no existe por _id, tal vez es una de las que acabamos de enviar?
                                // Es difícil saber cuál es cuál sin un ID temporal compartido.
                                // Por ahora, asumimos que si sync devuelve algo es una actualización de lo que enviamos
                                // OJO: La estrategia de "enviar todo" de arriba es peligrosa si no mapeamos bien.
                            }
                        } catch (e) { console.warn(e); }
                    }
                }

                if (updates.length > 0) {
                    await db.tasks.bulkPut(updates);
                }
                console.log('Tareas locales sincronizadas con el servidor.');
            }
        } catch (error) {
            console.error('Error sincronizando tareas:', error);
        }
    },

    /**
     * Obtiene los técnicos elegibles del servidor
     */
    async getTechnicians() {
        if (!navigator.onLine) return [];

        const token = localStorage.getItem('glpi_pro_token');
        if (!token || token.split('.').length !== 3) return [];

        try {
            const response = await fetch(`${API_BASE_URL}/tasks/technicians`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                return await response.json();
            }
            return [];
        } catch (error) {
            console.error('Error fetching technicians:', error);
            return [];
        }
    },

    /**
     * Inicia un listener para cambios de conexión
     */
    init() {
        window.addEventListener('online', () => {
            console.log('Conexión restaurada. Intentando sincronizar...');
            this.syncPendingActs();
            this.syncPendingTasks();
            this.pullRemoteChanges();
        });

        // También intentar sincronizar al cargar la app
        this.syncPendingActs();
        this.syncPendingTasks();
        this.pullRemoteChanges();
    }
};
