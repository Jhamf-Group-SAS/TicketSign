import React, { useState, useRef, useEffect } from 'react';
import { db } from '../store/db';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X, Save, User, ClipboardList, ChevronDown, Calendar as CalendarIcon, Hash, MapPin, Bell, Trash2 } from 'lucide-react';
import Toast from './Toast';
import CustomDatePicker from './CustomDatePicker';

const cn = (...inputs) => twMerge(clsx(inputs));

const TaskForm = ({ onCancel, onSave, initialData }) => {
    const isEditing = !!(initialData && initialData.id);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'CORRECTIVO',
        priority: 'MEDIA',
        status: 'PROGRAMADA',
        scheduled_at: '',
        reminder_at: '',
        reminder_sent: false,
        assigned_technicians: [],
        glpi_ticket_id: '',
        equipment_service: '',
        ...initialData
    });

    const [techInput, setTechInput] = useState('');
    const [toast, setToast] = useState(null);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isReminderPickerOpen, setIsReminderPickerOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState(null); // 'type' | 'priority' | 'status' | null
    const datePickerRef = useRef(null);
    const reminderPickerRef = useRef(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        // Bloquear scroll del body
        document.body.style.overflow = 'hidden';

        const handleClickOutside = (event) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
                setIsDatePickerOpen(false);
            }
            if (reminderPickerRef.current && !reminderPickerRef.current.contains(event.target)) {
                setIsReminderPickerOpen(false);
            }
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            // Restaurar scroll del body
            document.body.style.overflow = 'unset';
        };
    }, []);

    const CustomSelect = ({ label, name, value, options, onChange }) => {
        const isOpen = openDropdown === name;
        return (
            <div className="relative flex-1" ref={name === openDropdown ? dropdownRef : null}>
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">{label}</label>
                <div
                    onClick={() => setOpenDropdown(isOpen ? null : name)}
                    className={`w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm outline-none transition-all font-bold cursor-pointer flex justify-between items-center group
                        ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-500/50' : 'hover:border-slate-300 dark:hover:border-white/20'}`}
                >
                    <span className="text-slate-900 dark:text-white">{value}</span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </div>

                {isOpen && (
                    <div className="absolute top-[calc(100%+8px)] left-0 w-full z-[70] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 animate-in zoom-in-95 duration-200 overflow-hidden">
                        {options.map(opt => (
                            <div
                                key={opt}
                                onClick={() => {
                                    onChange({ target: { name, value: opt } });
                                    setOpenDropdown(null);
                                }}
                                className={`px-4 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all mb-1 last:mb-0
                                    ${value === opt
                                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                            >
                                {opt}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const addTechnician = () => {
        if (techInput.trim() && !formData.assigned_technicians.includes(techInput.trim())) {
            setFormData(prev => ({
                ...prev,
                assigned_technicians: [...prev.assigned_technicians, techInput.trim()],
                status: prev.status === 'PROGRAMADA' ? 'ASIGNADA' : prev.status
            }));
            setTechInput('');
        }
    };

    const removeTechnician = (tech) => {
        setFormData(prev => {
            const newTechs = prev.assigned_technicians.filter(t => t !== tech);
            return {
                ...prev,
                assigned_technicians: newTechs,
                status: newTechs.length === 0 ? 'PROGRAMADA' : prev.status
            };
        });
    };

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        console.log('Iniciando guardado de tarea:', formData);

        if (!formData.title) {
            setToast({ message: 'El título es obligatorio', type: 'error' });
            return;
        }

        try {
            const timestamp = new Date().toISOString();
            if (isEditing) {
                await db.tasks.update(formData.id, {
                    ...formData,
                    updatedAt: timestamp
                });
                setToast({ message: 'Tarea actualizada correctamente', type: 'success' });
            } else {
                await db.tasks.add({
                    ...formData,
                    createdAt: timestamp,
                    updatedAt: timestamp
                });
                setToast({ message: 'Tarea creada correctamente', type: 'success' });
            }

            setTimeout(onSave, 1500);
        } catch (error) {
            console.error('Error al guardar tarea:', error);
            setToast({ message: 'Error al guardar la tarea', type: 'error' });
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[82vh]">
                <header className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                            {isEditing ? 'Editar Tarea' : 'Nueva Tarea'}
                        </h2>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Programación de servicios TI</p>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all active:scale-95 text-slate-500">
                        <X size={22} />
                    </button>
                </header>

                <form id="task-form" onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto no-scrollbar flex-1">
                    <div className="space-y-5">
                        {/* Status selector (Solo en edición o siempre visible) */}
                        {isEditing && (
                            <div className="pb-4 border-b border-slate-100 dark:border-white/5">
                                <CustomSelect
                                    label="Estado del Flujo"
                                    name="status"
                                    value={formData.status}
                                    options={['PROGRAMADA', 'ASIGNADA', 'EN_EJECUCION', 'CANCELADA', 'COMPLETADA']}
                                    onChange={handleInputChange}
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Título de la Tarea</label>
                            <input
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold placeholder:font-normal"
                                placeholder="Ej: Mantenimiento Preventivo Servidores"
                            />
                        </div>

                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Descripción</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all h-24 resize-none"
                                placeholder="Detalles de la labor a realizar..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <CustomSelect
                                label="Tipo"
                                name="type"
                                value={formData.type}
                                options={['PREVENTIVO', 'CORRECTIVO']}
                                onChange={handleInputChange}
                            />
                            <CustomSelect
                                label="Prioridad"
                                name="priority"
                                value={formData.priority}
                                options={['BAJA', 'MEDIA', 'ALTA']}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Ticket GLPI (Opcional)</label>
                                <div className="relative">
                                    <Hash size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        name="glpi_ticket_id"
                                        value={formData.glpi_ticket_id}
                                        onChange={handleInputChange}
                                        className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-4 pl-10 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                                        placeholder="ID Ticket"
                                    />
                                </div>
                            </div>
                            <div className="relative" ref={datePickerRef}>
                                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Fecha Programada</label>
                                <div
                                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                                    className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-4 pl-10 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold cursor-pointer relative"
                                >
                                    <CalendarIcon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    {formData.scheduled_at ? new Date(formData.scheduled_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Seleccionar...'}
                                </div>

                                {isDatePickerOpen && (
                                    <CustomDatePicker
                                        value={formData.scheduled_at}
                                        onChange={(date) => setFormData(prev => ({ ...prev, scheduled_at: date }))}
                                        onClose={() => setIsDatePickerOpen(false)}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-blue-500/5 dark:bg-blue-500/10 rounded-2xl border border-blue-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Bell size={16} className="text-blue-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Recordatorio Personalizado</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, reminder_at: prev.reminder_at ? '' : new Date().toISOString() }))}
                                    className={cn(
                                        "w-10 h-6 rounded-full p-1 transition-all duration-300",
                                        formData.reminder_at ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-800"
                                    )}
                                >
                                    <div className={cn(
                                        "w-4 h-4 bg-white rounded-full transition-transform duration-300",
                                        formData.reminder_at ? "translate-x-4" : "translate-x-0"
                                    )} />
                                </button>
                            </div>

                            {formData.reminder_at && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="relative" ref={reminderPickerRef}>
                                        <div
                                            onClick={() => setIsReminderPickerOpen(!isReminderPickerOpen)}
                                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl p-3 pl-10 text-[11px] outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold cursor-pointer relative"
                                        >
                                            <CalendarIcon size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            {new Date(formData.reminder_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                                        </div>

                                        {isReminderPickerOpen && (
                                            <div className="absolute top-full left-0 mt-2 z-[80] w-full">
                                                <CustomDatePicker
                                                    value={formData.reminder_at}
                                                    onChange={(date) => {
                                                        setFormData(prev => ({ ...prev, reminder_at: date, reminder_sent: false }));
                                                    }}
                                                    onClose={() => setIsReminderPickerOpen(false)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-slate-500 font-bold italic">* Recibirás una alerta en el centro de notificaciones a esta hora.</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Técnicos Asignados</label>
                            <div className="flex gap-2 mb-3">
                                <input
                                    value={techInput}
                                    onChange={(e) => setTechInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTechnician())}
                                    className="flex-1 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold placeholder:font-normal"
                                    placeholder="Nombre del técnico..."
                                />
                                <button
                                    type="button"
                                    onClick={addTechnician}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                                >
                                    <User size={18} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {formData.assigned_technicians.map(tech => (
                                    <span key={tech} className="bg-blue-500/10 text-blue-500 text-[9px] font-black px-3 py-2 rounded-lg border border-blue-500/20 flex items-center gap-2 animate-in zoom-in-95 duration-200">
                                        {tech}
                                        <button type="button" onClick={() => removeTechnician(tech)} className="hover:text-red-500 transition-colors"><X size={12} /></button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Equipo o Servicio</label>
                            <div className="relative">
                                <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    name="equipment_service"
                                    value={formData.equipment_service}
                                    onChange={handleInputChange}
                                    className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-4 pl-10 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                                    placeholder="Ej: Rack comunicaciones piso 2"
                                />
                            </div>
                        </div>
                    </div>
                </form>

                <footer className="p-6 bg-slate-50 dark:bg-slate-950/30 border-t border-slate-100 dark:border-white/5 flex gap-3">
                    {isEditing && (
                        <button
                            type="button"
                            onClick={async () => {
                                if (window.confirm('¿Estás seguro de eliminar esta tarea?')) {
                                    await db.tasks.delete(formData.id);
                                    onSave();
                                }
                            }}
                            className="p-4 rounded-2xl border-2 border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all active:scale-95"
                        >
                            <Trash2 size={20} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="flex-[2] flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                    >
                        <Save size={18} />
                        {isEditing ? 'Actualizar Tarea' : 'Crear Tarea'}
                    </button>
                </footer>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default TaskForm;
