import mongoose from 'mongoose';

const ConfigurationSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Configuration = mongoose.model('Configuration', ConfigurationSchema);

export default Configuration;
