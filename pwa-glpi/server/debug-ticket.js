import 'dotenv/config';
import axios from 'axios';

// Replicamos la config manualmente para no depender de la instancia si algo falla, 
// o usamos la instancia. Usemos axios directo para simplificar y ver TODO raw.

const apiUrl = process.env.GLPI_API_URL;
const appToken = process.env.GLPI_APP_TOKEN;
const userToken = process.env.GLPI_USER_TOKEN;

async function debugTicket() {
    console.log('--- DEBUG TICKET 716 ---');
    console.log('URL:', apiUrl);

    try {
        // 1. Init Session
        const sessionRes = await axios.get(`${apiUrl}/initSession`, {
            params: { get_full_session: true },
            headers: {
                'App-Token': appToken,
                'Authorization': `user_token ${userToken}`
            }
        });
        const sessionToken = sessionRes.data.session_token;
        console.log('Session Token:', sessionToken);

        // 2. Get Ticket 716
        console.log('Fetching Ticket 716...');
        const ticketRes = await axios.get(`${apiUrl}/Ticket/716`, {
            params: { expand_dropdowns: true },
            headers: {
                'App-Token': appToken,
                'Session-Token': sessionToken
            }
        });

        console.log('--- TICKET DATA (Raw) ---');
        console.log(JSON.stringify(ticketRes.data, null, 2));

        // 3. Get Ticket Actors (Requester) explicitly
        console.log('--- TICKET ACTORS (Ticket_User) ---');
        const actorsRes = await axios.get(`${apiUrl}/Ticket/716/Ticket_User`, {
            params: { expand_dropdowns: true },
            headers: {
                'App-Token': appToken,
                'Session-Token': sessionToken
            }
        });
        console.log(JSON.stringify(actorsRes.data, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

debugTicket();
