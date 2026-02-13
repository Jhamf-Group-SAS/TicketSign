import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, Loader2, Plus } from 'lucide-react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * CustomSelect Component
 * A premium dropdown component designed for the PWA-GLPI application.
 */
const CustomSelect = ({
    value,
    onChange,
    options = [],
    placeholder = "Seleccionar...",
    label,
    icon: Icon,
    withSearch = false,
    className = "",
    disabled = false,
    loading = false,
    error = false,
    menuPlacement = "bottom" // "top" or "bottom"
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    const selectedOption = options.find(opt => opt.id === value || opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = withSearch
        ? options.filter(opt => {
            const name = (opt.name || opt.label || opt.fullName || '').toLowerCase();
            return name.includes(searchTerm.toLowerCase());
        })
        : options;

    return (
        <div className={cn("relative w-full", className)} ref={containerRef}>
            {label && (
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-[0.2em]">
                    {label}
                </label>
            )}

            <div className="relative group">
                <button
                    type="button"
                    disabled={disabled || loading}
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "w-full flex items-center justify-between bg-white dark:bg-slate-900 border rounded-2xl p-4 text-sm transition-all focus:outline-none focus:ring-4 focus:ring-purple-500/10",
                        isOpen ? "border-purple-500/50 ring-4 ring-purple-500/10" : "border-slate-200 dark:border-white/10 hover:border-purple-500/30",
                        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                        error ? "border-red-500/50" : ""
                    )}
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                        {Icon && <Icon size={16} className={cn("shrink-0", isOpen ? "text-purple-500" : "text-slate-400")} />}
                        <span className={cn(
                            "truncate font-bold",
                            selectedOption ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"
                        )}>
                            {selectedOption ? (selectedOption.label || selectedOption.name || selectedOption.fullName) : placeholder}
                        </span>
                    </div>
                    {loading ? (
                        <Loader2 size={16} className="animate-spin text-purple-500 shrink-0 ml-2" />
                    ) : (
                        <ChevronDown
                            size={16}
                            className={cn(
                                "text-slate-400 group-hover:text-purple-500 transition-transform duration-200 shrink-0 ml-2",
                                isOpen ? "rotate-180 text-purple-500" : ""
                            )}
                        />
                    )}
                </button>

                {isOpen && (
                    <div className={cn(
                        "absolute left-0 z-[100] w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 shadow-purple-500/5",
                        menuPlacement === "top" ? "bottom-full mb-2" : "top-full mt-2"
                    )}>
                        {withSearch && (
                            <div className="p-3 border-b border-slate-100 dark:border-white/5">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        autoFocus
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Buscar..."
                                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-bold"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="max-h-[250px] overflow-y-auto p-1.5 no-scrollbar custom-scrollbar">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((opt) => {
                                    const isSelected = (opt.id === value || opt.value === value);
                                    return (
                                        <button
                                            key={opt.id || opt.value}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onChange(opt.id || opt.value);
                                                setIsOpen(false);
                                                setSearchTerm('');
                                            }}
                                            className={cn(
                                                "w-full text-left px-3 py-3 text-xs rounded-xl transition-all flex items-center justify-between font-bold",
                                                isSelected
                                                    ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                                                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                                            )}
                                        >
                                            <span className="truncate">{opt.label || opt.name || opt.fullName}</span>
                                            {isSelected && <Check size={14} />}
                                        </button>
                                    );
                                })
                            ) : (
                                searchTerm ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onChange(searchTerm);
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                        className="w-full text-left px-3 py-3 text-xs rounded-xl text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 font-bold flex items-center gap-2"
                                    >
                                        <Plus size={14} /> Usar "{searchTerm}"
                                    </button>
                                ) : (
                                    <div className="p-4 text-center text-xs text-slate-400 italic font-medium">
                                        No se encontraron resultados
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Native Select Fallback (Hidden) - for Accessibility/Forms if needed */}
            <select
                className="hidden"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            >
                {options.map(opt => (
                    <option key={opt.id || opt.value} value={opt.id || opt.value}>
                        {opt.label || opt.name || opt.fullName}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default CustomSelect;
