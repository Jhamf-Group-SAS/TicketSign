// [ESM FIX] dotenv/config debe ser el PRIMER import para que process.env
// esté poblado antes de que cualquier otro módulo (ej: crypto.js) se evalúe.
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';

import syncRoutes from './routes/sync.js';
import authRoutes from './routes/auth.js';
import reportsRoutes from './routes/reports.js';
import tasksRoutes from './routes/tasks.js';
import glpiRoutes from './routes/glpi.js';
import quotationsRoutes from './routes/quotations.js';
import configRoutes from './routes/config.js';

import reminderService from './services/reminder.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Asegurar que el directorio de uploads existe
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`[System] Directorio '${uploadsDir}' creado.`);
}

// AUDIT-006: CORS con lista blanca de orígenes
const allowedOrigins = [
    'https://ticketsign.jhamf.com',
    ...(process.env.NODE_ENV !== 'production'
        ? [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://localhost:3003',
            'http://localhost:4173'
        ]
        : [])
];
const corsOptions = {
    origin: (origin, callback) => {
        // Permitir peticiones sin origen (ej. curl, Postman, servidores internos)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`Origen no permitido por CORS: ${origin}`));
        }
    },
    credentials: true,
    exposedHeaders: ["Content-Disposition"]
};

// AUDIT-005: Rate limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10,
    message: { status: 'error', message: 'Demasiados intentos de inicio de sesión. Intente de nuevo en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    message: { status: 'error', message: 'Límite de solicitudes API alcanzado. Intente de nuevo en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

// [FALLBACK] En Docker/Producción, el host de la DB se llama 'mongo'
const DEFAULT_MONGO = process.env.NODE_ENV === 'production'
    ? 'mongodb://mongo:27017/ticketsign'
    : 'mongodb://127.0.0.1:27017/ticketsign';

const MONGO_URI = process.env.MONGO_URI || DEFAULT_MONGO;

if (!process.env.MONGO_URI && process.env.NODE_ENV === 'production') {
    console.warn(`[Database] ⚠️ MONGO_URI no definida. Usando fallback de red Docker: ${MONGO_URI}`);
}

const maskedURI = MONGO_URI.replace(/\/\/.*@/, '//****:****@');
console.log(`[Database] Intentando conectar a: ${maskedURI}`);

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
})
    .then(() => {
        console.log('✅ Connected to MongoDB');
        mongoose.connection.db.listCollections().toArray().then(cols => {
            console.log(`[Database] Colecciones encontradas: ${cols.map(c => c.name).join(', ')}`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
    });

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: false, // Permitir iframes (necesario para previsualización de PDF)
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "frame-ancestors": ["'self'", ...allowedOrigins],
            "img-src": ["'self'", "data:", "blob:", "*", "https:"],
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
            "media-src": ["'self'", "https://assets.mixkit.co", "https:", "*"]
        }
    }
}));
app.use(cors(corsOptions));           // AUDIT-006: Solo orígenes permitidos
app.use(express.json({ limit: '1mb' })); // AUDIT-008: Reducido de 50mb

// AUDIT-011: /health restringido a consultantes internos (sin datos sensibles)
app.get('/health', (req, res) => {
    const origin = req.headers.origin || req.socket.remoteAddress;
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

app.use('/api/auth/login', loginLimiter); // AUDIT-005: Rate limit en login
app.use('/api/', apiLimiter);             // AUDIT-005: Rate limit general
app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/glpi', glpiRoutes);
app.use('/api/quotations', quotationsRoutes);
app.use('/api/config', configRoutes);

// [M-04] SEGURIDAD: El directorio uploads NO se sirve estáticamente al público.
// Los archivos se acceden mediante rutas autenticadas en /api/quotations/view/:filename
// app.use('/uploads', express.static('uploads')); // ELIMINADO por seguridad

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    // Arrancamos el servicio AQUÍ para que siempre inicie
    reminderService.start();
});
