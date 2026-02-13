import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, RefreshCw, MessageSquare, Check, ChevronLeft, ChevronRight, Search, Filter, X, List } from 'lucide-react';
import CustomSelect from './CustomSelect';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Status Map: 1=New, 2=Assigned, 3=Planned, 4=Waiting, 5=Solved, 6=Closed
const STATUS_MAP = {
    1: { label: 'Nuevo', color: 'bg-emerald-500', bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    2: { label: 'Asignado', color: 'bg-blue-500', bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    3: { label: 'Planificado', color: 'bg-cyan-500', bg: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
    4: { label: 'En Espera', color: 'bg-amber-500', bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    5: { label: 'Resuelto', color: 'bg-green-600', bg: 'bg-green-600/10 text-green-600 border-green-600/20' },
    6: { label: 'Cerrado', color: 'bg-slate-500', bg: 'bg-slate-500/10 text-slate-500 border-slate-500/20' }
};

const TicketList = ({ onSelectTicket, onBack, user }) => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all'); // 'all', 1, 2, 3, 4, 5, 6
    const [onlyMine, setOnlyMine] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    const fetchTickets = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();

            // Increase range to fetch more tickets for pagination
            params.append('range', '0-1000'); // Fetch up to 1000 tickets

            if (filter !== 'all') {
                params.append('status', filter);
            }

            if (onlyMine && user) {
                if (user.id) params.append('technician_id', user.id);
            }

            const response = await fetch(`${API_BASE_URL}/glpi/tickets?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token') || ''}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch tickets');
            const data = await response.json();
            setTickets(data);
        } catch (err) {
            console.error('Error fetching tickets:', err);
            setError('No se pudieron cargar los tickets. Verifica tu conexión.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [filter, onlyMine]);

    // Derived state for filtered tickets
    const filteredTickets = tickets.filter(t => {
        // 1. Filtrar por búsqueda
        const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.id.toString().includes(searchTerm);

        if (!matchesSearch) return false;

        // 2. Filtrar por mis tickets
        if (onlyMine) {
            if (!user?.id) return false;

            const targetId = String(user.id);
            const isMyTech = String(t.technician_id_raw) === targetId;
            const isMyReq = String(t.requester_id_raw) === targetId;

            // También buscamos en los nombres por si acaso
            const myNames = [
                (user.name || '').toLowerCase(),
                (user.displayName || '').toLowerCase(),
                (user.username || '').toLowerCase()
            ].filter(Boolean);

            const techMatch = (t.technician_name || '').toLowerCase();
            const reqMatch = (t.requester_name || '').toLowerCase();
            const isNamed = myNames.some(name => techMatch.includes(name) || reqMatch.includes(name));

            return isMyTech || isMyReq || isNamed;
        }

        return true;
    });

    if (onlyMine) {
        console.log(`[DEBUG] Resumen Mis Tickets: Total=${tickets.length}, Filtered=${filteredTickets.length}, userId=${user?.id}`);
        if (filteredTickets.length === 0 && tickets.length > 0) {
            console.log('[DEBUG] Ejemplo de ticket no filtrado:', {
                id: tickets[0].id,
                tech_id_raw: tickets[0].technician_id_raw,
                tech_raw: tickets[0].technician
            });
        }
    }

    // Reset pagination when filter/search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filter, onlyMine, searchTerm, itemsPerPage]);

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentTickets = filteredTickets.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const filters = [
        { id: 'all', label: 'Todos' },
        { id: 1, label: 'Nuevos' },
        { id: 2, label: 'Asignados' },
        { id: 3, label: 'Planificados' },
        { id: 4, label: 'En Espera' },
        { id: 5, label: 'Resueltos' },
        { id: 6, label: 'Cerrados' }
    ];

    return (
        <div className="flex-1 flex flex-col h-[calc(100dvh-130px)] bg-slate-50 dark:bg-slate-950 overflow-hidden relative rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="flex flex-col gap-4 p-4 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 sticky top-0 z-10 shrink-0 shadow-sm">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-blue-500" />
                            Tickets de Soporte
                        </h1>
                        <p className="text-xs text-slate-500 font-medium">Gestiona incidencias GLPI</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowMobileFilters(!showMobileFilters)}
                            className={`md:hidden p-2 rounded-xl transition-colors ${showMobileFilters ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                        >
                            {showMobileFilters ? <X size={18} /> : <Filter size={18} />}
                        </button>
                        <button
                            onClick={fetchTickets}
                            disabled={loading}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                {/* Mobile Filters Menu (Collapsible) */}
                {showMobileFilters && (
                    <div className="md:hidden bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-white/10 space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Estado</span>
                            <div className="grid grid-cols-2 gap-2">
                                {filters.map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => {
                                            setFilter(f.id);
                                            setShowMobileFilters(false);
                                        }}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border text-left flex items-center justify-between ${filter === f.id
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-blue-400'
                                            }`}
                                    >
                                        {f.label}
                                        {filter === f.id && <Check size={14} />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                            <label className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 cursor-pointer">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Solo Mis Tickets</span>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${onlyMine ? 'bg-blue-500 border-blue-500' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>
                                    {onlyMine && <Check size={14} className="text-white" />}
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={onlyMine}
                                    onChange={(e) => setOnlyMine(e.target.checked)}
                                />
                            </label>
                        </div>
                    </div>
                )}

                {/* Desktop Filters Row (Hidden on Mobile) */}
                <div className="hidden md:flex flex-row gap-3 items-center justify-between">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar w-full sm:w-auto">
                        {filters.map(f => (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id)}
                                className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all border ${filter === f.id
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30'
                                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-white/10 hover:border-blue-400'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                        <label className="flex items-center gap-2 cursor-pointer group select-none">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${onlyMine ? 'bg-blue-500 border-blue-500' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>
                                {onlyMine && <Check size={12} className="text-white" />}
                            </div>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={onlyMine}
                                onChange={(e) => setOnlyMine(e.target.checked)}
                            />
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 group-hover:text-blue-500 transition-colors">Mis Tickets</span>
                        </label>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por ID o título..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative">
                {error ? (
                    <div className="flex flex-col items-center justify-center h-full text-red-500 animate-in fade-in p-6">
                        <AlertCircle size={48} className="mb-2 opacity-50" />
                        <p className="font-bold text-center">{error}</p>
                        <button onClick={fetchTickets} className="mt-4 text-sm underline opacity-70 hover:opacity-100">Reintentar</button>
                    </div>
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 animate-pulse">
                        <Loader2 size={48} className="animate-spin mb-4 opacity-50" />
                        <p className="text-xs font-black uppercase tracking-widest">Cargando Tickets...</p>
                    </div>
                ) : filteredTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center p-6">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <MessageSquare size={32} className="opacity-50" />
                        </div>
                        <p className="font-bold text-lg text-slate-600 dark:text-slate-300">No hay tickets</p>
                        <p className="text-sm max-w-xs mt-1">No se encontraron tickets con los filtros seleccionados.</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile List View (Hidden on MD+) */}
                        <div className="md:hidden h-full overflow-y-auto p-4 space-y-4 no-scrollbar">
                            {currentTickets.map(ticket => {
                                const status = STATUS_MAP[ticket.status] || STATUS_MAP[1];
                                return (
                                    <div
                                        key={ticket.id}
                                        onClick={() => onSelectTicket(ticket.id)}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-400">#{ticket.id}</span>
                                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tight">{ticket.entity_name}</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase ${status.bg}`}>
                                                {status.label}
                                            </span>
                                        </div>

                                        <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2 line-clamp-2 text-sm leading-snug">
                                            {ticket.title}
                                        </h3>

                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {ticket.priority > 3 && (
                                                <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                    Alta Prioridad
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5 mt-2">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-slate-400 uppercase font-bold">Solicitante</span>
                                                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate max-w-[120px]">{ticket.requester_name || 'N/A'}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] text-slate-400 uppercase font-bold">Fecha</span>
                                                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">{new Date(ticket.date).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop Table View (Hidden on Mobile) */}
                        <div className="hidden md:block h-full overflow-y-auto no-scrollbar">
                            <table className="w-full text-left border-collapse table-auto">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 shadow-sm backdrop-blur-md">
                                    <tr>
                                        {[
                                            { title: 'ID', width: 'w-16' },
                                            { title: 'TÍTULO', width: 'w-auto' },
                                            { title: 'ENTIDAD', width: 'w-32' },
                                            { title: 'ESTADO', width: 'w-28' },

                                            { title: 'APERTURA', width: 'w-32' },
                                            { title: 'PRIORIDAD', width: 'w-24' },
                                            { title: 'SOLICITANTE', width: 'w-40' },
                                            { title: 'TÉCNICO', width: 'w-40' }
                                        ].map((col, idx) => (
                                            <th key={idx} className={`p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-white/5 ${col.width}`}>
                                                {col.title}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {currentTickets.map((ticket, index) => {
                                        const status = STATUS_MAP[ticket.status] || STATUS_MAP[1];
                                        // Priority Map for badge color
                                        const getPriorityColor = (p) => {
                                            if (p >= 5) return 'bg-red-100 text-red-600 border-red-200';
                                            if (p >= 4) return 'bg-orange-100 text-orange-600 border-orange-200';
                                            if (p >= 3) return 'bg-yellow-50 text-yellow-600 border-yellow-200'; // Media
                                            return 'bg-slate-50 text-slate-500 border-slate-100'; // Baja
                                        };
                                        const getPriorityLabel = (p) => {
                                            const map = { 1: 'Muy Baja', 2: 'Baja', 3: 'Media', 4: 'Alta', 5: 'Muy Alta' };
                                            return map[p] || 'Media';
                                        };

                                        return (
                                            <tr
                                                key={ticket.id}
                                                onClick={() => onSelectTicket(ticket.id)}
                                                className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors text-xs"
                                            >
                                                <td className="p-4 font-bold text-slate-500">#{ticket.id}</td>
                                                <td className="p-4 font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 line-clamp-2 max-w-[250px]">
                                                    {ticket.title}
                                                </td>
                                                <td className="p-4 text-slate-500">
                                                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 dark:border-slate-700 inline-block max-w-[120px] truncate">
                                                        {ticket.entity_name}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-black uppercase ${status.bg}`}>
                                                        {status.label}
                                                    </span>
                                                </td>

                                                <td className="p-4 text-slate-500 font-mono text-[10px]">
                                                    {new Date(ticket.date).toLocaleString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${getPriorityColor(ticket.priority)}`}>
                                                        {getPriorityLabel(ticket.priority)}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-slate-600 dark:text-slate-400 truncate max-w-[150px]" title={ticket.requester_name}>
                                                    {ticket.requester_name || '-'}
                                                </td>
                                                <td className="p-4 text-slate-600 dark:text-slate-400 truncate max-w-[150px]" title={ticket.technician_name}>
                                                    {ticket.technician_name || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="p-3 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 sticky bottom-0 z-20 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 font-medium">Filas por página:</span>
                                <div className="w-24">
                                    <CustomSelect
                                        value={itemsPerPage}
                                        onChange={(val) => setItemsPerPage(Number(val))}
                                        options={[5, 10, 20, 50, 100].map(val => ({ id: val, label: val }))}
                                        menuPlacement="top"
                                        className="!p-0"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">
                                    {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredTickets.length)} de {filteredTickets.length}
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => paginate(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button
                                        onClick={() => paginate(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TicketList;


