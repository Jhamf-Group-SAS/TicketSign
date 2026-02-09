import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Task from './models/Task.js';
import Act from './models/Act.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ticketsign';

async function resetDatabase() {
    try {
        console.log(`[Reset] Conectando a MongoDB en: ${MONGO_URI}...`);
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a MongoDB');

        console.log('🗑️ Eliminando todas las Tareas...');
        const tasksResult = await Task.deleteMany({});
        console.log(`   -> Eliminadas ${tasksResult.deletedCount} tareas.`);

        console.log('🗑️ Eliminando todas las Actas...');
        const actsResult = await Act.deleteMany({});
        console.log(`   -> Eliminadas ${actsResult.deletedCount} actas.`);

        console.log('✅ Base de datos limpia.');
    } catch (error) {
        console.error('❌ Error limpiando base de datos:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

resetDatabase();
