import mongoose from 'mongoose';

// [SEC-DB1] Claves de configuración permitidas explícitamente (whitelist a nivel de modelo)
export const ALLOWED_CONFIG_KEYS = [
    // Integración GLPI
    'glpi_api_url', 'glpi_app_token', 'glpi_user_token',
    // Integración WhatsApp
    'whatsapp_phone_id', 'whatsapp_business_id', 'whatsapp_token',
    'whatsapp_template_name', 'whatsapp_lang',
    // Branding y UI
    'loginImage', 'notificationSound', 'pdfLogo', 'pdfFooter', 'theme',
    // Preferencias de PDF
    'pdfIncludePhotos', 'pdfIncludeSignatures',
    // PWA
    'serviceWorker', 'pushNotifications',
    // Sync
    'autoSync', 'syncRetryInterval',
    // Notificaciones WhatsApp
    'waNotifyAssign', 'waAutoReminders', 'waDuplicateControl'
];

const ConfigurationSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        maxlength: 100,
        // [SEC-DB1] Validar contra whitelist
        validate: {
            validator: (k) => ALLOWED_CONFIG_KEYS.includes(k),
            message: (props) => `'${props.value}' no es una clave de configuración permitida`
        }
    },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Configuration = mongoose.model('Configuration', ConfigurationSchema);

export default Configuration;
