import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    FileText, Plus, Search, Clock, CheckCircle2, AlertCircle,
    ChevronRight, ChevronLeft, Loader2, Eye, ShoppingCart, XCircle, Building2, Calendar, Trash2, Filter, Check, ChevronDown, User
} from 'lucide-react';
import { cn } from '../utils/cn';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const STATUS_CONFIG = {
    PENDIENTE: { label: 'Pendiente', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20', icon: Clock },
    EN_REVISION: { label: 'En Revisión', color: 'text-primary-500 bg-primary-500/10 border-primary-500/20', icon: Eye },
    APROBADA: { label: 'Aprobada', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
    RECHAZADA: { label: 'Rechazada', color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: XCircle },
    COMPRADA: { label: 'Comprada', color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', icon: ShoppingCart },
    CANCELADA: { label: 'Cancelada', color: 'text-text-muted bg-tertiary border-color', icon: XCircle },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDIENTE;
    const Icon = cfg.icon;
    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 text-[10px] font-[600] uppercase tracking-wide px-2 py-0.5 rounded-full border",
            cfg.color
        )}>
            <Icon size={12} />
            {cfg.label}
        </span>
    );
}

function MetricCard({ title, value, icon: Icon, className }) {
    return (
        <div className={cn(
            "bg-secondary rounded-[12px] p-[16px_20px] shadow-sm border border-color flex items-center justify-between",
            className
        )}>
            <div>
                <p className="text-[11px] font-[600] text-text-muted uppercase tracking-[1px] mb-1">{title}</p>
                <p className="text-[20px] font-[800] text-text-primary tracking-tight">{value}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-tertiary flex items-center justify-center text-text-secondary border border-color">
                <Icon size={20} />
            </div>
        </div>
    );
}

