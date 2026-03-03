import { db } from '../store/db';
import { Package, ClipboardList, User, Building2, Monitor, Calendar, Clock, Tag, CheckCircle, Save, X, ChevronLeft, Building, Trash2, ShieldCheck, Settings2, Globe, FileCheck, Keyboard, Mouse, Laptop, HardDrive, Image as ImageIcon, UploadCloud, FileText, MessageSquare, Printer, Wifi, Zap, Layers, Power, ClipboardCheck, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from './Toast';
import { cn } from '../utils/cn';

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

const MaintenancePreview = ({ act, onBack, theme }) => {
    const [isExporting, setIsExporting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    if (!act) return null;

    const handleSyncManual = async () => {
        if (!navigator.onLine) {
            toast.error('No tienes conexión a internet para sincronizar');
            return;
        }

        setIsSyncing(true);
        toast.info('Sincronizando con GLPI...');

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/sync/maintenance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                },
                body: JSON.stringify(act)
            });

            const result = await response.json();

            if (response.ok) {
                toast.success('¡Acta sincronizada correctamente en GLPI!');
            } else {
                throw new Error(result.message || 'Error en la sincronización');
            }
        } catch (error) {
            // sync error preview
            toast.error(`Error: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/reports/individual`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                },
                body: JSON.stringify(act)
            });

            if (response.ok) {
                const data = await response.blob();
                const blob = new Blob([data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `Acta_Ticket_${act.glpi_ticket_id || 'S-T'}.pdf`;
                document.body.appendChild(a);
                a.click();

                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 30000); // 30s timeout para prevenir bug de nombres de archivo UUID en PWA

                toast.success('PDF generado con éxito');
            } else {
                toast.error('Error al generar PDF');
            }
        } catch (error) {
            toast.error('Error de conexión');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6 pb-32 max-w-3xl mx-auto animate-in fade-in duration-500">
            {/* Header Preview */}
            <div className="flex items-center justify-between sticky top-0 z-40 bg-secondary py-4 border-b border-color mx-[-1rem] px-4">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "p-3 rounded-2xl text-white shadow-lg",
                        act.type === 'PREVENTIVO' ? "bg-primary-500" : act.type === 'ENTREGA' ? "bg-purple-500" : "bg-orange-500"
                    )}>
                        {act.type === 'ENTREGA' ? <Package size={20} /> : <ClipboardList size={20} />}
                    </div>
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider leading-tight">
                            {act.type === 'PREVENTIVO' ? 'Resumen Mantenimiento Preventivo' : act.type === 'ENTREGA' ? 'Resumen Acta de Entrega' : 'Resumen Mantenimiento Correctivo'}
                        </h2>
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-[0.2em]">Ticket GLPI #{act.glpi_ticket_id}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Resumen General */}
                <section className="bg-secondary p-6 rounded-2xl border border-color space-y-4 shadow-sm">
                    <h3 className="text-[10px] font-bold uppercase text-primary-500 tracking-[0.2em] flex items-center gap-2">
                        <ClipboardCheck size={14} /> Información General
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                            <p className="text-[9px] uppercase font-bold text-text-muted mb-1">Empresa</p>
                            <p className="text-text-primary font-bold">{act.client_name || '---'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] uppercase font-bold text-text-muted mb-1">Técnico</p>
                            <p className="text-text-primary font-bold">{act.technical_name || '---'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] uppercase font-bold text-text-muted mb-1">Fecha</p>
                            <p className="text-text-primary font-bold">{new Date(act.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                            <p className="text-[9px] uppercase font-bold text-text-muted mb-1">Sync Status</p>
                            <span className={cn(
                                "text-[8px] px-2 py-0.5 rounded-lg border font-bold uppercase",
                                act.status === 'SINCRONIZADO' ? "bg-secondary text-emerald-500 border-emerald-500" : "bg-secondary text-amber-500 border-amber-500"
                            )}>
                                {act.status}
                            </span>
                        </div>
                    </div>
                </section>

                {/* Bloque de Usuario */}
                <div className="bg-secondary p-4 rounded-2xl border border-color flex items-center gap-4 shadow-sm">
                    <div className="bg-tertiary p-2.5 rounded-xl text-primary-500 border border-color">
                        <User size={18} />
                    </div>
                    <div>
                        <p className="text-[8px] uppercase font-bold text-primary-500 tracking-[0.2em] mb-0.5">Usuario Asignado</p>
                        <h4 className="text-sm font-bold text-text-primary">{act.assigned_user || 'No Registrado'}</h4>
                    </div>
                </div>

                {/* Detalles del Equipo */}
                <section className="bg-secondary p-6 rounded-2xl border border-color space-y-5 shadow-sm">
                    <h3 className="text-[10px] font-bold uppercase text-purple-500 tracking-[0.2em] flex items-center gap-2">
                        <HardDrive size={14} /> Datos del Equipo
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="col-span-2 md:col-span-2">
                            <p className="text-[9px] uppercase font-bold text-text-muted mb-1">Inventario / Modelo</p>
                            <p className="text-xs font-bold text-text-primary">{act.inventory_number || '---'} | {act.equipment_model || '---'}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[9px] uppercase font-bold text-text-muted mb-1">Tipo de Activo</p>
                            <span className="px-2 py-0.5 bg-secondary text-purple-500 rounded-lg text-[10px] font-bold uppercase border border-purple-500">{act.equipment_type || 'COMPUTADOR'}</span>
                        </div>
                        <div>
                            <p className="text-[9px] uppercase font-bold text-text-muted mb-1">Serial</p>
                            <p className="text-xs font-bold text-text-primary font-mono">{act.equipment_serial || '---'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] uppercase font-bold text-text-muted mb-1">Hostname</p>
                            <p className="text-xs font-bold text-text-primary">{act.equipment_hostname || '---'}</p>
                        </div>
                        {(!act.equipment_type || act.equipment_type === 'COMPUTADOR') && (
                            <>
                                <div>
                                    <p className="text-[9px] uppercase font-bold text-text-muted mb-1">Hardware</p>
                                    <p className="text-[10px] font-bold text-text-primary">
                                        {act.equipment_processor || '---'} | {act.equipment_ram === 'OTRO' ? act.equipment_ram_other : act.equipment_ram} RAM
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase font-bold text-text-muted mb-1">Almacenamiento</p>
                                    <p className="text-[10px] font-bold text-text-primary">
                                        {act.equipment_disk === 'OTRO' ? act.equipment_disk_other : act.equipment_disk} {act.equipment_disk_type}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </section>

                {/* Checklist */}
                <section className="bg-secondary p-6 rounded-2xl border border-color space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-bold uppercase text-emerald-500 tracking-[0.2em] flex items-center gap-2">
                            <Tag size={14} /> Ejecución del Servicio
                        </h3>
                    </div>

                    {(act.type === 'PREVENTIVO' || act.type === 'ENTREGA') ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(act.type === 'PREVENTIVO' ? PREVENTIVE_CHECKLIST :
                                DELIVERY_CHECKLISTS[act.equipment_type] || GENERIC_CHECKLIST)
                                .map((item) => (
                                    act.checklist[item.id] && (
                                        <div key={item.id} className="flex items-center gap-3 p-3 bg-tertiary rounded-xl border border-color">
                                            <div className="bg-secondary p-1.5 rounded-lg text-emerald-500 border border-emerald-500">
                                                <item.icon size={14} />
                                            </div>
                                            <span className="flex-1 text-[11px] font-bold text-text-secondary uppercase tracking-tight">{item.label}</span>
                                            <CheckCircle size={14} className="text-emerald-500" />
                                        </div>
                                    )
                                ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {['diagnostico', 'falla_reportada', 'accion_realizada', 'repuestos_usados'].map(k => (
                                <div key={k}>
                                    <p className="text-[9px] uppercase font-bold text-text-muted mb-1">{k.replace('_', ' ')}</p>
                                    <p className="text-xs bg-tertiary p-4 rounded-xl border border-color leading-relaxed">{act.checklist[k] || '---'}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Observaciones */}
                <section className="bg-secondary p-6 rounded-2xl border border-color space-y-4 shadow-sm">
                    <h3 className="text-[10px] font-bold uppercase text-primary-500 tracking-[0.2em] flex items-center gap-2">
                        <MessageSquare size={14} /> Conclusiones
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <p className="text-[9px] uppercase font-bold text-text-muted mb-1">Observaciones</p>
                            <p className="text-xs text-text-primary bg-tertiary/30 p-4 rounded-xl border border-color leading-relaxed">{act.observations || 'Sin observaciones.'}</p>
                        </div>
                        {act.type !== 'ENTREGA' && act.recommendations && (
                            <div>
                                <p className="text-[9px] uppercase font-bold text-text-muted mb-1">Recomendaciones</p>
                                <p className="text-xs text-text-primary bg-tertiary/30 p-4 rounded-xl border border-color leading-relaxed">{act.recommendations}</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Evidencias Fotográficas */}
                {act.photos && act.photos.length > 0 && (
                    <section className="bg-secondary p-6 rounded-2xl border border-color space-y-4 shadow-sm">
                        <h3 className="text-[10px] font-bold uppercase text-blue-500 tracking-[0.2em] flex items-center gap-2">
                            <ImageIcon size={14} /> Evidencias Fotográficas ({act.photos.length})
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {act.photos.map((photo, i) => (
                                <div key={i} className="aspect-square bg-tertiary rounded-xl border border-color overflow-hidden flex items-center justify-center p-1 relative group">
                                    <img src={photo.data} alt={`Evidencia ${i + 1}`} className="w-full h-full object-cover rounded-lg" />
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Firmas */}
                <section className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary p-5 rounded-2xl border border-color shadow-sm space-y-3">
                        <p className="text-[9px] uppercase font-bold text-text-muted tracking-widest text-center">Técnico</p>
                        <div className="h-24 bg-slate-200 rounded-xl flex items-center justify-center p-2">
                            {act.signatures.technical ? (
                                <img src={act.signatures.technical} className="h-full object-contain" alt="firma tecnico" />
                            ) : (
                                <span className="text-[10px] text-slate-500 italic">Sin firma</span>
                            )}
                        </div>
                    </div>
                    <div className="bg-secondary p-5 rounded-2xl border border-color shadow-sm space-y-3">
                        <p className="text-[9px] uppercase font-bold text-text-muted tracking-widest text-center">Cliente</p>
                        <div className="h-24 bg-slate-200 rounded-xl flex items-center justify-center p-2">
                            {act.signatures.client ? (
                                <img src={act.signatures.client} className="h-full object-contain" alt="firma cliente" />
                            ) : (
                                <span className="text-[10px] text-slate-500 italic">Sin firma</span>
                            )}
                        </div>
                    </div>
                </section>
            </div>

            {/* Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-secondary border-t border-color flex gap-3 z-50 shadow-2xl">
                <div className="max-w-3xl w-full mx-auto flex gap-3">
                    <button onClick={onBack} className="flex-1 bg-tertiary border border-color text-text-secondary py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">Cerrar</button>
                    <button
                        onClick={handleSyncManual}
                        disabled={isSyncing}
                        className="flex-1 bg-tertiary hover:bg-secondary text-emerald-500 border border-emerald-500 py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                    >
                        {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                        Sync
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="flex-[1.5] bg-primary-500 hover:bg-primary-600 text-white py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        Descargar PDF
                    </button>
                </div>
            </div>
            <br />
        </div>
    );
};

export default MaintenancePreview;
