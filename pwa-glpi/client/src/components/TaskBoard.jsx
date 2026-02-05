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

// Helper para combinar clases de Tailwind
function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const KANBAN_STATUS = [
    { id: 'PROGRAMADA', label: 'Programada', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30' },
    { id: 'ASIGNADA', label: 'Asignada', icon: CalendarIcon, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/30' },
    { id: 'EN_EJECUCION', label: 'En Ejecución', icon: Hammer, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/30' },
    { id: 'CANCELADA', label: 'Cancelada', icon: PauseCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30' },
    { id: 'COMPLETADA', label: 'Completada', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/30' }
];

const TaskCard = ({ task, onDragStart, onClick }) => {
    const isOverdue = task.scheduled_at && new Date(task.scheduled_at) < new Date() && task.status !== 'COMPLETADA';

    return (
        <div
            draggable={task.status !== 'COMPLETADA'}
            onDragStart={(e) => onDragStart(e, task.id)}
            onClick={() => onClick(task)}
            className={cn(
                "bg-white dark:bg-slate-900/60 backdrop-blur-sm p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] hover:shadow-xl hover:border-blue-500/30 group",
                isOverdue ? "border-red-500/30" : "border-slate-200 dark:border-white/5"
            )}
        >
            <div className="flex justify-between items-start mb-2">
                <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                    task.priority === 'ALTA' ? "bg-red-500/10 text-red-500" :
                        task.priority === 'MEDIA' ? "bg-orange-500/10 text-orange-500" :
                            "bg-blue-500/10 text-blue-500"
                )}>
                    {task.priority}
                </span>
                <div className="flex gap-1">
                    {task.glpi_ticket_id && <LinkIcon size={14} className="text-blue-400" />}
                    {task.acta_id && <FileCheck size={14} className="text-green-500" />}
                </div>
            </div>

            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1 group-hover:text-blue-500 transition-colors">
                {task.title}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                {task.description}
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <Clock size={12} className={cn(isOverdue && "text-red-500")} />
                    <span className={cn(isOverdue && "text-red-500 font-bold")}>
                        {task.scheduled_at ? new Date(task.scheduled_at).toLocaleDateString() : 'Pendiente'}
                    </span>
                </div>
                <div className="flex -space-x-2">
                    {task.assigned_technicians?.map((tech, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-bold">
                            {tech.charAt(0).toUpperCase()}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const TaskBoard = ({ onBack }) => {
    const tasks = useLiveQuery(() => db.tasks.toArray()) || [];
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [viewDate, setViewDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [statusFilters, setStatusFilters] = useState([]);

    // Lógica de filtrado combinada
    const filteredTasks = tasks.filter(task => {
        const matchesSearch = !searchTerm ||
            task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.glpi_ticket_id?.toString().includes(searchTerm);

        const matchesStatus = statusFilters.length === 0 || statusFilters.includes(task.status);

        return matchesSearch && matchesStatus;
    });

    const toggleStatusFilter = (status) => {
        setStatusFilters(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilters([]);
    };

    // Salto automático al visualizar resultados fuera del mes actual al filtrar o buscar
    useEffect(() => {
        const hasActiveFilters = searchTerm || statusFilters.length > 0;
        if (hasActiveFilters && filteredTasks.length > 0) {
            const sortedResults = [...filteredTasks].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
            const firstResult = sortedResults[0];

            if (firstResult.scheduled_at) {
                const resultDate = new Date(firstResult.scheduled_at);
                const isSameMonth = resultDate.getMonth() === viewDate.getMonth() &&
                    resultDate.getFullYear() === viewDate.getFullYear();

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
        const newDate = new Date(date);
        // Ajustar a la hora actual si es hoy, o a las 9 AM por defecto
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
        const taskId = e.dataTransfer.getData("taskId");
        if (!taskId) return;

        await db.tasks.update(Number(taskId), {
            status: newStatus,
            updatedAt: new Date().toISOString()
        });
    };

    const CustomDatePicker = ({ selectedDate, onChange }) => {
        const [pickerDate, setPickerDate] = useState(selectedDate || new Date());
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

        const year = pickerDate.getFullYear();
        const month = pickerDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const prevMonth = (e) => {
            e.stopPropagation();
            setPickerDate(new Date(year, month - 1, 1));
        };
        const nextMonth = (e) => {
            e.stopPropagation();
            setPickerDate(new Date(year, month + 1, 1));
        };

        const pickerDays = [];
        for (let i = 0; i < firstDay; i++) pickerDays.push(null);
        for (let i = 1; i <= daysInMonth; i++) pickerDays.push(new Date(year, month, i));

        return (
            <div className="bg-slate-50/50 dark:bg-white/5 rounded-2xl p-3 border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between mb-3">
                    <button onClick={prevMonth} className="p-1 hover:bg-white dark:hover:bg-white/10 rounded-lg transition-all text-slate-500">
                        <ArrowLeft size={14} />
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">
                        {months[month]} {year}
                    </span>
                    <button onClick={nextMonth} className="p-1 hover:bg-white dark:hover:bg-white/10 rounded-lg transition-all text-slate-500">
                        <ArrowLeft size={14} className="rotate-180" />
                    </button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days.map(d => (
                        <div key={d} className="text-center text-[7px] font-black uppercase text-slate-400 py-0.5">
                            {d}
                        </div>
                    ))}
                    {pickerDays.map((date, i) => {
                        if (!date) return <div key={`empty-${i}`} className="h-7" />;
                        const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                        const isToday = date.toDateString() === new Date().toDateString();

                        return (
                            <button
                                key={i}
                                onClick={() => onChange(date)}
                                className={cn(
                                    "h-7 rounded-lg text-[9px] font-bold transition-all flex items-center justify-center border",
                                    isSelected
                                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                                        : isToday
                                            ? "border-blue-500/30 text-blue-500 bg-blue-500/5 hover:bg-blue-500/10"
                                            : "border-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-white/5"
                                )}
                            >
                                {date.getDate()}
                            </button>
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
                    <div
                        key={status.id}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleStatusDrop(e, status.id)}
                        onClick={() => toggleStatusFilter(status.id)}
                        className={cn(
                            "p-4 rounded-3xl border transition-all flex flex-col gap-1 cursor-pointer hover:scale-[1.02] active:scale-95",
                            status.bg,
                            isActive ? "border-blue-500 ring-2 ring-blue-500/20" : status.border
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <status.icon size={18} className={status.color} />
                            <span className="text-xl font-black text-slate-900 dark:text-white">{count}</span>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 opacity-70">
                            {status.label}
                        </span>
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

        const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
        const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

        const calendarDays = [];
        for (let i = 0; i < startDay; i++) calendarDays.push(null);
        for (let i = 1; i <= daysInMonth; i++) calendarDays.push(new Date(year, month, i));

        const CalendarDropdown = ({ value, options, onChange, type }) => {
            const [isDropdownOpen, setIsDropdownOpen] = useState(false);
            const dropdownRef = useRef(null);

            useEffect(() => {
                const handleClickOutside = (event) => {
                    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                        setIsDropdownOpen(false);
                    }
                };
                document.addEventListener('mousedown', handleClickOutside);
                return () => document.removeEventListener('mousedown', handleClickOutside);
            }, []);

            return (
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5 shadow-sm active:scale-95"
                    >
                        {type === 'month' ? months[value] : value}
                        <ChevronDown size={14} className={cn("transition-transform duration-300", isDropdownOpen && "rotate-180")} />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 z-[100] animate-in zoom-in-95 duration-200 max-h-64 overflow-y-auto no-scrollbar ring-1 ring-black/5">
                            {options.map((opt, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        onChange(type === 'month' ? i : opt);
                                        setIsDropdownOpen(false);
                                    }}
                                    className={cn(
                                        "w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all mb-1 last:mb-0",
                                        (type === 'month' ? value === i : value === opt)
                                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                            : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"
                                    )}
                                >
                                    {type === 'month' ? opt : opt}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            );
        };

        return (
            <div className="flex-1 flex flex-col min-h-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-2xl">
                {/* Calendar Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <CalendarDropdown
                            type="month"
                            value={month}
                            options={months}
                            onChange={(newMonth) => setViewDate(new Date(year, newMonth, 1))}
                        />
                        <CalendarDropdown
                            type="year"
                            value={year}
                            options={Array.from({ length: 31 }, (_, i) => year - 15 + i)}
                            onChange={(newYear) => setViewDate(new Date(newYear, month, 1))}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all active:scale-90 text-slate-500">
                            <ArrowLeft size={20} />
                        </button>
                        <button onClick={() => setViewDate(new Date())} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-all">
                            Hoy
                        </button>
                        <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all active:scale-90 text-slate-500">
                            <ArrowLeft size={20} className="rotate-180" />
                        </button>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                    <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-white/5 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/5 shadow-inner">
                        {days.map(d => (
                            <div key={d} className="bg-slate-50 dark:bg-slate-900/80 p-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-200 dark:border-white/5">
                                {d}
                            </div>
                        ))}
                        {calendarDays.map((date, i) => {
                            if (!date) return <div key={`empty-${i}`} className="bg-slate-50/30 dark:bg-slate-950/20 h-[135px] border-[0.5px] border-slate-100 dark:border-white/5" />;

                            const dayTasks = filteredTasks.filter(t => {
                                if (!t.scheduled_at) return false;
                                const d = new Date(t.scheduled_at);
                                return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
                            });

                            const isToday = new Date().toDateString() === date.toDateString();

                            const handleCalendarDrop = async (e, targetDate) => {
                                e.preventDefault();
                                const taskId = e.dataTransfer.getData("taskId");
                                if (!taskId) return;

                                const task = await db.tasks.get(Number(taskId));
                                if (!task) return;

                                const originalDate = new Date(task.scheduled_at);
                                const newDate = new Date(targetDate);
                                newDate.setHours(originalDate.getHours());
                                newDate.setMinutes(originalDate.getMinutes());

                                await db.tasks.update(Number(taskId), {
                                    scheduled_at: newDate.toISOString(),
                                    updatedAt: new Date().toISOString()
                                });
                            };

                            return (
                                <div
                                    key={i}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleCalendarDrop(e, date)}
                                    onClick={() => handleCreateOnDay(date)}
                                    className={cn(
                                        "bg-white dark:bg-slate-900/80 h-[135px] p-1.5 transition-all hover:bg-slate-50 dark:hover:bg-white/5 border-[0.5px] border-slate-100 dark:border-white/5 cursor-cell group/day relative flex flex-col",
                                        isToday && "ring-1 ring-inset ring-blue-500/30 bg-blue-500/5 z-10"
                                    )}
                                >
                                    <div className="flex justify-between items-center mb-1.5 px-1 shrink-0">
                                        <span className={cn(
                                            "text-[11px] font-black",
                                            isToday ? "text-blue-500" : "text-slate-400"
                                        )}>
                                            {date.getDate()}
                                        </span>
                                        <Plus size={10} className="text-blue-500 opacity-0 group-hover/day:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="space-y-1 flex-1 overflow-y-auto no-scrollbar scroll-smooth">
                                        {dayTasks.map(task => {
                                            const statusInfo = KANBAN_STATUS.find(s => s.id === task.status);
                                            return (
                                                <div
                                                    key={task.id}
                                                    draggable
                                                    onDragStart={(e) => e.dataTransfer.setData("taskId", task.id)}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditTask(task);
                                                    }}
                                                    className={cn(
                                                        "relative h-[26px] flex items-center pl-2 pr-4 rounded-md border text-[11px] font-bold cursor-pointer transition-all active:scale-[0.97] hover:shadow-sm overflow-hidden",
                                                        statusInfo?.bg || 'bg-slate-50 dark:bg-white/5',
                                                        statusInfo?.border || 'border-slate-200 dark:border-white/10'
                                                    )}
                                                >
                                                    <div className="flex items-center gap-1.5 leading-none w-full truncate">
                                                        <span className="text-[8px] text-slate-500 dark:text-slate-400 shrink-0 tabular-nums font-medium opacity-70">
                                                            {new Date(task.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                        </span>
                                                        <span className="truncate text-[11.5px] font-black text-slate-900 dark:text-white flex-1 tracking-tight">{task.title}</span>
                                                        {task.reminder_at && (
                                                            <Bell size={10} className={cn("shrink-0", task.reminder_sent ? "text-slate-400" : "text-blue-500")} />
                                                        )}
                                                    </div>
                                                    {/* Barra lateral derecha oscura */}
                                                    <div className="absolute right-0 top-0 bottom-0 w-[4px] bg-slate-900/40 dark:bg-slate-700/60" />
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
        <div className="h-full w-full">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col p-1 sm:p-2 lg:p-3 space-y-3">
                <header className="relative z-50 flex justify-between items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm">
                    <div className="flex items-center gap-10">
                        <button
                            onClick={onBack}
                            className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all active:scale-90 text-slate-500"
                        >
                            <ArrowLeft size={22} />
                        </button>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Calendario de Tareas</h2>
                            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Gestión temporal de servicios TI</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-1 justify-end max-w-2xl ml-10">
                        {/* Search Bar Inline */}
                        <div className="relative group/search flex-1 hidden sm:block">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-blue-500 transition-colors" size={18} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar por título, ticket o descripción..."
                                className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl py-3 pl-12 pr-10 text-sm focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 transition-all"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <div className="relative">
                                <button
                                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                                    className={cn(
                                        "p-3.5 rounded-xl transition-all active:scale-95 shadow-sm border",
                                        (statusFilters.length > 0 || searchTerm)
                                            ? "bg-blue-600 border-blue-500 text-white"
                                            : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500"
                                    )}
                                >
                                    <Filter size={22} />
                                    {(statusFilters.length > 0) && (
                                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-in zoom-in">
                                            {statusFilters.length}
                                        </span>
                                    )}
                                </button>

                                {isFilterOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[100]" onClick={() => setIsFilterOpen(false)}></div>
                                        <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-5 z-[110] animate-in fade-in zoom-in-95 duration-200 backdrop-blur-3xl">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Filtros</h4>
                                                <button onClick={() => setIsFilterOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                                    <X size={18} />
                                                </button>
                                            </div>

                                            <div className="mb-4">
                                                <CustomDatePicker
                                                    selectedDate={viewDate}
                                                    onChange={(date) => {
                                                        setViewDate(new Date(date.getFullYear(), date.getMonth(), 1));
                                                        setIsFilterOpen(false);
                                                    }}
                                                />
                                            </div>

                                            <div className="flex justify-between items-center mb-3 pt-4 border-t border-slate-100 dark:border-white/5">
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Estados</h4>
                                                {(statusFilters.length > 0 || searchTerm) && (
                                                    <button onClick={clearFilters} className="text-[9px] font-black text-red-500 uppercase hover:underline tracking-widest">Limpiar</button>
                                                )}
                                            </div>

                                            <div className="space-y-6">
                                                <div className="sm:hidden">
                                                    <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Búsqueda rápida</p>
                                                    <input
                                                        type="text"
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                        placeholder="Buscar por título..."
                                                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>

                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">Filtrar por estados</p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {KANBAN_STATUS.map(s => (
                                                            <button
                                                                key={s.id}
                                                                onClick={() => toggleStatusFilter(s.id)}
                                                                className={cn(
                                                                    "flex items-center gap-2 px-3 py-2.5 rounded-xl text-[9px] font-bold uppercase transition-all border text-left",
                                                                    statusFilters.includes(s.id)
                                                                        ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/10"
                                                                        : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:border-blue-500/30"
                                                                )}
                                                            >
                                                                <s.icon size={12} className={statusFilters.includes(s.id) ? "text-white" : s.color} />
                                                                <span className="flex-1 truncate">{s.label}</span>
                                                                {statusFilters.includes(s.id) && <CheckCircle2 size={10} />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {(searchTerm || statusFilters.length > 0) ? (
                                                <button
                                                    onClick={() => {
                                                        clearFilters();
                                                        setViewDate(new Date());
                                                        setIsFilterOpen(false);
                                                    }}
                                                    className="w-full mt-6 bg-red-500 hover:bg-red-600 text-white py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                                >
                                                    <X size={14} />
                                                    Reiniciar Vista
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setIsFilterOpen(false)}
                                                    className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-600/20 transition-all active:scale-95"
                                                >
                                                    Listo
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                            <button
                                onClick={() => setIsFormOpen(true)}
                                className="flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                            >
                                <Plus size={18} />
                                <span className="hidden sm:inline">Nueva Tarea</span>
                            </button>
                        </div>
                    </div>
                </header>

                <StatusSummary />
                <CalendarView />
            </div>

            {isFormOpen && (
                <TaskForm
                    onCancel={handleCloseForm}
                    onSave={handleCloseForm}
                    initialData={editingTask}
                />
            )}
        </div>
    );
};

export default TaskBoard;
