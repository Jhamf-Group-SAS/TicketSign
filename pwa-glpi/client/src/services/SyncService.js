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
        if (!token) return;

        try {
            // --- Sincronizar Actas ---
            try {
                const responseActs = await fetch(`${API_BASE_URL}/sync/maintenance?limit=50`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (responseActs.ok) {
                    const remoteActs = await responseActs.json();
                    if (Array.isArray(remoteActs)) {
                        const { saveRemoteActs } = await import('../store/db');
                        await saveRemoteActs(remoteActs);
                        console.log(`[Sync] Sincronizados ${remoteActs.length} registros de actas.`);
                    }
                }
            } catch (e) {
                console.error('[Sync] Error pulling acts:', e);
            }

            // --- Sincronizar Tareas ---
            try {
                const responseTasks = await fetch(`${API_BASE_URL}/tasks`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (responseTasks.ok) {
                    const remoteTasks = await responseTasks.json();

                    if (Array.isArray(remoteTasks)) {
                        const { db } = await import('../store/db');

                        // 1. Mapear tareas locales existentes por _id (Server ID)
                        const localTasks = await db.tasks.toArray();
                        const localMap = new Map();
                        localTasks.forEach(t => {
                            if (t._id) localMap.set(t._id, t);
                        });

                        // 2. Preparar lista para guardar (Upsert)
                        const tasksToSave = remoteTasks.map(remoteTask => {
                            const localMatch = localMap.get(remoteTask._id);
                            if (localMatch) {
                                // ACTUALIZAR: Mantener el ID local (Dexie PK)
                                return { ...remoteTask, id: localMatch.id };
                            } else {
                                // INSERTAR: Asegurar que id sea undefined para autoincrement
                                const { id, ...rest } = remoteTask;
                                return { ...rest, id: undefined };
                            }
                        });

                        if (tasksToSave.length > 0) {
                            await db.tasks.bulkPut(tasksToSave);
                        }

                        // 3. (Opcional) Limpieza de tareas que ya no existen en el servidor
                        // IMPORTANTE: Solo borrar si estamos seguros que el endpoint devuelve TODO lo visible.
                        // Por ahora, para evitar borrar tareas privadas locales o drafts, NO borramos masivamente.
                        // Solo actualizamos/insertamos las que vienen del servidor.

                        console.log(`[Sync] Sincronizadas ${tasksToSave.length} tareas del servidor.`);
                    }
                } else {
                    console.warn(`[Sync] Error fetching tasks: ${responseTasks.status} ${responseTasks.statusText}`);
                }
            } catch (e) {
                console.error('[Sync] Error pulling tasks:', e);
            }

        } catch (error) {
            console.error('[Sync] General error:', error);
        }
    },

    /**
     * Sincroniza tareas locales modificadas al servidor
     */
    async syncPendingTasks() {
        if (!navigator.onLine) return;

        const { db } = await import('../store/db');
        const token = localStorage.getItem('glpi_pro_token');
        if (!token || token.split('.').length !== 3) return;

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
