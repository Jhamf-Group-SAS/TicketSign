import React, { useState, useEffect } from 'react';
import { db } from '../store/db';
import { 
    ChevronLeft, 
    Users, 
    FileText, 
    Send, 
    Search, 
    Building2, 
    Package, 
    CheckCircle, 
    Calendar, 
    RefreshCw,
    BarChart3,
    TrendingUp,
    Clock,
    Sparkles,
    SlidersHorizontal,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    CheckCircle2,
    XCircle,
    AlertCircle,
    PenTool,
    User
} from 'lucide-react';
import { toast } from './Toast';
import CustomDatePicker from './CustomDatePicker';
import { cn } from '../utils/cn';
import { downloadBlob } from '../utils/download';

const ClientConsolidated = ({ onBack, onViewAct }) => {
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientActs, setClientActs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('count'); // count | name | lastActivity
    const [clientsPage, setClientsPage] = useState(1);
    const [clientsPerPage, setClientsPerPage] = useState(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [projectId, setProjectId] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [selectedDate, setSelectedDate] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerAnchor, setDatePickerAnchor] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedActId, setExpandedActId] = useState(null);
    const [actsPerPage, setActsPerPage] = useState(5);

    const [globalStats, setGlobalStats] = useState({
        totalClients: 0,
        totalActs: 0,
        preventiveActs: 0,
        correctiveActs: 0,
        deliveryActs: 0,
        mostActiveClient: 'Ninguno',
        mostActiveCount: 0
    });

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        const allActs = await db.acts.toArray();
        let preventiveActs = 0;
        let correctiveActs = 0;
        let deliveryActs = 0;

        const clientGroups = allActs.reduce((acc, act) => {
            const client = act.client_name || 'Sin Cliente';
            
            if (act.type === 'PREVENTIVO') preventiveActs++;
            else if (act.type === 'CORRECTIVO') correctiveActs++;
            else if (act.type === 'ENTREGA') deliveryActs++;

            if (!acc[client]) {
                acc[client] = { 
                    name: client, 
                    count: 0, 
                    lastActivity: act.createdAt,
                    preventiveCount: 0,
                    correctiveCount: 0,
                    deliveryCount: 0
                };
            }
            acc[client].count++;
            
            if (act.type === 'PREVENTIVO') acc[client].preventiveCount++;
            else if (act.type === 'CORRECTIVO') acc[client].correctiveCount++;
            else if (act.type === 'ENTREGA') acc[client].deliveryCount++;

            if (new Date(act.createdAt) > new Date(acc[client].lastActivity)) {
                acc[client].lastActivity = act.createdAt;
            }
            return acc;
        }, {});

        const clientsList = Object.values(clientGroups);
        setClients(clientsList);

        // Compute most active client
        let mostActiveClient = 'Ninguno';
        let mostActiveCount = 0;
        clientsList.forEach(c => {
            if (c.count > mostActiveCount) {
                mostActiveCount = c.count;
                mostActiveClient = c.name;
            }
        });

        setGlobalStats({
            totalClients: clientsList.length,
            totalActs: allActs.length,
            preventiveActs,
            correctiveActs,
            deliveryActs,
            mostActiveClient,
            mostActiveCount
        });
    };

    const handleSelectClient = async (clientName) => {
        const acts = await db.acts.where('client_name').equals(clientName).sortBy('createdAt');
        setSelectedClient(clientName);
        setClientActs(acts.reverse());
        setCurrentPage(1);
        setExpandedActId(null);
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/reports/export-consolidated`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                },
                body: JSON.stringify({
                    client_name: selectedClient,
                    acts: clientActs
                })
            });

            if (response.ok) {
                const data = await response.blob();
                const safeName = (selectedClient || 'Consolidado').replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
                await downloadBlob(data, `Consolidado_${safeName}.pdf`);
                toast.success('PDF exportado con éxito');
            } else {
                toast.error('Error al exportar PDF');
            }
        } catch (error) {
            toast.error('Error de conexión');
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportCSV = async () => {
        setIsExportingCSV(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/reports/export-csv`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                },
                body: JSON.stringify({
                    client_name: selectedClient,
                    acts: clientActs
                })
            });

            if (response.ok) {
                const data = await response.blob();
                const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
                const safeName = (selectedClient || 'Reporte').replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
                await downloadBlob(blob, `Consolidado_${safeName}.csv`);
                toast.success('Excel (CSV) exportado con éxito');
            } else {
                toast.error('Error al exportar CSV');
            }
        } catch (error) {
            toast.error('Error de conexión');
        } finally {
            setIsExportingCSV(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!projectId) {
            toast.error('Debe especificar el ID del Proyecto de GLPI');
            return;
        }

        setIsGenerating(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/reports/consolidated`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                },
                body: JSON.stringify({
                    client_name: selectedClient,
                    acts: clientActs,
                    projectId: projectId
                })
            });

            if (response.ok) {
                const data = await response.json();
                toast.success(`Sincronizado con éxito en Proyecto ID: ${data.glpiId}`);
            } else {
                const err = await response.json();
                toast.error(`Error: ${err.message}`);
            }
        } catch (error) {
            toast.error('Error de conexión con el servidor');
        } finally {
            setIsGenerating(false);
        }
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedClients = [...filteredClients].sort((a, b) => {
        if (sortBy === 'name') {
            return a.name.localeCompare(b.name);
        } else if (sortBy === 'lastActivity') {
            return new Date(b.lastActivity) - new Date(a.lastActivity);
        } else {
            return b.count - a.count;
        }
    });

    // Reset to page 1 when filters change (render-time guard, avoids extra effect)
    const _sortRef = React.useRef(sortBy + searchTerm);
    if (_sortRef.current !== sortBy + searchTerm) {
        _sortRef.current = sortBy + searchTerm;
        Promise.resolve().then(() => setClientsPage(1));
    }

    const totalClientPages = Math.ceil(sortedClients.length / clientsPerPage);
    const paginatedClients = sortedClients.slice(
        (clientsPage - 1) * clientsPerPage,
        clientsPage * clientsPerPage
    );

    return (
        <div className="space-y-8 pb-24 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-5 duration-700">
            
            {/* Header Area */}
            <div className="flex items-center gap-3 bg-secondary p-3 md:p-5 rounded-2xl border border-color shadow-sm sticky top-[73px] z-40 transition-all overflow-hidden">
                <button
                    onClick={selectedClient ? () => setSelectedClient(null) : onBack}
                    className="p-2.5 md:p-3 bg-tertiary border border-color text-text-muted hover:text-primary-500 rounded-xl transition-all active:scale-90 group shrink-0"
                >
                    <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                </button>
                <div className="min-w-0 flex-1 overflow-hidden">
                    <h2 className="text-sm md:text-lg font-black flex items-center gap-2 text-text-primary uppercase tracking-tighter overflow-hidden">
                        {selectedClient ? (
                            <>
                                <Building2 size={16} className="text-primary-500 shrink-0 animate-pulse" />
                                <span className="truncate block min-w-0">Consolidado: {selectedClient}</span>
                            </>
                        ) : (
                            <>
                                <Users size={16} className="text-primary-500 shrink-0" />
                                <span className="truncate">Control de Cartera</span>
                            </>
                        )}
                    </h2>
                    <p className="text-[9px] md:text-[10px] uppercase font-black text-text-muted tracking-[0.2em] mt-0.5 md:mt-1 border-l-2 border-primary-500/30 pl-3 ml-1 opacity-70 truncate">
                        {selectedClient ? 'Reporte Operativo Detallado' : 'Gestión Centralizada por Cliente'}
                    </p>
                </div>
            </div>

            {!selectedClient ? (
                <div className="space-y-8">
                    {/* General Statistics Panels (Dashboard style) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Stat 1: Total Clients */}
                        <div className="bg-secondary border border-color rounded-2xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-primary-500/5 blur-lg pointer-events-none group-hover:bg-primary-500/10 transition-colors" />
                            <div className="space-y-1 relative">
                                <span className="text-[10px] font-black uppercase text-text-muted tracking-wider">Total Clientes</span>
                                <h3 className="text-3xl font-black text-text-primary tracking-tight">{globalStats.totalClients}</h3>
                                <p className="text-[9px] font-bold text-text-muted uppercase">Entidades atendidas</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center shrink-0 shadow-sm border border-primary-500/5 group-hover:scale-110 transition-transform">
                                <Users size={20} />
                            </div>
                        </div>

                        {/* Stat 2: Total Maintenance Acts */}
                        <div className="bg-secondary border border-color rounded-2xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-indigo-500/5 blur-lg pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
                            <div className="space-y-1 relative">
                                <span className="text-[10px] font-black uppercase text-text-muted tracking-wider">Mantenimientos</span>
                                <h3 className="text-3xl font-black text-text-primary tracking-tight">{globalStats.totalActs}</h3>
                                <p className="text-[9px] font-bold text-text-muted uppercase">Historial completo</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 shadow-sm border border-indigo-500/5 group-hover:scale-110 transition-transform">
                                <BarChart3 size={20} />
                            </div>
                        </div>

                        {/* Stat 3: Distribution percentage visual */}
                        <div className="bg-secondary border border-color rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group min-h-[92px]">
                            <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-emerald-500/5 blur-lg pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
                            <div className="space-y-2 relative w-full">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-text-muted">
                                    <span>Distribución Actas</span>
                                    <span className="flex items-center gap-1"><Sparkles size={10} className="text-emerald-500 shrink-0" /> Tipos</span>
                                </div>
                                <div className="w-full h-2 bg-tertiary rounded-full overflow-hidden flex shadow-inner mt-1">
                                    {globalStats.totalActs > 0 ? (
                                        <>
                                            <div style={{ width: `${(globalStats.preventiveActs / globalStats.totalActs) * 100}%` }} className="bg-indigo-500 h-full" title="Preventivos" />
                                            <div style={{ width: `${(globalStats.correctiveActs / globalStats.totalActs) * 100}%` }} className="bg-amber-500 h-full" title="Correctivos" />
                                            <div style={{ width: `${(globalStats.deliveryActs / globalStats.totalActs) * 100}%` }} className="bg-emerald-500 h-full" title="Entregas" />
                                        </>
                                    ) : (
                                        <div className="w-full bg-tertiary h-full" />
                                    )}
                                </div>
                                <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider text-text-muted mt-1.5 pt-0.5">
                                    <span className="text-indigo-500">P: {globalStats.preventiveActs}</span>
                                    <span className="text-amber-500">C: {globalStats.correctiveActs}</span>
                                    <span className="text-emerald-500">E: {globalStats.deliveryActs}</span>
                                </div>
                            </div>
                        </div>

                        {/* Stat 4: Most Active Client */}
                        <div className="bg-secondary border border-color rounded-2xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-amber-500/5 blur-lg pointer-events-none group-hover:bg-amber-500/10 transition-colors" />
                            <div className="space-y-1 relative min-w-0 flex-1 pr-2">
                                <span className="text-[10px] font-black uppercase text-text-muted tracking-wider">Cliente Más Activo</span>
                                <h3 className="text-base font-black text-text-primary tracking-tight truncate uppercase leading-tight mt-1">{globalStats.mostActiveClient}</h3>
                                <p className="text-[9px] font-bold text-text-muted uppercase mt-0.5">{globalStats.mostActiveCount} intervenciones</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 shadow-sm border border-amber-500/5 group-hover:scale-110 transition-transform">
                                <Building2 size={20} />
                            </div>
                        </div>
                    </div>

                    {/* Search Field & Sort Segment Controls */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-secondary/40 border border-color rounded-2xl p-4 shadow-sm">
                        {/* Search Input */}
                        <div className="relative w-full sm:max-w-md group/search">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-muted group-focus-within/search:text-primary-500 transition-colors">
                                <Search size={18} />
                            </span>
                            <input
                                type="text"
                                placeholder="Buscar cliente por nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-secondary border border-color focus:border-primary-500 rounded-xl py-3 pl-11 pr-4 text-sm focus:ring-4 focus:ring-primary-500/5 transition-all text-text-primary placeholder:text-text-muted/55 outline-none shadow-sm"
                            />
                        </div>

                        {/* Sort Options */}
                        <div className="flex items-center gap-2 w-full sm:w-auto self-start sm:self-center bg-secondary border border-color p-1.5 rounded-xl shadow-sm overflow-x-auto no-scrollbar flex-nowrap">
                            <span className="text-[10px] uppercase font-black tracking-wider text-text-muted px-2.5 flex items-center gap-1.5 shrink-0">
                                <SlidersHorizontal size={12} className="text-primary-500" /> Ordenar:
                            </span>
                            {[
                                { id: 'count', label: 'Más Activos' },
                                { id: 'name', label: 'Nombre A-Z' },
                                { id: 'lastActivity', label: 'Última Actividad' }
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setSortBy(opt.id)}
                                    className={cn(
                                        "px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all active:scale-95 shrink-0",
                                        sortBy === opt.id ? "bg-primary-500 text-white shadow-sm" : "text-text-secondary hover:bg-tertiary"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                                 {/* Client Selection List (Tabular Row-based, not Card) */}
                    {sortedClients.length > 0 ? (
                        <>
                        <div className="bg-secondary border border-color dark:border-[#334155] rounded-2xl overflow-hidden shadow-sm divide-y divide-color dark:divide-[#334155]">
                            {paginatedClients.map((client, idx) => {
                                const total = client.count || 1;
                                const prevPct = Math.round((client.preventiveCount / total) * 100);
                                const corrPct = Math.round((client.correctiveCount / total) * 100);
                                const delivPct = Math.round((client.deliveryCount / total) * 100);

                                // Determine accent gradient based on the client's primary activity type
                                let avatarBg = 'from-primary-500 to-indigo-500';
                                
                                if (client.preventiveCount >= client.correctiveCount && client.preventiveCount >= client.deliveryCount) {
                                    avatarBg = 'from-indigo-500 to-blue-600';
                                } else if (client.correctiveCount >= client.preventiveCount && client.correctiveCount >= client.deliveryCount) {
                                    avatarBg = 'from-amber-500 to-orange-600';
                                } else if (client.deliveryCount >= client.preventiveCount && client.deliveryCount >= client.correctiveCount) {
                                    avatarBg = 'from-emerald-500 to-teal-600';
                                }

                                // Extract initials cleanly
                                const initials = client.name
                                    .split(' ')
                                    .filter(w => w.length > 0 && !['SAS', 'S.A.S', 'S.A.', 'SA', 'Y', 'DE', 'EL', 'LA'].includes(w.toUpperCase()))
                                    .slice(0, 2)
                                    .map(w => w[0])
                                    .join('')
                                    .toUpperCase() || client.name.slice(0, 2).toUpperCase();

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => handleSelectClient(client.name)}
                                        className="flex flex-col md:flex-row md:items-center justify-between p-5 hover:bg-tertiary/20 transition-all cursor-pointer group relative gap-4 border-b border-color dark:border-[#334155] last:border-b-0"
                                    >
                                        {/* Left hover visual indicator bar */}
                                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                        {/* Left Section: Initial avatar, Company Name and activity */}
                                        <div className="flex items-center gap-4 min-w-0 md:w-5/12">
                                            <div className={cn(
                                                "w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-sm bg-gradient-to-br shrink-0 transition-transform group-hover:scale-[1.03]",
                                                avatarBg
                                            )}>
                                                {initials}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-black text-sm text-text-primary uppercase tracking-tight group-hover:text-primary-500 transition-colors truncate">
                                                    {client.name}
                                                </h4>
                                                <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1.5 mt-1 opacity-70">
                                                    <Clock size={11} className="text-primary-500 shrink-0" />
                                                    Último reporte: {new Date(client.lastActivity).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Middle Section 1: Dynamic Sparkline progress line (Visible on larger screens) */}
                                        <div className="hidden lg:flex flex-col justify-center flex-1 max-w-[160px] px-2">
                                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-text-muted mb-1 px-0.5">
                                                <span>Distribución</span>
                                                <span className="text-primary-500">{client.count} Actas</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-tertiary rounded-full overflow-hidden flex shadow-inner">
                                                {client.preventiveCount > 0 && (
                                                    <div style={{ width: `${prevPct}%` }} className="bg-indigo-500 h-full" title={`Preventivos: ${prevPct}%`} />
                                                )}
                                                {client.correctiveCount > 0 && (
                                                    <div style={{ width: `${corrPct}%` }} className="bg-amber-500 h-full" title={`Correctivos: ${corrPct}%`} />
                                                )}
                                                {client.deliveryCount > 0 && (
                                                    <div style={{ width: `${delivPct}%` }} className="bg-emerald-500 h-full" title={`Entregas: ${delivPct}%`} />
                                                )}
                                            </div>
                                        </div>

                                        {/* Middle Section 2: Metric Badges */}
                                        <div className="flex flex-wrap gap-2 items-center md:justify-center">
                                            {client.preventiveCount > 0 && (
                                                <span className="inline-flex items-center gap-1.5 text-[8.5px] font-black px-2.5 py-1 bg-indigo-500/10 text-indigo-500 rounded-lg border border-indigo-500/20 uppercase tracking-widest transition-transform group-hover:scale-102">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> {client.preventiveCount} Prev.
                                                </span>
                                            )}
                                            {client.correctiveCount > 0 && (
                                                <span className="inline-flex items-center gap-1.5 text-[8.5px] font-black px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20 uppercase tracking-widest transition-transform group-hover:scale-102">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {client.correctiveCount} Corr.
                                                </span>
                                            )}
                                            {client.deliveryCount > 0 && (
                                                <span className="inline-flex items-center gap-1.5 text-[8.5px] font-black px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/20 uppercase tracking-widest transition-transform group-hover:scale-102">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {client.deliveryCount} Entr.
                                                </span>
                                            )}
                                        </div>

                                        {/* Right Section: Action label & sliding circle chevron */}
                                        <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden md:inline">
                                                Ver Reportes
                                            </span>
                                            <div className="w-8 h-8 rounded-full bg-tertiary border border-color flex items-center justify-center text-text-muted group-hover:text-white group-hover:bg-primary-500 group-hover:border-primary-500 transition-all duration-300 transform group-hover:translate-x-1 shadow-sm shrink-0">
                                                <ChevronLeft size={14} className="rotate-180" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Client Pagination Controls */}
                        {(totalClientPages > 1 || sortedClients.length > 5) && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                                {/* Per-page selector */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">Mostrar:</span>
                                    <div className="flex items-center gap-1 bg-secondary border border-color dark:border-[#334155] rounded-xl p-1">
                                        {[5, 10, 25, 50].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => { setClientsPerPage(n); setClientsPage(1); }}
                                                className={cn(
                                                    "px-3 py-1 text-[10px] font-black uppercase tracking-wide rounded-lg transition-all active:scale-95",
                                                    clientsPerPage === n
                                                        ? "bg-primary-500 text-white shadow-sm"
                                                        : "text-text-secondary hover:bg-tertiary"
                                                )}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="text-[10px] text-text-muted font-semibold">
                                        de {sortedClients.length} clientes
                                    </span>
                                </div>

                                {/* Page navigation */}
                                {totalClientPages > 1 && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setClientsPage(p => Math.max(1, p - 1))}
                                            disabled={clientsPage === 1}
                                            className="p-2 rounded-xl bg-secondary border border-color dark:border-[#334155] text-text-muted hover:text-primary-500 hover:border-primary-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90"
                                        >
                                            <ChevronLeft size={14} />
                                        </button>

                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: totalClientPages }, (_, i) => i + 1).map(page => (
                                                <button
                                                    key={page}
                                                    onClick={() => setClientsPage(page)}
                                                    className={cn(
                                                        "w-8 h-8 rounded-xl text-[11px] font-black transition-all active:scale-90",
                                                        clientsPage === page
                                                            ? "bg-primary-500 text-white shadow-sm"
                                                            : "text-text-secondary hover:bg-tertiary border border-color dark:border-[#334155]"
                                                    )}
                                                >
                                                    {page}
                                                </button>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => setClientsPage(p => Math.min(totalClientPages, p + 1))}
                                            disabled={clientsPage === totalClientPages}
                                            className="p-2 rounded-xl bg-secondary border border-color dark:border-[#334155] text-text-muted hover:text-primary-500 hover:border-primary-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90"
                                        >
                                            <ChevronLeft size={14} className="rotate-180" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        </>
                    ) : (
                        <div className="p-16 text-center bg-secondary border border-color rounded-2xl shadow-sm">
                            <div className="w-16 h-16 bg-tertiary rounded-2xl flex items-center justify-center mx-auto mb-4 opacity-50 border border-color">
                                <Search size={28} className="text-text-muted" />
                            </div>
                            <h4 className="text-sm font-black text-text-primary uppercase tracking-wider">No se encontraron clientes</h4>
                            <p className="text-xs text-text-muted mt-1 font-semibold">Intente refinar la búsqueda con un nombre diferente.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Selected Client COVER CARD - Mobile optimized */}
                    <div className="bg-gradient-to-r from-slate-50 via-slate-100/50 to-indigo-50/30 text-text-primary dark:bg-gradient-to-r dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 dark:text-white rounded-2xl p-4 md:p-8 border border-color dark:border-slate-800 shadow-md dark:shadow-2xl relative overflow-hidden transition-all duration-500">
                        {/* Light highlights */}
                        <div className="absolute right-0 top-0 w-[400px] h-[400px] rounded-full bg-primary-500/5 dark:bg-primary-500/10 blur-[100px] pointer-events-none" />
                        <div className="absolute -left-10 -bottom-10 w-[250px] h-[250px] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[80px] pointer-events-none" />

                        {/* Background visual graphics */}
                        <div className="absolute right-12 bottom-0 opacity-5 pointer-events-none hidden md:block text-slate-400 dark:text-slate-500">
                            <Building2 size={180} className="stroke-[1.5]" />
                        </div>

                        {/* Mobile: horizontal compact row / Desktop: vertical centered */}
                        <div className="flex flex-row items-center gap-4 md:flex-col md:items-center lg:flex-row lg:items-start relative z-10">
                            {/* Avatar - smaller on mobile */}
                            <div className="w-14 h-14 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 dark:from-primary-400 dark:to-indigo-600 flex items-center justify-center font-black text-2xl md:text-3xl text-white shadow-xl shadow-primary-500/15 dark:shadow-primary-500/20 border border-white/20 dark:border-white/25 shrink-0">
                                {selectedClient[0]?.toUpperCase() || 'C'}
                            </div>

                            {/* Text block */}
                            <div className="flex-1 min-w-0 text-left md:text-center lg:text-left">
                                <span className="text-[8px] md:text-[9px] font-black tracking-[0.2em] bg-primary-500/10 dark:bg-white/10 text-primary-600 dark:text-primary-300 px-2.5 py-1 rounded-full uppercase border border-primary-500/10 dark:border-white/5 inline-block">
                                    Resumen Corporativo
                                </span>
                                <h2 className="text-lg md:text-3xl font-black tracking-tight mt-2 uppercase truncate leading-tight text-text-primary dark:text-white">
                                    {selectedClient}
                                </h2>
                                <p className="text-[11px] md:text-xs text-text-secondary dark:text-slate-300 font-bold tracking-wide mt-1.5 md:mt-2.5 opacity-90 leading-relaxed max-w-2xl hidden sm:block">
                                    Panel integrado para el seguimiento de actas técnicas, controles operativos, firmas de conformidad y sincronización de tickets de soporte con GLPI.
                                </p>

                                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 opacity-90 text-[10px] md:text-[11px] font-black uppercase tracking-wider text-text-muted dark:text-slate-300 justify-start md:justify-center lg:justify-start">
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={11} className="text-primary-500 dark:text-primary-400 shrink-0" />
                                        <span>Últ. Reporte: {clientActs[0] ? new Date(clientActs[0].createdAt).toLocaleDateString() : '---'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Users size={11} className="text-primary-500 dark:text-primary-400 shrink-0" />
                                        <span>{clientActs.length} Servicios</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Integrated Tools Bar - Mobile optimized */}
                    <div className="bg-secondary/60 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-color shadow-premium flex flex-col gap-4">
                        {/* Project Input */}
                        <div className="bg-tertiary/40 border border-color rounded-xl p-3 flex flex-col justify-center relative transition-all duration-300 hover:border-primary-500/40 focus-within:border-primary-500/60 focus-within:ring-4 focus-within:ring-primary-500/5">
                            <label className="text-[9px] uppercase font-black text-primary-500 tracking-[0.2em] block mb-1 pl-0.5">Integración Proyecto GLPI</label>
                            <div className="relative flex items-center">
                                <input
                                    type="number"
                                    placeholder="Especificar ID Proyecto"
                                    value={projectId}
                                    onChange={(e) => setProjectId(e.target.value)}
                                    className="w-full bg-transparent border-0 rounded-lg px-0.5 py-1 text-xs font-black text-text-primary focus:outline-none focus:ring-0 transition-all shadow-none outline-none placeholder:text-text-muted/40"
                                />
                                <Sparkles size={14} className="text-primary-500 opacity-60 absolute right-1 pointer-events-none" />
                            </div>
                        </div>

                        {/* Action Buttons - 2-col grid on mobile, row on desktop */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                            <button
                                onClick={handleExportCSV}
                                disabled={isExportingCSV}
                                className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white px-3 py-2.5 rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-[10px] font-black uppercase tracking-wider"
                            >
                                {isExportingCSV ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                                ) : (
                                    <Package size={14} className="shrink-0" />
                                )}
                                <span>Descargar CSV</span>
                            </button>

                            <button
                                onClick={handleExportPDF}
                                disabled={isExporting}
                                className="bg-tertiary border border-color hover:bg-secondary hover:border-primary-500/30 active:scale-95 text-text-primary px-3 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-[10px] font-black uppercase tracking-wider"
                            >
                                {isExporting ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary-500 shrink-0" />
                                ) : (
                                    <FileText size={14} className="text-primary-500 shrink-0" />
                                )}
                                <span>Exportar PDF</span>
                            </button>

                            <button
                                onClick={handleGenerateReport}
                                disabled={isGenerating}
                                className="col-span-2 md:col-span-1 bg-gradient-to-r from-primary-500 to-blue-600 hover:from-primary-600 hover:to-blue-700 active:scale-95 text-white px-3 py-2.5 rounded-xl shadow-xl shadow-primary-500/15 flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-[10px] font-black uppercase tracking-wider"
                            >
                                {isGenerating ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                                ) : (
                                    <Send size={14} className="shrink-0" />
                                )}
                                <span>Sincronizar en GLPI</span>
                            </button>
                        </div>
                    </div>

                    {/* Capsule Category Filters & Date filter */}
                    {(() => {
                        const filteredResults = clientActs.filter(act => {
                            const matchesType = filterType === 'ALL' || act.type === filterType;
                            const actDateString = act.scheduled_date || act.createdAt;
                            const actDate = new Date(actDateString).toISOString().split('T')[0];
                            const matchesDate = !selectedDate || actDate === selectedDate;
                            return matchesType && matchesDate;
                        });

                        const totalPages = Math.ceil(filteredResults.length / actsPerPage);
                        const startIndex = (currentPage - 1) * actsPerPage;
                        const paginatedResults = filteredResults.slice(startIndex, startIndex + actsPerPage);

                        return (
                            <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondary p-3 rounded-2xl border border-color shadow-sm">
                                    <div className="flex flex-wrap gap-1.5">
                                        <button
                                            onClick={() => { setFilterType('ALL'); setCurrentPage(1); }}
                                            className={cn(
                                                "px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all active:scale-95 flex items-center gap-2",
                                                filterType === 'ALL'
                                                    ? "bg-primary-500 border-primary-500 text-white shadow-lg shadow-primary-500/20"
                                                    : "bg-tertiary border-color text-text-secondary hover:bg-secondary"
                                            )}
                                        >
                                            <span>Todos</span>
                                            <span className={cn("px-1.5 py-0.5 rounded-md text-[9px] font-black", filterType === 'ALL' ? "bg-white/20 text-white" : "bg-tertiary border border-color text-text-muted")}>
                                                {clientActs.length}
                                            </span>
                                        </button>

                                        {[
                                            { id: 'PREVENTIVO', label: 'Preventivos', color: 'indigo', colorClass: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20', activeClass: 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20' },
                                            { id: 'CORRECTIVO', label: 'Correctivos', color: 'amber', colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/20', activeClass: 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' },
                                            { id: 'ENTREGA', label: 'Entregas', color: 'emerald', colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', activeClass: 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20' }
                                        ].map(item => {
                                            const count = clientActs.filter(a => a.type === item.id).length;
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => { setFilterType(item.id); setCurrentPage(1); }}
                                                    className={cn(
                                                        "px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all active:scale-95 flex items-center gap-2",
                                                        filterType === item.id ? item.activeClass : "bg-tertiary border-color text-text-secondary hover:bg-secondary"
                                                    )}
                                                >
                                                    <span>{item.label}</span>
                                                    <span className={cn("px-1.5 py-0.5 rounded-md text-[9px] font-black", filterType === item.id ? "bg-white/20 text-white" : item.colorClass)}>
                                                        {count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Date Filter */}
                                    <div className="relative self-stretch sm:self-center shrink-0 min-w-[160px] group/date">
                                        <button
                                            onClick={(e) => {
                                                setShowDatePicker(true);
                                                setDatePickerAnchor(e.currentTarget);
                                            }}
                                            className="w-full bg-tertiary border border-color rounded-xl px-3.5 py-2 text-[11px] font-black text-text-primary flex items-center justify-between hover:bg-secondary transition-all shadow-inner group-hover/date:border-primary-500/40"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <Calendar size={13} className="text-primary-500 shrink-0" />
                                                <span className="truncate">{selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString() : 'Cualquier Fecha'}</span>
                                            </div>
                                            <ChevronDown size={14} className="text-text-muted shrink-0 transition-transform group-hover/date:text-primary-500" />
                                        </button>

                                        {showDatePicker && (
                                            <CustomDatePicker
                                                anchorEl={datePickerAnchor}
                                                value={selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date()}
                                                hideTime={true}
                                                onChange={(val) => {
                                                    setSelectedDate(new Date(val).toISOString().split('T')[0]);
                                                    setShowDatePicker(false);
                                                    setCurrentPage(1);
                                                    setDatePickerAnchor(null);
                                                }}
                                                onClose={() => {
                                                    setShowDatePicker(false);
                                                    setDatePickerAnchor(null);
                                                }}
                                            />
                                        )}

                                        {selectedDate && (
                                            <button
                                                onClick={() => { setSelectedDate(''); setCurrentPage(1); }}
                                                className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-red-500 hover:text-red-600 transition-colors bg-secondary border border-color rounded-full shadow-sm hover:scale-105 active:scale-95"
                                                title="Limpiar fecha"
                                            >
                                                <XCircle size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Premium Table with Expandable Accordion rows */}
                                <div className="bg-secondary rounded-2xl border border-color shadow-sm overflow-hidden transition-all">
                                    {/* Desktop View Table */}
                                    <div className="hidden lg:block overflow-x-auto no-scrollbar">
                                        <table className="w-full text-left border-collapse min-w-full">
                                            <thead>
                                                <tr className="bg-tertiary/75 border-b border-color dark:border-[#334155] text-[10px] font-black text-text-muted uppercase tracking-widest">
                                                    <th className="pl-8 pr-4 py-4">Ticket</th>
                                                    <th className="px-6 py-4">Equipo / Host</th>
                                                    <th className="px-6 py-4">Tipo Acta</th>
                                                    <th className="px-6 py-4">Fecha Programada</th>
                                                    <th className="px-6 py-4">Firma Técnico</th>
                                                    <th className="px-6 py-4">Firma Cliente</th>
                                                    <th className="px-6 py-4 text-center pr-8">Ficha</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-color dark:divide-[#334155]">
                                                {paginatedResults.length > 0 ? (
                                                    paginatedResults.map(act => {
                                                        const isExpanded = expandedActId === act.id;
                                                        const hasTechnicalSignature = !!act.signatures?.technical;
                                                        const hasClientSignature = !!act.signatures?.client;

                                                        return (
                                                            <>
                                                                <tr 
                                                                    key={act.id} 
                                                                    onClick={() => setExpandedActId(isExpanded ? null : act.id)}
                                                                    className={cn(
                                                                        "hover:bg-tertiary/20 transition-all cursor-pointer group/row border-b border-color dark:border-[#334155]",

                                                                        isExpanded && "bg-primary-500/[0.02]"
                                                                    )}
                                                                >
                                                                    <td className="pl-8 pr-4 py-4 align-middle">
                                                                        <span className="text-[12px] font-black text-primary-500 tabular-nums">#{act.glpi_ticket_id || '---'}</span>
                                                                    </td>
                                                                    <td className="px-6 py-4 align-middle">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[12px] font-black text-text-primary uppercase tracking-tight truncate max-w-[200px]">{act.equipment_model || 'Genérico'}</span>
                                                                            <span className="text-[9px] font-bold text-text-muted opacity-60 uppercase tracking-widest mt-0.5">{act.equipment_serial || 'SIN SERIAL'}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4 align-middle">
                                                                        <span className={cn(
                                                                            "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shrink-0",
                                                                            act.type === 'PREVENTIVO' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' :
                                                                            act.type === 'ENTREGA' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                                                            'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                                        )}>
                                                                            {act.type}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-4 align-middle">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[11px] font-black text-text-primary uppercase tracking-tight">
                                                                                {new Date(act.scheduled_date || act.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                            </span>
                                                                            <span className="text-[9px] font-bold text-text-muted opacity-50 uppercase tracking-tighter">
                                                                                Registro: {new Date(act.createdAt).toLocaleDateString()}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4 align-middle">
                                                                        {hasTechnicalSignature ? (
                                                                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                                                                <CheckCircle2 size={11} className="shrink-0" /> Firmado
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                                                                <AlertCircle size={11} className="shrink-0" /> Pendiente
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-6 py-4 align-middle">
                                                                        {hasClientSignature ? (
                                                                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                                                                <CheckCircle2 size={11} className="shrink-0" /> Firmado
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                                                                <AlertCircle size={11} className="shrink-0" /> Pendiente
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-6 py-4 align-middle pr-8 text-center">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setExpandedActId(isExpanded ? null : act.id);
                                                                            }}
                                                                            className="p-1.5 rounded-lg bg-tertiary border border-color text-text-muted group-hover/row:text-primary-500 group-hover/row:border-primary-500/30 transition-all hover:bg-secondary active:scale-90"
                                                                        >
                                                                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                                                        </button>
                                                                    </td>
                                                                </tr>

                                                                {/* Expanded Sub-Panel Details Row */}
                                                                {isExpanded && (
                                                                    <tr className="bg-primary-500/[0.01]">
                                                                        <td colSpan={7} className="px-8 py-5">
                                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 bg-secondary/40 backdrop-blur-sm p-5 rounded-2xl border border-color shadow-inner animate-in slide-in-from-top-3 duration-300">
                                                                                {/* Technical Details Column */}
                                                                                <div className="space-y-4 pr-6 md:border-r border-color">
                                                                                    <h5 className="text-[10px] font-black text-primary-500 uppercase tracking-[0.2em] border-b border-color dark:border-[#334155] pb-2 flex items-center gap-2">
                                                                                        <Sparkles size={11} className="shrink-0 animate-pulse" /> Detalle Técnico del Servicio
                                                                                    </h5>
                                                                                    <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-text-secondary">
                                                                                        <div>
                                                                                            <p className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-0.5">Equipo / Hostname</p>
                                                                                            <p className="text-text-primary font-bold uppercase">{act.equipment_hostname || 'Sin Hostname'}</p>
                                                                                        </div>
                                                                                        <div>
                                                                                            <p className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-0.5">Tipo de Equipo</p>
                                                                                            <p className="text-text-primary font-bold uppercase">{act.equipment_type || 'Genérico'}</p>
                                                                                        </div>
                                                                                        <div>
                                                                                            <p className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-0.5">Modelo</p>
                                                                                            <p className="text-text-primary font-bold uppercase">{act.equipment_model || '---'}</p>
                                                                                        </div>
                                                                                        <div>
                                                                                            <p className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-0.5">Número de Serial</p>
                                                                                            <p className="text-text-primary font-bold uppercase tabular-nums">{act.equipment_serial || '---'}</p>
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="pt-2">
                                                                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-1.5">Observaciones / Diagnóstico</p>
                                                                                        <div className="bg-tertiary/40 border border-color rounded-xl p-3.5 text-xs text-text-secondary leading-relaxed italic max-h-[100px] overflow-y-auto custom-scrollbar">
                                                                                            {act.checklist?.observaciones || act.checklist?.diagnostico || act.checklist?.descripcion || 'Sin observaciones registradas en este servicio.'}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Technician & Signatures Column */}
                                                                                <div className="space-y-4 flex flex-col justify-between pl-0 md:pl-6 pt-6 md:pt-0">
                                                                                    <div>
                                                                                        <h5 className="text-[10px] font-black text-primary-500 uppercase tracking-[0.2em] border-b border-color dark:border-[#334155] pb-2 flex items-center gap-2">
                                                                                            <User size={11} className="shrink-0" /> Técnico y Certificaciones
                                                                                        </h5>
                                                                                        
                                                                                        <div className="flex items-center gap-3.5 py-2">
                                                                                            <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-500 text-sm font-black shadow-sm shrink-0">
                                                                                                {act.technical_name?.[0]?.toUpperCase() || <User size={16} />}
                                                                                            </div>
                                                                                            <div>
                                                                                                <p className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-0.5">Técnico de Soporte</p>
                                                                                                <p className="text-xs font-black text-text-primary uppercase tracking-tight">{act.technical_name || 'Asignado en GLPI'}</p>
                                                                                            </div>
                                                                                        </div>

                                                                                        <div className="grid grid-cols-2 gap-3.5 mt-3 pt-2 border-t border-color dark:border-[#334155]">
                                                                                            <div className="bg-tertiary/30 rounded-xl p-3 border border-color dark:border-[#334155] flex items-center gap-3">
                                                                                                <PenTool size={16} className={hasTechnicalSignature ? "text-emerald-500" : "text-text-muted"} />
                                                                                                <div>
                                                                                                    <p className="text-[8px] font-black text-text-muted uppercase tracking-wider">Firma Técnico</p>
                                                                                                    <p className={cn("text-[10px] font-black uppercase mt-0.5", hasTechnicalSignature ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-500")}>
                                                                                                        {hasTechnicalSignature ? "Registrada" : "Falta"}
                                                                                                    </p>
                                                                                                </div>
                                                                                            </div>
                                                                                                            <div className="bg-tertiary/30 rounded-xl p-3 border border-color dark:border-[#334155] flex items-center gap-3">
                                                                                                <PenTool size={16} className={hasClientSignature ? "text-emerald-500" : "text-text-muted"} />
                                                                                                <div>
                                                                                                    <p className="text-[8px] font-black text-text-muted uppercase tracking-wider">Firma Cliente</p>
                                                                                                    <p className={cn("text-[10px] font-black uppercase mt-0.5", hasClientSignature ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-500")}>
                                                                                                        {hasClientSignature ? "Registrada" : "Falta"}
                                                                                                    </p>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* View details button linking to full act preview */}
                                                                                    <div className="pt-4 flex justify-end">
                                                                                        <button
                                                                                            onClick={() => onViewAct && onViewAct(act)}
                                                                                            className="inline-flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white bg-primary-500 hover:bg-primary-600 rounded-xl shadow-lg shadow-primary-500/10 active:scale-95 transition-all"
                                                                                        >
                                                                                            <ExternalLink size={12} />
                                                                                            Ver Acta Completa
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </>
                                                        );
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan={7} className="py-20 text-center">
                                                            <div className="flex flex-col items-center gap-3 opacity-30">
                                                                <RefreshCw size={36} className="animate-spin-slow text-text-muted" />
                                                                <p className="font-black uppercase tracking-[0.2em] text-[11px]">Sin registros encontrados</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile View Cards */}
                                    <div className="lg:hidden flex flex-col divide-y divide-color dark:divide-[#334155]">
                                        {paginatedResults.length > 0 ? (
                                            paginatedResults.map(act => (
                                                <div key={act.id} className="p-5 active:bg-tertiary/30 transition-colors group">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className={cn(
                                                                "w-2 h-2 rounded-full",
                                                                act.type === 'PREVENTIVO' ? 'bg-indigo-500' :
                                                                act.type === 'ENTREGA' ? 'bg-emerald-500' : 'bg-amber-500'
                                                            )} />
                                                            <span className="text-[10px] font-black uppercase text-text-muted tracking-[0.1em]">{act.type}</span>
                                                        </div>
                                                        <span className="text-[10px] font-black text-primary-500 bg-primary-500/5 px-2.5 py-1 rounded-lg border border-primary-500/10">
                                                            #{act.glpi_ticket_id}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-[14px] font-black text-text-primary leading-tight mb-2 uppercase tracking-tight">{act.equipment_model}</h4>
                                                    
                                                    <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 pt-3 border-t border-color/40 opacity-70">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar size={12} className="text-primary-500" />
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-tighter">
                                                                    {new Date(act.scheduled_date || act.createdAt).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Package size={12} className="text-primary-500" />
                                                            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-tighter truncate max-w-[120px]">
                                                                S/N: {act.equipment_serial}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 flex justify-end">
                                                        <button 
                                                            onClick={() => onViewAct && onViewAct(act)}
                                                            className="text-[9px] font-black uppercase tracking-widest text-primary-500 flex items-center gap-1 hover:underline"
                                                        >
                                                            Detalles <ExternalLink size={10} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-16 text-center opacity-30">
                                                <p className="font-black uppercase tracking-[0.1em] text-[11px]">Sin registros</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Pagination Controls */}
                                {(totalPages > 1 || filteredResults.length > 5) && (
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                                        {/* Per-page selector */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">Mostrar:</span>
                                            <div className="flex items-center gap-1 bg-secondary border border-color dark:border-[#334155] rounded-xl p-1">
                                                {[5, 10, 25, 50].map(n => (
                                                    <button
                                                        key={n}
                                                        onClick={() => { setActsPerPage(n); setCurrentPage(1); }}
                                                        className={cn(
                                                            "px-3 py-1 text-[10px] font-black uppercase tracking-wide rounded-lg transition-all active:scale-95",
                                                            actsPerPage === n
                                                                ? "bg-primary-500 text-white shadow-sm"
                                                                : "text-text-secondary hover:bg-tertiary"
                                                        )}
                                                    >
                                                        {n}
                                                    </button>
                                                ))}
                                            </div>
                                            <span className="text-[10px] text-text-muted font-semibold">
                                                de {filteredResults.length} registros
                                            </span>
                                        </div>

                                        {/* Page navigation */}
                                        {totalPages > 1 && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                    className="p-2 rounded-xl bg-secondary border border-color dark:border-[#334155] text-text-muted hover:text-primary-500 hover:border-primary-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90"
                                                >
                                                    <ChevronLeft size={14} />
                                                </button>

                                                <div className="flex items-center gap-1">
                                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                                        <button
                                                            key={page}
                                                            onClick={() => setCurrentPage(page)}
                                                            className={cn(
                                                                "w-8 h-8 rounded-xl text-[11px] font-black transition-all active:scale-90",
                                                                currentPage === page
                                                                    ? "bg-primary-500 text-white shadow-sm"
                                                                    : "text-text-secondary hover:bg-tertiary border border-color dark:border-[#334155]"
                                                            )}
                                                        >
                                                            {page}
                                                        </button>
                                                    ))}
                                                </div>

                                                <button
                                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                    disabled={currentPage === totalPages}
                                                    className="p-2 rounded-xl bg-secondary border border-color dark:border-[#334155] text-text-muted hover:text-primary-500 hover:border-primary-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90"
                                                >
                                                    <ChevronLeft size={14} className="rotate-180" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

export default ClientConsolidated;
