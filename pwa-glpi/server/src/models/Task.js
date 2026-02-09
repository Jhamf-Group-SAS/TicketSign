import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    type: {
        type: String,
        enum: ['PREVENTIVO', 'CORRECTIVO'],
        default: 'CORRECTIVO'
    },
    priority: {
        type: String,
        enum: ['BAJA', 'MEDIA', 'ALTA'],
        default: 'MEDIA'
    },
    status: {
        type: String,
        enum: ['PROGRAMADA', 'ASIGNADA', 'EN_EJECUCION', 'CANCELADA', 'COMPLETADA'],
        default: 'PROGRAMADA'
    },
    scheduled_at: { type: Date },
    assigned_technicians: [String], // IDs de usuarios o nombres
    glpi_ticket_id: String,
    equipment_service: String,
    acta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Act' },
    createdBy: { type: String, required: true }, // Username del creador
    isPrivate: { type: Boolean, default: false },
    reminder_at: { type: Date },
    reminder_sent: { type: Boolean, default: false },
    recurrence: {
        type: String,
        enum: ['NINGUNA', 'DIARIA', 'SEMANAL', 'MENSUAL'],
        default: 'NINGUNA'
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Middleware para actualizar updatedAt
taskSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('Task', taskSchema);
