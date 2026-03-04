import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../store/db';
import { SyncService } from '../services/SyncService';
import { cn } from '../utils/cn';
import {
    X,
    Save,
    User,
    ClipboardList,
    ChevronDown,
    Calendar as CalendarIcon,
    Hash,
    MapPin,
    Bell,
    Trash2,
    Search,
    Check,
    Lock,
    Globe,
    Loader2,
    MessageSquare,
    Clock
} from 'lucide-react';
import { toast } from './Toast';
import CustomDatePicker from './CustomDatePicker';
import CustomSelect from './CustomSelect';
import NotificationService from '../services/NotificationService';

const InputGroup = ({ label, name, value, placeholder, onChange, required, icon: Icon, type = "text", disabled }) => (
    <div className="space-y-1.5 flex-1">
        <label className="text-[12px] font-[600] text-text-primary block ml-1 uppercase tracking-wide">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
            {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />}
            <input
                type={type}
                name={name}
                value={value}
                placeholder={placeholder}
                onChange={onChange}
                disabled={disabled}
                className={cn(
                    "h-[40px] w-full rounded-[8px] border border-color px-[12px] text-[13px] bg-tertiary outline-none transition-all text-text-primary placeholder:text-text-muted/40",
                    "focus:border-primary-500 focus:bg-secondary shadow-sm",
                    Icon && "pl-[36px]",
                    disabled && "opacity-60 cursor-not-allowed bg-tertiary"
                )}
            />
        </div>
    </div>
);

