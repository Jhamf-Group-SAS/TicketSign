import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    X,
    Check,
    Clock
} from 'lucide-react';
import { cn } from '../utils/cn';

const CustomDatePicker = ({ value, onChange, onClose, hideTime = false }) => {
    const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
    const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : new Date());
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar', 'months', 'years'

    // Time state
    const currentHours = selectedDate.getHours();
    const isPM = currentHours >= 12;
    const initialDisplayHour = currentHours % 12 || 12;

    const [hours, setHours] = useState(initialDisplayHour);
    const [minutes, setMinutes] = useState(selectedDate.getMinutes());
    const [ampm, setAmpm] = useState(isPM ? 'PM' : 'AM');

    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const daysHeader = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

    const handleDateSelect = (day) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        setSelectedDate(newDate);
    };

    const handleMonthSelect = (monthIndex) => {
        setViewDate(new Date(viewDate.getFullYear(), monthIndex, 1));
        setViewMode('calendar');
    };

    const handleYearSelect = (year) => {
        setViewDate(new Date(year, viewDate.getMonth(), 1));
        setViewMode('calendar');
    };

    const handleNow = () => {
        const now = new Date();
        onChange(now.toISOString());
        onClose();
    };

    const handleClear = () => {
        onChange('');
        onClose();
    };

    const handleSave = () => {
        // Asegurar que usamos el año/mes/día de selectedDate y la hora/min del picker
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const date = selectedDate.getDate();

        let finalHour = parseInt(hours) || 0;
        if (ampm === 'PM' && finalHour < 12) finalHour += 12;
        if (ampm === 'AM' && finalHour === 12) finalHour = 0;

        // Log interno útil para depuración (se verá en consola de desarrollo)
        // console.log(`[DatePicker] Savign: ${finalHour}:${minutes} ${ampm} -> Local`);

        const finalMinutes = parseInt(minutes) || 0;

        // Construcción explícita en hora local
        const finalDate = new Date(year, month, date, finalHour, finalMinutes, 0, 0);

        onChange(finalDate.toISOString());
        onClose();
    };

    const renderCalendarDays = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="w-10 h-10" />);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const isSelected = selectedDate.getDate() === d &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year;

            const isToday = new Date().getDate() === d &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

            days.push(
                <button
                    key={d}
                    type="button"
                    onClick={() => handleDateSelect(d)}
                    className={cn(
                        "w-10 h-10 rounded-xl text-[14px] font-[700] transition-all flex items-center justify-center relative",
                        isSelected
                            ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20"
                            : "text-text-secondary hover:bg-tertiary hover:text-primary-500",
                        isToday && !isSelected && "text-primary-500 bg-primary-500/10 font-black"
                    )}
                >
                    {d}
                </button>
            );
        }
        return days;
    };

    const renderMonthSelector = () => (
        <div className="grid grid-cols-3 gap-2 py-4">
            {months.map((m, idx) => (
                <button
                    key={m}
                    onClick={() => handleMonthSelect(idx)}
                    className={cn(
                        "py-3 rounded-2xl text-[13px] font-[700] transition-all",
                        viewDate.getMonth() === idx
                            ? "bg-primary-500 text-white shadow-md shadow-primary-500/10"
                            : "text-text-muted hover:bg-tertiary hover:text-primary-500"
                    )}
                >
                    {m.substring(0, 3).toUpperCase()}
                </button>
            ))}
        </div>
    );

    const renderYearSelector = () => {
        const currentYear = viewDate.getFullYear();
        const startYear = currentYear - 6;
        const years = Array.from({ length: 12 }, (_, i) => startYear + i);

        return (
            <div className="grid grid-cols-3 gap-2 py-4">
                {years.map(year => (
                    <button
                        key={year}
                        onClick={() => handleYearSelect(year)}
                        className={cn(
                            "py-3 rounded-2xl text-[13px] font-[700] transition-all",
                            viewDate.getFullYear() === year
                                ? "bg-[#0695c4] text-white shadow-md shadow-[#0695c4]/20"
                                : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0695c4]"
                        )}
                    >
                        {year}
                    </button>
                ))}
            </div>
        );
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[3000] flex items-center justify-center bg-primary animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div
                className="bg-secondary rounded-[32px] shadow-2xl border border-color overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300 max-h-[95vh] md:max-h-[600px] relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Close Button Mobile/Global */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-[#94a3b8] hover:text-[#1e293b] md:hidden z-10"
                >
                    <X size={20} />
                </button>

                {/* Left Side: Calendar Content Area */}
                <div className="p-8 w-[340px] bg-secondary flex flex-col">
                    {/* Dynamic Header */}
                    <div className="flex items-center justify-between mb-8">
                        <button
                            onClick={viewMode === 'calendar' ? prevMonth : () => { }}
                            className={cn(
                                "p-2.5 hover:bg-tertiary rounded-2xl text-text-muted transition-all active:scale-90 border border-color",
                                viewMode !== 'calendar' && "opacity-0 cursor-default"
                            )}
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <div className="flex flex-col items-center flex-1">
                            <button
                                onClick={() => setViewMode(viewMode === 'months' ? 'calendar' : 'months')}
                                className={cn(
                                    "px-4 py-1.5 rounded-xl transition-all font-[900] uppercase tracking-wider text-[15px]",
                                    viewMode === 'months' ? "bg-primary-500/20 text-primary-500" : "text-text-primary hover:bg-tertiary"
                                )}
                            >
                                {viewMode === 'years' ? 'Cambiar Año' : months[viewDate.getMonth()]}
                            </button>
                            <button
                                onClick={() => setViewMode(viewMode === 'years' ? 'calendar' : 'years')}
                                className={cn(
                                    "px-3 py-0.5 rounded-lg mt-1 transition-all text-[12px] font-[800] tracking-widest uppercase",
                                    viewMode === 'years' ? "bg-tertiary text-primary-500" : "text-text-muted hover:text-primary-500"
                                )}
                            >
                                {viewDate.getFullYear()}
                            </button>
                        </div>

                        <button
                            onClick={viewMode === 'calendar' ? nextMonth : () => { }}
                            className={cn(
                                "p-2.5 hover:bg-tertiary rounded-2xl text-text-muted transition-all active:scale-90 border border-color",
                                viewMode !== 'calendar' && "opacity-0 cursor-default"
                            )}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1">
                        {viewMode === 'calendar' && (
                            <>
                                <div className="grid grid-cols-7 gap-1 mb-3">
                                    {daysHeader.map(d => (
                                        <span key={d} className="w-10 text-center text-[11px] font-[800] text-[#94a3b8] uppercase tracking-widest">
                                            {d}
                                        </span>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {renderCalendarDays()}
                                </div>
                            </>
                        )}

                        {viewMode === 'months' && renderMonthSelector()}
                        {viewMode === 'years' && renderYearSelector()}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center gap-4 mt-auto pt-8">
                        <button
                            onClick={handleClear}
                            className="flex-1 text-[11px] font-[900] text-orange-500 uppercase tracking-widest px-4 py-3 bg-orange-500/10 hover:bg-orange-500/20 rounded-2xl transition-all active:scale-95"
                        >
                            Limpiar
                        </button>
                        <button
                            onClick={handleNow}
                            className="flex-1 text-[11px] font-[900] text-primary-500 uppercase tracking-widest px-4 py-3 bg-primary-500/10 hover:bg-primary-500/20 rounded-2xl transition-all active:scale-95 text-center"
                        >
                            Hoy
                        </button>
                    </div>
                </div>

                {/* Right Side: Time Picker */}
                {!hideTime && (
                    <div className="w-full md:w-[280px] bg-tertiary flex flex-col border-t md:border-t-0 md:border-l border-color">
                        <div className="p-8 flex-1 overflow-y-auto no-scrollbar space-y-8">
                            {/* Hours Grid */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Clock size={16} className="text-[#0695c4]" />
                                    <p className="text-[11px] font-[800] text-[#1e293b] uppercase tracking-widest">Hora</p>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                                        <button
                                            key={h}
                                            onClick={() => {
                                                setHours(h);
                                                // Default to :00 if picking a new hour and minutes are unedited
                                                if (minutes === 0 || minutes === '') setMinutes(0);
                                            }}
                                            className={cn(
                                                "h-10 text-[14px] font-[800] rounded-xl transition-all relative border-2",
                                                hours === h
                                                    ? "bg-primary-500 text-white border-primary-400 shadow-lg shadow-primary-500/20 scale-110 z-10"
                                                    : "bg-secondary text-text-secondary border-transparent hover:border-primary-500/30 hover:text-primary-500"
                                            )}
                                        >
                                            {h.toString().padStart(2, '0')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Minutes Input */}
                            <div>
                                <p className="text-[11px] font-[800] text-[#1e293b] uppercase tracking-widest mb-4">Minutos</p>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={typeof minutes === 'number' ? minutes.toString().padStart(2, '0') : ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '') {
                                                setMinutes('');
                                                return;
                                            }
                                            const num = parseInt(val, 10);
                                            if (!isNaN(num) && num >= 0 && num <= 59) {
                                                setMinutes(num);
                                            }
                                        }}
                                        onBlur={() => {
                                            if (minutes === '' || isNaN(minutes)) setMinutes(0);
                                        }}
                                        className="w-full h-12 text-center text-[20px] font-[800] text-primary-500 bg-secondary border border-color rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all shadow-sm"
                                        placeholder="00"
                                    />
                                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                        <span className="text-[11px] font-[800] text-[#94a3b8] uppercase tracking-widest">MIN</span>
                                    </div>
                                </div>
                            </div>

                            {/* AM/PM Selection */}
                            <div>
                                <p className="text-[11px] font-[800] text-text-primary uppercase tracking-widest mb-4">Meridiano</p>
                                <div className="flex gap-2 p-1.5 bg-secondary rounded-2xl border border-color">
                                    {['AM', 'PM'].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setAmpm(p)}
                                            className={cn(
                                                "flex-1 h-10 text-[12px] font-[900] rounded-xl transition-all uppercase tracking-[0.1em] border-2",
                                                ampm === p
                                                    ? "bg-primary-500 text-white border-primary-400 shadow-md scale-105"
                                                    : "text-text-muted border-transparent hover:text-primary-500"
                                            )}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="p-8 bg-secondary border-t border-color">
                            <button
                                onClick={handleSave}
                                className="w-full h-14 bg-[linear-gradient(135deg,#0695c4,#0578a0)] text-white rounded-[20px] text-[13px] font-[900] uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:shadow-primary-500/30 active:scale-95 transition-all flex items-center justify-center gap-3 group"
                            >
                                <Check size={20} className="group-hover:scale-110 transition-transform" />
                                Confirmar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default CustomDatePicker;
