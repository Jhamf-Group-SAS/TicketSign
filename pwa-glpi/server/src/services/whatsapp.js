import axios from 'axios';

class WhatsAppService {
    config() {
        return {
            phoneId: process.env.WHATSAPP_PHONE_ID,
            token: process.env.WHATSAPP_TOKEN,
            templateName: process.env.WHATSAPP_TEMPLATE_NAME || 'notificacion_de_tarea_asignada',
            lang: process.env.WHATSAPP_LANG || 'es'
        };
    }

    /**
     * Envía una notificación de tarea asignada vía WhatsApp
     * @param {string} to - Número de teléfono (con código de país, ej: 573001234567)
     * @param {Object} data - Datos de la tarea { techName, title, description, date }
     */
    async sendTaskNotification(to, data) {
        const { phoneId, token, templateName, lang } = this.config();

        if (!to || !phoneId || !token) {
            console.error('[WhatsApp] Falta configuración o destinatario');
            return false;
        }

        // Limpiar el número de teléfono (solo números)
        const cleanTo = to.replace(/\D/g, '');

        try {
            const url = `https://graph.facebook.com/v18.0/${this.phoneId}/messages`;

            const payload = {
                messaging_product: "whatsapp",
                to: cleanTo,
                type: "template",
                template: {
                    name: this.templateName,
                    language: {
                        code: this.lang
                    },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: data.techName || 'Técnico' },
                                { type: "text", text: data.title || 'Nueva Tarea' },
                                { type: "text", text: data.description || 'Sin descripción' },
                                { type: "text", text: data.date || 'Pendiente' }
                            ]
                        }
                    ]
                }
            };

            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`[WhatsApp] Mensaje enviado a ${cleanTo}:`, response.data);
            return true;
        } catch (error) {
            console.error('[WhatsApp] Error enviando mensaje:', error.response?.data || error.message);
            return false;
        }
    }
}

export default new WhatsAppService();
