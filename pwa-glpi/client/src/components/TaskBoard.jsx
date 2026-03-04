import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { isHoliday } from '../utils/holidays';
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
    ChevronDown,
    Kanban,
    ChevronLeft,
    ChevronRight,
    Palette,
    Trash2
} from 'lucide-react';
import { db } from '../store/db';
import TaskForm from './TaskForm';
import { cn } from '../utils/cn';

const KANBAN_STATUS = [
    { id: 'PROGRAMADA', label: 'PROGRAMADA', icon: Clock, color: 'text-blue-500', bg: 'bg-secondary', border: 'border-blue-500' },
    { id: 'ASIGNADA', label: 'ASIGNADA', icon: CalendarIcon, color: 'text-purple-500', bg: 'bg-secondary', border: 'border-purple-500' },
    { id: 'EN_EJECUCION', label: 'EJECUCIÓN', icon: Hammer, color: 'text-amber-500', bg: 'bg-secondary', border: 'border-amber-500' },
    { id: 'CANCELADA', label: 'CANCELADA', icon: PauseCircle, color: 'text-gray-500', bg: 'bg-secondary', border: 'border-gray-500' },
    { id: 'COMPLETADA', label: 'COMPLETADA', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-secondary', border: 'border-emerald-500' },
    { id: 'VENCIDA', label: 'VENCIDA', icon: AlertCircle, color: 'text-red-500', bg: 'bg-secondary', border: 'border-red-500' }
];

const DAY_COLORS = [
    { color: '#0695c4', name: 'Azul GLPI' },
    { color: '#10b981', name: 'Esmeralda' },
    { color: '#ef4444', name: 'Rojo' },
    { color: '#f59e0b', name: 'Ámbar' },
    { color: '#f97316', name: 'Naranja' },
    { color: '#8b5cf6', name: 'Púrpura' },
    { color: '#ec4899', name: 'Rosa' },
    { color: '#06b6d4', name: 'Cian' },
    { color: '#6366f1', name: 'Índigo' },
    { color: '#14b8a6', name: 'Turquesa' },
    { color: '#22c55e', name: 'Verde' },
    { color: '#f43f5e', name: 'Rosa Fuerte' },
    { color: '#d946ef', name: 'Fucsia' },
    { color: '#eab308', name: 'Amarillo' },
    { color: '#94a3b8', name: 'Gris' },
    { color: 'transparent', name: 'Limpiar' }
];

const TaskBoard = ({ onBack }) => {
    const tasks = useLiveQuery(() => db.tasks.toArray()) || [];
    const daySettings = useLiveQuery(() => db.day_settings.toArray()) || [];
    const [user] = useState(JSON.parse(localStorage.getItem('glpi_pro_user') || '{}'));

    const isAdmin = (user.profile || '').includes('Super-Admin') || (user.profile || '').includes('Admin-Mesa');
    const isSpecialist = ['Especialistas', 'Administrativo', 'Admin'].some(p => (user.profile || '').includes(p));
    const canCreate = isAdmin || isSpecialist;

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [viewDate, setViewDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilters, setStatusFilters] = useState([]);
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar', 'months', 'years'
    const [activePickerDate, setActivePickerDate] = useState(null);
    const scrollContainerRef = useRef(null);

    const [hoveredTask, setHoveredTask] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [placement, setPlacement] = useState('top');
    const [deltaX, setDeltaX] = useState(0);

    const filteredTasks = tasks.filter(task => {
        const myNames = [(user.username || ''), (user.name || ''), (user.displayName || '')].filter(Boolean).map(n => n.toLowerCase());
        const isCreator = myNames.includes((task.createdBy || '').toLowerCase());
        const isAssigned = (task.assigned_technicians || []).some(tech => myNames.some(name => (tech || '').toLowerCase().includes(name)));
        if (task.isPrivate && !isCreator && !isAssigned) return false;

        const matchesSearch = !searchTerm || task.title?.toLowerCase().includes(searchTerm.toLowerCase()) || task.glpi_ticket_id?.toString().includes(searchTerm);
        const matchesStatus = statusFilters.length === 0 || statusFilters.includes(task.status);
        return matchesSearch && matchesStatus;
    });

    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const daysArr = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const startDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarDays = [];
    for (let i = 0; i < startDay; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(new Date(year, month, i));

    const handleTaskHover = (e, task) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        const centerX = rect.left + rect.width / 2;

        const bestPlacement = (spaceAbove < 250 && spaceBelow > spaceAbove) ? 'bottom' : 'top';
        setPlacement(bestPlacement);

        // Horizontal Intelligence
        const tooltipWidth = 256; // w-64
        const halfWidth = tooltipWidth / 2;
        const margin = 12;

        // Detect sidebar width from DOM or guess safe values
        const sidebar = document.querySelector('aside');
        const minX = (sidebar ? sidebar.offsetWidth : (window.innerWidth < 1024 ? 0 : 238)) + margin;
        const maxX = window.innerWidth - margin;

        let shift = 0;
        if (centerX - halfWidth < minX) {
            shift = minX - (centerX - halfWidth);
        } else if (centerX + halfWidth > maxX) {
            shift = maxX - (centerX + halfWidth);
        }
        setDeltaX(shift);

        if (bestPlacement === 'top') {
            setTooltipPosition({ x: centerX, y: rect.top - 12 });
        } else {
            setTooltipPosition({ x: centerX, y: rect.bottom + 12 });
        }
        setHoveredTask(task);
    };

    const handleCreateOnDay = (date) => {
        if (!canCreate) return;
        const newDate = new Date(date);
        newDate.setHours(9, 0);
        setEditingTask({ scheduled_at: newDate.toISOString(), status: 'PROGRAMADA', priority: 'MEDIA', type: 'CORRECTIVO' });
        setIsFormOpen(true);
    };

    const getDaySetting = (date) => daySettings.find(s => s.date === (date ? date.toDateString() : '')) || { color: 'transparent' };

    return (
        <div className="flex flex-col h-full space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 overflow-hidden pb-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <button
                        onClick={onBack}
                        className="p-3.5 bg-secondary border border-color rounded-2xl text-text-muted hover:text-primary-500 transition-all active:scale-90 shadow-sm group"
                    >
                        <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-tertiary rounded-xl flex items-center justify-center text-primary-500">
                            <Kanban size={22} />
                        </div>
                        <div>
                            <h2 className="text-[22px] font-[800] text-text-primary tracking-tight uppercase">Cronograma</h2>
                            <p className="text-[11px] font-[600] text-text-muted uppercase tracking-[1px] mt-0.5">Planificación técnica</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto mt-4 md:mt-0">
                    <div className="relative flex-1 group/search">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within/search:text-primary-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Filtrar agenda..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-tertiary border border-color focus:border-primary-500 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold outline-none transition-all placeholder:text-text-muted/40 shadow-sm min-w-[200px] text-text-primary"
                        />
                    </div>
                    {canCreate && (
                        <button
                            onClick={() => handleCreateOnDay(new Date())}
                            className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3.5 rounded-2xl text-[11px] font-black tracking-[0.1em] shadow-lg transition-all flex justify-center items-center gap-3 active:scale-95 uppercase group whitespace-nowrap"
                        >
                            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                            Programar Tarea
                        </button>
                    )}
                </div>
            </div>

            {/* Status Quick Filters */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {KANBAN_STATUS.map(status => {
                    const count = filteredTasks.filter(t => t.status === status.id).length;
                    const isActive = statusFilters.includes(status.id);
                    return (
                        <button
                            key={status.id}
                            onClick={() => setStatusFilters(prev => prev.includes(status.id) ? prev.filter(s => s !== status.id) : [...prev, status.id])}
                            className={cn(
                                "p-4 rounded-[12px] bg-secondary border border-color shadow-sm flex flex-col gap-2 transition-all text-left relative overflow-hidden",
                                isActive && "border-primary-500 bg-tertiary"
                            )}
                        >
                            <div className="flex justify-between items-center">
                                <span className={cn("text-[20px] font-[800] text-text-primary", isActive && "text-primary-500")}>{count}</span>
                                <div className={cn("p-2 rounded-lg bg-tertiary text-text-secondary", isActive && "bg-primary-500 text-white")}>
                                    <status.icon size={16} />
                                </div>
                            </div>
                            <span className="text-[11px] font-[600] text-text-muted uppercase tracking-[.6px]">{status.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Calendar Grid Container */}
            <div className="bg-secondary border border-color rounded-[12px] shadow-sm flex flex-col overflow-hidden transition-colors duration-300">
                <div className="p-4 border-b border-color flex items-center justify-between bg-secondary">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-row items-center gap-2 md:gap-4">
                            <button
                                onClick={() => setViewMode(viewMode === 'months' ? 'calendar' : 'months')}
                                className={cn(
                                    "text-[15px] font-[700] uppercase tracking-tight transition-all px-3 py-1 rounded-lg",
                                    viewMode === 'months' ? "bg-secondary text-primary-500 border border-primary-500" : "text-text-primary hover:bg-tertiary"
                                )}
                            >
                                {months[month]}
                            </button>
                            <button
                                onClick={() => setViewMode(viewMode === 'years' ? 'calendar' : 'years')}
                                className={cn(
                                    "text-[15px] font-[700] transition-all px-3 py-1 rounded-lg",
                                    viewMode === 'years' ? "bg-secondary text-primary-500 border border-primary-500" : "text-text-primary hover:bg-tertiary"
                                )}
                            >
                                {year}
                            </button>
                        </div>
                        <div className="flex items-center bg-tertiary rounded-lg p-1 gap-1 border border-color">
                            <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-secondary rounded-md text-text-secondary transition-all"><ChevronLeft size={16} /></button>
                            <button
                                onClick={() => { setViewDate(new Date()); setViewMode('calendar'); }}
                                className="px-3 py-1 hover:bg-secondary rounded-md text-[10px] font-black uppercase text-primary-500 transition-all font-bold"
                            >
                                Hoy
                            </button>
                            <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-secondary rounded-md text-text-secondary transition-all"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                </div>

                <div className="relative min-h-[400px]">
                    {viewMode === 'calendar' ? (
                        <div className="flex flex-col flex-1 overflow-x-auto custom-scrollbar w-full">
                            <div className="min-w-[700px] flex flex-col flex-1">
                                {/* Grid View */}
                                <div className="grid grid-cols-7 border-b border-color bg-primary transition-colors">
                                    {daysArr.map(d => (
                                        <div key={d} className="py-2.5 text-center text-[9px] md:text-[11px] font-[600] uppercase text-text-muted tracking-[1px]">{d}</div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-7 flex-1 overflow-y-auto no-scrollbar">
                                    {calendarDays.map((date, i) => {
                                        const isToday = date && date.toDateString() === new Date().toDateString();
                                        const taskList = date ? filteredTasks.filter(t => t.scheduled_at && new Date(t.scheduled_at).toDateString() === date.toDateString()) : [];
                                        const holiday = date ? isHoliday(date) : null;

                                        return (
                                            <div
                                                key={i}
                                                onClick={() => date && handleCreateOnDay(date)}
                                                style={date ? {
                                                    backgroundColor: getDaySetting(date).color !== 'transparent' ? getDaySetting(date).color + '15' : undefined,
                                                    borderTop: getDaySetting(date).color !== 'transparent' ? `4px solid ${getDaySetting(date).color}` : undefined
                                                } : {}}
                                                className={cn(
                                                    "min-h-[80px] md:min-h-[140px] flex flex-col p-1 md:p-2 border-r border-tertiary border-b border-tertiary transition-all relative group/day",
                                                    !date && "bg-primary opacity-50",
                                                    date && "hover:bg-tertiary cursor-pointer"
                                                )}
                                            >
                                                {date && (
                                                    <>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className={cn(
                                                                "text-[10px] md:text-[12px] font-[800] flex items-center justify-center w-[20px] h-[20px] md:w-[24px] md:h-[24px] rounded-full",
                                                                isToday ? "bg-primary-500 text-white shadow-md shadow-primary-500" : "text-text-secondary"
                                                            )}>
                                                                {date.getDate()}
                                                            </span>

                                                            <div className="flex items-center gap-1">
                                                                {holiday && <span className="text-[9px] font-[800] text-red-500 uppercase mr-1">Feriado</span>}

                                                                {/* Palette Button & Popover */}
                                                                <div className="relative">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActivePickerDate(activePickerDate === date.toDateString() ? null : date.toDateString());
                                                                        }}
                                                                        className={cn(
                                                                            "p-1 rounded-md transition-all hover:bg-secondary border border-transparent",
                                                                            activePickerDate === date.toDateString() ? "bg-tertiary shadow-sm border-color text-primary-500" : "text-text-muted group-hover/day:text-text-secondary"
                                                                        )}
                                                                    >
                                                                        <Palette size={14} />
                                                                    </button>

                                                                    {activePickerDate === date.toDateString() && (
                                                                        <div
                                                                            className={cn(
                                                                                "absolute p-5 bg-secondary rounded-[2.5rem] shadow-2xl border border-color z-[100] w-64 animate-in fade-in zoom-in-95 duration-200",
                                                                                i < 21 ? "top-full mt-3" : "bottom-full mb-3",
                                                                                (i % 7) < 3 ? "left-0" : "right-0"
                                                                            )}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <div className="flex items-center justify-between mb-4">
                                                                                <div className="flex items-center gap-2.5">
                                                                                    <div
                                                                                        className="w-6 h-6 rounded-full border-2 border-primary-500/20 shadow-sm"
                                                                                        style={{ backgroundColor: getDaySetting(date).color === 'transparent' ? 'var(--bg-tertiary)' : getDaySetting(date).color }}
                                                                                    />
                                                                                    <span className="text-[11px] font-[800] uppercase text-text-primary tracking-widest">Color del Día</span>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => setActivePickerDate(null)}
                                                                                    className="p-1 hover:bg-tertiary rounded-full transition-colors text-text-muted"
                                                                                >
                                                                                    <X size={16} />
                                                                                </button>
                                                                            </div>

                                                                            {/* Smooth Dynamic Slider */}
                                                                            <div className="mb-5 px-1">
                                                                                <input
                                                                                    type="range"
                                                                                    min="0"
                                                                                    max="360"
                                                                                    className="w-full h-2.5 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-[#ff0000] via-[#ffff00] via-[#00ff00] via-[#00ffff] via-[#0000ff] via-[#ff00ff] to-[#ff0000] shadow-inner"
                                                                                    onChange={(e) => {
                                                                                        const color = `hsl(${e.target.value}, 75%, 55%)`;
                                                                                        db.day_settings.put({ date: date.toDateString(), color });
                                                                                    }}
                                                                                />
                                                                            </div>

                                                                            <div className="space-y-4">
                                                                                {/* Quick Access Palette */}
                                                                                <div className="grid grid-cols-5 gap-2">
                                                                                    {DAY_COLORS.filter(c => c.color !== 'transparent').map(c => (
                                                                                        <button
                                                                                            key={c.color}
                                                                                            onClick={() => {
                                                                                                db.day_settings.put({ date: date.toDateString(), color: c.color });
                                                                                                setActivePickerDate(null);
                                                                                            }}
                                                                                            style={{ backgroundColor: c.color }}
                                                                                            className={cn(
                                                                                                "w-8 h-8 rounded-xl border border-color/40 shadow-sm transition-all hover:scale-110",
                                                                                                getDaySetting(date).color === c.color ? "ring-2 ring-primary-500 ring-offset-2 ring-offset-secondary scale-110 shadow-md" : "hover:shadow-md"
                                                                                            )}
                                                                                        />
                                                                                    ))}
                                                                                </div>

                                                                                <button
                                                                                    onClick={() => {
                                                                                        db.day_settings.put({ date: date.toDateString(), color: 'transparent' });
                                                                                        setActivePickerDate(null);
                                                                                    }}
                                                                                    className="w-full py-2.5 bg-tertiary hover:bg-primary-500 hover:text-white rounded-2xl text-[10px] font-[900] uppercase tracking-widest text-text-muted transition-all flex items-center justify-center gap-2 border border-color"
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                    Restablecer Día
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 max-h-[100px] pr-1">
                                                            {taskList.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)).map(task => (
                                                                <div
                                                                    key={task.id}
                                                                    onClick={(e) => { e.stopPropagation(); setEditingTask(task); setIsFormOpen(true); }}
                                                                    onMouseEnter={(e) => handleTaskHover(e, task)}
                                                                    onMouseLeave={() => setHoveredTask(null)}
                                                                    className={cn(
                                                                        "px-1 md:px-2 py-1 md:py-1.5 rounded-md md:rounded-lg bg-tertiary text-[8px] md:text-[10px] font-[700] truncate border border-color cursor-pointer hover:bg-secondary hover:shadow-sm transition-all",
                                                                        task.status === 'COMPLETADA' && "text-emerald-500 bg-emerald-500/5 border-emerald-500/20",
                                                                        task.status === 'CANCELADA' && "text-gray-500 bg-gray-500/5 border-gray-500/20",
                                                                        task.status === 'EN_EJECUCION' && "text-amber-500 bg-amber-500/5 border-amber-500/20",
                                                                        task.status === 'ASIGNADA' && "text-purple-500 bg-purple-500/5 border-purple-500/20",
                                                                        task.status === 'PROGRAMADA' && "text-blue-500 bg-blue-500/5 border-blue-500/20",
                                                                        task.status === 'VENCIDA' && "text-red-500 bg-red-500/5 border-red-500/20",
                                                                        (!task.status || task.status === 'PENDIENTE') && "text-primary-500"
                                                                    )}
                                                                >
                                                                    {task.title}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : viewMode === 'months' ? (
                        <div className="p-8 grid grid-cols-3 md:grid-cols-4 gap-4 animate-in fade-in zoom-in duration-300">
                            {months.map((m, idx) => (
                                <button
                                    key={m}
                                    onClick={() => { setViewDate(new Date(year, idx, 1)); setViewMode('calendar'); }}
                                    className={cn(
                                        "py-6 rounded-2xl text-[14px] font-[800] uppercase tracking-widest transition-all border border-color",
                                        month === idx
                                            ? "bg-primary-500 text-white shadow-xl shadow-primary-500 border-transparent scale-105"
                                            : "bg-secondary text-text-muted hover:border-primary-500 hover:text-primary-500"
                                    )}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 flex flex-col gap-8 animate-in fade-in zoom-in duration-300">
                            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                                {Array.from({ length: 32 }, (_, i) => (Math.floor(year / 32) * 32) + i).map(y => (
                                    <button
                                        key={y}
                                        onClick={() => { setViewDate(new Date(y, month, 1)); setViewMode('calendar'); }}
                                        className={cn(
                                            "py-4 rounded-2xl text-[13px] font-[800] transition-all border border-color",
                                            year === y
                                                ? "bg-primary-500 text-white shadow-xl shadow-primary-500 border-transparent scale-105"
                                                : "bg-secondary text-text-muted hover:border-primary-500 hover:text-primary-500"
                                        )}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Premium Tooltip */}
            {
                hoveredTask && createPortal(
                    <div
                        className={cn(
                            "fixed z-[9999] pointer-events-none w-64 animate-in fade-in zoom-in-95 duration-200",
                            placement === 'top' ? "-translate-y-full" : "translate-y-0"
                        )}
                        style={{
                            left: tooltipPosition.x,
                            top: tooltipPosition.y,
                            transform: `translate(calc(-50% + ${deltaX}px), ${placement === 'top' ? '-100%' : '0'})`
                        }}
                    >
                        {/* Visual Arrow - compensated for deltaX to keep pointing to task */}
                        <div
                            className={cn(
                                "absolute left-1/2 w-4 h-4 bg-secondary border-color rotate-45 z-[10000]",
                                placement === 'top' ? "-bottom-2 border-r border-b" : "-top-2 border-l border-t"
                            )}
                            style={{ transform: `translateX(calc(-50% - ${deltaX}px)) rotate(45deg)` }}
                        />

                        <div className="bg-secondary/98 backdrop-blur-xl text-text-primary p-3.5 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.25)] border border-color flex flex-col gap-2.5 relative overflow-hidden group">
                            {/* Highlighting glow */}
                            <div className="absolute -top-6 -right-6 w-16 h-16 bg-primary-500/10 blur-2xl rounded-full" />

                            <div className="flex items-center gap-2 text-[10px] font-black text-primary-500 uppercase tracking-[1.5px] relative z-10">
                                <Clock size={12} strokeWidth={3} />
                                <span>{new Date(hoveredTask.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>

                            <p className="text-[11px] font-[600] text-text-primary leading-relaxed italic border-l-2 border-primary-500/40 pl-3 relative z-10">
                                {hoveredTask.description || 'Sin descripción técnica...'}
                            </p>
                        </div>
                    </div>,
                    document.body
                )
            }

            {
                isFormOpen && (
                    <TaskForm
                        initialData={editingTask}
                        onCancel={() => { setIsFormOpen(false); setEditingTask(null); }}
                        onSave={() => { setIsFormOpen(false); setEditingTask(null); }}
                    />
                )
            }
        </div >
    );
};

export default TaskBoard;
