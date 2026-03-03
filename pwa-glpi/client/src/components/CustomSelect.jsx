import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, Loader2, Plus } from 'lucide-react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * CustomSelect Component
 * Design System implementation: 40px height, 8px radius, f8fafc bg.
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
    menuPlacement = "bottom"
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    const selectedOption = options.find(opt => opt.id === value || opt.value === value || opt.entityName === value);

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
            const name = (opt.name || opt.label || opt.fullName || opt.entityName || '').toLowerCase();
            return name.includes(searchTerm.toLowerCase());
        })
        : options;

    return (
        <div className={cn("relative w-full", className)} ref={containerRef}>
            {label && (
                <label className="text-[12px] font-[600] text-text-primary block ml-1 mb-2.5 uppercase tracking-wide">
                    {label}
                </label>
            )}

            <div className="relative group">
                <button
                    type="button"
                    disabled={disabled || loading}
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "w-full flex items-center justify-between h-[44px] px-[16px] bg-primary border border-color rounded-[12px] text-[13px] outline-none transition-all shadow-sm",
                        isOpen ? "border-primary-500 bg-secondary ring-4 ring-primary-500/10" : "hover:border-primary-500/40 hover:bg-tertiary",
                        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                        error ? "border-red-500" : ""
                    )}
                >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        {Icon && <Icon size={16} className={cn("shrink-0", isOpen ? "text-primary-500" : "text-text-muted")} />}
                        <span className={cn(
                            "truncate font-[500]",
                            selectedOption ? "text-text-primary" : "text-text-muted/60"
                        )}>
                            {selectedOption ? (selectedOption.label || selectedOption.name || selectedOption.fullName || selectedOption.entityName) : placeholder}
                        </span>
                    </div>
                    {loading ? (
                        <Loader2 size={16} className="animate-spin text-primary-500 shrink-0 ml-2" />
                    ) : (
                        <ChevronDown
                            size={16}
                            className={cn(
                                "text-text-muted transition-transform duration-200 shrink-0 ml-2",
                                isOpen ? "rotate-180 text-primary-500" : ""
                            )}
                        />
                    )}
                </button>

                {isOpen && (
                    <div className={cn(
                        "absolute left-0 z-[110] w-full bg-secondary border border-color rounded-[12px] shadow-2xl mt-1 animate-in fade-in zoom-in-95 duration-200 overflow-hidden",
                        menuPlacement === "top" ? "bottom-full mb-1" : "top-full"
                    )}>
                        {withSearch && (
                            <div className="p-2 border-b border-color">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <input
                                        autoFocus
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Buscar..."
                                        className="w-full pl-9 pr-3 h-[32px] text-[12px] bg-tertiary border border-color rounded-md focus:outline-none focus:border-primary-500 focus:bg-secondary transition-all text-text-primary"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="max-h-[250px] overflow-y-auto p-1.5 no-scrollbar">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((opt) => {
                                    const isSelected = (opt.id === value || opt.value === value || opt.entityName === value);
                                    return (
                                        <button
                                            key={opt.id || opt.value || opt.entityName}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onChange(opt.id || opt.value || opt.entityName);
                                                setIsOpen(false);
                                                setSearchTerm('');
                                            }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-[13px] rounded-[6px] transition-all flex items-center justify-between font-[500]",
                                                isSelected
                                                    ? "bg-primary-500/10 text-primary-500 font-bold"
                                                    : "text-text-secondary hover:bg-tertiary"
                                            )}
                                        >
                                            <span className="truncate">{opt.label || opt.name || opt.fullName || opt.entityName}</span>
                                            {isSelected && <Check size={14} className="text-primary-500" />}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="p-4 text-center text-[12px] text-[#94a3b8] italic">
                                    No hay resultados
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomSelect;
