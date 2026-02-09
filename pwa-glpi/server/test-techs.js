import dotenv from 'dotenv';
dotenv.config();
import glpi from './src/services/glpi.js';

async function test() {
    try {
        console.log('Iniciando prueba de técnicos...');
        const techs = await glpi.getEligibleTechnicians();
        console.log('Técnicos recibidos:', techs.length);
        console.log(techs);
    } catch (err) {
        console.error('Error en prueba:', err);
    }
}

test();