const TaskForm = ({ onCancel, onClose, onSave, onSaved, initialData, task }) => {
    // Handle prop inconsistencies
    const finalInitialData = task || initialData;
    const finalOnCancel = onCancel || onClose;
    const finalOnSave = onSave || onSaved;

    const isEditing = !!(finalInitialData && (finalInitialData.id || finalInitialData._id));
    const [user] = useState(JSON.parse(localStorage.getItem('glpi_pro_user') || '{}'));

    const isAdmin = (user.profile || '').includes('Super-Admin') || (user.profile || '').includes('Admin-Mesa');
    const isSpecialist = ['Especialistas', 'Administrativo', 'Admin'].some(p => (user.profile || '').includes(p));
    const isCreator = finalInitialData?.createdBy === user.username;
    const canEditFull = isAdmin || (!isEditing && isSpecialist) || isCreator;

    const [formData, setFormData] = useState({
        title: '', description: '', type: 'CORRECTIVO', priority: 'MEDIA',
        status: 'PROGRAMADA', scheduled_at: '', reminder_at: '', reminder_sent: false,
        recurrence: 'NINGUNA', start_date: '', end_date: '', sendWhatsApp: true,
        assigned_technicians: [], glpi_ticket_id: '', equipment_service: '', isPrivate: false,
        ...finalInitialData
    });

    const [techInput, setTechInput] = useState('');
    const [techs, setTechs] = useState([]);
    const [filteredTechs, setFilteredTechs] = useState([]);
    const [isTechListOpen, setIsTechListOpen] = useState(false);
    const [loadingTechs, setLoadingTechs] = useState(false);
    // const [toast, setToast] = useState(null); // REMOVED
    const [datePickerType, setDatePickerType] = useState(null); // 'scheduled', 'start', 'end', or 'reminder'
    const [datePickerAnchor, setDatePickerAnchor] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await db.tasks.delete(formData.id || formData._id);
            if (navigator.onLine && (formData.id || formData._id)) {
                const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/tasks/${formData._id || formData.id}`;
                await fetch(url, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}` }
                });
            }
            toast.success('Tarea eliminada');
            setTimeout(finalOnSave, 1000);
        } catch (err) {
            toast.error('Error al eliminar');
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const techSearchRef = useRef(null);

    useEffect(() => {
        const loadTechs = async () => {
            setLoadingTechs(true);
            try {
                const data = await SyncService.getTechnicians();
                setTechs(data);
                setFilteredTechs(data);
            } catch (err) { /* silent */ } finally { setLoadingTechs(false); }
        };
        loadTechs();
    }, []);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const handleClickOutside = (e) => {
            if (techSearchRef.current && !techSearchRef.current.contains(e.target)) setIsTechListOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.body.style.overflow = 'unset';
        };
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTechSearch = (e) => {
        const query = e.target.value;
        setTechInput(query);
        setIsTechListOpen(true);
        const lower = query.toLowerCase();
        setFilteredTechs(techs.filter(t => (t.fullName || '').toLowerCase().includes(lower) || (t.name || '').toLowerCase().includes(lower)));
    };

    const toggleTechnician = (techName) => {
        setFormData(prev => {
            const isAssigned = prev.assigned_technicians.includes(techName);
            const newTechs = isAssigned ? prev.assigned_technicians.filter(t => t !== techName) : [...prev.assigned_technicians, techName];
            return {
                ...prev, assigned_technicians: newTechs,
                status: newTechs.length === 0 ? 'PROGRAMADA' : (prev.status === 'PROGRAMADA' ? 'ASIGNADA' : prev.status)
            };
        });
        setTechInput('');
        setIsTechListOpen(false);
    };

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (isSubmitting) return;
        if (!formData.title) { toast.error('El título es obligatorio'); return; }

        // Validación de fechas para recurrencia
        if (formData.recurrence !== 'NINGUNA' && !formData.start_date) {
            toast.error('La fecha de inicio es obligatoria');
            return;
        }

        setIsSubmitting(true);
        try {
            const timestamp = new Date().toISOString();
            const tasksToSave = [];

            if (formData.recurrence === 'NINGUNA' || isEditing) {
                // Tarea simple o edición: Solo una tarea
                const task = { ...formData, updatedAt: timestamp };
                if (!isEditing) { task.createdAt = timestamp; task.createdBy = user.username; }
                tasksToSave.push(task);
            } else {
                // Generar instancias recurrentes
                const maxInstances = 50;
                let count = 0;

                // Normalizar fechas a medianoche para comparación inclusiva
                let current = new Date(formData.start_date);
                current.setHours(0, 0, 0, 0);

                const end = new Date(formData.end_date || formData.start_date);
                end.setHours(23, 59, 59, 999);

                // Determinar la fuente de tiempo BASE para la recurrencia o tarea única
                // Si es periódica, ignoramos scheduled_at y usamos start_date para la hora base
                const baseTimeSource = (formData.recurrence !== 'NINGUNA') ? formData.start_date : (formData.scheduled_at || formData.start_date);
                const originalBase = new Date(baseTimeSource || Date.now());

                const baseHours = originalBase.getHours();
                const baseMinutes = originalBase.getMinutes();

                const originalReminder = formData.reminder_at ? new Date(formData.reminder_at) : null;
                const reminderDiff = (originalReminder && !isNaN(originalReminder.getTime()))
                    ? (originalReminder.getTime() - originalBase.getTime())
                    : null;

                while (current.getTime() <= end.getTime() && count < maxInstances) {
                    const instanceDate = new Date(current);

                    // Ajustar la hora de instancia según la base calculada arriba
                    instanceDate.setHours(baseHours, baseMinutes, 0, 0);

                    // Calcular recordatorio relativo
                    let instanceReminder = null;
                    if (reminderDiff !== null) {
                        instanceReminder = new Date(instanceDate.getTime() + reminderDiff);
                    }

                    tasksToSave.push({
                        ...formData,
                        scheduled_at: instanceDate.toISOString(),
                        reminder_at: instanceReminder ? instanceReminder.toISOString() : null,
                        updatedAt: timestamp,
                        createdAt: timestamp,
                        createdBy: user.username,
                        recurrence: 'NINGUNA'
                    });

                    if (formData.recurrence === 'DIARIA') current.setDate(current.getDate() + 1);
                    else if (formData.recurrence === 'SEMANAL') current.setDate(current.getDate() + 7);
                    else if (formData.recurrence === 'MENSUAL') current.setMonth(current.getMonth() + 1);
                    else break;

                    count++;
                    // Si solo se eligió una fecha (sin end_date real), romper tras la primera
                    if (!formData.end_date) break;
                }
            }

            if (navigator.onLine) {
                // Intento de guardado en servidor (individual o batch via sync)
                if (tasksToSave.length === 1) {
                    const task = tasksToSave[0];
                    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/tasks${isEditing ? `/${formData._id || formData.id}` : ''}`;
                    const response = await fetch(url, {
                        method: isEditing ? 'PATCH' : 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}` },
                        body: JSON.stringify(task)
                    });
                    if (response.ok) {
                        const saved = await response.json();
                        tasksToSave[0]._id = saved._id;
                    }
                } else {
                    // Batch sync para recurrencias
                    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/tasks/sync`;
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}` },
                        body: JSON.stringify({ tasks: tasksToSave })
                    });
                    if (response.ok) {
                        const savedTasks = await response.json();
                        // Actualizar IDs para IndexedDB
                        savedTasks.forEach((s, i) => { if (tasksToSave[i]) tasksToSave[i]._id = s._id; });
                    }
                }
            }

            // Guardar en IndexedDB
            for (const task of tasksToSave) {
                if (isEditing && (task.id || task._id)) {
                    const localId = task.id || (await db.tasks.get({ _id: task._id }))?.id;
                    if (localId) await db.tasks.update(localId, task);
                    else await db.tasks.put(task);
                } else {
                    await db.tasks.put(task);
                }
            }

            // Notificación inmediata si soy el asignado (Solo para tareas individuales)
            if (!isEditing && tasksToSave.length === 1) {
                const task = tasksToSave[0];
                const isAssignedToMe = (task.assigned_technicians || []).some(tech =>
                    tech === user.username || tech === user.name || tech === user.displayName
                );

                // Solo notificar si el usuario desea recibir notificaciones (sendWhatsApp flag)
                if (isAssignedToMe && task.sendWhatsApp !== false) {
                    NotificationService.notify({
                        title: 'Nueva Tarea Creada',
                        message: task.title,
                        type: 'TASK',
                        task: task
                    });
                }
            }

            toast.success(isEditing ? 'Actualizada' : (tasksToSave.length > 1 ? `${tasksToSave.length} Tareas creadas` : 'Creada'));
            setTimeout(finalOnSave, 1000);
        } catch (err) {
            console.error('[TaskForm] Submit error:', err);
            toast.error('Error al guardar');
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-primary animate-in fade-in duration-300">
            <div className="bg-secondary rounded-[24px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-color">
                <header className="px-6 py-5 border-b border-color flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-[17px] font-[900] text-text-primary uppercase tracking-tight">
                            {isEditing ? 'Editar Tarea' : 'Nueva Tarea'}
                        </h2>
                        <p className="text-[10px] font-[800] text-text-muted uppercase tracking-[2px] mt-0.5">Programación Técnica</p>
                    </div>
                    <button onClick={finalOnCancel} className="p-2.5 hover:bg-tertiary rounded-2xl text-text-muted hover:text-primary-500 transition-all active:scale-90 border border-color">
                        <X size={20} />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto no-scrollbar flex-1">
                    {/* Visibility Selector */}
                    <div className="flex items-center justify-between p-4 bg-tertiary rounded-2xl border border-color">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-xl", formData.isPrivate ? "bg-orange-500/10 text-orange-500" : "bg-primary-500/10 text-primary-500")}>
                                {formData.isPrivate ? <Lock size={16} /> : <Globe size={16} />}
                            </div>
                            <span className="text-[12px] font-[800] text-text-primary uppercase tracking-wide">Visibilidad {formData.isPrivate ? 'Privada' : 'Pública'}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, isPrivate: !p.isPrivate }))}
                            className={cn("w-12 h-6 rounded-full p-1 transition-all relative", formData.isPrivate ? "bg-orange-500" : "bg-primary-500")}
                        >
                            <div className={cn("w-4 h-4 bg-tertiary rounded-full transition-all shadow-sm", formData.isPrivate ? "translate-x-6" : "translate-x-0")} />
                        </button>
                    </div>

                    <InputGroup label="Título" name="title" value={formData.title} onChange={handleInputChange} placeholder="Describa la labor..." required disabled={!canEditFull} />

                    <div className="space-y-1.5">
                        <label className="text-[12px] font-[800] text-text-primary block ml-1 uppercase tracking-wide">Descripción</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            disabled={!canEditFull}
                            className="w-full rounded-xl border border-color p-4 text-[13px] bg-tertiary outline-none transition-all focus:border-primary-500 min-h-[100px] font-medium text-text-primary placeholder:text-text-muted/40"
                            placeholder="Detalles adicionales..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <CustomSelect label="Prioridad" value={formData.priority} options={[{ id: 'BAJA', label: 'Baja' }, { id: 'MEDIA', label: 'Media' }, { id: 'ALTA', label: 'Alta' }, { id: 'CRITICA', label: 'Crítica' }]} onChange={val => setFormData(p => ({ ...p, priority: val }))} />
                        <CustomSelect
                            label="Estado"
                            value={formData.status}
                            options={[
                                { id: 'PROGRAMADA', label: 'PROGRAMADA' },
                                { id: 'ASIGNADA', label: 'ASIGNADA' },
                                { id: 'EN_EJECUCION', label: 'EJECUCIÓN' },
                                { id: 'CANCELADA', label: 'CANCELADA' },
                                { id: 'COMPLETADA', label: 'COMPLETADA' },
                                { id: 'VENCIDA', label: 'VENCIDA' }
                            ]}
                            onChange={val => setFormData(p => ({ ...p, status: val }))}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <CustomSelect label="Periodicidad" value={formData.recurrence} options={[{ id: 'NINGUNA', label: 'Ninguna' }, { id: 'DIARIA', label: 'Diaria' }, { id: 'SEMANAL', label: 'Semanal' }, { id: 'MENSUAL', label: 'Mensual' }]} onChange={val => setFormData(p => ({ ...p, recurrence: val }))} />
                        <CustomSelect
                            label="Tipo"
                            value={formData.type}
                            options={[
                                { id: 'CORRECTIVO', label: 'Correctivo' },
                                { id: 'PREVENTIVO', label: 'Preventivo' },
                                { id: 'MEJORA', label: 'Mejora' }
                            ]}
                            onChange={val => setFormData(p => ({ ...p, type: val }))}
                        />
                    </div>

                    {/* Fechas según Periodicidad */}
                    <div className="grid grid-cols-2 gap-4">
                        {formData.recurrence === 'NINGUNA' ? (
                            <div className="space-y-1.5 flex-[2]">
                                <label className="text-[12px] font-[800] text-text-primary block ml-1 uppercase tracking-wide">Fecha Programada</label>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        if (canEditFull) {
                                            setDatePickerType('scheduled');
                                            setDatePickerAnchor(e.currentTarget);
                                        }
                                    }}
                                    className="h-11 w-full bg-tertiary border border-color rounded-xl px-4 flex items-center justify-between text-[13px] hover:border-primary-500 transition-all text-text-primary"
                                >
                                    <span className={cn("font-bold", formData.scheduled_at ? "text-text-primary" : "text-text-muted/60")}>
                                        {formData.scheduled_at ? new Date(formData.scheduled_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short', hour12: true }) : 'Seleccionar...'}
                                    </span>
                                    <CalendarIcon size={14} className="text-text-muted" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-[12px] font-[800] text-text-primary block ml-1 uppercase tracking-wide">Fecha Inicio</label>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            if (canEditFull) {
                                                setDatePickerType('start');
                                                setDatePickerAnchor(e.currentTarget);
                                            }
                                        }}
                                        className="h-11 w-full bg-tertiary border border-color rounded-xl px-4 flex items-center justify-between text-[13px] hover:border-primary-500 transition-all text-text-primary"
                                    >
                                        <span className={cn("font-bold", formData.start_date ? "text-text-primary" : "text-text-muted/60")}>
                                            {formData.start_date ? new Date(formData.start_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short', hour12: true }) : 'Desde...'}
                                        </span>
                                        <CalendarIcon size={14} className="text-text-muted" />
                                    </button>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[12px] font-[800] text-text-primary block ml-1 uppercase tracking-wide">Fecha Fin</label>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            if (canEditFull) {
                                                setDatePickerType('end');
                                                setDatePickerAnchor(e.currentTarget);
                                            }
                                        }}
                                        className="h-11 w-full bg-tertiary border border-color rounded-xl px-4 flex items-center justify-between text-[13px] hover:border-primary-500 transition-all text-text-primary"
                                    >
                                        <span className={cn("font-bold", formData.end_date ? "text-text-primary" : "text-text-muted/60")}>
                                            {formData.end_date ? new Date(formData.end_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short', hour12: true }) : 'Hasta...'}
                                        </span>
                                        <CalendarIcon size={14} className="text-text-muted" />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputGroup label="Ticket GLPI" icon={Hash} name="glpi_ticket_id" value={formData.glpi_ticket_id} onChange={handleInputChange} placeholder="Opcional" />

                        {/* Conditional WhatsApp option */}
                        {formData.recurrence !== 'NINGUNA' && (
                            <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 h-11 self-end">
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={14} className="text-emerald-500" />
                                    <span className="text-[10px] font-[700] text-emerald-500 uppercase tracking-tight">WhatsApp</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData(p => ({ ...p, sendWhatsApp: !p.sendWhatsApp }))}
                                    className={cn(
                                        "w-[38px] h-[20px] rounded-full relative transition-all duration-300",
                                        formData.sendWhatsApp ? "bg-emerald-500" : "bg-tertiary"
                                    )}
                                >
                                    <div className={cn(
                                        "absolute top-[2px] w-[16px] h-[16px] bg-secondary rounded-full transition-all duration-300 shadow-sm",
                                        formData.sendWhatsApp ? "left-[20px]" : "left-[2px]"
                                    )} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Recordatorio (Siempre Visible) */}
                    <div className="space-y-1.5">
                        <label className="text-[12px] font-[800] text-text-primary block ml-1 uppercase tracking-wide">Recordatorio</label>
                        <button
                            type="button"
                            onClick={(e) => {
                                setDatePickerType('reminder');
                                setDatePickerAnchor(e.currentTarget);
                            }}
                            className="h-11 w-full bg-tertiary border border-color rounded-xl px-4 flex items-center justify-between text-[13px] hover:border-primary-500 transition-all text-text-primary"
                        >
                            <div className="flex items-center gap-3">
                                <Bell size={16} className={cn(formData.reminder_at ? "text-orange-500" : "text-text-muted")} />
                                <span className={cn("font-bold", formData.reminder_at ? "text-text-primary" : "text-text-muted/60")}>
                                    {formData.reminder_at ? new Date(formData.reminder_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short', hour12: true }) : 'Configurar alerta automática...'}
                                </span>
                            </div>
                            <ChevronDown size={14} className="text-text-muted" />
                        </button>
                    </div>

                    {/* Technicians Selection */}
                    <div className="space-y-4 pt-4 border-t border-color">
                        <div className="flex items-center justify-between text-[12px] font-[800] text-text-primary uppercase tracking-wide">
                            <label>Técnicos Asignados</label>
                            <span className="bg-primary-500/10 text-primary-500 px-2 py-0.5 rounded-lg text-[10px]">{formData.assigned_technicians.length}</span>
                        </div>
                        <div className="relative" ref={techSearchRef}>
                            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                value={techInput}
                                onChange={handleTechSearch}
                                onFocus={() => canEditFull && setIsTechListOpen(true)}
                                className="w-full h-11 pl-10 bg-tertiary border border-color rounded-xl text-[13px] outline-none focus:border-primary-500 transition-all text-text-primary"
                                placeholder="Escribe para buscar..."
                            />
                            {isTechListOpen && filteredTechs.length > 0 && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-secondary border border-color rounded-2xl shadow-2xl z-50 max-h-48 overflow-y-auto p-1.5 animate-in slide-in-from-top-2">
                                    {filteredTechs.map(t => (
                                        <div
                                            key={t.id}
                                            onClick={() => toggleTechnician(t.fullName)}
                                            className={cn(
                                                "p-3 rounded-xl text-[13px] font-bold cursor-pointer flex justify-between items-center group transition-colors",
                                                formData.assigned_technicians.includes(t.fullName) ? "bg-primary-500/10 text-primary-500" : "hover:bg-tertiary text-text-primary"
                                            )}
                                        >
                                            {t.fullName}
                                            {formData.assigned_technicians.includes(t.fullName) && <Check size={14} />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {formData.assigned_technicians.map(tech => (
                                <span key={tech} className="bg-tertiary text-text-secondary text-[11px] font-[800] px-3 py-1.5 rounded-xl border border-color flex items-center gap-2 group hover:border-primary-500/30 transition-all">
                                    {tech}
                                    <button type="button" onClick={() => toggleTechnician(tech)} className="hover:text-red-500 transition-colors"><X size={12} /></button>
                                </span>
                            ))}
                        </div>
                    </div>
                </form>

                <footer className="px-8 py-6 bg-tertiary border-t border-color flex gap-4">
                    {isEditing && canEditFull && (
                        <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            className="w-12 h-12 flex items-center justify-center shrink-0 bg-secondary border border-red-500/30 text-red-500 rounded-2xl hover:bg-red-500/10 transition-all"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={finalOnCancel}
                        disabled={isSubmitting}
                        className="flex-[1] h-12 bg-secondary border border-color text-text-muted font-bold text-[12px] rounded-2xl uppercase tracking-widest hover:bg-tertiary transition-all disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-[2.5] h-12 bg-primary-500 text-white font-[900] text-[13px] rounded-2xl uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:shadow-primary-500/30 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:active:scale-100"
                    >
                        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (isEditing ? 'Actualizar Tarea' : 'Crear Tarea')}
                    </button>
                </footer>
            </div>

            {/* Date Pickers */}
            {datePickerType && (
                <CustomDatePicker
                    anchorEl={datePickerAnchor}
                    value={
                        datePickerType === 'scheduled' ? formData.scheduled_at :
                            datePickerType === 'start' ? formData.start_date :
                                datePickerType === 'end' ? formData.end_date :
                                    formData.reminder_at
                    }
                    onChange={(val) => {
                        const fieldMap = {
                            scheduled: 'scheduled_at',
                            start: 'start_date',
                            end: 'end_date',
                            reminder: 'reminder_at'
                        };
                        setFormData(p => ({ ...p, [fieldMap[datePickerType]]: val }));
                        setDatePickerType(null);
                        setDatePickerAnchor(null);
                    }}
                    onClose={() => {
                        setDatePickerType(null);
                        setDatePickerAnchor(null);
                    }}
                />
            )}

            {/* toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> -- REMOVED */}

            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[3000] bg-primary flex items-center justify-center p-4">
                    <div className="bg-secondary rounded-[24px] max-w-sm w-full p-6 text-center shadow-2xl border border-color">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                            <Trash2 size={24} />
                        </div>
                        <h3 className="text-[18px] font-[800] text-text-primary mb-2">¿Eliminar Tarea?</h3>
                        <p className="text-[13px] text-text-muted mb-6">Esta acción no se puede deshacer.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-tertiary text-text-muted rounded-xl text-[12px] font-[800] uppercase hover:bg-secondary border border-color transition-colors">Cancelar</button>
                            <button onClick={handleDelete} disabled={isDeleting} className="flex-1 py-3 bg-red-500 text-white rounded-xl text-[12px] font-[800] uppercase flex items-center justify-center gap-2 hover:bg-red-600 transition-colors disabled:opacity-70 focus:outline-none shadow-lg shadow-red-500/20">
                                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : 'Sí, Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

export default TaskForm;
