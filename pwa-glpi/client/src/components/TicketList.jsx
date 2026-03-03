import React, { useState } from 'react';
import {
    Search,
    MessageSquare,
    Filter,
    Clock,
    Building2,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RefreshCcw,
    Calendar
} from 'lucide-react';
import { cn } from '../utils/cn';

const STATUS_MAP = {
    1: { label: 'Nuevo', bg: 'bg-blue-500/10 text-blue-500 border border-blue-500/20' },
    2: { label: 'Asignado', bg: 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' },
    3: { label: 'Planificado', bg: 'bg-purple-500/10 text-purple-500 border border-purple-500/20' },
    4: { label: 'En Espera', bg: 'bg-amber-500/10 text-amber-500 border border-amber-500/20' },
    5: { label: 'Resuelto', bg: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' },
    6: { label: 'Cerrado', bg: 'bg-tertiary text-text-muted border border-color' },
};

const TicketList = ({ tickets, onSelectTicket, loading, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    const filteredTickets = tickets.filter(t => {
        const matchesSearch =
            t.id.toString().includes(searchTerm) ||
            t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.entity_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter = filter === 'all' || t.status === parseInt(filter);
        return matchesSearch && matchesFilter;
    });

    const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
    const currentTickets = filteredTickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="flex flex-col h-full bg-primary animate-in fade-in duration-500 overflow-hidden transition-colors">
            {/* Header / Toolbar */}
            <div className="p-6 border-b border-color bg-secondary space-y-6 transition-colors">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-tertiary rounded-xl flex items-center justify-center text-primary-500 shadow-sm">
                            <Filter size={20} />
                        </div>
                        <div>
                            <h2 className="text-[17px] font-[700] text-text-primary uppercase tracking-tight">Soporte Técnico</h2>
                            <p className="text-[11px] font-[600] text-text-muted uppercase tracking-[1px]">Tickets activos en GLPI</p>
                        </div>
                    </div>
                    <button
                        onClick={onRefresh}
                        className="p-2.5 hover:bg-[#f1f5f9] rounded-xl text-[#94a3b8] transition-all active:scale-90"
                    >
                        <RefreshCcw size={20} />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por ID, asunto o entidad..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full h-10 pl-11 pr-4 bg-tertiary border border-color rounded-lg text-[13px] outline-none transition-all focus:border-primary-500 focus:bg-secondary text-text-primary"
                        />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center py-20">
                        <Loader2 size={32} className="animate-spin text-[#0695c4] mb-4" />
                        <p className="text-[11px] font-[600] text-[#94a3b8] uppercase tracking-[2px]">Sincronizando GLPI...</p>
                    </div>
                ) : filteredTickets.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-20 text-[#94a3b8]">
                        <MessageSquare size={48} className="opacity-20 mb-4" />
                        <p className="text-[11px] font-[700] uppercase tracking-widest">No hay tickets encontrados</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-[14px]">
                        {currentTickets.map(ticket => {
                            const priorityColor = {
                                1: 'bg-[#94a3b8]',
                                2: 'bg-[#64748b]',
                                3: 'bg-[#0695c4]',
                                4: 'bg-[#f97316]',
                                5: 'bg-[#ef4444]',
                                6: 'bg-[#ef4444]'
                            }[ticket.priority] || 'bg-[#0695c4]';

                            return (
                                <div
                                    key={ticket.id}
                                    onClick={() => onSelectTicket(ticket.id)}
                                    className="bg-secondary rounded-[12px] p-4 border border-color shadow-sm flex items-center gap-4 hover:shadow-md hover:border-text-muted transition-all cursor-pointer group"
                                >
                                    <div className={cn("w-1 self-stretch rounded-full shrink-0", priorityColor)} />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1.5">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[14px] font-[700] text-text-primary">#{ticket.id}</span>
                                                <span className="text-[11px] font-[600] text-primary-500 bg-tertiary px-2 py-0.5 rounded-lg border border-color">
                                                    {ticket.inventory_number || 'S/E'}
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-[600] text-text-muted uppercase tracking-wide">
                                                {ticket.technician_name || 'Sin asignar'}
                                            </span>
                                        </div>
                                        <h4 className="text-[13.5px] font-[500] text-text-secondary truncate mb-2 group-hover:text-text-primary transition-colors">
                                            {ticket.title}
                                        </h4>
                                        <div className="flex items-center gap-4 text-[11px] text-text-muted font-[600] uppercase tracking-tight opacity-70">
                                            <span className="flex items-center gap-1.5"><Building2 size={12} className="text-primary-500" /> {ticket.entity_name}</span>
                                            <span className="flex items-center gap-1.5"><Calendar size={12} className="text-primary-500" /> {new Date(ticket.date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {!loading && filteredTickets.length > itemsPerPage && (
                <div className="p-4 bg-secondary border-t border-color flex items-center justify-between px-6 transition-colors">
                    <p className="text-[11px] font-[600] text-text-muted uppercase tracking-[1px]">Página {currentPage} de {totalPages}</p>
                    <div className="flex gap-3">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="h-9 px-4 bg-tertiary border border-color rounded-lg text-[11px] font-[600] text-text-secondary uppercase tracking-widest disabled:opacity-40 hover:bg-secondary hover:text-primary-500 transition-all"
                        >
                            Anterior
                        </button>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="h-9 px-4 bg-tertiary border border-color rounded-lg text-[11px] font-[600] text-text-secondary uppercase tracking-widest disabled:opacity-40 hover:bg-secondary hover:text-primary-500 transition-all"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TicketList;
