import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';

import syncRoutes from './routes/sync.js';
import authRoutes from './routes/auth.js';
import reportsRoutes from './routes/reports.js';
import tasksRoutes from './routes/tasks.js';

const app = express();
const PORT = process.env.PORT || 5000;

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ticketsign';
console.log(`[Database] Intentando conectar a: ${MONGO_URI}`);

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000, // Tiempo de espera para la conexión
})
    .then(() => {
        console.log('✅ Connected to MongoDB');
        // Listar colecciones para verificar acceso
        mongoose.connection.db.listCollections().toArray().then(cols => {
            console.log(`[Database] Colecciones encontradas: ${cols.map(c => c.name).join(', ')}`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        console.error('Asegúrate de que el servicio de MongoDB esté corriendo localmente.');
    });

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected (local mode)',
        timestamp: new Date().toISOString()
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/tasks', tasksRoutes);

// Routes placeholders
// app.use('/api/auth', authRoutes);
// app.use('/api/sync', syncRoutes);
// app.use('/api/glpi', glpiRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
