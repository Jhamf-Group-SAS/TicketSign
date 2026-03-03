import { db, updateSyncStatus, getPendingSync } from '../store/db';
import NotificationService from './NotificationService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const listeners = new Set();
let isSyncing = false;

export const SyncService = {
    subscribe(callback) {
        listeners.add(callback);
        return () => listeners.delete(callback);
    },

    notify() {
        listeners.forEach(cb => cb(isSyncing));
    },

    setSyncing(val) {
        isSyncing = val;
        this.notify();
    },

    /**
     * Intenta sincronizar todas las actas pendientes
     */
    async syncPendingActs() {
        if (!navigator.onLine) return;

        const token = localStorage.getItem('glpi_pro_token');
        if (!token || token === 'undefined' || token.length < 20) return;

        const pending = await getPendingSync();
        if (pending.length === 0) return;

        this.setSyncing(true);
        // No active client logs

        try {
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
                        await updateSyncStatus(act.id, 'SINCRONIZADO', null, { _id: result._id });
                        // Sincronizada correctamente
                    } else {
                        const error = await response.text();
                        await updateSyncStatus(act.id, 'ERROR', error);
                    }
                } catch (err) {
                    // Error en sincronización de acta
                    await updateSyncStatus(act.id, 'ERROR', err.message);
                }
            }
        } finally {
            this.setSyncing(false);
        }
    },

    /**
     * Trae cambios del servidor al cliente
     */
    async pullRemoteChanges() {
        if (!navigator.onLine) return;

        const token = localStorage.getItem('glpi_pro_token');
        if (!token) return;

        this.setSyncing(true);
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
                        // Pull actas success
                    }
                }
            } catch (e) {
                // Pull actas error
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

                            // Notificar a NotificationService sobre tareas nuevas para este dispositivo
                            const newTasks = remoteTasks.filter(rt => !localMap.has(rt._id));
                            if (newTasks.length > 0) {
                                NotificationService.handleNewRemoteTasks(newTasks);
                            }
                        }

                        // 3. RECONCILIACION: Borrar tareas locales que ya no existen en el servidor
                        // O que están duplicadas localmente (mismos _id)
                        const remoteIds = new Set(remoteTasks.map(t => t._id));
                        const idsToDelete = [];
                        const seenIds = new Set();

                        // Procesamos las tareas que acabamos de guardar para marcarlas como "vistas"
                        tasksToSave.forEach(t => { if (t._id) seenIds.add(t._id); });

                        localTasks.forEach(t => {
                            if (!t._id) return; // No borrar tareas locales aún no sincronizadas

                            // Si el _id ya no está en el servidor
                            if (!remoteIds.has(t._id)) {
                                idsToDelete.push(t.id);
                            }
                            // O si es un duplicado local (mismo _id pero diferente PK que el que ya guardamos)
                            // Nota: t.id es la PK de Dexie. Si no está en tasksToSave, es una copia vieja.
                            else if (seenIds.has(t._id) && !tasksToSave.some(s => s.id === t.id)) {
                                idsToDelete.push(t.id);
                            }
                        });

                        if (idsToDelete.length > 0) {
                            await db.tasks.bulkDelete(idsToDelete);
                        }

                        // Sync tasks success
                    }
                } else {
                    // Pull tasks warn
                }
            } catch (e) {
                // Pull tasks error
            }

        } finally {
            this.setSyncing(false);
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

        this.setSyncing(true);
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
                    if (remote._id) {
                        const localMatch = localTasks.find(t =>
                            t._id === remote._id ||
                            (!t._id && t.createdAt === remote.createdAt && t.title === remote.title)
                        );
                        if (localMatch) {
                            updates.push({ ...remote, id: localMatch.id });
                        }
                    }
                }

                if (updates.length > 0) {
                    await db.tasks.bulkPut(updates);
                }
                // Local tasks synced
            }
        } finally {
            this.setSyncing(false);
        }
    },

    /**
     * Cachea entidades, técnicos y tickets de GLPI localmente
     */
    async syncGLPICache() {
        if (!navigator.onLine) return;
        const token = localStorage.getItem('glpi_pro_token');
        if (!token || token.split('.').length !== 3) return;

        try {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
            const headers = { 'Authorization': `Bearer ${token}` };

            const [entRes, techRes, tickRes] = await Promise.all([
                fetch(`${baseUrl}/glpi/entities`, { headers }),
                fetch(`${baseUrl}/glpi/technicians`, { headers }),
                fetch(`${baseUrl}/glpi/tickets?range=0-1500&status=pending`, { headers })
            ]);

            if (entRes.ok) {
                const entities = (await entRes.json()).map(e => ({ id: String(e.id), label: e.name, entityName: e.name }));
                await db.glpi_entities.clear();
                await db.glpi_entities.bulkAdd(entities);
            }
            if (techRes.ok) {
                const techs = (await techRes.json()).map(t => ({ id: String(t.id), label: `${t.fullName} (${t.name})`, fullName: t.fullName }));
                await db.glpi_technicians.clear();
                await db.glpi_technicians.bulkAdd(techs);
            }
            if (tickRes.ok) {
                const tickets = (await tickRes.json()).map(t => ({ id: String(t.id), label: `#${t.id} - ${t.title}`, original: t }));
                await db.glpi_tickets.clear();
                await db.glpi_tickets.bulkAdd(tickets);
            }
        } catch (error) {
            console.error('Error syncing GLPI cache', error);
        }
    },

    async getCachedEntities() { return await db.glpi_entities.toArray() || []; },
    async getCachedTechnicians() { return await db.glpi_technicians.toArray() || []; },
    async getCachedTickets() { return await db.glpi_tickets.toArray() || []; },

    /**
     * Obtiene los técnicos elegibles del servidor (para tareas)
     */
    async getTechnicians() {
        if (!navigator.onLine) return [];
        const token = localStorage.getItem('glpi_pro_token');
        if (!token || token.split('.').length !== 3) return [];
        try {
            const response = await fetch(`${API_BASE_URL}/tasks/technicians`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.ok) return await response.json();
            return [];
        } catch (error) { return []; }
    },

    /**
     * Inicia un listener para cambios de conexión y polling periódico
     */
    init() {
        // Evitar múltiples inicializaciones
        if (this._initialized) return;
        this._initialized = true;

        window.addEventListener('online', () => {
            // Connection restored
            this.syncPendingActs();
            this.syncPendingTasks();
            this.pullRemoteChanges();
        });

        // Intentar sincronizar al cargar la app
        this.syncPendingActs();
        this.syncPendingTasks();
        this.pullRemoteChanges();

        // Polling periódico cada 60 segundos si hay sesión y red
        setInterval(() => {
            if (navigator.onLine && localStorage.getItem('glpi_pro_token')) {
                // Periodic sync
                this.pullRemoteChanges();
                this.syncPendingTasks();
            }
        }, 60000);
    }
};

export default SyncService;
