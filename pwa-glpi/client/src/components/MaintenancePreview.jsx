import { ChevronLeft, Calendar, User, Tag, HardDrive, ClipboardCheck, Image as ImageIcon, PenTool, CheckCircle, X, FileText, UploadCloud, RefreshCcw } from 'lucide-react';
import { useState } from 'react';
import Toast from './Toast';

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
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-500 dark:text-slate-400">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white transition-colors">
                            Vista Previa: Ticket #{act.glpi_ticket_id || '---'}
                        </h2>
                        <p className="text-[10px] uppercase font-black text-blue-500 tracking-widest">{act.type} - {act.status}</p>
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
                        <div className="col-span-2">
                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Inventario / Activo</p>
                            <p className="text-purple-600 dark:text-blue-400 font-black transition-colors">{act.inventory_number || 'N/A'}</p>
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
                    </div>
                </section>

                {/* Checklist */}
                <section className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm space-y-4 shadow-sm dark:shadow-none transition-colors">
                    <h3 className="text-xs font-black uppercase text-green-500 tracking-[0.2em] flex items-center gap-2">
                        <Tag size={14} /> Resultados del Checklist
                    </h3>
                    {act.type === 'PREVENTIVO' ? (
                        <div className="space-y-2">
                            {Object.entries(act.checklist)
                                .filter(([_, val]) => val === true)
                                .map(([key]) => (
                                    <div key={key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-200 dark:border-white/5 transition-colors">
                                        <span className="text-sm text-slate-600 dark:text-slate-300 capitalize transition-colors">{key.replace(/_/g, ' ')}</span>
                                        <CheckCircle size={18} className="text-green-500" />
                                    </div>
                                ))}
                            {Object.values(act.checklist).every(v => v === false) && (
                                <p className="text-center text-slate-400 dark:text-slate-500 text-xs italic py-4 transition-colors">No se marcaron actividades.</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 text-sm">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Falla Reportada</p>
                                <p className="text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950/30 p-3 rounded-xl border border-slate-200 dark:border-white/5 leading-relaxed transition-colors">{act.checklist.falla_reportada || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Acción Realizada</p>
                                <p className="text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950/30 p-3 rounded-xl border border-slate-200 dark:border-white/5 leading-relaxed transition-colors">{act.checklist.accion_realizada || 'N/A'}</p>
                            </div>
                        </div>
                    )}
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
