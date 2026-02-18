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
import glpiRoutes from './routes/glpi.js';

import reminderService from './services/reminder.js';

const app = express();
const PORT = process.env.PORT || 5000;

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ticketsign';
console.log(`[Database] Intentando conectar a: ${MONGO_URI}`);

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

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/glpi', glpiRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    // Arrancamos el servicio AQUÍ para que siempre inicie
    reminderService.start();
});
