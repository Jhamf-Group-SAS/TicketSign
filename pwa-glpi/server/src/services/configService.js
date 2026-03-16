import Configuration from '../models/Configuration.js';
import { decrypt } from '../utils/crypto.js';

class ConfigService {
    constructor() {
        this.cache = new Map();
        this.lastFetch = 0;
        this.TTL = 60 * 1000; // 1 minuto de cache
    }

    async get(key, defaultValue = null) {
        try {
            if (Date.now() - this.lastFetch > this.TTL) {
                await this.refreshCache();
            }

            // Priorizar DB sobre .env
            if (this.cache.has(key)) {
                return this.cache.get(key);
            }
        } catch (error) {
            console.error(`[ConfigService] Error fetching ${key}:`, error.message);
        }

        // Listado de llaves que SOLO pueden venir de la DB (Integraciones)
        const INTEGRATION_KEYS = [
            'glpi_api_url', 'glpi_app_token', 'glpi_user_token',
            'whatsapp_phone_id', 'whatsapp_token', 'whatsapp_template_name', 'whatsapp_lang'
        ];

        // Si es una llave de integración, NO permitir fallback al .env
        if (INTEGRATION_KEYS.includes(key.toLowerCase()) || key.toLowerCase().startsWith('whatsapp_')) {
            return defaultValue;
        }

        // Si no está en DB, usar .env como último recurso para llaves de sistema (JWT, DB, Encryption)
        const envVal = process.env[key.toUpperCase()] || process.env[key];
        return envVal || defaultValue;
    }

    async refreshCache() {
        try {
            const configs = await Configuration.find();
            this.cache.clear();
            // [M-02] SEGURIDAD: Cap del cache para evitar consumo ilimitado de memoria
            const MAX_CACHE_SIZE = 500;
            configs.slice(0, MAX_CACHE_SIZE).forEach(c => this.cache.set(c.key, decrypt(c.value)));
            this.lastFetch = Date.now();
        } catch (error) {
            // Si falla la DB (ej. al inicio), ignoramos y usamos lo que haya o env
        }
    }

    async getAll() {
        await this.refreshCache();
        const all = {};
        this.cache.forEach((v, k) => all[k] = v);
        return all;
    }
}

export default new ConfigService();
