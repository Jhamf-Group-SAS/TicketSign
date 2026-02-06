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
                    // Actualización simple por ahora, se puede mejorar la lógica de merge
                    await db.tasks.bulkPut(remoteTasks.map(t => ({ ...t, id: t.id || t._id })));
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
                await db.tasks.bulkPut(syncedTasks.map(t => ({ ...t, id: t.id || t._id })));
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
