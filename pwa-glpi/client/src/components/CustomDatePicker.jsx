import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon } from 'lucide-react';

const CustomDatePicker = ({ value, onChange, onClose, hideTime = false }) => {
    const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
    const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : new Date());
    const [hours, setHours] = useState(selectedDate.getHours());
    const [minutes, setMinutes] = useState(selectedDate.getMinutes());
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar', 'month', 'year'

    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const daysHeader = ['Wk', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => {
        let day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1;
    };

    const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

    const handleDateSelect = (day) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day, hours, minutes);
        setSelectedDate(newDate);
        // Si es solo fecha, podríamos cerrar, pero como hay hora, mejor dejar que el usuario de a "Guardar"
    };

    const handleMonthSelect = (monthIndex) => {
        setViewDate(new Date(viewDate.getFullYear(), monthIndex, 1));
        setViewMode('calendar');
    };

    const handleYearSelect = (year) => {
        setViewDate(new Date(year, viewDate.getMonth(), 1));
        setViewMode('month');
    };

    const handleNow = () => {
        const now = new Date();
        setSelectedDate(now);
        setHours(now.getHours());
        setMinutes(now.getMinutes());
        setViewDate(now);
        setViewMode('calendar');
        onChange(now.toISOString());
        onClose();
    };

    const handleSave = () => {
        const finalDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hours, minutes);
        onChange(finalDate.toISOString());
        onClose();
    };

    const renderDays = () => {
        const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
        const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());
        const rows = [];
        let cells = [];

        for (let i = 0; i < firstDay; i++) {
            cells.push(<div key={`empty-${i}`} className="w-10 h-10"></div>);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const isSelected = selectedDate.getDate() === d &&
                selectedDate.getMonth() === viewDate.getMonth() &&
                selectedDate.getFullYear() === viewDate.getFullYear();
            const isToday = new Date().getDate() === d &&
                new Date().getMonth() === viewDate.getMonth() &&
                new Date().getFullYear() === viewDate.getFullYear();

            cells.push(
                <button
                    key={d}
                    type="button"
                    onClick={() => handleDateSelect(d)}
                    className={`w-10 h-10 rounded-full text-xs font-bold transition-all flex items-center justify-center relative
                        ${isSelected ? 'bg-blue-200/50 text-slate-800 border-2 border-slate-600' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'}
                        ${isToday && !isSelected ? 'text-blue-500 font-black' : ''}`}
                >
                    {d}
                    {isSelected && <div className="absolute inset-0 rounded-full border border-slate-400/30 scale-110"></div>}
                </button>
            );

            if (cells.length === 7) {
                rows.push(<div key={`row-${d}`} className="flex justify-between mb-2">{cells}</div>);
                cells = [];
            }
        }
        if (cells.length > 0) {
            while (cells.length < 7) cells.push(<div key={`empty-end-${cells.length}`} className="w-10 h-10"></div>);
            rows.push(<div key={`row-last`} className="flex justify-between mb-2">{cells}</div>);
        }
        return rows;
    };

    const renderMonths = () => {
        return (
            <div className="grid grid-cols-3 gap-3">
                {months.map((m, i) => (
                    <button
                        key={m}
                        onClick={() => handleMonthSelect(i)}
                        className={`p-3 rounded-xl text-xs font-bold transition-all
                            ${viewDate.getMonth() === i ? 'bg-blue-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'}`}
                    >
                        {m}
                    </button>
                ))}
            </div>
        );
    };

    const renderYears = () => {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 10;
        const endYear = currentYear + 10;
        const years = [];
        for (let y = startYear; y <= endYear; y++) {
            years.push(y);
        }
        return (
            <div className="grid grid-cols-4 gap-3 max-h-[220px] overflow-y-auto no-scrollbar">
                {years.map(y => (
                    <button
                        key={y}
                        onClick={() => handleYearSelect(y)}
                        className={`p-3 rounded-xl text-xs font-bold transition-all
                            ${viewDate.getFullYear() === y ? 'bg-blue-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'}`}
                    >
                        {y}
                    </button>
                ))}
            </div>
        );
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <div
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] p-6 w-full max-w-[340px] animate-in zoom-in-95 duration-300"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    {viewMode === 'calendar' && (
                        <button type="button" onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 transition-all active:scale-90">
                            <ChevronLeft size={20} />
                        </button>
                    )}

                    <div className="flex items-center gap-2 mx-auto cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 px-3 py-1 rounded-xl transition-colors" onClick={() => setViewMode(viewMode === 'calendar' ? 'month' : 'year')}>
                        <span className="text-lg font-black text-blue-500 tracking-tight">
                            {viewMode === 'year' ? 'Seleccionar Año' :
                                viewMode === 'month' ? viewDate.getFullYear() :
                                    months[viewDate.getMonth()]}
                        </span>
                        {viewMode === 'calendar' && (
                            <>
                                <ChevronRight size={14} className="text-slate-400 rotate-90 opacity-50" />
                                <span className="text-lg font-black text-slate-400 tracking-tight">{viewDate.getFullYear()}</span>
                            </>
                        )}
                    </div>

                    {viewMode === 'calendar' && (
                        <button type="button" onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 transition-all active:scale-90">
                            <ChevronRight size={20} />
                        </button>
                    )}
                </div>

                {viewMode === 'calendar' ? (
                    <>
                        {/* Days Header */}
                        <div className="flex justify-between mb-4 px-1">
                            {daysHeader.map(d => (
                                <span key={d} className={`w-9 text-center text-[10px] font-black uppercase tracking-tighter ${d === 'Wk' || d === 'Dom' ? 'text-blue-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {d}
                                </span>
                            ))}
                        </div>

                        {/* Grid */}
                        <div className="mb-6 px-1">
                            {renderDays().map((row, i) => (
                                <div key={i} className="flex justify-between mb-2">
                                    <div className="w-9 h-9 flex items-center justify-center text-[9px] font-black text-blue-500/30">
                                        {5 + i}
                                    </div>
                                    {row.props.children.map((child, j) => (
                                        <div key={j} className="w-9 h-9 flex items-center justify-center">
                                            {React.cloneElement(child, { className: child.props.className.replace('w-10 h-10', 'w-8 h-8') })}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="mb-6">
                        {viewMode === 'month' ? renderMonths() : renderYears()}
                    </div>
                )}

                {/* Time Picker */}
                {!hideTime && (
                    <div className="border-t border-slate-100 dark:border-white/5 pt-6 mb-6">
                        <div className="flex items-center justify-center gap-4">
                            <div className="flex flex-col items-center">
                                <input
                                    type="number"
                                    value={hours.toString().padStart(2, '0')}
                                    onChange={(e) => setHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                                    className="w-14 text-2xl font-black text-slate-900 dark:text-white bg-transparent text-center outline-none focus:text-blue-500 transition-colors"
                                />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Horas</span>
                            </div>
                            <span className="font-black text-slate-300 text-xl mb-4">:</span>
                            <div className="flex flex-col items-center">
                                <input
                                    type="number"
                                    value={minutes.toString().padStart(2, '0')}
                                    onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                    className="w-14 text-2xl font-black text-slate-400 bg-transparent text-center outline-none focus:text-blue-500 transition-colors"
                                />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Minutos</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={handleNow}
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-95"
                    >
                        {hideTime ? 'Hoy' : 'Ahora'}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="flex-[1.2] px-4 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CustomDatePicker;
