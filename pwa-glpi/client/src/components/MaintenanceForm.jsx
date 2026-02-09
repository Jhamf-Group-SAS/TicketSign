import { useState } from 'react';
import SignaturePad from './SignaturePad';
import PhotoCapture from './PhotoCapture';
import Toast from './Toast';
import { saveDraftAct, markForSync, db } from '../store/db';
import { CheckCircle, AlertTriangle, Save, X, ChevronLeft, HardDrive } from 'lucide-react';

const MaintenanceForm = ({ type, onCancel, onSave, theme }) => {
    const [formData, setFormData] = useState({
        glpi_ticket_id: '',
        client_name: '',
        technical_name: '',
        equipment_serial: '',
        equipment_hostname: '',
        equipment_model: '',
        assigned_user: '',
        observations: '',
        recommendations: '',
        checklist: type === 'PREVENTIVO' ? {
            limpieza_interna: false,
            limpieza_externa: false,
            verificacion_disco: false,
            verificacion_memoria: false,
            actualizaciones_sistema: false,
            antivirus_actualizado: false,
            backup_verificado: false
        } : {
            diagnostico: '',
            falla_reportada: '',
            accion_realizada: '',
            repuestos_usados: '',
            estado_final: 'OPERATIVO'
        },
        signatures: { technical: null, client: null },
        photos: []
    });

    const [toast, setToast] = useState(null);
    const [errors, setErrors] = useState([]);

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
        if (!formData.recommendations) newErrors.push('recommendations');

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
                    headers: { 'Content-Type': 'application/json' },
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
                <div className="flex items-center gap-3">
                    <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-500 dark:text-slate-400">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                            {type === 'PREVENTIVO' ? <CheckCircle className="text-blue-500" size={20} /> : <AlertTriangle className="text-orange-500" size={20} />}
                            Acta {type}
                        </h2>
                        <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest">Nuevo Registro</p>
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
                <section className="space-y-5 bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm shadow-sm dark:shadow-none">
                    <h3 className="text-xs font-black uppercase text-blue-500 tracking-[0.2em]">Información General</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Ticket GLPI #</label>
                            <input name="glpi_ticket_id" onChange={handleInputChange} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('glpi_ticket_id') ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700`} placeholder="Ej: 15420" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">EMPRESA</label>
                            <input name="client_name" onChange={handleInputChange} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('client_name') ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all`} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Técnico Responsable</label>
                            <input name="technical_name" onChange={handleInputChange} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('technical_name') ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all`} />
                        </div>
                    </div>
                </section>

                {/* Datos del Equipo */}
                <section className="space-y-6 bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm shadow-sm dark:shadow-none">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase text-purple-500 tracking-[0.2em] flex items-center gap-2">
                            <HardDrive size={16} /> Datos Técnicos del Activo
                        </h3>
                    </div>
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
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Usuario / Dueño del Equipo</label>
                            <input name="assigned_user" onChange={handleInputChange} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('assigned_user') ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all`} placeholder="Nombre de la persona que usa el equipo" />
                        </div>
                    </div>
                </section>

                {/* Checklist */}
                <section className="space-y-5 bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-sm shadow-sm dark:shadow-none">
                    <h3 className="text-xs font-black uppercase text-green-500 tracking-[0.2em]">Checklist de Actividades</h3>
                    {type === 'PREVENTIVO' ? (
                        <div className="grid grid-cols-1 gap-3">
                            {Object.keys(formData.checklist).map(key => (
                                <label key={key} className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-950/30 hover:bg-slate-100 dark:hover:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/5 cursor-pointer transition-all active:scale-[0.98]">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300 capitalize">{key.replace(/_/g, ' ')}</span>
                                    <input
                                        type="checkbox"
                                        checked={formData.checklist[key]}
                                        onChange={(e) => handleChecklistChange(key, e.target.checked)}
                                        className="w-6 h-6 rounded-lg border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-blue-600 focus:ring-blue-500/50"
                                    />
                                </label>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Diagnóstico</label>
                                <textarea name="diagnostico" onChange={(e) => handleChecklistChange('diagnostico', e.target.value)} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('diagnostico') ? 'border-red-500/50' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white h-24 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all resize-none`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Falla Reportada</label>
                                <textarea name="falla_reportada" onChange={(e) => handleChecklistChange('falla_reportada', e.target.value)} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('falla_reportada') ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white h-32 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all resize-none`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Acción Realizada</label>
                                <textarea name="accion_realizada" onChange={(e) => handleChecklistChange('accion_realizada', e.target.value)} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('accion_realizada') ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white h-32 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all resize-none`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Repuestos Usados</label>
                                <textarea name="repuestos_usados" onChange={(e) => handleChecklistChange('repuestos_usados', e.target.value)} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('repuestos_usados') ? 'border-red-500/50' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white h-24 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all resize-none`} />
                            </div>
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
                        <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Recomendaciones del Técnico</label>
                            <textarea name="recommendations" onChange={handleInputChange} className={`w-full bg-slate-50 dark:bg-slate-950/50 border ${errors.includes('recommendations') ? 'border-red-500/50' : 'border-slate-200 dark:border-white/5'} rounded-2xl p-4 text-sm text-slate-900 dark:text-white h-24 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none`} />
                        </div>
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
