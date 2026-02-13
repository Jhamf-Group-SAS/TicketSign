import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Send, CheckCircle2, User, Clock, FileText, Tag, AlertCircle, MapPin, Building2, Layers, Users, Search, ChevronDown, FileUp, ThumbsUp, MessageSquare } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

// Mapas de estados y prioridades para consistencia visual
const STATUS_MAP = {
    1: { label: 'Nuevo', color: 'bg-emerald-500', bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    2: { label: 'Asignado', color: 'bg-blue-500', bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    3: { label: 'Planificado', color: 'bg-cyan-500', bg: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
    4: { label: 'En Espera', color: 'bg-amber-500', bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    5: { label: 'Resuelto', color: 'bg-green-600', bg: 'bg-green-600/10 text-green-600 border-green-600/20' },
    6: { label: 'Cerrado', color: 'bg-slate-500', bg: 'bg-slate-500/10 text-slate-500 border-slate-500/20' }
};

const PRIORITY_MAP = {
    1: { label: 'Muy Baja', bg: 'bg-slate-100 text-slate-500 border-slate-200' },
    2: { label: 'Baja', bg: 'bg-blue-50 text-blue-600 border-blue-100' },
    3: { label: 'Media', bg: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
    4: { label: 'Alta', bg: 'bg-orange-100 text-orange-600 border-orange-200' },
    5: { label: 'Muy Alta', bg: 'bg-red-100 text-red-600 border-red-200' },
    6: { label: 'Mayor', bg: 'bg-rose-500 text-white border-rose-600' }
};

const formatTimeAgo = (date) => {
    if (!date) return '';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'hace unos segundos';
    const intervals = { 'año': 31536000, 'mes': 2592000, 'semana': 604800, 'día': 86400, 'hora': 3600, 'minuto': 60 };
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const count = Math.floor(seconds / secondsInUnit);
        if (count >= 1) {
            let plural = count > 1 ? 's' : '';
            if (unit === 'mes' && count > 1) plural = 'es';
            return `hace ${count} ${unit}${plural}`;
        }
    }
    return date;
};

const TicketDetail = ({ ticketId, onBack }) => {
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [newFollowup, setNewFollowup] = useState('');
    const [isSoluModalOpen, setIsSoluModalOpen] = useState(false);
    const [solutionContent, setSolutionContent] = useState('');
    const [options, setOptions] = useState({ categories: [], locations: [], technicians: [], groups: [], users: [] });
    const [updatingField, setUpdatingField] = useState(null);
    const [openDropdown, setOpenDropdown] = useState(null);
    const [isResponderMenuOpen, setIsResponderMenuOpen] = useState(false);
    const fileInputRef = React.useRef(null);

    const fetchOptions = async () => {
        try {
            const headers = { 'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token') || ''}` };
            const [catRes, locRes, techRes, userRes, groupRes] = await Promise.all([
                fetch(`${API_BASE_URL}/glpi/categories`, { headers }),
                fetch(`${API_BASE_URL}/glpi/locations`, { headers }),
                fetch(`${API_BASE_URL}/glpi/technicians`, { headers }),
                fetch(`${API_BASE_URL}/glpi/users`, { headers }),
                fetch(`${API_BASE_URL}/glpi/groups`, { headers })
            ]);

            const [categoriesRaw, locationsRaw, technicians, users, groups] = await Promise.all([
                catRes.json(), locRes.json(), techRes.json(), userRes.json(), groupRes.json()
            ]);

            const processHierarchy = (items) => {
                const mapped = items.map(item => {
                    const full = item.completename || item.name || '';
                    const parts = full.split(' > ');
                    const depth = parts.length - 1;
                    return {
                        ...item,
                        completename: full,
                        depth,
                        shortName: parts[parts.length - 1]
                    };
                });

                return mapped.map(item => {
                    const isParent = mapped.some(other =>
                        other.completename && other.completename.startsWith(item.completename + ' > ')
                    );
                    return { ...item, isParent };
                }).sort((a, b) => (a.completename || '').localeCompare(b.completename || ''));
            };

            setOptions({
                categories: processHierarchy(categoriesRaw),
                locations: processHierarchy(locationsRaw),
                technicians,
                users,
                groups
            });
        } catch (error) {
            console.error('Error fetching options:', error);
        }
    };

    const fetchTicket = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/glpi/tickets/${ticketId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token') || ''}` } });
            if (!res.ok) throw new Error('Failed to fetch ticket');
            const data = await res.json();
            setTicket(data);
        } catch (error) {
            console.error('Error fetching ticket:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTicket();
        fetchOptions();
    }, [ticketId]);

    const handleUpdateField = async (fieldName, value) => {
        setUpdatingField(fieldName);
        try {
            const res = await fetch(`${API_BASE_URL}/glpi/tickets/${ticketId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token') || ''}`
                },
                body: JSON.stringify({ [fieldName]: value })
            });

            if (!res.ok) throw new Error('Failed to update field');
            await fetchTicket();
        } catch (error) {
            alert('Error al actualizar campo');
        } finally {
            setUpdatingField(null);
        }
    };

    const handleUpdateActor = async (userId, type, isGroup = false) => {
        setUpdatingField('actor');
        try {
            const res = await fetch(`${API_BASE_URL}/glpi/tickets/${ticketId}/actors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token') || ''}`
                },
                body: JSON.stringify({ userId, type, isGroup })
            });

            if (!res.ok) throw new Error('Failed to update actor');
            await fetchTicket();
        } catch (error) {
            alert('Error al actualizar actor');
        } finally {
            setUpdatingField(null);
        }
    };

    const InlineSelect = ({ label, value, options, onChange, icon: Icon, colorClass, fieldName, withSearch = false, fallbackName, layout = 'vertical', badgeStyle }) => {
        const isUpdating = updatingField === fieldName;
        const isOpen = openDropdown === fieldName;
        const [searchTerm, setSearchTerm] = useState('');

        const getDisplayName = () => {
            if (options.length > 0) {
                const found = options.find(opt => opt.id == value);
                if (found) return found.completename || found.name || found.fullName || found.label;
            }
            if (fallbackName && fallbackName.includes(' > ')) {
                const parts = fallbackName.split(' > ');
                return parts[parts.length - 1];
            }
            return fallbackName || 'Seleccionar...';
        };

        const selectedName = getDisplayName();

        const filteredOptions = withSearch
            ? options.filter(opt => {
                const name = (opt.completename || opt.name || opt.fullName || opt.label || '').toLowerCase();
                return name.includes(searchTerm.toLowerCase());
            })
            : options;

        useEffect(() => {
            if (!isOpen) setSearchTerm('');
        }, [isOpen]);

        return (
            <div className={cn("group relative", layout === 'vertical' ? "flex items-center gap-3" : "w-full")}>
                {layout === 'vertical' && (
                    <div className={cn("p-2 rounded-lg transition-colors bg-opacity-10", colorClass?.replace('text-', 'bg-'))}>
                        <Icon size={16} className={colorClass} />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    {layout === 'vertical' && (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                    )}
                    <div className="relative">
                        <button
                            disabled={isUpdating}
                            onClick={() => setOpenDropdown(isOpen ? null : fieldName)}
                            className={cn(
                                "flex items-center justify-between w-full text-xs font-bold py-2.5 px-4 rounded-xl border transition-all focus:outline-none shadow-sm",
                                isOpen ? "border-blue-500/50 ring-4 ring-blue-500/10" : "border-slate-200 dark:border-white/10 hover:border-blue-500/30",
                                isUpdating && "opacity-50",
                                layout === 'horizontal' && "bg-white dark:bg-slate-900"
                            )}
                        >
                            {badgeStyle ? (
                                <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase border", badgeStyle)}>
                                    {selectedName}
                                </span>
                            ) : (
                                <span className="truncate pr-4 text-slate-700 dark:text-slate-200 font-bold">{selectedName}</span>
                            )}
                            <div className="flex items-center gap-2 shrink-0">
                                {isUpdating ? (
                                    <Loader2 size={12} className="animate-spin text-blue-500" />
                                ) : (
                                    <ChevronDown size={14} className={cn("text-slate-400 group-hover:text-blue-500 transition-transform duration-200", isOpen && "rotate-180 text-blue-500")} />
                                )}
                            </div>
                        </button>

                        {isOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-[60]"
                                    onClick={() => setOpenDropdown(null)}
                                />
                                <div className="absolute left-0 top-full mt-2 w-full min-w-[260px] max-h-[400px] flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden shadow-blue-500/5">
                                    {withSearch && (
                                        <div className="p-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                                            <div className="relative">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    placeholder="Buscar..."
                                                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div className="overflow-y-auto no-scrollbar p-1.5 custom-scrollbar">
                                        {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                                            <button
                                                key={opt.id}
                                                disabled={opt.isParent}
                                                onClick={(e) => {
                                                    if (opt.isParent) return;
                                                    e.stopPropagation();
                                                    onChange(opt.id);
                                                    setOpenDropdown(null);
                                                }}
                                                className={cn(
                                                    "w-full text-left px-3 py-2.5 text-xs rounded-xl transition-all flex flex-col font-bold",
                                                    opt.isParent
                                                        ? "cursor-default opacity-80"
                                                        : "cursor-pointer",
                                                    opt.id == value
                                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40"
                                                        : opt.isParent
                                                            ? "text-slate-400 dark:text-slate-500 font-bold bg-slate-50/30 dark:bg-white/5 mt-1 pointer-events-none"
                                                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                                                )}
                                                style={{
                                                    paddingLeft: opt.depth ? `${(opt.depth * 10) + 12}px` : '12px'
                                                }}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {opt.depth > 0 && <span className="opacity-30 text-[10px]">└</span>}
                                                    <span className="truncate">{opt.shortName || opt.name || opt.fullName || opt.label}</span>
                                                </span>
                                                {opt.depth > 0 && opt.id != value && !opt.isParent && (
                                                    <span className="text-[9px] opacity-40 ml-4 truncate font-medium">
                                                        {opt.completename.split(' > ').slice(0, -1).join(' > ')}
                                                    </span>
                                                )}
                                            </button>
                                        )) : (
                                            <div className="p-4 text-center text-xs text-slate-400 italic">No se encontraron resultados</div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const handleAddFollowup = async (e) => {
        e.preventDefault();
        if (!newFollowup.trim()) return;
        setSending(true);
        try {
            const res = await fetch(`${API_BASE_URL}/glpi/tickets/${ticketId}/followup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token') || ''}`
                },
                body: JSON.stringify({ content: newFollowup })
            });
            if (!res.ok) throw new Error('Failed to add followup');

            setNewFollowup('');
            fetchTicket(); // Refresh timeline
        } catch (error) {
            alert('Error al enviar respuesta');
        } finally {
            setSending(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSending(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_BASE_URL}/glpi/tickets/${ticketId}/document`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token') || ''}`
                },
                body: formData
            });

            if (!res.ok) throw new Error('Failed to upload document');
            alert('Documento subido correctamente');
            fetchTicket();
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Error al subir el documento');
        } finally {
            setSending(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRequestApproval = async () => {
        alert('Funcionalidad de solicitud de aprobación en desarrollo');
    };

    const handleSolve = async () => {
        if (!solutionContent.trim()) return;
        setSending(true);
        try {
            const res = await fetch(`${API_BASE_URL}/glpi/tickets/${ticketId}/solution`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token') || ''}`
                },
                body: JSON.stringify({ content: solutionContent })
            });
            if (!res.ok) throw new Error('Failed to add solution');

            setIsSoluModalOpen(false);
            setSolutionContent('');
            fetchTicket();
        } catch (error) {
            alert('Error al solucionar ticket');
        } finally {
            setSending(false);
        }
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
            <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
        </div>
    );

    if (!ticket) return (
        <div className="flex h-screen items-center justify-center">
            <p>Ticket no encontrado</p>
            <button onClick={onBack} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Volver</button>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100dvh-130px)] sm:h-[calc(100dvh-150px)] bg-slate-50 dark:bg-slate-950 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/5 shadow-2xl relative">
            {/* Header */}
            <div className="z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5 p-4 flex items-center gap-4 shadow-sm shrink-0">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors">
                    <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">#{ticket.id}</span>
                        <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border",
                            ticket.type === 2 ? "bg-purple-500/10 text-purple-500 border-purple-500/20" : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                        )}>
                            {ticket.type === 2 ? 'Petición' : 'Incidencia'}
                        </span>
                        <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border",
                            ticket.status === 5 ? "bg-green-500/10 text-green-600 border-green-500/20" :
                                ticket.status === 6 ? "bg-slate-500/10 text-slate-500 border-slate-500/20" :
                                    "bg-blue-500/10 text-blue-500 border-blue-500/20"
                        )}>
                            Status: {typeof ticket.status === 'object' ? ticket.status.name : (
                                ticket.status == 1 ? 'Nuevo' :
                                    ticket.status == 2 ? 'Asignado' :
                                        ticket.status == 3 ? 'Planificado' :
                                            ticket.status == 4 ? 'En espera' :
                                                ticket.status == 5 ? 'Solucionado' :
                                                    ticket.status == 6 ? 'Cerrado' : ticket.status
                            )}
                        </span>
                    </div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate" title={ticket.name}>{ticket.name}</h1>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50">
                <div className="max-w-[1400px] mx-auto p-4 sm:p-6 flex flex-col gap-6 lg:flex-row lg:gap-8">

                    {/* Left Column: Description & Timeline */}
                    <div className="order-2 lg:order-1 lg:flex-1 space-y-6">

                        {/* Main Description (Green Bubble with Tail) */}
                        <div className="flex gap-1 items-start group">
                            <div className="w-10 h-10 rounded-md bg-rose-400 flex items-center justify-center shrink-0 shadow-sm" title={ticket.requester_name}>
                                <span className="text-xs font-black text-white">
                                    {getInitials(ticket.requester_name)}
                                </span>
                            </div>

                            <div className="flex-1 relative ml-2">
                                {/* Tail */}
                                <div className="absolute top-3 -left-2 w-0 h-0 border-t-[8px] border-t-transparent border-r-[8px] border-r-emerald-100 border-b-[8px] border-b-transparent" />

                                <div className="bg-emerald-50/80 dark:bg-emerald-500/5 rounded-xl border border-emerald-200 dark:border-emerald-500/20 shadow-sm overflow-hidden">
                                    <div className="px-3 py-1.5 bg-emerald-100/40 dark:bg-emerald-500/10 border-b border-emerald-200/50 dark:border-emerald-500/10 flex flex-wrap gap-2 items-center">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/60 dark:bg-black/20 rounded border border-emerald-200/40 text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
                                            Creado: <Clock size={10} className="ml-1" /> {formatTimeAgo(ticket.date)} por <User size={10} className="ml-1" /> {ticket.requester_name || 'Solicitante'}
                                        </div>
                                        {ticket.date_mod && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/60 dark:bg-black/20 rounded border border-emerald-200/40 text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
                                                Última actualización: <Clock size={10} className="ml-1" /> {formatTimeAgo(ticket.date_mod)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-100 mb-2 leading-tight">{ticket.name}</h3>
                                        <div
                                            className="prose prose-sm dark:prose-invert max-w-none text-emerald-800/90 dark:text-emerald-200/80 leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: ticket.content }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Timeline / Activities (Chat Bubble Format with Tail) */}
                        <div className="space-y-4 pt-2">
                            {ticket.timeline?.map((item, index) => {
                                const userName = item.users_id_name || (typeof item.users_id === 'object' ? (item.users_id.fullName || item.users_id.name) : item.users_id) || 'System';
                                const isSolution = item.type === 'solution';

                                return (
                                    <div key={index} className="flex gap-1 items-start group">
                                        <div className={cn(
                                            "w-10 h-10 rounded-md flex items-center justify-center shrink-0 shadow-sm border transition-colors",
                                            isSolution ? "bg-emerald-400 border-emerald-500" : "bg-purple-500 border-purple-600"
                                        )}>
                                            <span className="text-xs font-black text-white">
                                                {getInitials(userName)}
                                            </span>
                                        </div>

                                        <div className="flex-1 relative ml-2">
                                            {/* Tail */}
                                            <div className={cn(
                                                "absolute top-3 -left-2 w-0 h-0 border-t-[8px] border-t-transparent border-r-[8px] border-b-[8px] border-b-transparent",
                                                isSolution ? "border-r-emerald-50" : "border-r-slate-100"
                                            )} />

                                            <div className={cn("rounded-xl border shadow-sm transition-all hover:shadow-md overflow-hidden",
                                                isSolution
                                                    ? "bg-emerald-50/80 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20"
                                                    : "bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-white/10"
                                            )}>
                                                <div className={cn("px-3 py-1.5 border-b flex flex-wrap gap-2 items-center",
                                                    isSolution
                                                        ? "bg-emerald-100/40 dark:bg-emerald-500/10 border-emerald-200/50"
                                                        : "bg-slate-200/30 dark:bg-white/5 border-slate-200/50"
                                                )}>
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/60 dark:bg-black/20 rounded border border-slate-200/40 text-[9px] font-bold text-slate-500 dark:text-slate-400">
                                                        <Clock size={10} /> {formatTimeAgo(item.date_creation)} por {userName}
                                                    </div>
                                                    {isSolution && (
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded">Solución</span>
                                                    )}
                                                </div>
                                                <div className="p-4">
                                                    <div
                                                        className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                                                        dangerouslySetInnerHTML={{ __html: item.content }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Column: Information Panel */}
                    <div className="order-1 lg:order-2 lg:w-[400px] mt-0 space-y-6">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6 sticky top-6">
                            <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-white/5 pb-4">
                                <AlertCircle size={16} className="text-blue-500" />
                                <h2 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Información de la {ticket.type === 2 ? 'Petición' : 'Incidencia'}</h2>
                            </div>

                            <div className="space-y-5">
                                {/* Entidad */}
                                <div className="flex items-center">
                                    <span className="w-24 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Entidad</span>
                                    <div className="flex-1 min-w-0 flex items-center px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200/50 dark:border-white/5">
                                        <Building2 size={12} className="text-slate-400 mr-2" />
                                        <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                                            {typeof ticket.entities_id === 'object' ? ticket.entities_id.name : (ticket.entities_id || 'N/A')}
                                        </span>
                                    </div>
                                </div>

                                {/* Tipo */}
                                <div className="flex items-center">
                                    <span className="w-24 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tipo</span>
                                    <div className="flex-1 min-w-0">
                                        <InlineSelect
                                            fieldName="type"
                                            value={ticket.type}
                                            options={[{ id: 1, name: 'Incidencia' }, { id: 2, name: 'Petición' }]}
                                            onChange={(val) => handleUpdateField('type', val)}
                                            icon={FileText}
                                            colorClass="text-indigo-500"
                                            layout="horizontal"
                                        />
                                    </div>
                                </div>

                                {/* Categoría */}
                                <div className="flex items-center">
                                    <span className="w-24 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Categoría <span className="text-red-500">*</span></span>
                                    <div className="flex-1 min-w-0">
                                        <InlineSelect
                                            fieldName="itilcategories_id"
                                            value={typeof ticket.itilcategories_id === 'object' ? ticket.itilcategories_id.id : ticket.itilcategories_id}
                                            options={options.categories}
                                            onChange={(val) => handleUpdateField('itilcategories_id', val)}
                                            icon={Layers}
                                            colorClass="text-purple-500"
                                            withSearch={true}
                                            fallbackName={ticket.category_name || (typeof ticket.itilcategories_id === 'object' ? (ticket.itilcategories_id.completename || ticket.itilcategories_id.name) : null) || 'Seleccionar...'}
                                            layout="horizontal"
                                        />
                                    </div>
                                </div>

                                {/* Estado */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center">
                                        <span className="w-24 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estado</span>
                                        <div className="flex-1 min-w-0">
                                            <InlineSelect
                                                fieldName="status"
                                                value={typeof ticket.status === 'object' ? ticket.status.id : ticket.status}
                                                options={[{ id: 1, name: 'Nuevo' }, { id: 2, name: 'Asignado' }, { id: 3, name: 'Planificado' }, { id: 4, name: 'En espera' }, { id: 5, name: 'Solucionado' }, { id: 6, name: 'Cerrado' }]}
                                                onChange={(val) => handleUpdateField('status', val)}
                                                icon={Tag}
                                                colorClass="text-emerald-500"
                                                layout="horizontal"
                                                badgeStyle={STATUS_MAP[typeof ticket.status === 'object' ? ticket.status.id : ticket.status]?.bg}
                                            />
                                        </div>
                                    </div>
                                    {/* Sub-status box from screenshot */}
                                    <div className="ml-24 flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-500/20 text-[10px] font-black">
                                        <CheckCircle2 size={12} />
                                        <span>EN ESPERA: {ticket.status_desc || 'SISTEMA'}</span>
                                        <div className="ml-auto w-2 h-2 bg-blue-500 rounded-sm" />
                                    </div>
                                </div>

                                {/* Prioridad */}
                                <div className="flex items-center">
                                    <span className="w-24 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Prioridad <span className="text-red-500">*</span></span>
                                    <div className="flex-1 min-w-0">
                                        <InlineSelect
                                            fieldName="priority"
                                            value={typeof ticket.priority === 'object' ? ticket.priority.id : ticket.priority}
                                            options={[{ id: 1, name: 'Muy baja' }, { id: 2, name: 'Baja' }, { id: 3, name: 'Media' }, { id: 4, name: 'Alta' }, { id: 5, name: 'Muy alta' }, { id: 6, name: 'Mayor' }]}
                                            onChange={(val) => handleUpdateField('priority', val)}
                                            icon={AlertCircle}
                                            colorClass="text-rose-500"
                                            layout="horizontal"
                                            badgeStyle={PRIORITY_MAP[typeof ticket.priority === 'object' ? ticket.priority.id : ticket.priority]?.bg}
                                        />
                                    </div>
                                </div>

                                {/* Ubicaciones */}
                                <div className="flex items-center">
                                    <span className="w-24 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ubicación <span className="text-red-500">*</span></span>
                                    <div className="flex-1 min-w-0">
                                        <InlineSelect
                                            fieldName="locations_id"
                                            value={typeof ticket.locations_id === 'object' ? ticket.locations_id.id : ticket.locations_id}
                                            options={[{ id: 0, name: 'No especificada' }, ...options.locations]}
                                            onChange={(val) => handleUpdateField('locations_id', val)}
                                            icon={MapPin}
                                            colorClass="text-amber-500"
                                            withSearch={true}
                                            fallbackName={ticket.location_name || ticket.locations_id?.completename || ticket.locations_id?.name || 'Seleccionar...'}
                                            layout="horizontal"
                                        />
                                    </div>
                                </div>

                                {/* Asignada a */}
                                <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Actores</h3>
                                        <Users size={14} className="text-slate-400" />
                                    </div>

                                    <div className="space-y-4">
                                        {/* Solicitante */}
                                        <div className="relative">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Solicitante</p>
                                            <button
                                                disabled={updatingField === 'requester'}
                                                onClick={() => setOpenDropdown(openDropdown === 'requester' ? null : 'requester')}
                                                className={cn(
                                                    "flex items-center gap-3 w-full p-2 rounded-xl border transition-all text-left group",
                                                    openDropdown === 'requester' ? "border-blue-500 ring-2 ring-blue-500/20 shadow-sm" : "border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/5",
                                                    updatingField === 'requester' && "opacity-50"
                                                )}
                                            >
                                                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                                    <User size={16} className="text-blue-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                                        {ticket.requester_name || 'Sin solicitante'}
                                                    </p>
                                                </div>
                                                {updatingField === 'requester' ? (
                                                    <Loader2 size={12} className="animate-spin text-blue-500" />
                                                ) : (
                                                    <ChevronDown size={14} className={cn("text-slate-400 group-hover:text-blue-500 transition-transform duration-200", openDropdown === 'requester' && "rotate-180 text-blue-500")} />
                                                )}
                                            </button>

                                            {openDropdown === 'requester' && (
                                                <>
                                                    <div className="fixed inset-0 z-30" onClick={() => setOpenDropdown(null)} />
                                                    <div className="absolute left-0 top-full mt-2 w-full min-w-[260px] max-h-[350px] flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden shadow-blue-500/5">
                                                        <div className="p-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                                                            <div className="relative">
                                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    placeholder="Buscar usuario..."
                                                                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold"
                                                                    onChange={(e) => {
                                                                        const term = e.target.value.toLowerCase();
                                                                        const btns = e.target.closest('.absolute').querySelectorAll('.user-btn');
                                                                        btns.forEach(btn => {
                                                                            btn.style.display = btn.innerText.toLowerCase().includes(term) ? 'block' : 'none';
                                                                        });
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="overflow-y-auto no-scrollbar p-1.5 custom-scrollbar">
                                                            {(options.users || []).length > 0 ? (options.users || []).map(u => (
                                                                <button
                                                                    key={u.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleUpdateActor(u.id, 1);
                                                                        setOpenDropdown(null);
                                                                    }}
                                                                    className={cn(
                                                                        "user-btn w-full text-left px-3 py-2.5 text-xs rounded-xl transition-all font-bold",
                                                                        ticket.requester_name === u.fullName
                                                                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40"
                                                                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                                                                    )}
                                                                >
                                                                    {u.fullName || u.name}
                                                                </button>
                                                            )) : (
                                                                <div className="p-4 text-center text-xs text-slate-400 italic">No hay usuarios disponibles</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Asignada a */}
                                        <div className="relative">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Asignada a</p>
                                            <button
                                                disabled={updatingField === 'actor'}
                                                onClick={() => setOpenDropdown(openDropdown === 'actor' ? null : 'actor')}
                                                className={cn(
                                                    "flex items-center gap-3 w-full p-2 rounded-xl border transition-all text-left group",
                                                    openDropdown === 'actor' ? "border-blue-500 ring-2 ring-blue-500/20 shadow-sm" : "border-slate-200 dark:border-white/5",
                                                    updatingField === 'actor' && "opacity-50"
                                                )}
                                            >
                                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                                    {ticket.groupActors?.some(a => a.type == 2) ? (
                                                        <Users size={16} className="text-emerald-600" />
                                                    ) : (
                                                        <User size={16} className="text-emerald-600" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                                        {ticket.technician_name || 'Sin asignar'}
                                                    </p>
                                                </div>
                                                {updatingField === 'actor' ? (
                                                    <Loader2 size={12} className="animate-spin text-blue-500" />
                                                ) : (
                                                    <ChevronDown size={14} className={cn("text-slate-400 group-hover:text-emerald-500 transition-transform duration-200", openDropdown === 'actor' && "rotate-180 text-emerald-500")} />
                                                )}
                                            </button>

                                            {openDropdown === 'actor' && (
                                                <>
                                                    <div className="fixed inset-0 z-30" onClick={() => setOpenDropdown(null)} />
                                                    <div className="absolute left-0 bottom-full mb-2 w-full min-w-[260px] max-h-[350px] flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden shadow-emerald-500/5">
                                                        <div className="p-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                                                            <div className="relative">
                                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    placeholder="Buscar técnico..."
                                                                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-bold"
                                                                    onChange={(e) => {
                                                                        const term = e.target.value.toLowerCase();
                                                                        const btns = e.target.closest('.absolute').querySelectorAll('.tech-btn');
                                                                        btns.forEach(btn => {
                                                                            btn.style.display = btn.innerText.toLowerCase().includes(term) ? 'block' : 'none';
                                                                        });
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="overflow-y-auto no-scrollbar p-1.5 custom-scrollbar">
                                                            {/* Usuarios Técnicos */}
                                                            {options.technicians.length > 0 && options.technicians.map(tech => (
                                                                <button
                                                                    key={`user-${tech.id}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleUpdateActor(tech.id, 2, false);
                                                                        setOpenDropdown(null);
                                                                    }}
                                                                    className={cn(
                                                                        "tech-btn w-full text-left px-3 py-2.5 text-xs rounded-xl transition-all flex items-center gap-2 font-bold",
                                                                        ticket.actors?.some(a => a.type == 2 && a.users_id && (a.users_id.id == tech.id || a.users_id == tech.id))
                                                                            ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/40"
                                                                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                                                                    )}
                                                                >
                                                                    <User size={12} className="opacity-40" />
                                                                    {tech.fullName || tech.name}
                                                                </button>
                                                            ))}

                                                            {/* Grupos */}
                                                            {options.groups && options.groups.length > 0 && (
                                                                <>
                                                                    <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 dark:border-white/5 mt-1 bg-slate-50/50 dark:bg-white/5">Grupos</div>
                                                                    {options.groups.map(group => (
                                                                        <button
                                                                            key={`group-${group.id}`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleUpdateActor(group.id, 2, true);
                                                                                setOpenDropdown(null);
                                                                            }}
                                                                            className={cn(
                                                                                "tech-btn w-full text-left px-3 py-2.5 text-xs rounded-xl transition-all flex items-center gap-2 font-bold",
                                                                                ticket.actors?.some(a => a.type == 2 && a.groups_id && (a.groups_id.id == group.id || a.groups_id == group.id))
                                                                                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/40"
                                                                                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                                                                            )}
                                                                        >
                                                                            <Users size={12} className="opacity-40" />
                                                                            {group.fullName || group.name}
                                                                        </button>
                                                                    ))}
                                                                </>
                                                            )}

                                                            {options.technicians.length === 0 && (!options.groups || options.groups.length === 0) && (
                                                                <div className="p-4 text-center text-xs text-slate-400 italic">No hay resultados</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/5 z-20 shrink-0">
                <form onSubmit={handleAddFollowup} className="flex gap-2 max-w-4xl mx-auto items-center">
                    <input
                        type="text"
                        value={newFollowup}
                        onChange={(e) => setNewFollowup(e.target.value)}
                        placeholder="Escribe una respuesta o seguimiento..."
                        className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all text-sm"
                    />

                    <div className="relative flex h-[46px]">
                        {/* Responder Button Partitioned */}
                        <button
                            type="submit"
                            disabled={sending || !newFollowup.trim()}
                            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold px-3 sm:px-5 rounded-l-xl transition-all active:scale-[0.98] border-r border-amber-600/20 whitespace-nowrap"
                        >
                            {sending ? <Loader2 size={18} className="animate-spin" /> : <MessageSquare size={18} />}
                            <span className="hidden sm:inline">Responder</span>
                        </button>

                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsResponderMenuOpen(!isResponderMenuOpen);
                            }}
                            className="bg-amber-500 hover:bg-amber-600 text-slate-900 px-2 sm:px-3 rounded-r-xl transition-all active:scale-[0.98] flex items-center justify-center"
                        >
                            <ChevronDown size={18} className={cn("transition-transform duration-200", isResponderMenuOpen && "rotate-180")} />
                        </button>

                        {/* Responder Menu Dropdown */}
                        {isResponderMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setIsResponderMenuOpen(false)} />
                                <div className="absolute right-0 bottom-full mb-3 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-40 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsSoluModalOpen(true);
                                            setIsResponderMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-4 px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors border-b border-slate-100 dark:border-white/5 group"
                                    >
                                        <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 group-hover:scale-110 transition-transform">
                                            <CheckCircle2 size={18} />
                                        </div>
                                        <span>Añade una solución</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            fileInputRef.current?.click();
                                            setIsResponderMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-4 px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors border-b border-slate-100 dark:border-white/5 group"
                                    >
                                        <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 group-hover:scale-110 transition-transform">
                                            <FileUp size={18} />
                                        </div>
                                        <span>Añadir un documento</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleRequestApproval();
                                            setIsResponderMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-4 px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors group"
                                    >
                                        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 group-hover:scale-110 transition-transform">
                                            <ThumbsUp size={18} />
                                        </div>
                                        <span>Solicitar aprobación</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </form>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                />
            </div>

            {/* Solution Modal Portal */}
            {isSoluModalOpen && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 border border-slate-200 dark:border-white/10">
                        <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">Solucionar Ticket</h2>
                        <textarea
                            value={solutionContent}
                            onChange={(e) => setSolutionContent(e.target.value)}
                            placeholder="Describe la solución aplicada..."
                            className="w-full h-32 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 resize-none focus:outline-none focus:ring-2 focus:ring-green-500/50 text-sm mb-4"
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsSoluModalOpen(false)}
                                className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-sm font-bold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSolve}
                                disabled={sending || !solutionContent.trim()}
                                className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-green-500/20 transition-all active:scale-95 flex items-center gap-2"
                            >
                                {sending && <Loader2 size={14} className="animate-spin" />}
                                Confirmar Solución
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default TicketDetail;
