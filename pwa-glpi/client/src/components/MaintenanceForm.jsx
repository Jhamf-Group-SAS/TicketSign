import { useState, useEffect } from 'react';
import {
    Package,
    ClipboardList,
    User,
    Building2,
    Monitor,
    Laptop,
    ShieldCheck,
    Settings2,
    FileCheck,
    CheckCircle2,
    AlertCircle,
    Save,
    Printer,
    Wifi,
    Zap,
    Layers,
    Cpu,
    Database,
    Mouse,
    Globe,
    Keyboard,
    Power,
    Calendar,
    Wrench,
    Hammer,
    Wind,
    Thermometer,
    Fan,
    Camera,
    PenTool,
    HardDrive
} from 'lucide-react';
import SignaturePad from './SignaturePad';
import PhotoCapture from './PhotoCapture';
import { toast } from './Toast';
import { saveDraftAct, markForSync, db } from '../store/db';
import SyncService from '../services/SyncService';
import CustomSelect from './CustomSelect';
import CustomDatePicker from './CustomDatePicker';
import { cn } from '../utils/cn';

const RAM_OPTIONS = ['4 GB', '8 GB', '12 GB', '16 GB', '32 GB', '64 GB', 'OTRO'];
const DISK_OPTIONS = ['120 GB', '240 GB', '480 GB', '512 GB', '1 TB', '2 TB', 'OTRO'];
const DISK_TYPE_OPTIONS = ['SSD', 'HDD', 'NVMe'];
const PROCESSOR_OPTIONS = ['Core i3', 'Core i5', 'Core i7', 'Core i9', 'Ryzen 3', 'Ryzen 5', 'Ryzen 7', 'Ryzen 9', 'Celeron', 'Pentium', 'Xeon'];

const DEVICE_TYPES = [
    { id: 'COMPUTADOR', label: 'Laptop', icon: Laptop },
    { id: 'IMPRESORA', label: 'Impresora', icon: Printer },
    { id: 'REDES', label: 'Redes', icon: Wifi },
    { id: 'PERIFERICO', label: 'Periférico', icon: Mouse },
    { id: 'OTRO', label: 'Otro', icon: Settings2 }
];

const PREVENTIVE_CHECKLIST = [
    { id: 'limpieza_interna', label: 'Limpieza Interna', icon: Wrench },
    { id: 'soplado', label: 'Soplado de Polvo', icon: Wind },
    { id: 'cambio_pasta', label: 'Cambio de Pasta Térmica', icon: Thermometer },
    { id: 'limpieza_externa', label: 'Limpieza Externa', icon: Wrench },
    { id: 'ajuste_tornilleria', label: 'Ajuste de Tornillería', icon: Hammer },
    { id: 'verificacion_ventiladores', label: 'Verificación Ventiladores', icon: Fan },
    { id: 'organizacion_cables', label: 'Organización Cables', icon: Layers },
    { id: 'revision_voltajes', label: 'Revisión Voltajes', icon: Zap }
];

const DELIVERY_CHECKLIST = [
    { id: 'monitor', label: 'Monitor / Pantalla', icon: Monitor },
    { id: 'teclado', label: 'Teclado', icon: Keyboard },
    { id: 'mouse', label: 'Mouse', icon: Mouse },
    { id: 'cargador', label: 'Cargador / Cable Poder', icon: Power },
    { id: 'maletin', label: 'Maletín / Funda', icon: Package },
    { id: 'cable_video', label: 'Cable Video', icon: Monitor },
    { id: 'so_configurado', label: 'OS Configurado', icon: FileCheck },
    { id: 'perfil_usuario', label: 'Perfil Usuario', icon: User },
    { id: 'unido_dominio', label: 'Unido al Dominio', icon: Globe },
    { id: 'antivirus_instalado', label: 'Antivirus Instalado', icon: ShieldCheck },
    { id: 'aplicaciones_base', label: 'Aplicaciones Base', icon: Layers }
];

