import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * AutomaticUpdateHandler component
 * This component silently checks for updates to the Service Worker
 * and automatically reloads the page when a new version is available.
 */
const AutomaticUpdateHandler = () => {
    // Interval for update checking (e.g., every 15 minutes)
    const UPDATE_CHECK_INTERVAL = 15 * 60 * 1000;

    const {
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, r) {
            if (r) {
                // Periodically check for service worker updates
                setInterval(async () => {
                    if (!(!r.installing && navigator.onLine)) return;

                    const resp = await fetch(swUrl, {
                        cache: 'no-cache',
                        headers: {
                            'cache-control': 'no-cache',
                        },
                    });

                    if (resp?.status === 200) {
                        await r.update();
                    }
                }, UPDATE_CHECK_INTERVAL);
            }
        },
        onNeedRefresh() {
            // New version found, reloading to apply changes
            console.log('[PWA] Nueva versión detectada. Recargando para actualizar...');
            updateServiceWorker(true);
        },
        onOfflineReady() {
            console.log('[PWA] Aplicación lista para trabajar sin conexión.');
        },
    });

    return null; // Silent component
};

export default AutomaticUpdateHandler;
