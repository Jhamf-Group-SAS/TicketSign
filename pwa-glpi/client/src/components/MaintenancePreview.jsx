import { db } from '../store/db';
import { Package, ClipboardList, User, Building2, Monitor, Calendar, Clock, Tag, CheckCircle, Save, X, ChevronLeft, Building, Trash2, ShieldCheck, Settings2, Globe, FileCheck, Keyboard, Mouse, Laptop, HardDrive, Image as ImageIcon, UploadCloud, FileText, MessageSquare, Printer, Wifi, Zap, Layers, Power, ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import Toast from './Toast';

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
    const [toast, setToast] = useState(null);

    if (!act) return null;

    const handleSyncManual = async () => {
        if (!navigator.onLine) {
            setToast({ message: 'No tienes conexión a internet para sincronizar', type: 'error' });
            return;
        }

        setIsSyncing(true);
        setToast({ message: 'Sincronizando con GLPI...', type: 'info' });

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/sync/maintenance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                },
                body: JSON.stringify(act)
            });

            const result = await response.json();

            if (response.ok) {
                setToast({ message: '¡Acta sincronizada correctamente en GLPI!', type: 'success' });
            } else {
                throw new Error(result.message || 'Error en la sincronización');
            }
        } catch (error) {
            console.error('Error al sincronizar:', error);
            setToast({ message: `Error: ${error.message}`, type: 'error' });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/reports/individual`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                },
                body: JSON.stringify(act)
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Acta_Ticket_${act.glpi_ticket_id || 'S-T'}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
        } catch (error) {
            console.error('Error al descargar PDF:', error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-8 pb-32 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors">
            {/* Header Preview */}
            <div className="flex items-center justify-between sticky top-[73px] z-40 bg-white/80 dark:bg-[#020617]/80 backdrop-blur-md py-4 border-b border-slate-200 dark:border-white/5 mx-[-1rem] px-4 transition-colors">
                <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${act.type === 'PREVENTIVO' ? 'bg-blue-500/10 text-blue-500' : act.type === 'ENTREGA' ? 'bg-purple-500/10 text-purple-500' : 'bg-orange-500/10 text-orange-500'}`}>
                        {act.type === 'ENTREGA' ? <Package size={28} /> : <ClipboardList size={28} />}
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                            {act.type === 'PREVENTIVO' ? 'Acta Preventiva' : act.type === 'ENTREGA' ? 'Acta de Entrega' : 'Acta Correctiva'}
                        </h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Resumen del Servicio</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Resumen General */}
                <section className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm space-y-4 shadow-sm dark:shadow-none transition-colors">
                    <h3 className="text-xs font-black uppercase text-blue-500 tracking-[0.2em] flex items-center gap-2">
                        <ClipboardCheck size={14} /> Información General
                    </h3>
                    <div className="grid grid-cols-2 gap-y-4 text-sm">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">EMPRESA</p>
                            <p className="text-slate-900 dark:text-white font-medium transition-colors">{act.client_name || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Técnico</p>
                            <p className="text-slate-900 dark:text-white font-medium transition-colors">{act.technical_name || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Fecha</p>
                            <p className="text-slate-900 dark:text-white font-medium transition-colors">{new Date(act.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Estado</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold uppercase">{act.status}</span>
                        </div>
                    </div>
                </section>

                {/* Bloque de Usuario Destacado */}
                <div className="bg-blue-600/10 p-6 rounded-[2rem] border border-blue-500/20 backdrop-blur-sm flex items-center justify-between group shadow-xl shadow-blue-900/10 mx-2 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600/20 p-3 rounded-2xl text-blue-500">
                            <User size={20} />
                        </div>
                        <div>
                            <p className="text-[9px] uppercase font-black text-blue-500 tracking-[0.2em] mb-0.5">Usuario Asignado</p>
                            <h4 className="text-base font-black text-slate-900 dark:text-white transition-colors">{act.assigned_user || act.client_name || 'No Registrado'}</h4>
                        </div>
                    </div>
                </div>

                {/* Detalles del Equipo */}
                <section className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm space-y-4 shadow-sm dark:shadow-none transition-colors">
                    <h3 className="text-xs font-black uppercase text-purple-500 tracking-[0.2em] flex items-center gap-2">
                        <HardDrive size={14} /> Datos del Equipo
                    </h3>
                    <div className="grid grid-cols-2 gap-y-4 text-sm">
                        <div className="col-span-2 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Inventario / Activo</p>
                                <p className="text-purple-600 dark:text-blue-400 font-black transition-colors">{act.inventory_number || 'N/A'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Tipo de Activo</p>
                                <span className="px-3 py-1 bg-purple-500/10 text-purple-500 rounded-full text-[10px] font-black uppercase tracking-tight border border-purple-500/20">{act.equipment_type || 'COMPUTADOR'}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Serial</p>
                            <p className="text-slate-900 dark:text-white font-mono transition-colors">{act.equipment_serial || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Hostname</p>
                            <p className="text-slate-900 dark:text-white font-medium transition-colors">{act.equipment_hostname || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1 block">Modelo</label>
                            <p className="text-slate-900 dark:text-white font-medium transition-colors">{act.equipment_model || 'N/A'}</p>
                        </div>
                        {(!act.equipment_type || act.equipment_type === 'COMPUTADOR') && (
                            <>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Procesador</p>
                                    <p className="text-slate-900 dark:text-white font-medium transition-colors">{act.equipment_processor || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">RAM</p>
                                    <p className="text-slate-900 dark:text-white font-medium transition-colors">
                                        {act.equipment_ram === 'OTRO' ? `${act.equipment_ram_other} GB` : (act.equipment_ram || 'N/A')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Disco</p>
                                    <p className="text-slate-900 dark:text-white font-medium transition-colors">
                                        {act.equipment_disk === 'OTRO' ? `${act.equipment_disk_other} GB` : (act.equipment_disk || 'N/A')}
                                        <span className="ml-1.5 px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-[10px] font-black text-slate-500">{act.equipment_disk_type || 'SSD'}</span>
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </section>

                {/* Checklist */}
                <section className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm space-y-4 shadow-sm dark:shadow-none transition-colors">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase text-green-500 tracking-[0.2em] flex items-center gap-2">
                            <Tag size={14} /> Checklist de {act.type === 'ENTREGA' ? 'Entrega' : 'Mantenimiento'}
                        </h3>
                        {(act.type === 'PREVENTIVO' || act.type === 'ENTREGA') && (
                            <span className="text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1 rounded-full">
                                {Object.values(act.checklist).filter(v => v === true).length} Completados
                            </span>
                        )}
                    </div>

                    {(act.type === 'PREVENTIVO' || act.type === 'ENTREGA') ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(act.type === 'PREVENTIVO' ? PREVENTIVE_CHECKLIST :
                                DELIVERY_CHECKLISTS[act.equipment_type] || GENERIC_CHECKLIST)
                                .map((item) => (
                                    act.checklist[item.id] && (
                                        <div key={item.id} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-200 dark:border-white/5 transition-colors">
                                            <div className="bg-green-500/10 p-2 rounded-xl text-green-500">
                                                <item.icon size={18} />
                                            </div>
                                            <span className="flex-1 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors uppercase tracking-tight">{item.label}</span>
                                            <CheckCircle size={18} className="text-green-500" />
                                        </div>
                                    )
                                ))}
                            {Object.values(act.checklist).every(v => v === false) && (
                                <p className="col-span-2 text-center text-slate-400 dark:text-slate-500 text-xs italic py-4 transition-colors">No se marcaron actividades.</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 text-sm">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Diagnóstico</p>
                                <p className="text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950/30 p-3 rounded-xl border border-slate-200 dark:border-white/5 leading-relaxed transition-colors">{act.checklist.diagnostico || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Falla Reportada</p>
                                <p className="text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950/30 p-3 rounded-xl border border-slate-200 dark:border-white/5 leading-relaxed transition-colors">{act.checklist.falla_reportada || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Acción Realizada</p>
                                <p className="text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950/30 p-3 rounded-xl border border-slate-200 dark:border-white/5 leading-relaxed transition-colors">{act.checklist.accion_realizada || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Repuestos Usados</p>
                                <p className="text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950/30 p-3 rounded-xl border border-slate-200 dark:border-white/5 leading-relaxed transition-colors">{act.checklist.repuestos_usados || 'N/A'}</p>
                            </div>
                        </div>
                    )}
                </section>

                {/* Observaciones y Recomendaciones */}
                <section className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm space-y-4 shadow-sm dark:shadow-none transition-colors">
                    <h3 className="text-xs font-black uppercase text-blue-500 tracking-[0.2em] flex items-center gap-2">
                        <MessageSquare size={14} /> Observaciones Finales
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Observaciones Generales</p>
                            <div className="text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950/30 p-4 rounded-2xl border border-slate-200 dark:border-white/5 text-sm leading-relaxed transition-colors whitespace-pre-wrap">
                                {act.observations || 'Sin observaciones.'}
                            </div>
                        </div>
                        {act.type !== 'ENTREGA' && act.recommendations && (
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Recomendaciones</p>
                                <div className="text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950/30 p-4 rounded-2xl border border-slate-200 dark:border-white/5 text-sm leading-relaxed transition-colors whitespace-pre-wrap">
                                    {act.recommendations}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Evidencias */}
                {act.photos && act.photos.length > 0 && (
                    <section className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm space-y-4 shadow-sm dark:shadow-none transition-colors">
                        <h3 className="text-xs font-black uppercase text-orange-500 tracking-[0.2em] flex items-center gap-2">
                            <ImageIcon size={14} /> Evidencias Fotográficas
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            {act.photos.map((photo, i) => (
                                <div key={i} className="aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-white/5 transition-colors">
                                    <img src={photo} alt="evidencia" className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Firmas */}
                <section className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm space-y-3 shadow-sm dark:shadow-none transition-colors">
                        <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest text-center">Técnico</p>
                        {act.signatures.technical ? (
                            <img
                                src={act.signatures.technical}
                                className="w-full h-20 object-contain transition-all"
                                alt="firma tecnico"
                                style={{ filter: theme === 'dark' ? 'brightness(0) invert(1)' : 'brightness(0)' }}
                            />
                        ) : (
                            <div className="h-20 flex items-center justify-center text-slate-400 dark:text-slate-700 text-xs italic transition-colors">Sin firma</div>
                        )}
                    </div>
                    <div className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm space-y-3 shadow-sm dark:shadow-none transition-colors">
                        <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest text-center">EMPRESA</p>
                        {act.signatures.client ? (
                            <img
                                src={act.signatures.client}
                                className="w-full h-20 object-contain transition-all"
                                alt="firma cliente"
                                style={{ filter: theme === 'dark' ? 'brightness(0) invert(1)' : 'brightness(0)' }}
                            />
                        ) : (
                            <div className="h-20 flex items-center justify-center text-slate-400 dark:text-slate-700 text-xs italic transition-colors">Sin firma</div>
                        )}
                    </div>
                </section>
            </div>

            {/* Floating Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl border-t border-slate-200 dark:border-white/5 flex gap-4 z-50 transition-colors">
                <button onClick={onBack} className="flex-1 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-white font-black uppercase tracking-widest text-[11px] py-4 rounded-2xl border border-slate-200 dark:border-white/5 transition-all">
                    Volver
                </button>
                <button
                    onClick={handleSyncManual}
                    disabled={isSyncing}
                    className="flex-1 bg-green-600/20 hover:bg-green-600/30 text-green-500 font-black uppercase tracking-widest text-[11px] py-4 rounded-2xl border border-green-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                    {isSyncing ? <div className="w-4 h-4 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div> : <UploadCloud size={18} />}
                    <span>Sincronizar</span>
                </button>
                <button
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="flex-[1.5] bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[11px] py-4 rounded-2xl shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                    {isExporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <FileText size={18} />}
                    <span>PDF</span>
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

export default MaintenancePreview;
