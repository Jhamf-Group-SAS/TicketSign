import { useState, useEffect } from 'react';
import SignaturePad from './SignaturePad';
import PhotoCapture from './PhotoCapture';
import Toast from './Toast';
import { saveDraftAct, markForSync, db } from '../store/db';
import { Package, ClipboardList, Plus, History, User, Building2, Monitor, Keyboard, Mouse, Laptop, ShieldCheck, Settings2, Globe, FileCheck, CheckCircle2, AlertCircle, ChevronLeft, Save, X, Trash2, HardDrive, Printer, Wifi, Zap, Layers, Power, Cpu, Database } from 'lucide-react'
import CustomSelect from './CustomSelect';

const RAM_OPTIONS = ['4 GB', '8 GB', '12 GB', '16 GB', '32 GB', '64 GB', 'OTRO'];
const DISK_OPTIONS = ['120 GB', '240 GB', '480 GB', '512 GB', '1 TB', '2 TB', 'OTRO'];
const DISK_TYPE_OPTIONS = ['SSD', 'HDD', 'NVMe'];
const PROCESSOR_OPTIONS = ['Core i3', 'Core i5', 'Core i7', 'Core i9', 'Ryzen 3', 'Ryzen 5', 'Ryzen 7', 'Ryzen 9', 'Celeron', 'Pentium', 'Xeon'];

const DEVICE_TYPES = [
    { id: 'COMPUTADOR', label: 'Computador/Laptop', icon: Laptop },
    { id: 'IMPRESORA', label: 'Impresora', icon: Printer },
    { id: 'REDES', label: 'Equipos de Red', icon: Wifi },
    { id: 'PERIFERICO', label: 'Periférico', icon: Mouse },
    { id: 'OTRO', label: 'Otro Dispositivo', icon: Settings2 }
];

const PREVENTIVE_CHECKLIST = [
    { id: 'limpieza_interna', label: 'Limpieza Interna', icon: Monitor },
    { id: 'soplado', label: 'Soplado de Polvo', icon: FileCheck },
    { id: 'cambio_pasta', label: 'Cambio de Pasta Térmica', icon: Settings2 },
    { id: 'limpieza_externa', label: 'Limpieza Externa (Gabinete/Pantalla)', icon: Monitor },
    { id: 'ajuste_tornilleria', label: 'Ajuste de Tornillería', icon: Settings2 },
    { id: 'verificacion_ventiladores', label: 'Verificación de Ventiladores', icon: Settings2 },
    { id: 'organizacion_cables', label: 'Organización de Cables', icon: Globe },
    { id: 'revision_voltajes', label: 'Revisión de Voltajes Fuente', icon: ShieldCheck }
];

const DELIVERY_CHECKLIST = [
    { id: 'monitor', label: 'Monitor / Pantalla', icon: Monitor },
    { id: 'teclado', label: 'Teclado', icon: Keyboard },
    { id: 'mouse', label: 'Mouse', icon: Mouse },
    { id: 'cargador', label: 'Cargador / Cable Poder', icon: Laptop },
    { id: 'maletin', label: 'Maletín / Funda', icon: Package },
    { id: 'cable_video', label: 'Cable Video (HDMI/VGA)', icon: Globe },
    { id: 'so_configurado', label: 'OS Configurado', icon: ShieldCheck },
    { id: 'perfil_usuario', label: 'Perfil de Usuario', icon: User },
    { id: 'unido_dominio', label: 'Unido al Dominio', icon: Globe },
    { id: 'antivirus_instalado', label: 'Antivirus Instalado', icon: ShieldCheck },
    { id: 'aplicaciones_base', label: 'Aplicaciones Base', icon: Settings2 }
];

const PRINTER_CHECKLIST = [
    { id: 'encendido_funcional', label: 'Encendido y Funcional', icon: Power },
    { id: 'conectividad_red', label: 'Conectividad de Red', icon: Globe },
    { id: 'nivel_tinta', label: 'Nivel Inicial de Tóner/Tinta', icon: Zap },
    { id: 'accesorios_impresora', label: 'Accesorios Incluidos', icon: Package }
];

