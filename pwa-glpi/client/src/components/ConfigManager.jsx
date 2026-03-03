import React, { useState, useEffect } from 'react';
import {
    Save,
    Link as LinkIcon,
    MessageCircle,
    Printer,
    Smartphone,
    Loader2,
    CheckCircle2,
    Upload,
    X,
    Image as ImageIcon,
    Trash2,
    Music,
    Volume2,
    Palette
} from 'lucide-react';
import { db } from '../store/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '../utils/cn';

const ConfigManager = ({ onBack, onLogout }) => {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [saved, setSaved] = useState(false);
    const [uiSettings, setUiSettings] = useState({
        loginImage: '',
        notificationSound: ''
    });

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    const token = localStorage.getItem('glpi_pro_token');

    // Configuration State
    const [config, setConfig] = useState({
        glpi_api_url: '',
        glpi_app_token: '',
        glpi_user_token: '',
        autoSync: true,
        syncRetryInterval: 60,

        whatsapp_phone_id: '',
        whatsapp_business_id: '',
        whatsapp_token: '',
        whatsapp_template_name: 'notificacion_tarea',
        whatsapp_lang: 'es',
        waNotifyAssign: true,
        waAutoReminders: true,
        waDuplicateControl: true,

        pdfLogo: '',
        pdfFooter: 'Empresa XYZ S.A.S.',
        pdfIncludePhotos: true,
        pdfIncludeSignatures: true,

        serviceWorker: true,
        pushNotifications: false
    });

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/config`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.status === 401 || res.status === 403) {
                    if (onLogout) onLogout();
                    return;
                }
                if (res.ok) {
                    const data = await res.json();
                    setConfig(prev => ({ ...prev, ...data }));
                }
            } catch (error) {
                // error fetching config
            } finally {
                setFetching(false);
            }
        };
        fetchConfig();

        // Load UI Settings from local DB
        const loadUISettings = async () => {
            const settings = await db.settings.toArray();
            const uiMap = {};
            settings.forEach(s => uiMap[s.key] = s.value);
            setUiSettings(prev => ({ ...prev, ...uiMap }));
        };
        loadUISettings();
    }, [API_BASE_URL, token, onLogout]);

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert('La imagen es muy pesada. Máximo 2MB.');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setConfig({ ...config, pdfLogo: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(config)
            });
            if (res.status === 401 || res.status === 403) {
                if (onLogout) onLogout();
                return;
            }
            if (res.ok) {
                setSaved(true);
                // Save UI settings to local DB
                await db.settings.put({ key: 'loginImage', value: uiSettings.loginImage });
                await db.settings.put({ key: 'notificationSound', value: uiSettings.notificationSound });

                setTimeout(() => setSaved(false), 3000);
            }
        } catch (error) {
            // error saving config
        } finally {
            setLoading(false);
        }
    };

    const handleLoginImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert('La imagen es muy pesada. Máximo 2MB.');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setUiSettings({ ...uiSettings, loginImage: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSoundUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 1024 * 1024) {
                alert('El audio es muy pesado. Máximo 1MB.');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setUiSettings({ ...uiSettings, notificationSound: reader.result });
                // Play preview
                new Audio(reader.result).play().catch(e => console.warn("No se pudo reproducir audio", e));
            };
            reader.readAsDataURL(file);
        }
    };

    const InputField = ({ label, value, onChange, type = "text", placeholder, isPassword, fieldId }) => (
        <div className="space-y-1.5 flex-1">
            <label className="text-[11px] font-[700] text-[#64748b] uppercase tracking-wider block ml-1">{label}</label>
            <div className="relative">
                <input
                    type={isPassword ? "password" : type}
                    value={value}
                    onChange={(e) => setConfig({ ...config, [fieldId]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full h-[48px] bg-tertiary border border-color rounded-[12px] px-4 text-[14px] font-[500] text-text-primary outline-none focus:border-primary-500 transition-all placeholder:text-text-muted/40"
                />
            </div>
        </div>
    );

    const ToggleField = ({ label, description, checked, onChange, disabled }) => (
        <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
                <p className="text-[14px] font-[700] text-[#1e293b]">{label}</p>
                {description && <p className="text-[11px] text-[#94a3b8] font-[500]">{description}</p>}
            </div>
            <button
                onClick={() => !disabled && onChange(!checked)}
                className={cn(
                    "w-[44px] h-[24px] rounded-full relative transition-all duration-300",
                    checked ? "bg-primary-500" : "bg-tertiary border border-color",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
            >
                <div className={cn(
                    "absolute top-[3px] w-[18px] h-[18px] bg-secondary rounded-full transition-all duration-300 shadow-sm",
                    checked ? "left-[23px]" : "left-[3px]"
                )} />
            </button>
        </div>
    );

    if (fetching) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 size={40} className="animate-spin text-[#0695c4]" />
                <p className="text-[14px] font-[600] text-[#64748b]">Cargando configuración...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-20">
            {/* Header Area */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-[28px] font-[800] text-text-primary tracking-tight">Configuración</h2>
                    <p className="text-[14px] font-[500] text-text-muted mt-1">
                        Credenciales, integraciones y preferencias del sistema
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className={cn(
                        "h-[48px] px-6 rounded-[12px] text-[14px] font-[700] flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary-500/20 border border-primary-400/30",
                        saved ? "bg-emerald-500 text-white" : "bg-primary-500 text-white hover:bg-primary-600"
                    )}
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
                    {loading ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-8">
                    {/* GLPI Integration */}
                    <section className="bg-secondary rounded-[20px] p-8 border border-color shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <LinkIcon size={18} className="text-primary-500" />
                            <h3 className="text-[14px] font-[800] text-text-primary uppercase tracking-wider">Integración GLPI</h3>
                        </div>
                        <div className="space-y-5">
                            <InputField label="URL del servidor GLPI" value={config.glpi_api_url} fieldId="glpi_api_url" placeholder="https://glpi.domain.com/apirest.php" />
                            <InputField label="App Token" value={config.glpi_app_token} fieldId="glpi_app_token" isPassword />
                            <InputField label="User Token" value={config.glpi_user_token} fieldId="glpi_user_token" isPassword />

                            <div className="pt-2 border-t border-[#f1f5f9] space-y-4">
                                <ToggleField
                                    label="Sincronización automática"
                                    description="Pull cada 5 minutos cuando hay conexión"
                                    checked={config.autoSync}
                                    onChange={(v) => setConfig({ ...config, autoSync: v })}
                                />
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-[14px] font-[700] text-[#1e293b]">Intervalo de reintento Sync</p>
                                        <p className="text-[11px] text-[#94a3b8] font-[500]">Segundos entre reintentos offline</p>
                                    </div>
                                    <input
                                        type="number"
                                        value={config.syncRetryInterval}
                                        onChange={(e) => setConfig({ ...config, syncRetryInterval: e.target.value })}
                                        className="w-[80px] h-[40px] bg-tertiary border border-color rounded-lg text-center font-[700] text-text-primary"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* WhatsApp Cloud API */}
                    <section className="bg-secondary rounded-[20px] p-8 border border-color shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <MessageCircle size={18} className="text-primary-500" />
                            <h3 className="text-[14px] font-[800] text-text-primary uppercase tracking-wider">WhatsApp Cloud API</h3>
                        </div>
                        <div className="space-y-5">
                            <InputField label="Phone Number ID" value={config.whatsapp_phone_id} fieldId="whatsapp_phone_id" placeholder="ID numérico..." isPassword />
                            <InputField label="WhatsApp Business Account ID" value={config.whatsapp_business_id} fieldId="whatsapp_business_id" placeholder="ID numérico..." isPassword />
                            <InputField label="Access Token" value={config.whatsapp_token} fieldId="whatsapp_token" isPassword />
                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Nombre Plantilla" value={config.whatsapp_template_name} fieldId="whatsapp_template_name" placeholder="notificacion_tarea" />
                                <InputField label="Idioma" value={config.whatsapp_lang} fieldId="whatsapp_lang" placeholder="es" />
                            </div>

                            <div className="pt-2 border-t border-[#f1f5f9] space-y-4">
                                <ToggleField
                                    label="Notificaciones de asignación"
                                    description="Enviar WA al asignar técnico"
                                    checked={config.waNotifyAssign}
                                    onChange={(v) => setConfig({ ...config, waNotifyAssign: v })}
                                />
                                <ToggleField
                                    label="Recordatorios automáticos"
                                    description="Via ReminderService"
                                    checked={config.waAutoReminders}
                                    onChange={(v) => setConfig({ ...config, waAutoReminders: v })}
                                />
                                <ToggleField
                                    label="Control de duplicados"
                                    description="Flag reminder_sent en servidor"
                                    checked={config.waDuplicateControl}
                                    onChange={(v) => setConfig({ ...config, waDuplicateControl: v })}
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                    {/* PDF Generation */}
                    <section className="bg-secondary rounded-[20px] p-8 border border-color shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Printer size={18} className="text-primary-500" />
                            <h3 className="text-[14px] font-[800] text-text-primary uppercase tracking-wider">Generación de PDFs</h3>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-[700] text-[#64748b] uppercase tracking-wider block ml-1">Logo de la empresa</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1 group">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-primary-500">
                                            <LinkIcon size={16} />
                                        </div>
                                        <input
                                            type="text"
                                            value={config.pdfLogo}
                                            onChange={(e) => setConfig({ ...config, pdfLogo: e.target.value })}
                                            placeholder="URL de imagen (https://...)"
                                            className="w-full h-[45px] bg-tertiary border border-color rounded-[12px] pl-10 pr-4 text-[13px] font-[500] text-text-primary outline-none focus:border-primary-500 transition-all placeholder:text-text-muted/30"
                                        />
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="logo-upload"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                        />
                                        <label
                                            htmlFor="logo-upload"
                                            className="h-[45px] px-4 bg-tertiary border border-color rounded-[12px] flex items-center gap-2 cursor-pointer hover:bg-secondary transition-all text-text-muted hover:text-primary-500 shadow-sm border-dashed"
                                            title="Subir desde mi equipo"
                                        >
                                            <Upload size={16} />
                                            <span className="text-[12px] font-bold">Subir</span>
                                        </label>
                                    </div>
                                </div>

                                {config.pdfLogo && (
                                    <div className="mt-3 p-3 bg-tertiary/50 border border-color rounded-xl flex items-center justify-between animate-in zoom-in-95 duration-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-secondary rounded-lg border border-color flex items-center justify-center p-1 overflow-hidden shadow-inner">
                                                <img
                                                    src={config.pdfLogo}
                                                    alt="Preview"
                                                    className="max-w-full max-h-full object-contain"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = 'https://via.placeholder.com/150?text=Error';
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-text-primary uppercase tracking-wider">Logo configurado</p>
                                                <p className="text-[9px] text-text-muted truncate max-w-[150px] font-bold">
                                                    {config.pdfLogo.startsWith('data:') ? 'Imagen local (Base64)' : 'URL externa vinculada'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setConfig({ ...config, pdfLogo: '' })}
                                            className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                            title="Eliminar logo"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <InputField label="Pie de página del PDF" value={config.pdfFooter} fieldId="pdfFooter" placeholder="Empresa S.A.S..." />

                            <div className="pt-2 border-t border-[#f1f5f9] space-y-4">
                                <ToggleField
                                    label="Incluir fotos en PDF"
                                    description="Adjuntar evidencia fotográfica"
                                    checked={config.pdfIncludePhotos}
                                    onChange={(v) => setConfig({ ...config, pdfIncludePhotos: v })}
                                />
                                <ToggleField
                                    label="Incluir firma digital"
                                    description="Base64 embebida en el documento"
                                    checked={config.pdfIncludeSignatures}
                                    onChange={(v) => setConfig({ ...config, pdfIncludeSignatures: v })}
                                />
                            </div>
                        </div>
                    </section>

                    {/* PWA & Offline */}
                    <section className="bg-secondary rounded-[20px] p-8 border border-color shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Smartphone size={18} className="text-primary-500" />
                            <h3 className="text-[14px] font-[800] text-text-primary uppercase tracking-wider">PWA y Offline</h3>
                        </div>
                        <div className="space-y-4">
                            <ToggleField
                                label="Modo Offline-First"
                                description="Dexie.js + IndexedDB (siempre activo)"
                                checked={config.offlineFirst}
                                onChange={() => { }}
                                disabled={true}
                            />
                            <ToggleField
                                label="Service Worker activo"
                                description="vite-plugin-pwa"
                                checked={config.serviceWorker}
                                onChange={(v) => setConfig({ ...config, serviceWorker: v })}
                            />
                            <ToggleField
                                label="Notificaciones push"
                                description="Alertas de sincronización en dispositivo"
                                checked={config.pushNotifications}
                                onChange={(v) => setConfig({ ...config, pushNotifications: v })}
                            />
                        </div>
                    </section>

                    {/* Branding Personalization */}
                    <section className="bg-secondary rounded-[20px] p-8 border border-color shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Palette size={18} className="text-primary-500" />
                            <h3 className="text-[14px] font-[800] text-text-primary uppercase tracking-wider">Personalización de Marca</h3>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-[700] text-[#64748b] uppercase tracking-wider block ml-1">Imagen de Login (Inicio de Sesión)</label>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="login-image-upload"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleLoginImageUpload}
                                        />
                                        <label
                                            htmlFor="login-image-upload"
                                            className="h-[100px] min-w-[120px] px-4 bg-tertiary border border-color rounded-[20px] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-secondary transition-all text-text-muted hover:text-primary-500 shadow-sm border-dashed overflow-hidden"
                                        >
                                            {uiSettings.loginImage ? (
                                                <img src={uiSettings.loginImage} className="max-w-full h-full object-contain" />
                                            ) : (
                                                <>
                                                    <ImageIcon size={24} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-center">Cambiar<br />Imagen</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="text-[13px] font-[700] text-text-primary">Fondo de Login</p>
                                        <p className="text-[11px] text-text-muted font-[500] leading-relaxed">
                                            Dimensiones sugeridas: <strong className="text-primary-500">600x200px</strong> (Rectangular) o <strong className="text-primary-500">400x400px</strong> (Cuadrado).<br />
                                            Asegúrese de usar un fondo transparente (.png) para mejores resultados. Máx 2MB.
                                        </p>
                                        {uiSettings.loginImage && (
                                            <button
                                                onClick={() => setUiSettings({ ...uiSettings, loginImage: '' })}
                                                className="text-[11px] font-[700] text-red-500 flex items-center gap-1 mt-2 hover:underline"
                                            >
                                                <Trash2 size={12} /> Restablecer por defecto
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Notifications & Tones */}
                    <section className="bg-secondary rounded-[20px] p-8 border border-color shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Volume2 size={18} className="text-primary-500" />
                            <h3 className="text-[14px] font-[800] text-text-primary uppercase tracking-wider">Notificaciones y Sonidos</h3>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-[700] text-[#64748b] uppercase tracking-wider block ml-1">Tono de Notificación Personalizado</label>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="sound-upload"
                                            className="hidden"
                                            accept="audio/*"
                                            onChange={handleSoundUpload}
                                        />
                                        <label
                                            htmlFor="sound-upload"
                                            className="h-[100px] w-[100px] bg-tertiary border border-color rounded-[20px] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-secondary transition-all text-text-muted hover:text-primary-500 shadow-sm border-dashed"
                                        >
                                            {uiSettings.notificationSound ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <Music size={24} className="text-primary-500 animate-bounce" />
                                                    <span className="text-[8px] font-black uppercase text-primary-500 mt-1">Cargado</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <Volume2 size={24} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-center">Subir<br />Audio</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="text-[13px] font-[700] text-text-primary">Sonido de Alerta</p>
                                        <p className="text-[11px] text-text-muted font-[500]">Archivos de audio (MP3, WAV). Máx 1MB. El sonido se escuchará al llegar nuevas tareas o recordatorios.</p>
                                        {uiSettings.notificationSound && (
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => new Audio(uiSettings.notificationSound).play()}
                                                    className="text-[11px] font-[700] text-primary-500 flex items-center gap-1 mt-2 hover:underline"
                                                >
                                                    <Music size={12} /> Probar sonido
                                                </button>
                                                <button
                                                    onClick={() => setUiSettings({ ...uiSettings, notificationSound: '' })}
                                                    className="text-[11px] font-[700] text-red-500 flex items-center gap-1 mt-2 hover:underline"
                                                >
                                                    <Trash2 size={12} /> Restablecer
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default ConfigManager;