export default function QuotationList({ onNew, onSelect }) {
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('TODAS');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedQuotations, setSelectedQuotations] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef(null);
    const ITEMS_PER_PAGE = 10;
    const token = localStorage.getItem('glpi_pro_token');

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterRef.current && !filterRef.current.contains(event.target)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchQuotations = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterStatus !== 'TODAS') params.set('status', filterStatus);
            if (searchTerm) params.set('search', searchTerm);

            const res = await fetch(`${API_BASE}/quotations?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setQuotations(Array.isArray(data) ? data : []);
        } catch (e) {
            // quotation list error
        } finally {
            setLoading(false);
        }
    }, [token, filterStatus, searchTerm]);

    useEffect(() => {
        const t = setTimeout(fetchQuotations, 300);
        return () => clearTimeout(t);
    }, [fetchQuotations]);

    const totalValue = useMemo(() => {
        return quotations.reduce((acc, q) => acc + (q.total_value || 0), 0);
    }, [quotations]);

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentQuotations = quotations.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const totalPages = Math.ceil(quotations.length / ITEMS_PER_PAGE) || 1;

    const handleDeleteSelected = () => {
        if (!selectedQuotations.length) return;
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            await Promise.all(
                selectedQuotations.map(id =>
                    fetch(`${API_BASE}/quotations/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    }).catch(e => console.warn(`Error borrando ${id}`, e))
                )
            );
            setSelectedQuotations([]);
            setShowDeleteModal(false);
            fetchQuotations();
        } catch (error) {
            console.error('Error al eliminar cotizaciones', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedQuotations(quotations.map(q => q._id));
        else setSelectedQuotations([]);
    };

    const handleSelectQuotation = (id) => {
        setSelectedQuotations(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    return (
        <div className="space-y-6 pb-10 animate-in fade-in duration-500 max-w-6xl mx-auto">
            {/* Header / Sidebar/Topbar Style */}
            <div className="flex items-center justify-between bg-secondary py-4 px-6 rounded-[12px] border border-color shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-500">
                        <FileText size={22} />
                    </div>
                    <div>
                        <h2 className="text-[17px] font-[700] text-text-primary uppercase tracking-tight">Adquisiciones</h2>
                        <p className="text-[11px] font-[600] text-text-muted uppercase tracking-[1px]">Gestión técnica de suministros</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {selectedQuotations.length > 0 && (
                        <button
                            onClick={handleDeleteSelected}
                            disabled={isDeleting}
                            className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-[12px] text-[13px] font-[700] flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                            Eliminar ({selectedQuotations.length})
                        </button>
                    )}
                    <button
                        onClick={onNew}
                        className="bg-primary-500 hover:bg-primary-600 text-white px-6 h-10 rounded-xl text-[12px] font-[700] uppercase tracking-wide shadow-lg shadow-primary-500/20 flex items-center gap-2 transition-all active:scale-95 border border-primary-400/30"
                    >
                        <Plus size={18} />
                        Nueva Solicitud
                    </button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <MetricCard title="Pendientes" value={quotations.filter(q => q.status === 'PENDIENTE').length} icon={Clock} />
                <MetricCard title="En Revisión" value={quotations.filter(q => q.status === 'EN_REVISION').length} icon={Eye} />
                <MetricCard title="Aprobadas" value={quotations.filter(q => q.status === 'APROBADA').length} icon={CheckCircle2} />
                <MetricCard title="Compradas" value={quotations.filter(q => q.status === 'COMPRADA').length} icon={ShoppingCart} />
                <MetricCard title="Rechazadas" value={quotations.filter(q => q.status === 'RECHAZADA').length} icon={AlertCircle} />
                <MetricCard title="Canceladas" value={quotations.filter(q => q.status === 'CANCELADA').length} icon={XCircle} className="opacity-80" />
            </div>

            {/* List Container */}
            <div className="bg-secondary rounded-[12px] border border-color shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-color bg-tertiary flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative group w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={15} />
                        <input
                            type="text"
                            placeholder="Buscar por empresa o artículo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-9 pl-10 pr-4 bg-secondary border border-color rounded-lg text-[13px] text-text-primary outline-none focus:border-primary-500 transition-all"
                        />
                    </div>
                    <div className="relative" ref={filterRef}>
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={cn(
                                "h-9 px-4 bg-secondary border border-color rounded-xl text-[12px] font-[700] flex items-center gap-2.5 transition-all hover:bg-tertiary shadow-sm min-w-[160px] justify-between",
                                filterStatus !== 'TODAS' && "border-primary-500/50 bg-primary-500/5 text-primary-500"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Filter size={15} className={filterStatus !== 'TODAS' ? "text-primary-500" : "text-text-muted"} />
                                <span className="uppercase tracking-wide">
                                    {filterStatus === 'TODAS' ? 'Filtrar Estado' : filterStatus.replace('_', ' ')}
                                </span>
                            </div>
                            <ChevronDown size={14} className={cn("transition-transform duration-300", isFilterOpen && "rotate-180")} />
                        </button>

                        {isFilterOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-secondary/95 backdrop-blur-xl border border-color rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.3)] z-[200] overflow-hidden py-2 animate-in slide-in-from-top-2 duration-200">
                                <div className="px-4 py-2 bg-tertiary/50 border-b border-color mb-1">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Opciones de Filtro</span>
                                </div>
                                {['TODAS', 'PENDIENTE', 'EN_REVISION', 'APROBADA', 'COMPRADA', 'RECHAZADA', 'CANCELADA'].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => {
                                            setFilterStatus(s);
                                            setCurrentPage(1);
                                            setIsFilterOpen(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-[600] transition-all hover:bg-tertiary group",
                                            filterStatus === s ? "text-primary-500 bg-primary-500/5" : "text-text-secondary"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-2 h-2 rounded-full",
                                                s === 'TODAS' ? "bg-text-muted" :
                                                    s === 'PENDIENTE' ? "bg-orange-500" :
                                                        s === 'EN_REVISION' ? "bg-primary-500" :
                                                            s === 'APROBADA' ? "bg-emerald-500" :
                                                                s === 'COMPRADA' ? "bg-purple-500" :
                                                                    s === 'RECHAZADA' ? "bg-red-500" : "bg-text-muted"
                                            )} />
                                            <span>{s === 'TODAS' ? 'Todas (Historial)' : s.replace('_', ' ')}</span>
                                        </div>
                                        {filterStatus === s && <Check size={14} className="text-primary-500" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto no-scrollbar min-h-[400px]">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-tertiary border-b border-color">
                                <th className="pl-10 pr-4 py-4 text-left text-[10px] font-black">
                                    <input
                                        type="checkbox"
                                        checked={quotations.length > 0 && selectedQuotations.length === quotations.length}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500 bg-secondary border-color"
                                    />
                                </th>
                                <th className="px-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider">ID</th>
                                <th className="px-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider">TÍTULO</th>
                                <th className="px-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider">EMPRESA / CLIENTE</th>
                                <th className="px-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider">ESTADO</th>
                                <th className="px-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider">RESPONSABLE</th>
                                <th className="px-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider">ÚLTIMA ACTUALIZACIÓN</th>
                                <th className="px-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider text-right pr-10">ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-color">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-20">
                                        <Loader2 size={32} className="animate-spin text-[#0695c4] mx-auto mb-4" />
                                        <p className="text-[11px] font-[700] uppercase tracking-widest text-[#94a3b8]">Consultando base...</p>
                                    </td>
                                </tr>
                            ) : quotations.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-32 text-[#94a3b8] opacity-40">
                                        <FileText size={64} className="mx-auto mb-4" />
                                        <p className="text-[11px] font-[700] uppercase tracking-widest">Sin registros de cotización</p>
                                    </td>
                                </tr>
                            ) : (
                                currentQuotations.map(q => {
                                    const isSelected = selectedQuotations.includes(q._id);
                                    return (
                                        <tr key={q._id} className={cn("hover:bg-tertiary transition-colors cursor-pointer group", isSelected && "bg-primary-500/10")} onClick={() => onSelect(q._id)}>
                                            <td className="pl-10 pr-4 py-4 text-left align-middle" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectQuotation(q._id)}
                                                    className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500 bg-secondary border-color"
                                                />
                                            </td>
                                            <td className="px-4 py-4 align-middle text-[13px] text-text-secondary font-[600]">
                                                {q.quotation_number ? `#${q.quotation_number}` : '---'}
                                            </td>
                                            <td className="px-4 py-4 align-middle text-[13px] text-primary-500 font-[700] hover:underline">
                                                {q.title}
                                            </td>
                                            <td className="px-4 py-4 align-middle text-[12px] text-text-secondary font-[500] max-w-[200px] truncate">
                                                <span className={cn(q.company && "bg-tertiary px-2 py-1 rounded text-text-muted border border-color")}>{q.company || '---'}</span>
                                            </td>
                                            <td className="px-4 py-4 align-middle">
                                                <StatusBadge status={q.status} />
                                            </td>
                                            <td className="px-4 py-4 align-middle text-[12px] text-text-secondary font-[600]">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary-500/10 flex items-center justify-center text-primary-500">
                                                        <User size={12} />
                                                    </div>
                                                    <span className="truncate max-w-[120px] uppercase">{q.assigned_to || 'Sin asignar'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-middle text-[12px] text-text-muted">
                                                {new Date(q.updatedAt).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-4 align-middle text-right pr-10">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onSelect(q._id); }}
                                                    className="w-8 h-8 rounded-lg bg-tertiary text-text-muted flex items-center justify-center hover:bg-primary-500/20 hover:text-primary-500 border border-color transition-colors ml-auto"
                                                    title="Ver Detalle"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && quotations.length > ITEMS_PER_PAGE && (
                    <div className="p-4 bg-tertiary border-t border-color flex items-center justify-between px-6">
                        <p className="text-[11px] font-[600] text-text-muted uppercase tracking-[1px]">Página {currentPage} de {totalPages}</p>
                        <div className="flex gap-3">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="h-9 px-4 bg-secondary border border-color rounded-lg text-[11px] font-[600] text-text-secondary uppercase tracking-widest disabled:opacity-40 hover:bg-tertiary transition-all"
                            >
                                Anterior
                            </button>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="h-9 px-4 bg-secondary border border-color rounded-lg text-[11px] font-[600] text-text-secondary uppercase tracking-widest disabled:opacity-40 hover:bg-tertiary transition-all"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {/* Delete Confirmation Modal */}
            {
                showDeleteModal && (
                    <div className="fixed inset-0 bg-[#020617]/80 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-secondary rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-color">
                            <div className="p-6">
                                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                                    <AlertCircle className="text-red-500" size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-text-primary text-center mb-2">Eliminar cotizaciones</h3>
                                <p className="text-text-muted text-center text-[14px]">
                                    ¿Estás seguro de que deseas eliminar permanentemente <b>{selectedQuotations.length}</b> cotización{selectedQuotations.length > 1 ? 'es' : ''}? Esta acción no se puede deshacer.
                                </p>
                            </div>
                            <div className="px-6 py-4 bg-tertiary border-t border-color flex justify-end gap-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    disabled={isDeleting}
                                    className="px-4 py-2 text-text-secondary font-semibold text-[13px] hover:bg-secondary rounded-xl transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={isDeleting}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-[13px] rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-red-500/20"
                                >
                                    {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
