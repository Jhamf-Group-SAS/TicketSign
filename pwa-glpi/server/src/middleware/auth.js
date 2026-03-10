import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
    // [C-02 - EXCEPCIÓN] Rutas que sirven archivos multimedia y descargas directas del navegador
    // (ej: <img src="...">) necesitan soportar token por URL temporalmente.
    const isResourceRoute = req.originalUrl.includes('/view/') ||
        req.originalUrl.includes('/export/csv') ||
        req.originalUrl.includes('/export-csv') ||
        req.originalUrl.endsWith('/pdf') ||
        req.originalUrl.endsWith('consolidated'); // Por si se exporta el consolidado

    if (isResourceRoute) {
        return authenticateUrlToken(req, res, next);
    }

    const authHeader = req.headers['authorization'];
    // [C-02] SEGURIDAD: Solo se acepta token en header Authorization:Bearer.
    // Eliminado soporte por query param (?token=...) para prevenir exposición en logs y historial.
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('[Auth] Token verification failed:', err.message);
            return res.status(401).json({ message: 'Token inválido o expirado.' });
        }
        req.user = user;
        next();
    });
};

// [C-02 - EXCEPCIÓN] Para endpoints de visualización de archivos e imágenes (<img src="...">) y descargas
// nativas del navegador, se permite el token por URL ya que no se pueden inyectar headers en esas peticiones.
export const authenticateUrlToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('[Auth-URL] Token verification failed:', err.message);
            return res.status(401).json({ message: 'Token inválido o expirado.' });
        }
        req.user = user;
        next();
    });
};

export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: 'No autenticado.' });

        // [A-04] SEGURIDAD: Comparación exacta de roles para evitar bypass con nombres similares
        const userProfile = req.user.profile || '';
        const userRoles = userProfile.split(',').map(r => r.trim());
        const hasRole = roles.some(role => userRoles.includes(role));

        if (!hasRole) {
            return res.status(403).json({ message: 'No tienes permiso para realizar esta acción.' });
        }
        next();
    };
};
