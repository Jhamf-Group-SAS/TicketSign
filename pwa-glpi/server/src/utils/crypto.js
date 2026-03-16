import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// [C-01] Validación lazy: se ejecuta la primera vez que se usa encrypt/decrypt,
// no al importar el módulo. Esto evita el problema de ESM donde process.env
// puede no estar cargado en el momento en que el módulo se resuelve.
let _key = null;
function getKey() {
    if (_key) return _key;

    const rawKey = (process.env.ENCRYPTION_KEY || '').trim();

    if (!rawKey) {
        throw new Error('[CRÍTICO] ENCRYPTION_KEY no está definida en las variables de entorno.');
    }

    if (rawKey.length !== 64) {
        console.error(`[Crypto] Error de longitud: Detectados ${rawKey.length} caracteres.`);
        throw new Error(`[CRÍTICO] ENCRYPTION_KEY debe ser una cadena hexadecimal de 64 caracteres (32 bytes). Actual: ${rawKey.length}`);
    }

    _key = Buffer.from(rawKey, 'hex');
    return _key;
}

/**
 * Encrypts a string
 */
export const encrypt = (text) => {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

/**
 * Decrypts a string
 */
export const decrypt = (text) => {
    if (!text || typeof text !== 'string' || !text.includes(':')) return text;
    try {
        const textParts = text.split(':');
        if (textParts.length < 2) return text;

        const ivHex = textParts[0];
        // IV hex string should be 32 chars (16 bytes)
        if (ivHex.length !== 32 || !/^[0-9a-fA-F]+$/.test(ivHex)) {
            return text;
        }

        const iv = Buffer.from(ivHex, 'hex');
        const encryptedText = Buffer.from(textParts.slice(1).join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        // Fallback for strings that pass the regex but are not valid IVs or payloads
        // console.error('[Crypto] Decryption failed:', error.message);
        return text;
    }
};
