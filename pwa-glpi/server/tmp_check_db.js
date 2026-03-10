import 'dotenv/config';
import mongoose from 'mongoose';
import Quotation from './src/models/Quotation.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ticketsign';

async function checkPaths() {
    try {
        await mongoose.connect(MONGO_URI);
        const qs = await Quotation.find({}).sort({ createdAt: -1 }).limit(10);
        console.log(JSON.stringify(qs.map(q => ({
            id: q._id,
            title: q.title,
            file_url: q.file_url,
            images: q.images.map(i => i.url)
        })), null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkPaths();
