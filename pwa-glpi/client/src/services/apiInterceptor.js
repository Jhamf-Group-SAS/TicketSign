const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

/**
 * Interceptor global para fetch que maneja el error 401 (Unauthorized/Expired Token)
 * Redirige al login y limpia el almacenamiento local.
 */
const originalFetch = window.fetch;

window.fetch = async (...args) => {
    try {
        const response = await originalFetch(...args);

        // Si el servidor responde con 401, el token ha expirado o es inválido
        if (response.status === 401) {
            console.warn('[Auth] Token expirado o inválido. Redirigiendo al login...');

            // Limpiar datos de sesión
            localStorage.removeItem('glpi_pro_token');
            localStorage.removeItem('glpi_pro_user');

            // Redirigir al login si no estamos ya allí
            if (!window.location.pathname.includes('/front/login')) {
                window.location.href = '/front/login';
            }
        }

        return response;
    } catch (error) {
        throw error;
    }
};

export default window.fetch;
