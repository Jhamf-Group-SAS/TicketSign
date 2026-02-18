import React, { useState, useRef, useEffect } from 'react';
import { db } from '../store/db';
import { SyncService } from '../services/SyncService';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X, Save, User, ClipboardList, ChevronDown, Calendar as CalendarIcon, Hash, MapPin, Bell, Trash2, Search, Check, Lock, Globe } from 'lucide-react';
import Toast from './Toast';
import CustomDatePicker from './CustomDatePicker';
import CustomSelect from './CustomSelect';

const cn = (...inputs) => twMerge(clsx(inputs));

const TaskForm = ({ onCancel, onSave, initialData }) => {
    const isEditing = !!(initialData && initialData.id);
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('glpi_pro_user') || '{}'));

    // Reglas de permisos
    const isAdmin = (user.profile || '').includes('Super-Admin') || (user.profile || '').includes('Admin-Mesa');
    const isSpecialist = ['Especialistas', 'Administrativo', 'Admin'].some(p => (user.profile || '').includes(p));

    // ¿Puede editar campos? (Admin, o es el Creador)
    const isCreator = initialData?.createdBy === user.username;
    // canEditFull: Admin, o (Especialista creando nueva), o Creador
    const canEditFull = isAdmin || (!isEditing && isSpecialist) || isCreator;

    // ¿Puede editar el estado? (Admin, Creador, o Asignado)
    const canEditStatus = isAdmin || isSpecialist || isCreator;

    // ¿Puede eliminar? (Admin o Creador)
    const canDelete = isAdmin || isCreator;

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'CORRECTIVO',
        priority: 'MEDIA',
        status: 'PROGRAMADA',
        scheduled_at: '',
        reminder_at: '',
        reminder_sent: false,
        recurrence: 'NINGUNA',
        start_date: '',
        sendWhatsApp: true,
        assigned_technicians: [],
        glpi_ticket_id: '',
        equipment_service: '',
        isPrivate: false,
        ...initialData
    });

    const [techInput, setTechInput] = useState('');
    const [techs, setTechs] = useState([]);
    const [filteredTechs, setFilteredTechs] = useState([]);
    const [isTechListOpen, setIsTechListOpen] = useState(false);
    const [loadingTechs, setLoadingTechs] = useState(false);

    const [toast, setToast] = useState(null);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isReminderPickerOpen, setIsReminderPickerOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState(null); // 'type' | 'priority' | 'status' | 'recurrence' | null
    const [isDeleting, setIsDeleting] = useState(false);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const datePickerRef = useRef(null);
    const reminderPickerRef = useRef(null);
    const dropdownRef = useRef(null);
    const techSearchRef = useRef(null);

    useEffect(() => {
        const loadTechs = async () => {
            setLoadingTechs(true);
            try {
                const data = await SyncService.getTechnicians();
                setTechs(data);
                setFilteredTechs(data);
            } catch (err) {
                console.error('Error loading technicians:', err);
            } finally {
                setLoadingTechs(false);
            }
        };
        loadTechs();
    }, []);

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
            if (techSearchRef.current && !techSearchRef.current.contains(event.target)) {
                setIsTechListOpen(false);
            }
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
        if (!query.trim()) {
            setFilteredTechs(techs);
        } else {
            const lower = query.toLowerCase();
            setFilteredTechs(techs.filter(t =>
                t.fullName.toLowerCase().includes(lower) ||
                t.name.toLowerCase().includes(lower)
            ));
        }
    };

    const toggleTechnician = (techName) => {
        setFormData(prev => {
            const isAssigned = prev.assigned_technicians.includes(techName);
            const newTechs = isAssigned
                ? prev.assigned_technicians.filter(t => t !== techName)
                : [...prev.assigned_technicians, techName];

            return {
                ...prev,
                assigned_technicians: newTechs,
                status: newTechs.length === 0 ? 'PROGRAMADA' : (prev.status === 'PROGRAMADA' ? 'ASIGNADA' : prev.status)
            };
        });
        setTechInput('');
        setIsTechListOpen(false);
    };

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        if (!formData.title) {
            setToast({ message: 'El título es obligatorio', type: 'error' });
            return;
        }

        try {
            const timestamp = new Date().toISOString();

            // Lógica de Recurrencia (Creación Múltiple)
            if (!isEditing && formData.recurrence && formData.recurrence !== 'NINGUNA') {
                if (!formData.start_date || !formData.scheduled_at) {
                    setToast({ message: 'Debe indicar fecha inicio y fecha límite para la recurrencia', type: 'error' });
                    return;
                }

                const startDate = new Date(formData.start_date);
                const endDate = new Date(formData.scheduled_at);
                endDate.setHours(23, 59, 59, 999); // Incluir el último día completo

                if (startDate > endDate) {
                    setToast({ message: 'La fecha de inicio no puede ser posterior a la fecha límite', type: 'error' });
                    return;
                }

                const taskDates = [];
                let currentDate = new Date(startDate);

                // Evitar bucles infinitos o demasiadas tareas (límite seguridad 365)
                let safetyCounter = 0;
                while (currentDate <= endDate && safetyCounter < 366) {
                    taskDates.push(new Date(currentDate));

                    if (formData.recurrence === 'DIARIA') {
                        currentDate.setDate(currentDate.getDate() + 1);
                    } else if (formData.recurrence === 'SEMANAL') {
                        currentDate.setDate(currentDate.getDate() + 7);
                    } else if (formData.recurrence === 'MENSUAL') {
                        currentDate.setMonth(currentDate.getMonth() + 1);
                    }
                    safetyCounter++;
                }

                if (taskDates.length === 0) {
                    setToast({ message: 'El rango de fechas no generó ninguna tarea', type: 'error' });
                    return;
                }

                let createdCount = 0;
                const creationPromises = taskDates.map(async (date) => {
                    // Calcular fecha de recordatorio ajustada a esta instancia
                    let instanceReminder = '';
                    if (formData.reminder_at) {
                        const originalReminder = new Date(formData.reminder_at);
                        const newReminder = new Date(date);
                        newReminder.setHours(
                            originalReminder.getHours(),
                            originalReminder.getMinutes(),
                            originalReminder.getSeconds()
                        );
                        instanceReminder = newReminder.toISOString();
                    }

                    const taskData = {
                        ...formData,
                        scheduled_at: date.toISOString(),
                        reminder_at: instanceReminder, // Fecha ajustada
                        createdAt: timestamp,
                        createdBy: user.username,
                        updatedAt: timestamp,
                        recurrence: formData.recurrence, // Marca como recurrente
                        sendWhatsApp: formData.sendWhatsApp, // Flag para backend
                        // Opcional: podrías agregar un groupId para relacionarlas futuro
                    };
                    delete taskData.start_date; // No se guarda en DB como campo

                    // 1. Crear localmente
                    const newLocalId = await db.tasks.add(taskData);
                    createdCount++;

                    // 2. Sync server si online
                    if (navigator.onLine) {
                        try {
                            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/tasks`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                                },
                                body: JSON.stringify(taskData)
                            });
                            if (response.ok) {
                                const newTask = await response.json();
                                if (newTask._id) {
                                    await db.tasks.update(newLocalId, { _id: newTask._id });
                                }
                            }
                        } catch (err) { console.warn('Sync error for task instance', err); }
                    }
                });

                await Promise.all(creationPromises);
                setToast({ message: `${createdCount} tareas periódicas creadas correctamente`, type: 'success' });

            } else {
                // Lógica Original (Tarea Única o Edición)
                const finalData = {
                    ...formData,
                    updatedAt: timestamp
                };
                delete finalData.start_date; // Limpieza

                if (!isEditing) {
                    finalData.createdAt = timestamp;
                    finalData.createdBy = user.username;
                    // Si es creación simple sin recurrencia, scheduled_at es la fecha única
                }

                if (isEditing) {
                    await db.tasks.update(formData.id, finalData);
                    if (navigator.onLine) {
                        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/tasks/${formData._id || formData.id}`, {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                            },
                            body: JSON.stringify(finalData)
                        });
                    }
                    setToast({ message: 'Tarea actualizada correctamente', type: 'success' });
                } else {
                    // Creación Simple (Sin Recurrencia)
                    const newLocalId = await db.tasks.add(finalData);

                    if (navigator.onLine) {
                        try {
                            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/tasks`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                                },
                                body: JSON.stringify(finalData)
                            });

                            if (response.ok) {
                                const newTask = await response.json();
                                if (newTask._id) {
                                    await db.tasks.update(newLocalId, { _id: newTask._id });
                                }
                            }
                        } catch (serverErr) {
                            console.warn('Creada localmente, pendiente de sync con servidor:', serverErr);
                        }
                    }
                    setToast({ message: 'Tarea creada correctamente', type: 'success' });
                }
            }

            setTimeout(onSave, 1500);
        } catch (error) {
            console.error('Error al guardar tarea:', error);
            setToast({ message: 'Error al guardar la tarea', type: 'error' });
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2rem] md:rounded-3xl border border-slate-200 dark:border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[92vh] md:max-h-[82vh]">
                <header className="p-5 md:p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 shrink-0">
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                            {isEditing ? 'Editar Tarea' : 'Nueva Tarea'}
                        </h2>
                        <p className="text-[9px] md:text-[10px] font-medium text-slate-500 uppercase tracking-wider">Programación de servicios TI</p>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all active:scale-95 text-slate-500">
                        <X size={20} />
                    </button>
                </header>

                <form id="task-form" onSubmit={handleSubmit} className="p-5 md:p-6 space-y-6 overflow-y-auto no-scrollbar flex-1">
                    <div className="space-y-6">
                        {/* Status selector (Solo en edición o siempre visible) */}
                        {isEditing && (
                            <div className="pb-4 border-b border-slate-100 dark:border-white/5">
                                <CustomSelect
                                    label="Estado del Flujo"
                                    value={formData.status}
                                    options={['PROGRAMADA', 'ASIGNADA', 'EN_EJECUCION', 'CANCELADA', 'COMPLETADA'].map(opt => ({ id: opt, label: opt }))}
                                    onChange={(val) => setFormData(p => ({ ...p, status: val }))}
                                    disabled={!canEditStatus}
                                />
                            </div>
                        )}
                        {/* Visibilidad (Pública / Privada) */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/10">
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-1">Visibilidad</label>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    {formData.isPrivate ? 'Privada (Solo yo)' : 'Pública (Administradores y Asignados)'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, isPrivate: !prev.isPrivate }))}
                                disabled={!canEditFull}
                                className={cn(
                                    "relative w-32 h-10 rounded-xl p-1 transition-all flex items-center",
                                    formData.isPrivate ? "bg-amber-500/10 border-amber-500/30" : "bg-blue-500/10 border-blue-500/30",
                                    "border"
                                )}
                            >
                                <div className={cn(
                                    "absolute inset-y-1 w-1/2 rounded-lg transition-all flex items-center justify-center shadow-lg",
                                    formData.isPrivate ? "right-1 bg-amber-500 text-white" : "left-1 bg-blue-500 text-white"
                                )}>
                                    {formData.isPrivate ? <Lock size={14} className="mr-1" /> : <Globe size={14} className="mr-1" />}
                                    <span className="text-[10px] font-black uppercase">{formData.isPrivate ? 'Privada' : 'Pública'}</span>
                                </div>
                                <div className={cn("w-1/2 text-center text-[10px] font-black uppercase", !formData.isPrivate ? "" : "hidden")}>Pública</div>
                                <div className={cn("w-1/2 text-center text-[10px] font-black uppercase ml-auto", formData.isPrivate ? "" : "hidden")}>Privada</div>
                            </button>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Título de la Tarea</label>
                            <input
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                disabled={!canEditFull}
                                className={cn(
                                    "w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm outline-none transition-all font-bold placeholder:font-normal",
                                    canEditFull ? "focus:ring-2 focus:ring-blue-500/20" : "opacity-60 cursor-not-allowed"
                                )}
                                placeholder="Ej: Mantenimiento Preventivo Servidores"
                            />
                        </div>

                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Descripción</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                disabled={!canEditFull}
                                className={cn(
                                    "w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm outline-none transition-all h-24 resize-none",
                                    canEditFull ? "focus:ring-2 focus:ring-blue-500/20" : "opacity-60 cursor-not-allowed font-bold"
                                )}
                                placeholder="Detalles de la labor a realizar..."
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <CustomSelect
                                label="Tipo"
                                value={formData.type}
                                options={['PREVENTIVO', 'CORRECTIVO'].map(opt => ({ id: opt, label: opt }))}
                                onChange={(val) => setFormData(p => ({ ...p, type: val }))}
                                disabled={!canEditFull}
                            />
                            <CustomSelect
                                label="Prioridad"
                                value={formData.priority}
                                options={['BAJA', 'MEDIA', 'ALTA'].map(opt => ({ id: opt, label: opt }))}
                                onChange={(val) => setFormData(p => ({ ...p, priority: val }))}
                                disabled={!canEditFull}
                            />
                        </div>

                        {/* Recurrencia */}
                        <div>
                            <CustomSelect
                                label="Periodicidad"
                                value={formData.recurrence || 'NINGUNA'}
                                options={['NINGUNA', 'DIARIA', 'SEMANAL', 'MENSUAL'].map(opt => ({ id: opt, label: opt }))}
                                onChange={(val) => setFormData(p => ({ ...p, recurrence: val }))}
                                disabled={!canEditFull}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Ticket GLPI (Opcional)</label>
                                <div className="relative">
                                    <Hash size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        name="glpi_ticket_id"
                                        value={formData.glpi_ticket_id}
                                        onChange={handleInputChange}
                                        disabled={!canEditFull}
                                        className={cn(
                                            "w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-4 pl-10 text-sm outline-none transition-all font-bold",
                                            canEditFull ? "focus:ring-2 focus:ring-blue-500/20" : "opacity-60 cursor-not-allowed"
                                        )}
                                        placeholder="ID Ticket"
                                    />
                                </div>
                            </div>

                            {/* Lógica de Fechas según Recurrencia */}
                            {formData.recurrence !== 'NINGUNA' ? (
                                <>
                                    <div className="relative">
                                        <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Desde (Inicio)</label>
                                        <div
                                            onClick={() => canEditFull && setOpenDropdown('start_date_picker')}
                                            className={cn(
                                                "w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-4 pl-10 text-xs outline-none transition-all font-bold relative",
                                                canEditFull ? "cursor-pointer focus:ring-2 focus:ring-blue-500/20" : "opacity-60 cursor-not-allowed"
                                            )}
                                        >
                                            <CalendarIcon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            {formData.start_date ? new Date(formData.start_date).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Seleccionar...'}
                                        </div>
                                        {openDropdown === 'start_date_picker' && (
                                            <div className="absolute top-full left-0 z-50 mt-2 w-full">
                                                <CustomDatePicker
                                                    value={formData.start_date}
                                                    onChange={(date) => { setFormData(prev => ({ ...prev, start_date: date })); setOpenDropdown(null); }}
                                                    onClose={() => setOpenDropdown(null)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="relative" ref={datePickerRef}>
                                        <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Hasta (Límite)</label>
                                        <div
                                            onClick={() => canEditFull && setIsDatePickerOpen(!isDatePickerOpen)}
                                            className={cn(
                                                "w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-4 pl-10 text-xs outline-none transition-all font-bold relative",
                                                canEditFull ? "cursor-pointer focus:ring-2 focus:ring-blue-500/20" : "opacity-60 cursor-not-allowed"
                                            )}
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
                                </>
                            ) : (
                                <div className="relative" ref={datePickerRef}>
                                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Fecha Programada</label>
                                    <div
                                        onClick={() => canEditFull && setIsDatePickerOpen(!isDatePickerOpen)}
                                        className={cn(
                                            "w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-4 pl-10 text-xs outline-none transition-all font-bold relative",
                                            canEditFull ? "cursor-pointer focus:ring-2 focus:ring-blue-500/20" : "opacity-60 cursor-not-allowed"
                                        )}
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
                            )}
                        </div>

                        {/* Control de Notificaciones WhatsApp para Recurrencia */}
                        {formData.recurrence !== 'NINGUNA' && (
                            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-200 dark:border-green-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400">
                                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-green-700 dark:text-green-400">Notificar por WhatsApp</label>
                                        <p className="text-[10px] text-slate-500 font-medium">Enviar mensaje a técnicos por cada tarea generada</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, sendWhatsApp: !prev.sendWhatsApp }))}
                                    className={cn(
                                        "w-10 h-6 rounded-full p-1 transition-all duration-300",
                                        formData.sendWhatsApp ? "bg-green-500" : "bg-slate-200 dark:bg-slate-700"
                                    )}
                                >
                                    <div className={cn(
                                        "w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm",
                                        formData.sendWhatsApp ? "translate-x-4" : "translate-x-0"
                                    )} />
                                </button>
                            </div>
                        )}



                        <div className="p-4 bg-blue-500/5 dark:bg-blue-500/10 rounded-2xl border border-blue-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Bell size={16} className="text-blue-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Recordatorio Personalizado</span>
                                </div>
                                <button
                                    type="button"
                                    disabled={!canEditFull}
                                    onClick={() => setFormData(prev => ({ ...prev, reminder_at: prev.reminder_at ? '' : new Date().toISOString() }))}
                                    className={cn(
                                        "w-10 h-6 rounded-full p-1 transition-all duration-300",
                                        formData.reminder_at ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-800",
                                        !canEditFull && "opacity-40 cursor-not-allowed"
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
                                            onClick={() => canEditFull && setIsReminderPickerOpen(!isReminderPickerOpen)}
                                            className={cn(
                                                "w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl p-3 pl-10 text-[11px] outline-none transition-all font-bold relative",
                                                canEditFull ? "cursor-pointer focus:ring-2 focus:ring-blue-500/20" : "opacity-60 cursor-not-allowed"
                                            )}
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
                                    <p className="text-[9px] text-slate-500 font-bold italic">* Recibirás una alerta en el aplicativo a esta hora.</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Técnicos Asignados</label>
                            <div className="relative" ref={techSearchRef}>
                                <div className="relative flex items-center mb-3">
                                    <Search size={16} className="absolute left-4 text-slate-400" />
                                    <input
                                        value={techInput}
                                        onChange={handleTechSearch}
                                        onFocus={() => canEditFull && setIsTechListOpen(true)}
                                        disabled={!canEditFull}
                                        className={cn(
                                            "flex-1 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-4 pl-11 text-sm outline-none transition-all font-bold placeholder:font-normal",
                                            canEditFull ? "focus:ring-2 focus:ring-blue-500/20" : "opacity-60 cursor-not-allowed"
                                        )}
                                        placeholder="Buscar técnico de GLPI..."
                                    />
                                    {loadingTechs && <div className="absolute right-4 w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>}
                                </div>

                                {isTechListOpen && canEditFull && (
                                    <div className="absolute top-full left-0 w-full z-[70] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 max-h-60 overflow-y-auto mt-2 animate-in slide-in-from-top-2 no-scrollbar custom-scrollbar shadow-blue-500/5">
                                        {filteredTechs.length === 0 ? (
                                            <div className="p-4 text-center text-slate-500 text-xs font-bold">No se encontraron técnicos</div>
                                        ) : (
                                            filteredTechs.map(t => (
                                                <div
                                                    key={t.id}
                                                    onClick={() => toggleTechnician(t.fullName)}
                                                    className={cn(
                                                        "px-4 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all mb-1 last:mb-0 flex justify-between items-center group",
                                                        formData.assigned_technicians.includes(t.fullName)
                                                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40"
                                                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                                                    )}
                                                >
                                                    <div className="flex flex-col">
                                                        <span>{t.fullName}</span>
                                                    </div>
                                                    {formData.assigned_technicians.includes(t.fullName) && <Check size={16} />}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2 min-h-4">
                                {formData.assigned_technicians.map(tech => (
                                    <span key={tech} className="bg-blue-500/10 text-blue-500 text-[9px] font-black px-3 py-2 rounded-lg border border-blue-500/20 flex items-center gap-2 animate-in zoom-in-95 duration-200">
                                        {tech}
                                        {canEditFull && (
                                            <button type="button" onClick={() => toggleTechnician(tech)} className="hover:text-red-500 transition-colors">
                                                <X size={12} />
                                            </button>
                                        )}
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
                                    disabled={!canEditFull}
                                    className={cn(
                                        "w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-4 pl-10 text-sm outline-none transition-all font-bold",
                                        canEditFull ? "focus:ring-2 focus:ring-blue-500/20" : "opacity-60 cursor-not-allowed"
                                    )}
                                    placeholder="Ej: Rack comunicaciones piso 2"
                                />
                            </div>
                        </div>
                    </div>
                </form>

                <footer className="p-5 md:p-6 bg-slate-50 dark:bg-slate-950/30 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row gap-3">
                    <div className="flex gap-3 flex-1">
                        {isEditing && canDelete && (
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
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
                    </div>
                    {(isEditing ? canEditStatus : canEditStatus) && (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="flex-[2] flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                        >
                            <Save size={18} />
                            {isEditing ? 'Actualizar' : 'Crear Tarea'}
                        </button>
                    )}
                </footer>
            </div>

            {/* Modal de confirmación de eliminación con estilo Premium */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4 mx-auto">
                            <Trash2 size={24} />
                        </div>
                        <h3 className="text-lg font-black text-center text-slate-900 dark:text-white mb-2">¿Eliminar Tarea?</h3>
                        <p className="text-center text-slate-500 text-sm mb-6 font-medium">
                            Esta acción no se puede deshacer. La tarea será eliminada permanentemente.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 font-bold uppercase text-[10px] tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    setIsDeleting(true);
                                    try {
                                        await db.tasks.delete(formData.id);
                                        // Si estamos online, borrar del servidor
                                        if (navigator.onLine) {
                                            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/tasks/${formData._id || formData.id}`, {
                                                method: 'DELETE',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                                                }
                                            });
                                        }
                                        setToast({ message: 'Tarea eliminada', type: 'success' });
                                        setTimeout(onSave, 500); // Dar tiempo al toast
                                    } catch (error) {
                                        console.error(error);
                                        setIsDeleting(false);
                                        setToast({ message: 'Error eliminando', type: 'error' });
                                    }
                                }}
                                disabled={isDeleting}
                                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold uppercase text-[10px] tracking-widest hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all active:scale-95 flex justify-center items-center"
                            >
                                {isDeleting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default TaskForm;
