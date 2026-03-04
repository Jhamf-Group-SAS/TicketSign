import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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

const CustomDatePicker = ({ value, onChange, onClose, hideTime = false, anchorEl = null }) => {
    const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
    const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : new Date());
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar', 'months', 'years'
    const [popupStyle, setPopupStyle] = useState({ opacity: 0 }); // init hidden to prevent top-left flash
    const [isMobile, setIsMobile] = useState(false);

    useLayoutEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useLayoutEffect(() => {
        if (!anchorEl || isMobile) {
            setPopupStyle({});
            return;
        }

        const updatePosition = () => {
            const rect = anchorEl.getBoundingClientRect();
            // Estimate dropdown size
            const calendarHeight = 360;
            const calendarWidth = 300;

            let top = rect.bottom + 8;
            let left = rect.left;

            // Check if it fits below, otherwise try above
            if (top + calendarHeight > window.innerHeight) {
                if (rect.top - calendarHeight - 8 > 0) {
                    top = rect.top - calendarHeight - 8;
                } else {
                    // if neither fits perfectly, center vertically or stick to bottom
                    top = Math.max(10, window.innerHeight - calendarHeight - 10);
                }
            }
            if (left + calendarWidth > window.innerWidth) {
                left = Math.max(10, window.innerWidth - calendarWidth - 10);
            }

            setPopupStyle({
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                margin: 0,
                opacity: 1 // show it now
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [anchorEl, isMobile]);

    // Time state
    const currentHours = selectedDate.getHours();
    const isPM = currentHours >= 12;
    const initialDisplayHour = currentHours % 12 || 12;

    const [hours, setHours] = useState(initialDisplayHour);
    const [minutes, setMinutes] = useState(selectedDate.getMinutes());
    const [ampm, setAmpm] = useState(isPM ? 'PM' : 'AM');

    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const daysHeader = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

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
            days.push(<div key={`empty-${i}`} className="w-full h-8" />);
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
                        "w-full h-8 rounded-full text-[13px] font-[500] transition-all flex items-center justify-center relative",
                        isSelected
                            ? "bg-transparent text-text-primary shadow-sm border border-text-primary ring-2 ring-transparent"
                            : "text-text-muted hover:bg-tertiary hover:text-text-primary",
                        isToday && !isSelected && "text-primary-500 bg-primary-500/10 font-[800] border-none"
                    )}
                >
                    {d}
                </button>
            );
        }
        return days;
    };

    const renderMonthSelector = () => (
        <div className="grid grid-cols-3 gap-2 py-2">
            {months.map((m, idx) => (
                <button
                    key={m}
                    onClick={() => handleMonthSelect(idx)}
                    className={cn(
                        "py-2 rounded-xl text-[12px] font-[700] transition-all",
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
            <div className="grid grid-cols-3 gap-2 py-2">
                {years.map(year => (
                    <button
                        key={year}
                        onClick={() => handleYearSelect(year)}
                        className={cn(
                            "py-2 rounded-xl text-[12px] font-[700] transition-all",
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
            className={cn(
                "fixed inset-0 z-[3000] animate-in fade-in duration-200",
                anchorEl && !isMobile ? "bg-transparent" : "flex items-center justify-center bg-primary/95 backdrop-blur-sm"
            )}
            onClick={onClose}
        >
            <div
                className={cn(
                    "bg-secondary rounded-[16px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-color flex flex-col animate-in zoom-in-95 duration-200 relative max-h-[95vh] overflow-y-auto no-scrollbar w-[calc(100vw-32px)] sm:w-[300px]",
                    anchorEl && !isMobile && "opacity-0"
                )}
                onClick={e => e.stopPropagation()}
                style={anchorEl && !isMobile ? popupStyle : {}}
            >
                {/* Content Area */}
                <div className="p-3 flex flex-col w-full">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-2 relative min-h-[32px]">
                        <button
                            onClick={() => {
                                if (viewMode === 'calendar') prevMonth();
                                else setViewMode('calendar');
                            }}
                            className="p-1.5 hover:bg-tertiary rounded-lg text-text-muted transition-all bg-transparent absolute left-0"
                            title={viewMode === 'calendar' ? "Mes anterior" : "Volver al calendario"}
                        >
                            <ChevronLeft size={20} strokeWidth={1.5} />
                        </button>

                        <div className="flex items-center gap-1.5 cursor-pointer mx-auto">
                            <span onClick={() => setViewMode(viewMode === 'months' ? 'calendar' : 'months')} className="text-[15px] font-[400] text-primary-500 hover:opacity-80 transition-opacity capitalize flex items-center">
                                {months[viewDate.getMonth()]}
                                <ChevronRight size={14} className={cn("transition-transform duration-200 opacity-70 ml-1", viewMode === 'months' ? "-rotate-90" : "rotate-90")} strokeWidth={2} />
                            </span>
                            <span onClick={() => setViewMode(viewMode === 'years' ? 'calendar' : 'years')} className={cn("text-[15px] font-[400] hover:opacity-80 transition-opacity", viewMode === 'years' ? "text-primary-500" : "text-text-secondary")}>
                                {viewDate.getFullYear()}
                            </span>
                        </div>

                        <button
                            onClick={viewMode === 'calendar' ? nextMonth : () => { }}
                            className={cn("p-1.5 hover:bg-tertiary rounded-lg text-text-muted transition-all bg-transparent absolute right-0", viewMode !== 'calendar' && "opacity-0 cursor-default pointer-events-none")}
                        >
                            <ChevronRight size={20} strokeWidth={1.5} />
                        </button>
                    </div>

                    {/* Main Grid */}
                    <div className="flex-1 w-full">
                        {viewMode === 'calendar' && (
                            <>
                                <div className="grid grid-cols-7 gap-1 mb-1">
                                    {daysHeader.map(d => (
                                        <span key={d} className="w-full text-center text-[11px] font-[700] text-text-primary capitalize">
                                            {d}
                                        </span>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-y-1 gap-x-1">
                                    {renderCalendarDays()}
                                </div>
                            </>
                        )}
                        {viewMode === 'months' && renderMonthSelector()}
                        {viewMode === 'years' && renderYearSelector()}
                    </div>

                    {/* Inline Time Picker matching reference */}
                    {!hideTime && viewMode === 'calendar' && (
                        <div className="flex flex-col w-full mt-1 pt-2 border-t border-color/50">
                            <div className="flex items-center justify-center gap-1 text-[13px] font-[500] text-text-secondary">
                                <input
                                    type="number"
                                    min="1"
                                    max="12"
                                    value={hours === 0 ? '' : hours}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === '') setHours('');
                                        else {
                                            const num = parseInt(val, 10);
                                            if (num >= 1 && num <= 12) setHours(num);
                                        }
                                    }}
                                    onBlur={() => {
                                        let h = parseInt(hours, 10);
                                        if (isNaN(h) || h < 1) h = 12;
                                        setHours(h);
                                    }}
                                    className="w-8 h-7 text-[13px] text-center bg-transparent border-none text-text-primary font-[600] rounded-lg outline-none appearance-none focus:ring-1 focus:ring-primary-500"
                                    placeholder="12"
                                />
                                <span className="text-text-muted px-1">:</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={typeof minutes === 'number' ? minutes.toString().padStart(2, '0') : ''}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === '') setMinutes('');
                                        else {
                                            const num = parseInt(val, 10);
                                            if (!isNaN(num) && num >= 0 && num <= 59) setMinutes(num);
                                        }
                                    }}
                                    onBlur={() => {
                                        let m = parseInt(minutes, 10);
                                        if (isNaN(m) || m < 0) m = 0;
                                        setMinutes(m);
                                    }}
                                    className="w-8 h-7 text-[13px] text-center bg-transparent border-none text-text-secondary rounded-lg outline-none appearance-none focus:ring-1 focus:ring-primary-500"
                                    placeholder="00"
                                />
                                <span className="text-text-muted px-1">:</span>
                                <span className="w-8 text-center text-text-secondary text-[13px]">00</span>

                                <button
                                    onClick={() => setAmpm(ampm === 'AM' ? 'PM' : 'AM')}
                                    className="ml-2 px-2 h-7 bg-tertiary border border-color hover:bg-primary-500/10 rounded-md text-[12px] font-[600] text-primary-500 transition-colors"
                                >
                                    {ampm}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons matching reference */}
                    {viewMode === 'calendar' && (
                        <div className="flex items-center gap-3 w-full mt-2">
                            <button
                                onClick={handleNow}
                                className="flex-1 py-1.5 bg-transparent text-[#5c7096] border border-[#d2dce8] hover:bg-tertiary dark:border-color dark:text-text-secondary rounded-lg text-[13px] font-[500] transition-colors"
                            >
                                Ahora
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-[1.5] py-1.5 bg-[#fbc04a] hover:bg-[#fab01c] text-[#4f3a12] rounded-lg text-[13px] font-[600] shadow-sm transition-colors border-none"
                            >
                                Guardar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CustomDatePicker;