const PRINTER_CHECKLIST = [
    { id: 'encendido_funcional', label: 'Encendido Funcional', icon: Power },
    { id: 'conectividad_red', label: 'Conectividad Red', icon: Globe },
    { id: 'nivel_tinta', label: 'Nivel Tinta/Tóner', icon: Zap },
    { id: 'accesorios_impresora', label: 'Accesorios Incluidos', icon: Package }
];

const NETWORK_CHECKLIST = [
    { id: 'luces_ok', label: 'Luces Indicadoras OK', icon: Zap },
    { id: 'puertos_funcionales', label: 'Puertos Funcionales', icon: Layers },
    { id: 'configuracion_inicial', label: 'Configuración Inicial', icon: Settings2 },
    { id: 'documentacion_red', label: 'Documentación Entregada', icon: FileCheck }
];

const PERIPHERAL_CHECKLIST = [
    { id: 'funcionamiento_verificado', label: 'Funcionamiento OK', icon: Power },
    { id: 'cables_completos', label: 'Cables Completos', icon: Layers },
    { id: 'sin_defectos_fabrica', label: 'Sin Defectos', icon: ShieldCheck },
    { id: 'accesorios_periferico', label: 'Accesorios Incluidos', icon: Package }
];

const GENERIC_CHECKLIST = [
    { id: 'encendido_funcional_gen', label: 'Encendido Funcional', icon: Power },
    { id: 'accesorios_completos_gen', label: 'Cables/Accesorios', icon: Package },
    { id: 'sin_defectos_visibles_gen', label: 'Sin Defectos Visibles', icon: ShieldCheck },
    { id: 'documentacion_gen', label: 'Documentación Entregada', icon: FileCheck }
];

const DELIVERY_CHECKLISTS = {
    'COMPUTADOR': DELIVERY_CHECKLIST,
    'IMPRESORA': PRINTER_CHECKLIST,
    'REDES': NETWORK_CHECKLIST,
    'PERIFERICO': PERIPHERAL_CHECKLIST,
    'OTRO': GENERIC_CHECKLIST
};

