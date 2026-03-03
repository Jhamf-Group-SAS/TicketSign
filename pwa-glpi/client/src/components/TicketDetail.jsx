import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Send, CheckCircle2, User, Clock, FileText, Tag, AlertCircle, MapPin, Building2, Layers, Users, Search, ChevronDown, FileUp, ThumbsUp, MessageSquare } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

const sanitizeHTML = (html) => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const allowedTags = ['P', 'BR', 'STRONG', 'B', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'SPAN', 'DIV', 'H1', 'H2', 'H3', 'A', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD'];

    const sanitize = (node) => {
        // Eliminar scripts, iframes, etc
        if (node.nodeType === 1 && !allowedTags.includes(node.tagName)) {
            const text = node.textContent;
            node.replaceWith(document.createTextNode(text));
            return;
        }

        // Eliminar atributos on* (XSS)
        if (node.attributes) {
            Array.from(node.attributes).forEach(attr => {
                if (attr.name.startsWith('on') || attr.name === 'style' || (attr.name === 'href' && attr.value.startsWith('javascript:'))) {
                    node.removeAttribute(attr.name);
                }
            });
        }

        // Recursivo
        Array.from(node.childNodes).forEach(sanitize);
    };

    sanitize(doc.body);
    return doc.body.innerHTML;
};