const NETWORK_CHECKLIST = [
    { id: 'luces_ok', label: 'Encendido y Luces Indicadoras OK', icon: Zap },
    { id: 'puertos_funcionales', label: 'Puertos Funcionales', icon: Layers },
    { id: 'configuracion_inicial', label: 'Configuración Inicial Completada', icon: Settings2 },
    { id: 'documentacion_red', label: 'Documentación Entregada', icon: FileCheck }
];

const PERIPHERAL_CHECKLIST = [
    { id: 'funcionamiento_verificado', label: 'Encendido/Funcionamiento Verificado', icon: Power },
    { id: 'cables_completos', label: 'Cables Completos', icon: Layers },
    { id: 'sin_defectos_fabrica', label: 'Sin Defectos de Fabrica', icon: ShieldCheck },
    { id: 'accesorios_periferico', label: 'Accesorios Incluidos', icon: Package }
];

const GENERIC_CHECKLIST = [
    { id: 'encendido_funcional_gen', label: 'Encendido y Funcional', icon: Power },
    { id: 'accesorios_completos_gen', label: 'Cables/Accesorios Completos', icon: Package },
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

// Helper function for conditional class names (assuming `cn` is available or defined elsewhere)
const cn = (...classes) => classes.filter(Boolean).join(' ');

const MaintenanceForm = ({ type, onCancel, onSave, theme }) => {
    const [formData, setFormData] = useState(() => {
        let initialChecklist = {};
        if (type === 'PREVENTIVO') {
            PREVENTIVE_CHECKLIST.forEach(item => initialChecklist[item.id] = false);
        } else if (type === 'ENTREGA') {
            // Inicializar todas las opciones de checklist posibles para entrega
            Object.values(DELIVERY_CHECKLISTS).flat().forEach(item => initialChecklist[item.id] = false);
        } else { // CORRECTIVO
            initialChecklist = {
                diagnostico: '',
                falla_reportada: '',
                accion_realizada: '',
                repuestos_usados: '',
                estado_final: 'OPERATIVO'
            };
        }

        return {
            glpi_ticket_id: '',
            client_name: '',
            technical_name: '',
            equipment_serial: '',
            equipment_hostname: '',
            equipment_model: '',
            equipment_ram: '',
            equipment_ram_other: '',
            equipment_disk: '',
            equipment_disk_other: '',
            equipment_disk_type: 'SSD',
            equipment_processor: '',
            equipment_type: 'COMPUTADOR',
            assigned_user: '',
            observations: '',
            recommendations: '',
            checklist: initialChecklist,
            signatures: { technical: null, client: null },
            photos: []
        };
    });

    const [toast, setToast] = useState(null);
    const [errors, setErrors] = useState([]);
    const [entities, setEntities] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isSearchingTicket, setIsSearchingTicket] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!navigator.onLine) return;
            setIsLoadingData(true);
            try {
                const token = localStorage.getItem('glpi_pro_token');
                const headers = { 'Authorization': `Bearer ${token}` };
                const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

                const [entRes, techRes, tickRes] = await Promise.all([
                    fetch(`${baseUrl}/glpi/entities`, { headers }),
                    fetch(`${baseUrl}/glpi/technicians`, { headers }),
                    fetch(`${baseUrl}/glpi/tickets?range=0-50&status=pending`, { headers })
                ]);

                if (entRes.ok) {
                    const entData = await entRes.json();
                    setEntities(entData.map(e => ({ id: e.name, label: e.name, originalId: e.id })));
                }
                if (techRes.ok) {
                    const techData = await techRes.json();
                    setTechnicians(techData.map(t => ({ id: t.fullName, label: t.fullName, originalId: t.id })));
                }
                if (tickRes.ok) {
                    const tickData = await tickRes.json();
                    setTickets(tickData.map(t => ({
                        id: String(t.id),
                        label: `#${t.id} - ${t.title}`,
                        original: t
                    })));
                }
            } catch (error) {
                console.error('Error fetching GLPI data:', error);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, []);

    const handleTicketSelect = async (ticketId) => {
        const selectedTicket = tickets.find(t => t.id === ticketId);
        if (selectedTicket) {
            const ticket = selectedTicket.original;
            setFormData(prev => ({
                ...prev,
                glpi_ticket_id: String(ticket.id),
                client_name: ticket.entity_name || prev.client_name,
                technical_name: ticket.technician_name || prev.technical_name,
                assigned_user: ticket.requester_name || prev.assigned_user
            }));
        } else {
            // If not in the current list, try fetching it directly
            setIsSearchingTicket(true);
            try {
                const token = localStorage.getItem('glpi_pro_token');
                const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                const response = await fetch(`${baseUrl}/glpi/tickets/${ticketId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const ticket = await response.json();
                    setFormData(prev => ({
                        ...prev,
                        glpi_ticket_id: String(ticket.id),
                        client_name: ticket.entity_name || prev.client_name,
                        technical_name: ticket.technician_name || prev.technical_name,
                        assigned_user: ticket.requester_name || prev.assigned_user
                    }));
                } else {
                    setFormData(prev => ({ ...prev, glpi_ticket_id: ticketId }));
                }
            } catch (error) {
                console.error('Error searching ticket:', error);
                setFormData(prev => ({ ...prev, glpi_ticket_id: ticketId }));
            } finally {
                setIsSearchingTicket(false);
            }
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleChecklistChange = (key, value) => {
        setFormData(prev => ({
            ...prev,
            checklist: { ...prev.checklist, [key]: value }
        }));
    };

    const validateForm = () => {
        const newErrors = [];
        // General Data
        if (!formData.glpi_ticket_id) newErrors.push('glpi_ticket_id');
        if (!formData.client_name) newErrors.push('client_name');
        if (!formData.technical_name) newErrors.push('technical_name');

        // Equipment Details
        if (!formData.equipment_serial) newErrors.push('equipment_serial');
        if (!formData.equipment_hostname) newErrors.push('equipment_hostname');
        if (!formData.equipment_model) newErrors.push('equipment_model');
        if (!formData.assigned_user) newErrors.push('assigned_user');

        // Checklist / Work Description
        if (type === 'CORRECTIVO') {
            if (!formData.checklist.diagnostico) newErrors.push('diagnostico');
            if (!formData.checklist.falla_reportada) newErrors.push('falla_reportada');
            if (!formData.checklist.accion_realizada) newErrors.push('accion_realizada');
            if (!formData.checklist.repuestos_usados) newErrors.push('repuestos_usados');
        }

        // Observations & Recommendations
        if (!formData.observations) newErrors.push('observations');
        if (type !== 'ENTREGA' && !formData.recommendations) newErrors.push('recommendations');

        // Signatures
        if (!formData.signatures.technical) newErrors.push('signature_technical');
        if (!formData.signatures.client) newErrors.push('signature_client');

        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const handleSaveDraft = async () => {
        if (!validateForm()) {
            setToast({ message: 'Por favor complete los campos obligatorios', type: 'error' });
            return;
        }

        let actId;
        try {
            // Guardar localmente primero (Always safety first)
            actId = await saveDraftAct({ ...formData, type });

            if (navigator.onLine) {
                setToast({ message: 'Sincronizando con GLPI...', type: 'info' });

                const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/sync/maintenance`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                    },
                    body: JSON.stringify({ ...formData, type, createdAt: new Date() })
                });

                const result = await response.json();

                if (response.ok) {
                    // Marcar como sincronizado en la base de datos local para el historial
                    await db.acts.update(actId, {
                        status: 'SINCRONIZADO',
                        updatedAt: new Date().toISOString()
                    });

                    setToast({ message: '¡Acta sincronizada con éxito en el ticket de GLPI!', type: 'success' });
                    setTimeout(() => onSave(), 2000);
                } else {
                    throw new Error(result.message || 'Error en la sincronización');
                }
            } else {
                await markForSync(actId);
                setToast({ message: 'Acta guardada localmente. Sincronización Pendiente.', type: 'warning' });
                setTimeout(() => onSave(), 2000);
            }
        } catch (error) {
            console.error('Error al sincronizar:', error);
            if (actId) await markForSync(actId);
            setToast({ message: `Guardada localmente (Pendiente de Sync). Error: ${error.message}`, type: 'warning' });
            setTimeout(() => onSave(), 3000);
        }
    };

    return (
        <div className="space-y-8 pb-32 max-w-2xl mx-auto">
            {/* Header Formulario */}
            <div className="flex items-center justify-between sticky top-[73px] z-40 bg-white/80 dark:bg-[#020617]/80 backdrop-blur-md py-4 border-b border-slate-200 dark:border-white/5 mx-[-1rem] px-4 transition-colors">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "p-3 rounded-2xl transition-all",
                        type === 'PREVENTIVO' ? "bg-blue-500/10 text-blue-500" : type === 'ENTREGA' ? "bg-purple-500/10 text-purple-500" : "bg-orange-500/10 text-orange-500"
                    )}>
                        {type === 'ENTREGA' ? <Package size={24} /> : <ClipboardList size={24} />}
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                            {type === 'PREVENTIVO' ? 'Preventivo' : type === 'ENTREGA' ? 'Entrega de Activo' : 'Correctivo'}
                        </h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Acta de Servicio Técnico</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSaveDraft} className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 shadow-blue-500/20">
                        <Save size={18} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Info General */}
                <section className="relative z-30 space-y-5 bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm shadow-sm dark:shadow-none">
                    <h3 className="text-xs font-black uppercase text-blue-500 tracking-[0.2em]">Información General</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <CustomSelect
                                label="Ticket GLPI #"
                                placeholder="Buscar o ingresar número de ticket..."
                                value={formData.glpi_ticket_id}
                                onChange={handleTicketSelect}
                                options={tickets}
                                withSearch={true}
                                icon={ClipboardList}
                                loading={isSearchingTicket}
                                error={errors.includes('glpi_ticket_id')}
                            />
                        </div>
                        <div>
                            <CustomSelect
                                label="EMPRESA"
                                placeholder="Seleccionar Entidad..."
                                value={formData.client_name}
                                onChange={(val) => setFormData(p => ({ ...p, client_name: val }))}
                                options={entities}
                                withSearch={true}
                                icon={Building2}
                                loading={isLoadingData}
                                error={errors.includes('client_name')}
                            />
                        </div>
                        <div>
                            <CustomSelect
                                label="Técnico Responsable"
                                placeholder="Seleccionar Técnico..."
                                value={formData.technical_name}
                                onChange={(val) => setFormData(p => ({ ...p, technical_name: val }))}
                                options={technicians}
                                withSearch={true}
                                icon={User}
                                loading={isLoadingData}
                                error={errors.includes('technical_name')}
                            />
                        </div>
                    </div>
                </section>

                {/* Datos del Equipo */}
                <section className="relative z-20 space-y-6 bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm shadow-sm dark:shadow-none">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase text-purple-500 tracking-[0.2em] flex items-center gap-2">
                            <HardDrive size={16} /> Datos Técnicos del Activo
                        </h3>
                    </div>

                    {type === 'ENTREGA' && (
                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">Tipo de Dispositivo</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                                {DEVICE_TYPES.map((device) => (
                                    <button
                                        key={device.id}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, equipment_type: device.id }))}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all gap-2",
                                            formData.equipment_type === device.id
                                                ? "bg-purple-500/10 border-purple-500/50 text-purple-600 dark:text-purple-400 shadow-lg shadow-purple-500/10"
                                                : "bg-slate-50 dark:bg-slate-950/20 border-slate-200 dark:border-white/5 text-slate-400 hover:border-slate-300"
                                        )}
                                    >
                                        <device.icon size={20} />
                                        <span className="text-[9px] font-black uppercase tracking-tighter">{device.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Número de Inventario / Etiqueta</label>
                            <input name="inventory_number" onChange={handleInputChange} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('inventory_number') ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700`} placeholder="Ej: ACT-2024-001" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Modelo / Marca</label>
                            <input name="equipment_model" onChange={handleInputChange} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('equipment_model') ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all`} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Serial / Service Tag</label>
                            <input name="equipment_serial" onChange={handleInputChange} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('equipment_serial') ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700`} placeholder="S/N del equipo" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Hostname</label>
                            <input name="equipment_hostname" onChange={handleInputChange} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('equipment_hostname') ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all`} />
                        </div>

                        {/* Campos de Hardware - Solo visibles para Computadores */}
                        {formData.equipment_type === 'COMPUTADOR' && (
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-slate-50/50 dark:bg-slate-950/20 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-inner animate-in fade-in zoom-in-95 duration-300">
                                <div>
                                    <CustomSelect
                                        label="Seleccionar Procesador"
                                        placeholder="--- Escoger ---"
                                        value={formData.equipment_processor}
                                        onChange={(val) => setFormData(p => ({ ...p, equipment_processor: val }))}
                                        options={PROCESSOR_OPTIONS.map(opt => ({ id: opt, label: opt }))}
                                        icon={Cpu}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-[0.2em]">Memoria RAM</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <CustomSelect
                                                placeholder="--- Tamaño ---"
                                                value={formData.equipment_ram}
                                                onChange={(val) => setFormData(p => ({ ...p, equipment_ram: val }))}
                                                options={RAM_OPTIONS.map(opt => ({ id: opt, label: opt }))}
                                                icon={Layers}
                                            />
                                        </div>
                                        {formData.equipment_ram === 'OTRO' && (
                                            <div className="relative flex-1 animate-in zoom-in-95 duration-200">
                                                <input
                                                    type="number"
                                                    name="equipment_ram_other"
                                                    onChange={handleInputChange}
                                                    value={formData.equipment_ram_other}
                                                    placeholder="Ej: 48"
                                                    className="w-full bg-white dark:bg-slate-900 border border-purple-500/30 rounded-2xl p-4 pr-10 text-sm font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-purple-500/10 outline-none transition-all"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-purple-500 uppercase">GB</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-[0.2em]">Capacidad de Disco</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <CustomSelect
                                                placeholder="--- Tamaño ---"
                                                value={formData.equipment_disk}
                                                onChange={(val) => setFormData(p => ({ ...p, equipment_disk: val }))}
                                                options={DISK_OPTIONS.map(opt => ({ id: opt, label: opt }))}
                                                icon={Database}
                                            />
                                        </div>
                                        {formData.equipment_disk === 'OTRO' && (
                                            <div className="relative flex-1 animate-in zoom-in-95 duration-200">
                                                <input
                                                    type="number"
                                                    name="equipment_disk_other"
                                                    onChange={handleInputChange}
                                                    value={formData.equipment_disk_other}
                                                    placeholder="Ej: 750"
                                                    className="w-full bg-white dark:bg-slate-900 border border-purple-500/30 rounded-2xl p-4 pr-10 text-sm font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-purple-500/10 outline-none transition-all"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-purple-500 uppercase">GB</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-[0.2em]">Tipo de Disco</label>
                                    <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 gap-1 shadow-sm">
                                        {DISK_TYPE_OPTIONS.map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setFormData(p => ({ ...p, equipment_disk_type: type }))}
                                                className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${formData.equipment_disk_type === type
                                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40 transform active:scale-95'
                                                    : 'text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Usuario / Dueño del Equipo</label>
                            <input name="assigned_user" onChange={handleInputChange} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('assigned_user') ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all`} placeholder="Nombre de la persona que usa el equipo" />
                        </div>
                    </div>
                </section>

                {/* Checklist */}
                <section className="relative z-10 space-y-5 bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm shadow-sm dark:shadow-none">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                            Checklist de {type === 'PREVENTIVO' ? 'Mantenimiento' : type === 'ENTREGA' ? 'Entrega' : 'Servicio'}
                        </h3>
                        {(type === 'PREVENTIVO' || type === 'ENTREGA') && (
                            <span className="text-[10px] font-bold bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full">
                                {Object.values(formData.checklist).filter(v => v).length} / {Object.keys(formData.checklist).length}
                            </span>
                        )}
                    </div>

                    {type === 'CORRECTIVO' ? (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Diagnóstico</label>
                                <textarea name="diagnostico" value={formData.checklist.diagnostico} onChange={(e) => handleChecklistChange('diagnostico', e.target.value)} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('diagnostico') ? 'border-red-500/50' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white h-24 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all resize-none`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Falla Reportada</label>
                                <textarea name="falla_reportada" value={formData.checklist.falla_reportada} onChange={(e) => handleChecklistChange('falla_reportada', e.target.value)} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('falla_reportada') ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white h-32 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all resize-none`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Acción Realizada</label>
                                <textarea name="accion_realizada" value={formData.checklist.accion_realizada} onChange={(e) => handleChecklistChange('accion_realizada', e.target.value)} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('accion_realizada') ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white h-32 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all resize-none`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Repuestos Usados</label>
                                <textarea name="repuestos_usados" value={formData.checklist.repuestos_usados} onChange={(e) => handleChecklistChange('repuestos_usados', e.target.value)} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('repuestos_usados') ? 'border-red-500/50' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white h-24 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all resize-none`} />
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(type === 'PREVENTIVO' ? PREVENTIVE_CHECKLIST :
                                DELIVERY_CHECKLISTS[formData.equipment_type] || GENERIC_CHECKLIST)
                                .map((item) => (
                                    <label
                                        key={item.id}
                                        className={cn(
                                            "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group active:scale-[0.98]",
                                            formData.checklist[item.id]
                                                ? "bg-blue-500/5 border-blue-500/30 text-blue-600 dark:text-blue-400"
                                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5 text-slate-500 hover:border-slate-300 dark:hover:border-white/10"
                                        )}
                                    >
                                        <div className={cn(
                                            "p-2 rounded-xl transition-all",
                                            formData.checklist[item.id] ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-slate-100 dark:bg-white/5"
                                        )}>
                                            <item.icon size={18} />
                                        </div>
                                        <span className="flex-1 text-xs font-bold leading-tight">{item.label}</span>
                                        <div className={cn(
                                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                            formData.checklist[item.id] ? "bg-blue-500 border-blue-500" : "border-slate-200 dark:border-white/10"
                                        )}>
                                            {formData.checklist[item.id] && <CheckCircle2 size={12} className="text-white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={formData.checklist[item.id]}
                                            onChange={(e) => handleChecklistChange(item.id, e.target.checked)}
                                        />
                                    </label>
                                ))}
                        </div>
                    )}
                </section>

                {/* Observaciones y Recomendaciones */}
                <section className="space-y-5 bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm shadow-sm dark:shadow-none">
                    <h3 className="text-xs font-black uppercase text-blue-400 tracking-[0.2em]">Observaciones Finales</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Observaciones Generales</label>
                            <textarea name="observations" onChange={handleInputChange} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('observations') ? 'border-red-500/50' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white h-24 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none`} />
                        </div>
                        {type !== 'ENTREGA' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Recomendaciones del Técnico</label>
                                <textarea name="recommendations" onChange={handleInputChange} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('recommendations') ? 'border-red-500/50' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white h-24 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none`} />
                            </div>
                        )}
                    </div>
                </section>

                {/* Evidencias */}
                <section className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm shadow-sm dark:shadow-none">
                    <PhotoCapture onPhotosUpdate={(photos) => setFormData(prev => ({ ...prev, photos }))} />
                </section>

                {/* Firmas */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                    <div className={`bg-white dark:bg-slate-900/40 p-6 rounded-3xl border ${errors.includes('signature_technical') ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} backdrop-blur-sm transition-all shadow-sm dark:shadow-none`}>
                        <SignaturePad
                            label="Firma del Técnico"
                            onSave={(sig) => setFormData(prev => ({ ...prev, signatures: { ...prev.signatures, technical: sig } }))}
                            theme={theme}
                        />
                    </div>
                    <div className={`bg-white dark:bg-slate-900/40 p-6 rounded-3xl border ${errors.includes('signature_client') ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} backdrop-blur-sm transition-all shadow-sm dark:shadow-none`}>
                        <SignaturePad
                            label="Firma Conformidad Cliente"
                            onSave={(sig) => setFormData(prev => ({ ...prev, signatures: { ...prev.signatures, client: sig } }))}
                            theme={theme}
                        />
                    </div>
                </section>
            </div>

            {/* Floating Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl border-t border-slate-200 dark:border-white/5 flex gap-4 z-50 transition-colors">
                <button onClick={onCancel} className="flex-1 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-white font-black uppercase tracking-widest text-[11px] py-4 rounded-2xl border border-slate-200 dark:border-white/5 transition-all">
                    Cancelar
                </button>
                <button onClick={handleSaveDraft} className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-black uppercase tracking-widest text-[11px] py-4 rounded-2xl shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 transition-all active:scale-95">
                    <Save size={18} />
                    <span>Finalizar Acta</span>
                </button>
            </div>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default MaintenanceForm;