const MaintenanceForm = ({ type, onCancel, onSave, theme, act }) => {
    const [formData, setFormData] = useState(() => {
        if (act) {
            return {
                ...act,
                checklist: act.checklist || {},
                signatures: act.signatures || { technical: null, client: null },
                photos: act.photos || []
            };
        }

        let initialChecklist = {};
        if (type === 'PREVENTIVO') {
            PREVENTIVE_CHECKLIST.forEach(item => initialChecklist[item.id] = false);
        } else if (type === 'ENTREGA') {
            Object.values(DELIVERY_CHECKLISTS).flat().forEach(item => initialChecklist[item.id] = false);
        } else {
            initialChecklist = { diagnostico: '', falla_reportada: '', accion_realizada: '', repuestos_usados: '', estado_final: 'OPERATIVO' };
        }

        return {
            glpi_ticket_id: '', client_name: '', technical_name: '', equipment_serial: '', equipment_hostname: '',
            equipment_model: '', equipment_ram: '', equipment_ram_other: '', equipment_disk: '', equipment_disk_other: '',
            equipment_disk_type: 'SSD', equipment_processor: '', equipment_type: 'COMPUTADOR', assigned_user: '',
            observations: '', recommendations: '', checklist: initialChecklist, signatures: { technical: null, client: null }, photos: [],
            inventory_number: '', scheduled_date: ''
        };
    });

    const [errors, setErrors] = useState([]);
    const [entities, setEntities] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [isSearchingTicket, setIsSearchingTicket] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerAnchor, setDatePickerAnchor] = useState(null);

    // Resetear formulario si llega un acta asincrónicamente (ej. desde URL / F5)
    useEffect(() => {
        if (act) {
            setFormData({
                ...act,
                checklist: act.checklist || {},
                signatures: act.signatures || { technical: null, client: null },
                photos: act.photos || []
            });
        }
    }, [act]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Cargar instantáneamente desde caché local (IndexedDB)
                const cachedEnt = await SyncService.getCachedEntities();
                const cachedTech = await SyncService.getCachedTechnicians();
                const cachedTick = await SyncService.getCachedTickets();

                if (cachedEnt.length) setEntities(cachedEnt);
                if (cachedTech.length) setTechnicians(cachedTech);
                if (cachedTick.length) setTickets(cachedTick);

                // 2. Sincronizar en segundo plano si hay red
                if (navigator.onLine) {
                    await SyncService.syncGLPICache(); // Actualiza IndexedDB
                    // 3. Refrescar UI con los datos más recientes
                    setEntities(await SyncService.getCachedEntities());
                    setTechnicians(await SyncService.getCachedTechnicians());
                    setTickets(await SyncService.getCachedTickets());
                }
            } catch (e) {
                console.error('Error al inicializar datos del formulario:', e);
            }
        };
        fetchData();
    }, []);

    async function handleTicketSelect(ticketId) {
        const selectedTicket = tickets.find(t => t.id === ticketId);
        if (selectedTicket) {
            const ticket = selectedTicket.original;
            setFormData(prev => ({ ...prev, glpi_ticket_id: String(ticket.id), client_name: ticket.entity_name || prev.client_name, technical_name: ticket.technician_name || prev.technical_name, assigned_user: ticket.requester_name || prev.assigned_user }));
        } else {
            setIsSearchingTicket(true);
            try {
                const token = localStorage.getItem('glpi_pro_token');
                const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
                const response = await fetch(`${baseUrl}/glpi/tickets/${ticketId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (response.ok) {
                    const ticket = await response.json();
                    setFormData(prev => ({ ...prev, glpi_ticket_id: String(ticket.id), client_name: ticket.entity_name || prev.client_name, technical_name: ticket.technician_name || prev.technical_name, assigned_user: ticket.requester_name || prev.assigned_user }));
                } else setFormData(prev => ({ ...prev, glpi_ticket_id: ticketId }));
            } catch (error) { setFormData(prev => ({ ...prev, glpi_ticket_id: ticketId })); } finally { setIsSearchingTicket(false); }
        }
    }

    const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleChecklistChange = (key, value) => setFormData(prev => ({ ...prev, checklist: { ...prev.checklist, [key]: value } }));

    const validateForm = () => {
        const newErrors = [];
        if (!formData.glpi_ticket_id) newErrors.push('glpi_ticket_id');
        if (!formData.client_name) newErrors.push('client_name');
        if (!formData.technical_name) newErrors.push('technical_name');
        if (!formData.equipment_serial) newErrors.push('equipment_serial');
        if (!formData.equipment_hostname) newErrors.push('equipment_hostname');
        if (!formData.equipment_model) newErrors.push('equipment_model');
        if (!formData.assigned_user) newErrors.push('assigned_user');
        if (type === 'CORRECTIVO') {
            ['diagnostico', 'falla_reportada', 'accion_realizada', 'repuestos_usados'].forEach(k => { if (!formData.checklist[k]) newErrors.push(k); });
        }
        if (!formData.observations) newErrors.push('observations');
        if (type !== 'ENTREGA' && !formData.recommendations) newErrors.push('recommendations');
        if (!formData.signatures.technical) newErrors.push('signature_technical');
        if (!formData.signatures.client) newErrors.push('signature_client');

        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const handleSaveDraft = async () => {
        if (!formData.client_name && !formData.glpi_ticket_id) {
            toast.error('Ingrese al menos el cliente o el número de ticket para guardar un borrador');
            return;
        }
        try {
            const draftData = { ...formData, type, status: 'BORRADOR' };
            await saveDraftAct(draftData);
            toast.success('Borrador guardado localmente con éxito');
            setTimeout(() => onSave(), 1500);
        } catch (error) {
            console.error('Error al guardar borrador:', error);
            toast.error('Error al intentar guardar el borrador local');
        }
    };

    const handleFinalize = async () => {
        if (!validateForm()) {
            toast.error('Complete los campos obligatorios antes de finalizar');
            return;
        }
        let actId;
        try {
            const finalizeData = { ...formData, type, status: 'PENDIENTE_SINCRONIZACION' };
            if (formData.id) {
                await db.acts.update(formData.id, {
                    ...finalizeData,
                    updatedAt: new Date().toISOString()
                });
                actId = formData.id;
            } else {
                actId = await db.acts.add({
                    ...finalizeData,
                    glpi_ticket_id: finalizeData.glpi_ticket_id ? String(finalizeData.glpi_ticket_id) : '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }

            if (navigator.onLine) {
                toast.info('Sincronizando con el servidor...');
                const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/sync/maintenance`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                    },
                    body: JSON.stringify({ ...finalizeData, id: undefined, _id: undefined, createdAt: new Date() })
                });
                if (response.ok) {
                    const result = await response.json();
                    await db.acts.update(actId, {
                        _id: result._id,
                        status: 'SINCRONIZADO',
                        updatedAt: new Date().toISOString()
                    });
                    toast.success('¡Acta finalizada y sincronizada correctamente!');
                    setTimeout(() => onSave(), 1500);
                } else {
                    throw new Error('Error en sincronización remota');
                }
            } else {
                await markForSync(actId);
                toast.warning('Guardado localmente. Sincronización pendiente (Offline)');
                setTimeout(() => onSave(), 1500);
            }
        } catch (error) {
            console.error('Error al finalizar acta:', error);
            if (actId) await markForSync(actId);
            toast.warning('Guardado localmente. Sincronización pendiente.');
            setTimeout(() => onSave(), 2000);
        }
    };

    return (
        <div className="space-y-6 pb-40 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg",
                        type === 'PREVENTIVO' ? "bg-emerald-500 shadow-emerald-500/20" : type === 'ENTREGA' ? "bg-primary-500 shadow-primary-500/20" : "bg-orange-500 shadow-orange-500/20"
                    )}>
                        {type === 'PREVENTIVO' ? <Wrench size={24} /> : type === 'ENTREGA' ? <Package size={24} /> : <Hammer size={24} />}
                    </div>
                    <div>
                        <h1 className="text-[26px] font-[800] text-text-primary leading-tight capitalize">
                            {type.toLowerCase()}
                        </h1>
                        <p className="text-[14px] text-text-muted font-[500]">
                            Acta de Servicio Técnico
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleSaveDraft}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-tertiary text-text-secondary rounded-[8px] text-[13px] font-[600] border border-color transition-all shadow-sm"
                >
                    <Save size={16} /> Guardar borrador
                </button>
            </div>

            {/* General Information Section */}
            <section className="bg-secondary rounded-[16px] p-8 shadow-sm border border-color">
                <div className="flex items-center gap-3 mb-8 border-b border-color pb-4">
                    <ClipboardList size={20} className="text-primary-500" />
                    <h3 className="text-[13px] font-[800] text-primary-500 uppercase tracking-wider">
                        Información General
                    </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                    <div className="md:col-span-1">
                        <CustomSelect label="Ticket GLPI #" placeholder="Buscar o ingresar número de ticket..." value={formData.glpi_ticket_id} onChange={handleTicketSelect} options={tickets} withSearch={true} icon={ClipboardList} loading={isSearchingTicket} error={errors.includes('glpi_ticket_id')} />
                    </div>
                    <div className="md:col-span-1">
                        <CustomSelect label="Empresa" placeholder="Seleccionar Entidad..." value={entities.find(e => e.entityName === formData.client_name)?.id || formData.client_name} onChange={(id) => setFormData(p => ({ ...p, client_name: entities.find(e => e.id === id)?.entityName || id }))} options={entities} withSearch={true} icon={Building2} error={errors.includes('client_name')} />
                    </div>
                    <div className="md:col-span-1">
                        <CustomSelect label="Técnico Responsable" placeholder="Seleccionar Técnico..." value={technicians.find(t => t.fullName === formData.technical_name)?.id || formData.technical_name} onChange={(id) => setFormData(p => ({ ...p, technical_name: technicians.find(t => t.id === id)?.fullName || id }))} options={technicians} withSearch={true} icon={User} error={errors.includes('technical_name')} />
                    </div>
                    <div className="md:col-span-1 relative">
                        <label className="text-[12px] font-[600] text-text-primary block ml-1 mb-2 uppercase tracking-wide">Fecha de Realización</label>
                        <button
                            type="button"
                            onClick={(e) => {
                                setShowDatePicker(true);
                                setDatePickerAnchor(e.currentTarget);
                            }}
                            className={cn(
                                "w-full flex items-center justify-between h-[44px] px-[16px] bg-primary rounded-[12px] border border-color text-[13px] outline-none transition-all shadow-sm",
                                showDatePicker ? "border-primary-500 bg-secondary ring-4 ring-primary-500/10" : "hover:border-primary-500/40 hover:bg-tertiary",
                                errors.includes('scheduled_date') ? "border-red-500" : ""
                            )}
                        >
                            <span className={cn(formData.scheduled_date ? "text-text-primary font-[600]" : "text-text-muted")}>
                                {formData.scheduled_date ? new Date(formData.scheduled_date).toLocaleString('es-ES', {
                                    year: 'numeric', month: '2-digit', day: '2-digit',
                                    hour: '2-digit', minute: '2-digit', hour12: true
                                }) : "dd/mm/aaaa --:-- -----"}
                            </span>
                            <Calendar size={16} className="text-text-muted" />
                        </button>

                        {showDatePicker && (
                            <CustomDatePicker
                                anchorEl={datePickerAnchor}
                                value={formData.scheduled_date}
                                onChange={(val) => {
                                    setFormData(p => ({ ...p, scheduled_date: val }));
                                    setShowDatePicker(false);
                                    setDatePickerAnchor(null);
                                }}
                                onClose={() => {
                                    setShowDatePicker(false);
                                    setDatePickerAnchor(null);
                                }}
                            />
                        )}
                    </div>
                </div>
            </section>

            {/* Technical Specifications Section */}
            <section className="bg-secondary rounded-[16px] p-8 shadow-sm border border-color">
                <div className="flex items-center gap-3 mb-8 border-b border-color pb-4">
                    <Monitor size={20} className="text-primary-500" />
                    <h3 className="text-[13px] font-[800] text-primary-500 uppercase tracking-wider">
                        Datos Técnicos del Activo
                    </h3>
                </div>

                {type === 'ENTREGA' && (
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-6 mb-6">
                        {DEVICE_TYPES.map(d => (
                            <button
                                key={d.id}
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, equipment_type: d.id }))}
                                className={cn(
                                    "flex flex-col items-center p-4 rounded-xl border transition-all gap-2 min-w-[100px] text-center",
                                    formData.equipment_type === d.id
                                        ? "bg-tertiary border-primary-500 text-primary-500 shadow-sm"
                                        : "bg-tertiary border-color text-text-muted hover:border-primary-500"
                                )}
                            >
                                <d.icon size={22} className={cn("transition-all", formData.equipment_type === d.id ? "text-primary-500" : "opacity-40")} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">{d.label}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                    <InputGroup label="Número de Inventario / Etiqueta" name="inventory_number" placeholder="Ej: ACT-2024-001" value={formData.inventory_number} onChange={handleInputChange} error={errors.includes('inventory_number')} />
                    <InputGroup label="Modelo / Marca" name="equipment_model" placeholder="Ej: Dell OptiPlex 7090" value={formData.equipment_model} onChange={handleInputChange} error={errors.includes('equipment_model')} />
                    <InputGroup label="Serial / Service Tag" name="equipment_serial" placeholder="Ej: ABC1234XY" value={formData.equipment_serial} onChange={handleInputChange} error={errors.includes('equipment_serial')} />
                    <InputGroup label="Hostname" name="equipment_hostname" placeholder="Ej: PC-RECEPCION-01" value={formData.equipment_hostname} onChange={handleInputChange} error={errors.includes('equipment_hostname')} />

                    {formData.equipment_type === 'COMPUTADOR' && (
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-y-10 gap-x-12 p-8 bg-primary rounded-2xl border border-color mt-8">
                            <CustomSelect label="Procesador" placeholder="Seleccionar CPU..." value={formData.equipment_processor} onChange={(v) => setFormData(p => ({ ...p, equipment_processor: v }))} options={PROCESSOR_OPTIONS.map(o => ({ id: o, label: o }))} icon={Cpu} />
                            <div className="flex gap-4">
                                <CustomSelect className="flex-1" label="RAM" placeholder="Seleccionar RAM..." value={formData.equipment_ram} onChange={(v) => setFormData(p => ({ ...p, equipment_ram: v }))} options={RAM_OPTIONS.map(o => ({ id: o, label: o }))} icon={Layers} />
                                {formData.equipment_ram === 'OTRO' && <input name="equipment_ram_other" type="number" onChange={handleInputChange} value={formData.equipment_ram_other} className="w-24 h-[44px] mt-[32px] bg-secondary border border-color/60 rounded-[10px] px-3 text-[13px] outline-none focus:border-primary-500 text-text-primary shadow-sm" placeholder="GB" />}
                            </div>
                            <div className="flex gap-4">
                                <CustomSelect className="flex-1" label="Disco" placeholder="Capacidad Disco..." value={formData.equipment_disk} onChange={(v) => setFormData(p => ({ ...p, equipment_disk: v }))} options={DISK_OPTIONS.map(o => ({ id: o, label: o }))} icon={Database} />
                                {formData.equipment_disk === 'OTRO' && <input name="equipment_disk_other" type="number" onChange={handleInputChange} value={formData.equipment_disk_other} className="w-24 h-[44px] mt-[32px] bg-secondary border border-color/60 rounded-[10px] px-3 text-[13px] outline-none focus:border-primary-500 text-text-primary shadow-sm" placeholder="GB" />}
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[12px] font-[600] text-text-primary mb-2.5 ml-1 uppercase tracking-wide">Tecnología de Disco</label>
                                <div className="flex bg-tertiary p-1 rounded-lg border border-color gap-1">
                                    {DISK_TYPE_OPTIONS.map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, equipment_disk_type: t }))}
                                            className={cn(
                                                "flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all",
                                                formData.equipment_disk_type === t ? "bg-secondary text-primary-500 shadow-sm border border-color" : "text-text-muted hover:bg-secondary"
                                            )}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="md:col-span-2">
                        <InputGroup label="Usuario Final Responsable" name="assigned_user" placeholder="Nombre completo del destinatario" value={formData.assigned_user} onChange={handleInputChange} error={errors.includes('assigned_user')} />
                    </div>
                </div>
            </section>

            {/* Checklist Section */}
            {(type === 'PREVENTIVO' || type === 'ENTREGA') && (
                <section className="bg-secondary rounded-[16px] p-8 shadow-sm border border-color">
                    <div className="flex items-center justify-between border-b border-color pb-4 mb-8">
                        <div className="flex items-center gap-3">
                            <FileCheck size={20} className="text-primary-500" />
                            <h3 className="text-[13px] font-[800] text-primary-500 uppercase tracking-wider">
                                Protocolo de Verificación
                            </h3>
                        </div>
                        <span className="text-[11px] font-bold text-text-muted bg-tertiary px-3 py-1 rounded-full uppercase tabular-nums border border-color">
                            {Object.values(formData.checklist).filter(v => typeof v === 'boolean' && v).length} / {(type === 'PREVENTIVO' ? PREVENTIVE_CHECKLIST : DELIVERY_CHECKLISTS[formData.equipment_type] || GENERIC_CHECKLIST).length} Completados
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(type === 'PREVENTIVO' ? PREVENTIVE_CHECKLIST : DELIVERY_CHECKLISTS[formData.equipment_type] || GENERIC_CHECKLIST).map(item => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handleChecklistChange(item.id, !formData.checklist[item.id])}
                                className={cn(
                                    "flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
                                    formData.checklist[item.id]
                                        ? "bg-secondary border-emerald-500 shadow-sm shadow-emerald-500/5"
                                        : "bg-tertiary border-color hover:border-primary-500"
                                )}
                            >
                                <div className={cn(
                                    "p-1.5 rounded-lg transition-all",
                                    formData.checklist[item.id] ? "bg-emerald-500 text-white" : "bg-tertiary border border-color text-text-muted"
                                )}>
                                    <item.icon size={16} />
                                </div>
                                <span className={cn("flex-1 text-[11px] font-bold uppercase transition-colors", formData.checklist[item.id] ? "text-emerald-500" : "text-text-muted")}>
                                    {item.label}
                                </span>
                                {formData.checklist[item.id] && <CheckCircle2 size={16} className="text-emerald-500" />}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* Corrective Details Section */}
            {type === 'CORRECTIVO' && (
                <section className="bg-secondary rounded-[16px] p-8 shadow-sm border border-color">
                    <div className="flex items-center gap-3 mb-8 border-b border-color pb-4">
                        <Hammer size={20} className="text-primary-500" />
                        <h3 className="text-[13px] font-[800] text-primary-500 uppercase tracking-wider">
                            Detalles de la Intervención
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        <TextAreaGroup label="Diagnóstico Inicial" name="diagnostico" value={formData.checklist.diagnostico} onChange={(v) => handleChecklistChange('diagnostico', v)} error={errors.includes('diagnostico')} placeholder="¿Qué se encontró al recibir el equipo?" />
                        <TextAreaGroup label="Falla Reportada" name="falla_reportada" value={formData.checklist.falla_reportada} onChange={(v) => handleChecklistChange('falla_reportada', v)} error={errors.includes('falla_reportada')} placeholder="Descripción del síntoma reportado..." />
                        <TextAreaGroup label="Acción Realizada" name="accion_realizada" value={formData.checklist.accion_realizada} onChange={(v) => handleChecklistChange('accion_realizada', v)} error={errors.includes('accion_realizada')} placeholder="Detalle técnico de la reparación..." />
                        <TextAreaGroup label="Repuestos Usados" name="repuestos_usados" value={formData.checklist.repuestos_usados} onChange={(v) => handleChecklistChange('repuestos_usados', v)} error={errors.includes('repuestos_usados')} placeholder="Lista de repuestos utilizados (o N/A)..." />
                    </div>
                </section>
            )}

            {/* Observations Section */}
            <section className="bg-secondary rounded-[16px] p-8 shadow-sm border border-color">
                <div className="grid grid-cols-1 gap-8">
                    <TextAreaGroup label="Observaciones Finales" name="observations" value={formData.observations} onChange={(v) => setFormData(p => ({ ...p, observations: v }))} error={errors.includes('observations')} placeholder="Resumen final del estado del activo..." />
                    {type !== 'ENTREGA' && <TextAreaGroup label="Recomendaciones Técnicas" name="recommendations" value={formData.recommendations} onChange={(v) => setFormData(p => ({ ...p, recommendations: v }))} error={errors.includes('recommendations')} placeholder="¿Qué debe tener en cuenta el cliente?" />}
                </div>
            </section>

            {/* Evidence Area */}
            <section className="bg-secondary rounded-[16px] p-8 shadow-sm border border-color">
                <div className="flex items-center gap-3 mb-6">
                    <Camera size={20} className="text-primary-500" />
                    <h3 className="text-[13px] font-[800] text-primary-500 uppercase tracking-wider">
                        Evidencia Fotográfica
                    </h3>
                </div>
                <PhotoCapture onPhotosUpdate={(photos) => setFormData(p => ({ ...p, photos }))} />
            </section>

            {/* Signatures Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Cliente */}
                <section className="bg-secondary rounded-[16px] p-8 shadow-sm border border-color">
                    <div className="flex items-center gap-3 mb-6">
                        <PenTool size={20} className="text-primary-500" />
                        <h3 className="text-[13px] font-[800] text-primary-500 uppercase tracking-wider">
                            Firma del Cliente
                        </h3>
                    </div>
                    <div className={cn(
                        "rounded-xl overflow-hidden border-2 border-dashed transition-all",
                        errors.includes('signature_client') ? "border-red-500 bg-secondary" : "border-primary-500 bg-secondary"
                    )}>
                        <SignaturePad onSave={(sig) => setFormData(p => ({ ...p, signatures: { ...p.signatures, client: sig } }))} theme={theme} />
                    </div>
                    <div className="mt-4 text-center">
                        <p className="text-[11px] text-text-muted font-[500]">Se guarda offline y sincroniza con red</p>
                    </div>
                </section>

                {/* Técnico */}
                <section className="bg-secondary rounded-[16px] p-8 shadow-sm border border-color">
                    <div className="flex items-center gap-3 mb-6">
                        <User size={20} className="text-primary-500" />
                        <h3 className="text-[13px] font-[800] text-primary-500 uppercase tracking-wider">
                            Firma del Técnico
                        </h3>
                    </div>
                    <div className={cn(
                        "rounded-xl overflow-hidden border-2 border-dashed transition-all",
                        errors.includes('signature_client') || errors.includes('signature_technical') ? "border-red-500 bg-secondary" : "border-primary-500 bg-secondary"
                    )}>
                        <SignaturePad onSave={(sig) => setFormData(p => ({ ...p, signatures: { ...p.signatures, technical: sig } }))} theme={theme} />
                    </div>
                    <div className="mt-4 text-center">
                        <p className="text-[12px] font-bold text-text-primary">{formData.technical_name || 'Nombre del Técnico'}</p>
                    </div>
                </section>
            </div>

            {/* Acciones del Formulario (Integradas) */}
            <div className="flex gap-[16px] mt-12 mb-20">
                <button
                    onClick={onCancel}
                    className="flex-1 bg-tertiary text-text-secondary border border-color rounded-[14px] h-[52px] font-[600] text-[14px] hover:bg-secondary transition-all"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleFinalize}
                    className="flex-[3] bg-primary-500 text-white flex items-center justify-center gap-3 rounded-[14px] h-[52px] font-[700] text-[16px] shadow-lg hover:bg-primary-600 transition-all"
                >
                    <Save size={20} className="text-white" />
                    Finalizar Acta
                </button>
            </div>

            {/* toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> -- REMOVED */}
        </div>
    );
};

