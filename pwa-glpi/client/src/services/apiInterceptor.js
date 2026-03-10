const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

/**
 * Interceptor global para fetch que maneja el error 401 (Unauthorized/Expired Token)
 * Redirige al login y limpia el almacenamiento local.
 */
const originalFetch = window.fetch;
let isRedirecting = false;

window.fetch = async (...args) => {
    try {
        const response = await originalFetch(...args);

        // Si el servidor responde con 401, el token ha expirado o es inválido
        if (response.status === 401 && !isRedirecting) {
            console.warn('[Auth] Token expirado o inválido. Redirigiendo al login...');

            // Evitar múltiples redirecciones simultáneas
            isRedirecting = true;

            // Limpiar datos de sesión
            localStorage.removeItem('glpi_pro_token');
            localStorage.removeItem('glpi_pro_user');

            // Redirigir al login si no estamos ya allí
            if (!window.location.pathname.includes('/front/login')) {
                // Usamos un pequeño delay para permitir que otros procesos limpien
                setTimeout(() => {
                    window.location.href = '/front/login';
                }, 100);
            } else {
                isRedirecting = false;
            }
        }

        return response;
    } catch (error) {
        throw error;
    }
};

export default window.fetch;