// Mapas de estados y prioridades para consistencia visual
const STATUS_MAP = {
    1: { label: 'Nuevo', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    2: { label: 'Asignado', color: 'text-primary-500', bg: 'bg-primary-500/10 border-primary-500/20' },
    3: { label: 'Planificado', color: 'text-primary-500', bg: 'bg-primary-500/10 border-primary-500/20' },
    4: { label: 'En Espera', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
    5: { label: 'Resuelto', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    6: { label: 'Cerrado', color: 'text-text-muted', bg: 'bg-tertiary border-color' }
};

const PRIORITY_MAP = {
    1: { label: 'Muy Baja', bg: 'bg-secondary text-slate-500 border-slate-500' },
    2: { label: 'Baja', bg: 'bg-secondary text-blue-500 border-blue-500' },
    3: { label: 'Media', bg: 'bg-secondary text-amber-500 border-amber-500' },
    4: { label: 'Alta', bg: 'bg-secondary text-orange-500 border-orange-500' },
    5: { label: 'Muy Alta', bg: 'bg-secondary text-red-500 border-red-500' },
    6: { label: 'Mayor', bg: 'bg-rose-500 text-white border-rose-600 shadow-lg shadow-rose-500/20' }
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
            // error options
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
            // error ticket
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
                    <div className={cn("p-2 rounded-lg transition-colors bg-secondary border border-color")}>
                        <Icon size={16} className={colorClass} />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    {layout === 'vertical' && (
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{label}</p>
                    )}
                    <div className="relative">
                        <button
                            disabled={isUpdating}
                            onClick={() => setOpenDropdown(isOpen ? null : fieldName)}
                            className={cn(
                                "flex items-center justify-between w-full text-xs font-bold py-2 px-3 rounded-xl border transition-all focus:outline-none shadow-sm",
                                isOpen ? "border-primary-500 ring-2 ring-primary-500" : "border-color bg-tertiary hover:border-primary-500",
                                isUpdating && "opacity-50",
                                layout === 'horizontal' && "bg-secondary"
                            )}
                        >
                            {badgeStyle ? (
                                <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase border", badgeStyle)}>
                                    {selectedName}
                                </span>
                            ) : (
                                <span className="truncate pr-4 text-text-primary font-bold">{selectedName}</span>
                            )}
                            <div className="flex items-center gap-2 shrink-0">
                                {isUpdating ? (
                                    <Loader2 size={12} className="animate-spin text-primary-500" />
                                ) : (
                                    <ChevronDown size={14} className={cn("text-text-muted group-hover:text-primary-500 transition-transform duration-200", isOpen && "rotate-180 text-primary-500")} />
                                )}
                            </div>
                        </button>

                        {isOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-[60]"
                                    onClick={() => setOpenDropdown(null)}
                                />
                                <div className="absolute left-0 top-full mt-2 w-full min-w-[280px] max-h-[400px] flex flex-col bg-secondary border border-color rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                                    {withSearch && (
                                        <div className="p-3 border-b border-color bg-tertiary">
                                            <div className="relative">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    placeholder="Buscar..."
                                                    className="w-full pl-9 pr-3 py-2 text-xs bg-secondary border border-color rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all font-bold shadow-sm"
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
                                                        ? "bg-primary-500 text-white shadow-lg"
                                                        : opt.isParent
                                                            ? "text-text-muted font-bold bg-tertiary mt-1 pointer-events-none"
                                                            : "text-text-secondary hover:bg-tertiary"
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
                                            <div className="p-4 text-center text-xs text-text-muted italic">No se encontraron resultados</div>
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
            // error upload
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
        <div className="flex h-screen items-center justify-center bg-primary">
            <Loader2 className="animate-spin text-primary-500 w-8 h-8" />
        </div>
    );

    if (!ticket) return (
        <div className="flex h-screen items-center justify-center bg-primary">
            <div className="text-center">
                <AlertCircle className="mx-auto text-text-muted mb-3" size={48} />
                <p className="text-text-primary font-bold">Ticket no encontrado</p>
                <button onClick={onBack} className="mt-4 px-6 py-2 bg-primary-500 text-white rounded-xl font-bold">Volver</button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-theme(spacing.32))] bg-primary overflow-hidden rounded-[12px] border border-color shadow-sm relative animate-in fade-in duration-500">
            <div className="z-20 bg-secondary border-b border-color p-5 flex items-center gap-5 shrink-0 shadow-sm">
                <button onClick={onBack} className="w-10 h-10 flex items-center justify-center hover:bg-tertiary border border-color rounded-xl text-text-muted transition-all">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-[10px] font-[700] text-[#0695c4] bg-[#e0f4fc] px-2 py-0.5 rounded-md border border-[#bae6fd] uppercase tracking-wide">#{ticket.id}</span>
                        <span className={cn("text-[10px] font-[700] uppercase tracking-wide px-2 py-0.5 rounded-md border",
                            ticket.type === 2 ? "bg-[#f5f3ff] text-[#8b5cf6] border-[#ddd6fe]" : "bg-[#fff7ed] text-[#f97316] border-[#fed7aa]"
                        )}>
                            {ticket.type === 2 ? 'Petición' : 'Incidencia'}
                        </span>
                        <div className={cn("flex items-center gap-2 px-2 py-0.5 rounded-md border text-[10px] font-[700] uppercase tracking-wide",
                            STATUS_MAP[typeof ticket.status === 'object' ? ticket.status.id : ticket.status]?.bg || "bg-slate-50 border-slate-200 text-slate-500"
                        )}>
                            {typeof ticket.status === 'object' ? ticket.status.name : (
                                ticket.status == 1 ? 'Nuevo' :
                                    ticket.status == 2 ? 'Asignado' :
                                        ticket.status == 3 ? 'Planificado' :
                                            ticket.status == 4 ? 'En espera' :
                                                ticket.status == 5 ? 'Solucionado' :
                                                    ticket.status == 6 ? 'Cerrado' : ticket.status
                            )}
                        </div>
                    </div>
                    <h1 className="text-[17px] font-[700] text-[#1e293b] truncate uppercase tracking-tight" title={ticket.name}>{ticket.name}</h1>
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto bg-primary">
                <div className="max-w-[1400px] mx-auto p-4 sm:p-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:h-full">

                    {/* Left Column: Description & Timeline */}
                    <div className="order-2 lg:order-1 lg:flex-1 space-y-6">

                        {/* Main Description (Premium Bubble) */}
                        <div className="flex gap-4 items-start group">
                            <div className="w-12 h-12 rounded-[1rem] bg-secondary flex items-center justify-center shrink-0 shadow-lg border border-color" title={ticket.requester_name}>
                                <span className="text-sm font-black text-primary-500">
                                    {getInitials(ticket.requester_name)}
                                </span>
                            </div>

                            <div className="flex-1 relative">
                                <div className="bg-secondary rounded-[12px] border border-color shadow-sm overflow-hidden group-hover:border-primary-500 transition-all">
                                    <div className="px-5 py-2.5 bg-tertiary border-b border-color flex flex-wrap gap-3 items-center">
                                        <div className="flex items-center gap-2 px-3 py-1 bg-tertiary rounded-lg border border-color text-[10px] font-black text-text-muted uppercase tracking-widest">
                                            <Clock size={12} className="text-primary-500" /> {formatTimeAgo(ticket.date)}
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1 bg-tertiary rounded-lg border border-color text-[10px] font-black text-text-muted uppercase tracking-widest">
                                            <User size={12} className="text-primary-500" /> {ticket.requester_name || 'Solicitante'}
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <h3 className="text-lg font-black text-text-primary mb-4 leading-tight uppercase tracking-tighter">{ticket.name}</h3>
                                        <div
                                            className="prose prose-sm dark:prose-invert max-w-none text-text-secondary leading-relaxed font-medium italic opacity-90"
                                            dangerouslySetInnerHTML={{ __html: sanitizeHTML(ticket.content) }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Timeline / Activities (Premium Chat Bubble Format) */}
                        <div className="space-y-8 pt-4">
                            {ticket.timeline?.map((item, index) => {
                                const userName = item.users_id_name || (typeof item.users_id === 'object' ? (item.users_id.fullName || item.users_id.name) : item.users_id) || 'System';
                                const isSolution = item.type === 'solution';

                                return (
                                    <div key={index} className="flex gap-4 items-start group">
                                        <div className={cn(
                                            "w-12 h-12 rounded-[1rem] flex items-center justify-center shrink-0 shadow-lg border transition-all duration-500 group-hover:scale-105",
                                            isSolution
                                                ? "bg-emerald-500 border-emerald-400"
                                                : "bg-tertiary border-color shadow-sm"
                                        )}>
                                            <span className={cn("text-xs font-black", isSolution ? "text-white" : "text-text-muted")}>
                                                {getInitials(userName)}
                                            </span>
                                        </div>

                                        <div className="flex-1 relative">
                                            <div className={cn("rounded-[12px] border shadow-sm transition-all group-hover:shadow-md overflow-hidden",
                                                isSolution
                                                    ? "bg-secondary border-emerald-500"
                                                    : "bg-secondary border-color"
                                            )}>
                                                <div className={cn("px-5 py-2.5 border-b flex flex-wrap gap-3 items-center",
                                                    isSolution
                                                        ? "bg-emerald-500 text-white border-emerald-500"
                                                        : "bg-tertiary border-color"
                                                )}>
                                                    <div className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-lg border border-color text-[10px] font-black text-text-muted uppercase tracking-widest">
                                                        <Clock size={12} className={isSolution ? "text-emerald-500" : "text-primary-500"} /> {formatTimeAgo(item.date_creation)}
                                                    </div>
                                                    <div className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-lg border border-color text-[10px] font-black text-text-muted uppercase tracking-widest">
                                                        <User size={12} className={isSolution ? "text-emerald-500" : "text-primary-500"} /> {userName}
                                                    </div>
                                                    {isSolution && (
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-white bg-emerald-500 px-2.5 py-1 rounded-lg border border-emerald-400 shadow-lg">Solución Firmada</span>
                                                    )}
                                                </div>
                                                <div className="p-6">
                                                    <div
                                                        className="text-sm text-text-secondary leading-relaxed prose prose-sm dark:prose-invert max-w-none font-medium italic opacity-90"
                                                        dangerouslySetInnerHTML={{ __html: sanitizeHTML(item.content) }}
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
                    <div className="order-1 lg:order-2 lg:w-[420px] lg:h-full lg:overflow-y-auto no-scrollbar space-y-6 pb-32">
                        <div className="bg-secondary p-6 rounded-[12px] border border-color shadow-sm space-y-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500 blur-3xl rounded-full -mr-16 -mt-16 opacity-10" />
                            <div className="flex items-center gap-3 mb-2 border-b border-color pb-5 relative z-10">
                                <div className="p-2 bg-tertiary rounded-lg border border-color">
                                    <AlertCircle size={18} className="text-primary-500" />
                                </div>
                                <h2 className="text-[11px] font-black text-text-muted uppercase tracking-[0.25em] opacity-80">Arquitectura Técnica</h2>
                            </div>

                            <div className="space-y-6 relative z-10">
                                {/* Entidad */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1 opacity-70">Entidad Organizadora</label>
                                    <div className="flex items-center px-5 py-4 bg-tertiary rounded-2xl border border-color shadow-inner group-hover:border-primary-500 transition-all">
                                        <Building2 size={16} className="text-primary-500 mr-4" />
                                        <span className="text-sm text-text-primary font-black truncate uppercase tracking-tight">
                                            {typeof ticket.entities_id === 'object' ? ticket.entities_id.name : (ticket.entities_id || 'N/A')}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1 opacity-70">Tipo</label>
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
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1 opacity-70">Estado Actual</label>
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

                                {/* Categoría */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1 opacity-70">Clasificación ITIL</label>
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

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1 opacity-70">Prioridad</label>
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
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1 opacity-70">Ubicación</label>
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
                            </div>
                        </div>
                        {/* Actors Panel */}
                        <div className="bg-secondary p-6 rounded-[12px] border border-color shadow-sm space-y-6 relative overflow-hidden group">
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-500 blur-3xl rounded-full -ml-16 -mb-16 opacity-10" />
                            <div className="flex items-center justify-between border-b border-color pb-5 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-tertiary rounded-lg border border-color">
                                        <Users size={18} className="text-indigo-500" />
                                    </div>
                                    <h3 className="text-[11px] font-black text-text-muted uppercase tracking-[0.25em]">Actores Clave</h3>
                                </div>
                            </div>

                            <div className="space-y-6 relative z-10">
                                {/* Solicitante */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1 opacity-70">Lider de Requerimiento</label>
                                    <button
                                        disabled={updatingField === 'requester'}
                                        onClick={() => setOpenDropdown(openDropdown === 'requester' ? null : 'requester')}
                                        className={cn(
                                            "flex items-center gap-4 w-full p-4 rounded-2xl border transition-all text-left bg-tertiary group/actor hover:bg-secondary",
                                            openDropdown === 'requester' ? "border-primary-500 shadow-lg" : "border-color",
                                            updatingField === 'requester' && "opacity-50"
                                        )}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-tertiary flex items-center justify-center border border-color group-hover/actor:scale-110 transition-transform duration-500 shadow-inner">
                                            <User size={18} className="text-primary-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-black text-text-primary truncate uppercase tracking-tight">
                                                {ticket.requester_name || 'PENDIENTE DE ASIGNACIÓN'}
                                            </p>
                                        </div>
                                        {updatingField === 'requester' ? (
                                            <Loader2 size={14} className="animate-spin text-primary-500" />
                                        ) : (
                                            <ChevronDown size={16} className={cn("text-text-muted group-hover/actor:text-primary-500 transition-transform duration-300", openDropdown === 'requester' && "rotate-180 text-primary-500")} />
                                        )}
                                    </button>

                                    {openDropdown === 'requester' && (
                                        <>
                                            <div className="fixed inset-0 z-[100]" onClick={() => setOpenDropdown(null)} />
                                            <div className="absolute left-0 top-full mt-3 w-full min-w-[300px] max-h-[400px] flex flex-col bg-secondary border border-color rounded-[2rem] shadow-2xl z-[110] animate-in fade-in slide-in-from-top-4 duration-300 overflow-hidden">
                                                <div className="p-4 border-b border-color bg-tertiary">
                                                    <div className="relative">
                                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            placeholder="Filtrar solicitantes..."
                                                            className="w-full pl-9 pr-3 py-2.5 text-xs bg-secondary border border-color rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all font-black uppercase tracking-tight shadow-sm"
                                                            onChange={(e) => {
                                                                const term = e.target.value.toLowerCase();
                                                                const btns = e.target.closest('.absolute').querySelectorAll('.user-btn');
                                                                btns.forEach(btn => {
                                                                    btn.style.display = btn.innerText.toLowerCase().includes(term) ? 'flex' : 'none';
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto no-scrollbar p-2 custom-scrollbar">
                                                    {(options.users || []).length > 0 ? (options.users || []).map(u => (
                                                        <button
                                                            key={u.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleUpdateActor(u.id, 1);
                                                                setOpenDropdown(null);
                                                            }}
                                                            className={cn(
                                                                "user-btn w-full text-left px-4 py-3 text-[10px] rounded-xl transition-all font-black uppercase tracking-widest flex items-center gap-3",
                                                                ticket.requester_name === u.fullName
                                                                    ? "bg-primary-500 text-white shadow-xl shadow-primary-500/30"
                                                                    : "text-text-secondary hover:bg-tertiary"
                                                            )}
                                                        >
                                                            <div className={cn("w-2 h-2 rounded-full", ticket.requester_name === u.fullName ? "bg-primary-500" : "bg-primary-500/40")} />
                                                            {u.fullName || u.name}
                                                        </button>
                                                    )) : (
                                                        <div className="p-6 text-center text-xs text-text-muted italic opacity-60">Sin técnicos mapeados</div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Asignada a */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1 opacity-70">Responsable Técnico</label>
                                    <button
                                        disabled={updatingField === 'actor'}
                                        onClick={() => setOpenDropdown(openDropdown === 'actor' ? null : 'actor')}
                                        className={cn(
                                            "flex items-center gap-4 w-full p-4 rounded-2xl border transition-all text-left bg-tertiary group/actor hover:bg-secondary",
                                            openDropdown === 'actor' ? "border-emerald-500 shadow-lg" : "border-color",
                                            updatingField === 'actor' && "opacity-50"
                                        )}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center border border-emerald-500 group-hover/actor:scale-110 transition-transform duration-500 shadow-inner">
                                            {ticket.groupActors?.some(a => a.type == 2) ? (
                                                <Users size={18} className="text-emerald-500" />
                                            ) : (
                                                <User size={18} className="text-emerald-500" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-black text-text-primary truncate uppercase tracking-tight">
                                                {ticket.technician_name || 'SIN ASIGNACIÓN TÉCNICA'}
                                            </p>
                                        </div>
                                        {updatingField === 'actor' ? (
                                            <Loader2 size={14} className="animate-spin text-emerald-500" />
                                        ) : (
                                            <ChevronDown size={16} className={cn("text-text-muted group-hover/actor:text-emerald-500 transition-transform duration-300", openDropdown === 'actor' && "rotate-180 text-emerald-500")} />
                                        )}
                                    </button>

                                    {openDropdown === 'actor' && (
                                        <>
                                            <div className="fixed inset-0 z-[100]" onClick={() => setOpenDropdown(null)} />
                                            <div className="absolute left-0 bottom-full mb-3 w-full min-w-[300px] max-h-[400px] flex flex-col bg-secondary border border-color rounded-[2rem] shadow-2xl z-[110] animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden">
                                                <div className="p-4 border-b border-color bg-tertiary">
                                                    <div className="relative">
                                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            placeholder="Filtrar especialistas..."
                                                            className="w-full pl-9 pr-3 py-2.5 text-xs bg-secondary border border-color rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all font-black uppercase tracking-tight shadow-sm"
                                                            onChange={(e) => {
                                                                const term = e.target.value.toLowerCase();
                                                                const btns = e.target.closest('.absolute').querySelectorAll('.tech-btn');
                                                                btns.forEach(btn => {
                                                                    btn.style.display = btn.innerText.toLowerCase().includes(term) ? 'flex' : 'none';
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto no-scrollbar p-2 custom-scrollbar">
                                                    {options.technicians.length > 0 && options.technicians.map(tech => (
                                                        <button
                                                            key={`user-${tech.id}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleUpdateActor(tech.id, 2, false);
                                                                setOpenDropdown(null);
                                                            }}
                                                            className={cn(
                                                                "tech-btn w-full text-left px-4 py-3 text-[10px] rounded-xl transition-all flex items-center gap-3 font-black uppercase tracking-widest",
                                                                ticket.actors?.some(a => a.type == 2 && a.users_id && (a.users_id.id == tech.id || a.users_id == tech.id))
                                                                    ? "bg-emerald-500 text-white shadow-xl shadow-emerald-500/30"
                                                                    : "text-text-secondary hover:bg-tertiary"
                                                            )}
                                                        >
                                                            <div className={cn("w-2 h-2 rounded-full", ticket.actors?.some(a => a.type == 2 && a.users_id && (a.users_id.id == tech.id || a.users_id == tech.id)) ? "bg-emerald-500" : "bg-emerald-500/40")} />
                                                            {tech.fullName || tech.name}
                                                        </button>
                                                    ))}

                                                    {options.groups && options.groups.length > 0 && (
                                                        <>
                                                            <div className="px-4 py-3 text-[9px] font-black text-text-muted uppercase tracking-[0.25em] border-t border-color mt-2 bg-tertiary">Cell Grupos de Trabajo</div>
                                                            {options.groups.map(group => (
                                                                <button
                                                                    key={`group-${group.id}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleUpdateActor(group.id, 2, true);
                                                                        setOpenDropdown(null);
                                                                    }}
                                                                    className={cn(
                                                                        "tech-btn w-full text-left px-4 py-3 text-[10px] rounded-xl transition-all flex items-center gap-3 font-black uppercase tracking-widest",
                                                                        ticket.actors?.some(a => a.type == 2 && a.groups_id && (a.groups_id.id == group.id || a.groups_id == group.id))
                                                                            ? "bg-indigo-500 text-white shadow-xl shadow-indigo-500/30"
                                                                            : "text-text-secondary hover:bg-tertiary"
                                                                    )}
                                                                >
                                                                    <div className={cn("w-2 h-2 rounded-full", ticket.actors?.some(a => a.type == 2 && a.groups_id && (a.groups_id.id == group.id || a.groups_id == group.id)) ? "bg-indigo-500" : "bg-indigo-500/40")} />
                                                                    {group.fullName || group.name}
                                                                </button>
                                                            ))}
                                                        </>
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

            {/* Premium Enterprise Input Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-8 bg-secondary border-t border-color z-[60] shadow-[0_-20px_50px_rgba(0,0,0,0.15)] flex justify-center animate-in slide-in-from-bottom-full duration-700">
                <form onSubmit={handleAddFollowup} className="flex gap-4 max-w-5xl w-full items-center">
                    <div className="flex-1 relative group/input">
                        <textarea
                            rows="1"
                            value={newFollowup}
                            onChange={(e) => setNewFollowup(e.target.value)}
                            placeholder="Proponer respuesta técnica o actualización de Bitácora..."
                            className="w-full px-6 py-4 rounded-2xl bg-tertiary border border-color focus:border-primary-500 focus:ring-4 focus:ring-primary-500/5 outline-none transition-all text-sm font-bold text-text-primary shadow-inner placeholder:text-text-muted italic resize-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleAddFollowup(e);
                                }
                            }}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-4 opacity-40 group-focus-within/input:opacity-100 transition-opacity">
                            <MessageSquare size={18} className="text-text-muted" />
                        </div>
                    </div>

                    <div className="relative flex shadow-2xl shadow-primary-500/20 group/btn-main">
                        <button
                            type="submit"
                            disabled={sending || !newFollowup.trim()}
                            className="flex items-center gap-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black px-8 py-4 rounded-l-2xl transition-all active:scale-[0.98] border-r border-primary-600 uppercase tracking-[0.2em] text-[11px]"
                        >
                            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            <span className="hidden sm:inline">Ejecutar</span>
                        </button>

                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsResponderMenuOpen(!isResponderMenuOpen);
                            }}
                            className="bg-primary-500 hover:bg-primary-600 text-white px-5 rounded-r-2xl transition-all active:scale-[0.98] flex items-center justify-center border-l border-primary-600 group-hover/btn-main:bg-primary-600 shadow-inner"
                        >
                            <ChevronDown size={22} className={cn("transition-transform duration-500 text-white", isResponderMenuOpen && "rotate-180")} />
                        </button>

                        {/* Responder Menu Dropdown (Premium) */}
                        {isResponderMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setIsResponderMenuOpen(false)} />
                                <div className="absolute right-0 bottom-full mb-6 w-80 bg-secondary border border-color rounded-[2.5rem] shadow-2xl z-[70] overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
                                    <div className="p-4 bg-tertiary border-b border-color">
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] ml-2">Protocolos de Acción</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsSoluModalOpen(true);
                                            setIsResponderMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-5 px-6 py-5 text-[11px] font-black text-text-primary hover:bg-tertiary transition-all border-b border-color group/item uppercase tracking-widest"
                                    >
                                        <div className="p-3 rounded-2xl bg-secondary text-emerald-500 group-hover/item:scale-110 group-hover/item:bg-emerald-500 group-hover/item:text-white transition-all shadow-sm">
                                            <CheckCircle2 size={20} />
                                        </div>
                                        <div className="text-left">
                                            <span className="block">Liberar Solución</span>
                                            <span className="text-[9px] font-bold text-text-muted opacity-60">Finalización formal del ciclo</span>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            fileInputRef.current?.click();
                                            setIsResponderMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-5 px-6 py-5 text-[11px] font-black text-text-primary hover:bg-tertiary transition-all border-b border-color group/item uppercase tracking-widest"
                                    >
                                        <div className="p-3 rounded-2xl bg-secondary text-indigo-500 group-hover/item:scale-110 group-hover/item:bg-indigo-500 group-hover/item:text-white transition-all shadow-sm">
                                            <FileUp size={20} />
                                        </div>
                                        <div className="text-left">
                                            <span className="block">Adjuntar Reporte</span>
                                            <span className="text-[9px] font-bold text-text-muted opacity-60">Soportes, PDFs o Imágenes</span>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleRequestApproval();
                                            setIsResponderMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-5 px-6 py-5 text-[11px] font-black text-text-primary hover:bg-tertiary transition-all group/item uppercase tracking-widest"
                                    >
                                        <div className="p-3 rounded-2xl bg-secondary text-amber-500 group-hover/item:scale-110 group-hover/item:bg-amber-500 group-hover/item:text-white transition-all shadow-sm">
                                            <ThumbsUp size={20} />
                                        </div>
                                        <div className="text-left">
                                            <span className="block">Visto Bueno</span>
                                            <span className="text-[9px] font-bold text-text-muted opacity-60">Validación por Supervisor</span>
                                        </div>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </form>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            </div>

            {/* Premium Solution Modal Portal */}
            {isSoluModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-primary animate-in fade-in duration-500">
                    <div className="bg-secondary w-full max-w-xl rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.5)] p-10 animate-in zoom-in-95 slide-in-from-bottom-10 duration-700 border border-color relative overflow-hidden group/modal">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 blur-3xl rounded-full -mr-32 -mt-32 opacity-10" />

                        <div className="flex items-center gap-5 mb-8 relative z-10">
                            <div className="p-4 bg-secondary text-emerald-500 rounded-2xl border border-emerald-500 group-hover/modal:scale-110 transition-transform duration-700">
                                <CheckCircle2 size={32} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-text-primary uppercase tracking-tighter">Formalizar Solución</h2>
                                <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.25em] opacity-60 mt-1 border-l-2 border-emerald-500 pl-3">Protocolo de Cierre Técnico GLPI</p>
                            </div>
                        </div>

                        <div className="space-y-4 relative z-10">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1 opacity-70">Memoria Técnica del Proceso</label>
                            <textarea
                                value={solutionContent}
                                onChange={(e) => setSolutionContent(e.target.value)}
                                placeholder="Describe detalladamente los pasos técnicos realizados para solventar el requerimiento..."
                                className="w-full h-52 px-6 py-5 rounded-[1.5rem] bg-tertiary border border-color resize-none focus:border-emerald-500 outline-none transition-all text-sm font-bold text-text-primary mb-8 shadow-inner placeholder:text-text-muted leading-relaxed italic"
                            />
                        </div>

                        <div className="flex justify-end gap-5 relative z-10">
                            <button
                                onClick={() => setIsSoluModalOpen(false)}
                                className="px-8 py-4 text-text-muted hover:text-red-500 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSolve}
                                disabled={sending || !solutionContent.trim()}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95 flex items-center gap-3 group/btn"
                            >
                                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="group-hover/btn:translate-x-1 transition-transform" />}
                                Consolidar Solución
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
