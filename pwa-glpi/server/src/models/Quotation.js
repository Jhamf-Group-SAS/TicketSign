import mongoose from 'mongoose';
import Counter from './Counter.js';

const commentSchema = new mongoose.Schema({
    author: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}, { _id: true });

const quotationSchema = new mongoose.Schema({
    quotation_number: { type: Number, unique: true },
    title: { type: String, required: true },
    description: String,
    company: String, // Empresa relacionada (manual)

    // Datos económicos
    amount: { type: Number, default: 0 },
    currency: { type: String, enum: ['COP', 'USD', 'EUR'], default: 'COP' },
    supplier: String, // Nombre del proveedor

    // Vínculo con GLPI (opcional)
    glpi_ticket_id: String,

    // Archivo adjunto (principal/PDF)
    file_url: String,       // Ruta relativa en el servidor
    file_name: String,      // Nombre original del archivo
    file_type: String,      // MIME type

    // Imágenes adicionales
    images: [{
        url: String,
        name: String,
        mimetype: String
    }],

    // Estado y flujo
    status: {
        type: String,
        enum: ['PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'COMPRADA', 'CANCELADA'],
        default: 'PENDIENTE'
    },
    priority: {
        type: String,
        enum: ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'],
        default: 'MEDIA'
    },

    // Asignación
    assigned_to: String,  // Username del responsable de compras
    createdBy: { type: String, required: true },
    createdByName: String,

    // Datos de rechazo
    rejection_reason: String,

    // Datos de compra
    purchase_order: String, // Número de OC
    purchase_date: Date,

    // Hilo de comentarios internos
    comments: [commentSchema],

    // Etiquetas libres
    tags: [String],

    // Historial de cambios de estado
    history: [{
        from: String,
        to: String,
        by: String,
        at: { type: Date, default: Date.now },
        note: String
    }],

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

quotationSchema.pre('save', async function (next) {
    this.updatedAt = Date.now();

    if (this.isNew && !this.quotation_number) {
        try {
            const counter = await Counter.findByIdAndUpdate(
                { _id: 'quotation_number' },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            this.quotation_number = counter.seq;
        } catch (error) {
            return next(error);
        }
    }
    next();
});

export default mongoose.model('Quotation', quotationSchema);
