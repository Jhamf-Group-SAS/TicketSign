import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import TaskForm from './TaskForm';
import {
    Clock,
    CheckCircle2,
    AlertCircle,
    Hammer,
    PauseCircle,
    Plus,
    Filter,
    ArrowLeft,
    Search,
    X,
    Calendar as CalendarIcon,
    Link as LinkIcon,
    FileCheck,
    ChevronDown,
    Bell
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const KANBAN_STATUS = [
    { id: 'PROGRAMADA', label: 'Programada', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30' },
    { id: 'ASIGNADA', label: 'Asignada', icon: CalendarIcon, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/30' },
    { id: 'EN_EJECUCION', label: 'En Ejecución', icon: Hammer, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/30' },
    { id: 'CANCELADA', label: 'Cancelada', icon: PauseCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30' },
    { id: 'COMPLETADA', label: 'Completada', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/30' }
];

const TaskBoard = ({ onBack }) => {
    const tasks = useLiveQuery(() => db.tasks.toArray()) || [];
    const [user] = useState(JSON.parse(localStorage.getItem('glpi_pro_user') || '{}'));

    // Reglas de permisos
    const isAdmin = (user.profile || '').includes('Super-Admin') || (user.profile || '').includes('Admin-Mesa');
    const isSpecialist = (user.profile || '').includes('Especialistas');
    const canCreate = isAdmin || isSpecialist;
    const canMove = isAdmin || isSpecialist;

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [viewDate, setViewDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [statusFilters, setStatusFilters] = useState([]);
    const scrollContainerRef = useRef(null);
    const todayRef = useRef(null);

    const scrollToToday = () => {
        setTimeout(() => {
            if (todayRef.current && scrollContainerRef.current) {
                todayRef.current.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'center'
                });
            }
        }, 100);
    };

    const handleGoToToday = () => {
        const now = new Date();
        setViewDate(now);
        scrollToToday();
    };

    const filteredTasks = tasks.filter(task => {
        // Filtrar por pertenencia si no es admin
        if (!isAdmin) {
            const myNames = [
                (user.name || '').toLowerCase(),
                (user.displayName || '').toLowerCase(),
                (user.username || '').toLowerCase()
            ].filter(Boolean);

            const isCreator = myNames.includes((task.createdBy || '').toLowerCase());

            const isAssigned = (task.assigned_technicians || []).some(tech =>
                myNames.some(name => (tech || '').toLowerCase().includes(name) || name.includes((tech || '').toLowerCase()))
            );

            if (!isCreator && !isAssigned) return false;
        }

        const matchesSearch = !searchTerm ||
            task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.glpi_ticket_id?.toString().includes(searchTerm);
        const matchesStatus = statusFilters.length === 0 || statusFilters.includes(task.status);
        return matchesSearch && matchesStatus;
    });

    const toggleStatusFilter = (status) => {
        setStatusFilters(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilters([]);
    };

    useEffect(() => {
        const hasActiveFilters = searchTerm || statusFilters.length > 0;
        if (hasActiveFilters && filteredTasks.length > 0) {
            const sortedResults = [...filteredTasks].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
            const firstResult = sortedResults[0];
            if (firstResult.scheduled_at) {
                const resultDate = new Date(firstResult.scheduled_at);
                const isSameMonth = resultDate.getMonth() === viewDate.getMonth() && resultDate.getFullYear() === viewDate.getFullYear();
                if (!isSameMonth) {
                    const hasResultsInView = filteredTasks.some(t => {
                        if (!t.scheduled_at) return false;
                        const d = new Date(t.scheduled_at);
                        return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
                    });
                    if (!hasResultsInView) {
                        setViewDate(new Date(resultDate.getFullYear(), resultDate.getMonth(), 1));
                    }
                }
            }
        }
    }, [searchTerm, statusFilters]);

    const handleEditTask = (task) => {
        setEditingTask(task);
        setIsFormOpen(true);
    };

    const handleCreateOnDay = (date) => {
        if (!canCreate) return;
        const newDate = new Date(date);
        const now = new Date();
        if (newDate.toDateString() === now.toDateString()) {
            newDate.setHours(now.getHours(), now.getMinutes());
        } else {
            newDate.setHours(9, 0);
        }
        setEditingTask({
            scheduled_at: newDate.toISOString(),
            status: 'PROGRAMADA',
            priority: 'MEDIA',
            type: 'CORRECTIVO'
        });
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingTask(null);
    };

    const handleStatusDrop = async (e, newStatus) => {
        e.preventDefault();
        if (!canMove) return;
        const taskId = e.dataTransfer.getData("taskId");
        if (!taskId) return;

        await db.tasks.update(Number(taskId), {
            status: newStatus,
            updatedAt: new Date().toISOString()
        });

        if (navigator.onLine) {
            try {
                await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/tasks/${taskId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                    },
                    body: JSON.stringify({ status: newStatus, updatedAt: new Date().toISOString() })
                });
            } catch (err) { console.warn(err); }
        }
    };

    const CustomDatePicker = ({ selectedDate, onChange }) => {
        const [pickerDate, setPickerDate] = useState(selectedDate || new Date());
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const year = pickerDate.getFullYear();
        const month = pickerDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const pickerDays = [];
        for (let i = 0; i < firstDay; i++) pickerDays.push(null);
        for (let i = 1; i <= daysInMonth; i++) pickerDays.push(new Date(year, month, i));

        return (
            <div className="bg-slate-50/50 dark:bg-white/5 rounded-2xl p-3 border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between mb-3">
                    <button onClick={(e) => { e.stopPropagation(); setPickerDate(new Date(year, month - 1, 1)); }} className="p-1 hover:bg-white dark:hover:bg-white/10 rounded-lg text-slate-500"><ArrowLeft size={14} /></button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">{months[month]} {year}</span>
                    <button onClick={(e) => { e.stopPropagation(); setPickerDate(new Date(year, month + 1, 1)); }} className="p-1 hover:bg-white dark:hover:bg-white/10 rounded-lg text-slate-500"><ArrowLeft size={14} className="rotate-180" /></button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days.map(d => <div key={d} className="text-center text-[7px] font-black uppercase text-slate-400 py-0.5">{d}</div>)}
                    {pickerDays.map((date, i) => {
                        if (!date) return <div key={`empty-${i}`} className="h-7" />;
                        const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                        const isToday = date.toDateString() === new Date().toDateString();
                        return (
                            <button key={i} onClick={() => onChange(date)} className={cn("h-7 rounded-lg text-[9px] font-bold transition-all flex items-center justify-center border", isSelected ? "bg-blue-600 border-blue-500 text-white" : isToday ? "border-blue-500/30 text-blue-500 bg-blue-500/5" : "border-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-white/5")}>{date.getDate()}</button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const StatusSummary = () => (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {KANBAN_STATUS.map(status => {
                const count = filteredTasks.filter(t => t.status === status.id).length;
                const isActive = statusFilters.includes(status.id);
                return (
                    <div key={status.id} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleStatusDrop(e, status.id)} onClick={() => toggleStatusFilter(status.id)} className={cn("p-4 rounded-3xl border transition-all flex flex-col gap-1 cursor-pointer hover:scale-[1.02] active:scale-95", status.bg, isActive ? "border-blue-500 ring-2 ring-blue-500/20" : status.border)}>
                        <div className="flex items-center justify-between"><status.icon size={18} className={status.color} /><span className="text-xl font-black text-slate-900 dark:text-white">{count}</span></div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 opacity-70">{status.label}</span>
                    </div>
                );
            })}
        </div>
    );

    const CalendarView = () => {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const startDay = firstDay === 0 ? 6 : firstDay - 1;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const calendarDays = [];
        for (let i = 0; i < startDay; i++) calendarDays.push(null);
        for (let i = 1; i <= daysInMonth; i++) calendarDays.push(new Date(year, month, i));

        const CalendarDropdown = ({ value, options, onChange, type }) => {
            const [isDropdownOpen, setIsDropdownOpen] = useState(false);
            const dropdownRef = useRef(null);
            useEffect(() => {
                const handleClickOutside = (event) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDropdownOpen(false); };
                document.addEventListener('mousedown', handleClickOutside);
                return () => document.removeEventListener('mousedown', handleClickOutside);
            }, []);
            return (
                <div className="relative" ref={dropdownRef}>
                    <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5 shadow-sm">{type === 'month' ? months[value] : value}<ChevronDown size={14} className={cn("transition-transform", isDropdownOpen && "rotate-180")} /></button>
                    {isDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 z-[100] max-h-64 overflow-y-auto no-scrollbar">
                            {options.map((opt, i) => (
                                <button key={i} onClick={() => { onChange(type === 'month' ? i : opt); setIsDropdownOpen(false); }} className={cn("w-full text-left px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all mb-1", (type === 'month' ? value === i : value === opt) ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5")}>{type === 'month' ? opt : opt}</button>
                            ))}
                        </div>
                    )}
                </div>
            );
        };

        return (
            <div className="flex-1 flex flex-col min-h-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-2xl">
                <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between bg-white/50 dark:bg-slate-900/50 gap-4">
                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-center sm:justify-start">
                        <CalendarDropdown type="month" value={month} options={months} onChange={(newMonth) => setViewDate(new Date(year, newMonth, 1))} />
                        <CalendarDropdown type="year" value={year} options={Array.from({ length: 31 }, (_, i) => year - 15 + i)} onChange={(newYear) => setViewDate(new Date(newYear, month, 1))} />
                    </div>
                    <div className="flex gap-2 items-center w-full sm:w-auto justify-center sm:justify-end">
                        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-2 sm:p-3 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-500 transition-colors"><ArrowLeft size={18} /></button>
                        <button onClick={handleGoToToday} className="px-4 sm:px-6 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-all border border-slate-200 dark:border-white/5 shadow-sm">Hoy</button>
                        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-2 sm:p-3 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-500 transition-colors"><ArrowLeft size={18} className="rotate-180" /></button>
                    </div>
                </div>
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-x-auto overflow-y-auto p-2 sm:p-4 no-scrollbar"
                >
                    <div className="min-w-[700px] sm:min-w-0 grid grid-cols-7 gap-px bg-slate-200 dark:bg-white/5 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/5">
                        {days.map(d => <div key={d} className="bg-slate-50 dark:bg-slate-900/80 p-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{d}</div>)}
                        {calendarDays.map((date, i) => {
                            if (!date) return <div key={`empty-${i}`} className="bg-slate-50/30 dark:bg-slate-950/20 h-[100px] sm:h-[120px] border-[0.5px] border-slate-100 dark:border-white/5" />;
                            const dayTasks = filteredTasks.filter(t => {
                                if (!t.scheduled_at) return false;
                                const d = new Date(t.scheduled_at);
                                return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
                            });
                            const isToday = new Date().toDateString() === date.toDateString();
                            return (
                                <div
                                    key={i}
                                    ref={isToday ? todayRef : null}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => { e.preventDefault(); if (!canMove) return; const taskId = e.dataTransfer.getData("taskId"); if (taskId) { db.tasks.get(Number(taskId)).then(task => { if (task) { const originalDate = new Date(task.scheduled_at); const nDate = new Date(date); nDate.setHours(originalDate.getHours(), originalDate.getMinutes()); db.tasks.update(Number(taskId), { scheduled_at: nDate.toISOString(), updatedAt: new Date().toISOString() }); } }); } }}
                                    onClick={() => handleCreateOnDay(date)}
                                    className={cn("bg-white dark:bg-slate-900/80 h-[100px] sm:h-[120px] p-1.5 transition-all hover:bg-slate-50 dark:hover:bg-white/5 border-[0.5px] border-slate-100 dark:border-white/5 cursor-cell group flex flex-col", isToday && "ring-1 ring-inset ring-blue-500/30 bg-blue-500/5")}
                                >
                                    <div className="flex justify-between items-center mb-1 px-1 shrink-0"><span className={cn("text-[11px] font-black", isToday ? "text-blue-500" : "text-slate-400")}>{date.getDate()}</span><Plus size={10} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                                    <div className="space-y-1 flex-1 overflow-y-auto no-scrollbar">
                                        {dayTasks.map(task => {
                                            const statusInfo = KANBAN_STATUS.find(s => s.id === task.status);
                                            return (
                                                <div key={task.id} draggable={canMove} onDragStart={(e) => e.dataTransfer.setData("taskId", task.id)} onClick={(e) => { e.stopPropagation(); handleEditTask(task); }} className={cn("relative h-[24px] flex items-center px-2 rounded-md border text-[10px] font-bold cursor-pointer transition-all active:scale-[0.97] hover:shadow-sm overflow-hidden", statusInfo?.bg || 'bg-slate-50 dark:bg-white/5', statusInfo?.border || 'border-slate-200 dark:border-white/10')}>
                                                    <span className="truncate text-slate-900 dark:text-white flex-1">{task.title}</span>
                                                    {task.reminder_at && <Bell size={10} className={cn("shrink-0 ml-1", task.reminder_sent ? "text-slate-400" : "text-blue-500")} />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full w-full flex flex-col p-2 sm:p-4 lg:p-6 space-y-4">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm gap-4">
                <div className="flex items-center gap-4 sm:gap-10">
                    <button onClick={onBack} className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-500"><ArrowLeft size={20} /></button>
                    <div><h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">Calendario</h2><p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Gestión de servicios TI</p></div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 justify-end max-w-2xl">
                    <div className="relative group/search flex-1 hidden md:block">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar tareas..." className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl py-2.5 pl-11 pr-10 text-sm outline-none transition-all" />
                        {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400"><X size={12} /></button>}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                        <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={cn("p-3 rounded-xl transition-all border", (statusFilters.length > 0 || searchTerm) ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-white/5 text-slate-500")}><Filter size={20} /></button>
                        {canCreate && (
                            <button onClick={() => setIsFormOpen(true)} className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl flex-1 sm:flex-none"><Plus size={18} /><span>Nueva Tarea</span></button>
                        )}
                    </div>
                </div>
            </header>

            <StatusSummary />
            <CalendarView />

            {isFilterOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Filtros</h4>
                            <button onClick={() => setIsFilterOpen(false)} className="text-slate-400"><X size={18} /></button>
                        </div>
                        <div className="mb-4">
                            <CustomDatePicker selectedDate={viewDate} onChange={(date) => { setViewDate(new Date(date.getFullYear(), date.getMonth(), 1)); setIsFilterOpen(false); }} />
                        </div>
                        <div className="space-y-4">
                            <div className="md:hidden">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Búsqueda rápida</label>
                                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Estados</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {KANBAN_STATUS.map(s => (
                                        <button key={s.id} onClick={() => toggleStatusFilter(s.id)} className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl text-[9px] font-bold uppercase transition-all border text-left", statusFilters.includes(s.id) ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500")}>
                                            <s.icon size={12} className={statusFilters.includes(s.id) ? "text-white" : s.color} />
                                            <span className="truncate">{s.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={() => { clearFilters(); setViewDate(new Date()); setIsFilterOpen(false); }} className="w-full bg-red-500 text-white py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em]">Restablecer</button>
                        </div>
                    </div>
                </div>
            )}

            {isFormOpen && <TaskForm onCancel={handleCloseForm} onSave={handleCloseForm} initialData={editingTask} />}
        </div>
    );
};

export default TaskBoard;