const InputGroup = ({ label, name, placeholder, onChange, error, type = "text", value }) => (
    <div className="space-y-1.5 flex-1">
        <label className="text-[12px] font-[600] text-text-primary block ml-1">{label}</label>
        <input
            name={name}
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={onChange}
            className={cn(
                "h-[44px] rounded-[12px] border border-color px-[16px] text-[13px] bg-primary w-full outline-none transition-all text-text-primary shadow-sm",
                "focus:border-primary-500 focus:bg-secondary",
                error && "border-red-500 bg-secondary"
            )}
        />
    </div>
);

const TextAreaGroup = ({ label, name, value, onChange, error, placeholder }) => (
    <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-text-primary block ml-1">{label}</label>
        <div className="relative">
            <textarea
                name={name}
                value={value}
                placeholder={placeholder}
                onChange={onChange ? (e) => onChange(e.target.value) : undefined}
                className={cn(
                    "w-full bg-primary border rounded-xl py-4 px-4 text-[13px] font-medium outline-none transition-shadow min-h-[120px] resize-none placeholder:text-text-muted text-text-primary shadow-sm",
                    error
                        ? "border-red-500 ring-2 ring-red-500"
                        : "border-color focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:bg-secondary"
                )}
            />
            {error && <AlertCircle size={16} className="absolute right-3 top-3 text-red-500 animate-pulse" />}
        </div>
    </div>
);

export default MaintenanceForm;
