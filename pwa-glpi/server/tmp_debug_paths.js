import 'dotenv/config';
import mongoose from 'mongoose';
import Quotation from './src/models/Quotation.js';

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ticketsign');
        const qs = await Quotation.find({});
        const counts = {
            total: qs.length,
            inQuotations: 0,
            inUploadsRoot: 0,
            other: 0
        };

        qs.forEach(q => {
            const urls = [q.file_url, ...(q.images || []).map(i => i.url)].filter(Boolean);
            urls.forEach(url => {
                if (url.includes('quotations')) counts.inQuotations++;
                else if (url.startsWith('uploads')) counts.inUploadsRoot++;
                else counts.other++;
            });
        });

        console.log(JSON.stringify(counts, null, 2));

        const oddOnes = qs.filter(q => {
            const urls = [q.file_url, ...(q.images || []).map(i => i.url)].filter(Boolean);
            return urls.some(u => !u.includes('quotations'));
        });

        if (oddOnes.length > 0) {
            console.log('Sample of odd path:', oddOnes[0].file_url || oddOnes[0].images[0].url);
        }

    } catch (e) { console.error(e); }
    finally { mongoose.disconnect(); }
}
check();
