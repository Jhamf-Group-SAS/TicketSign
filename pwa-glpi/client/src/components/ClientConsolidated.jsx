import { useState, useEffect } from 'react';
import { db } from '../store/db';
import { ChevronLeft, Users, FileText, Send, Search, Building2, Package, CheckCircle, Calendar, RefreshCw } from 'lucide-react';
import { toast } from './Toast';
import CustomDatePicker from './CustomDatePicker';
import { cn } from '../utils/cn';
import { downloadBlob } from '../utils/download';

const ClientConsolidated = ({ onBack }) => {
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientActs, setClientActs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [projectId, setProjectId] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [selectedDate, setSelectedDate] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        const allActs = await db.acts.toArray();
        const clientGroups = allActs.reduce((acc, act) => {
            const client = act.client_name || 'Sin Cliente';
            if (!acc[client]) {
                acc[client] = { name: client, count: 0, lastActivity: act.createdAt };
            }
            acc[client].count++;
            if (new Date(act.createdAt) > new Date(acc[client].lastActivity)) {
                acc[client].lastActivity = act.createdAt;
            }
            return acc;
        }, {});
        setClients(Object.values(clientGroups));
    };

    const handleSelectClient = async (clientName) => {
        const acts = await db.acts.where('client_name').equals(clientName).sortBy('createdAt');
        setSelectedClient(clientName);
        setClientActs(acts.reverse());
        setCurrentPage(1);
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
                // Usamos un tipo específico para asegurar que Excel lo reconozca
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

    return (
        <div className="space-y-10 pb-32 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-5 duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-secondary p-5 rounded-2xl border border-color shadow-premium/5 sticky top-[73px] z-40 transition-all">
                <div className="flex items-center gap-4">
                    <button
                        onClick={selectedClient ? () => setSelectedClient(null) : onBack}
                        className="p-3 bg-tertiary border border-color text-text-muted hover:text-primary-500 rounded-xl transition-all active:scale-90 group"
                    >
                        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="min-w-0">
                        <h2 className="text-lg font-black flex items-center gap-3 text-text-primary uppercase tracking-tighter truncate">
                            {selectedClient ? (
                                <>
                                    <Building2 size={20} className="text-primary-500 shrink-0" />
                                    <span className="truncate">Consolidado: {selectedClient}</span>
                                </>
                            ) : (
                                <>
                                    <Users size={20} className="text-primary-500 shrink-0" />
                                    <span>Control de Cartera</span>
                                </>
                            )}
                        </h2>
                        <p className="text-[10px] uppercase font-black text-text-muted tracking-[0.25em] mt-1 pr-4 border-l-2 border-primary-500/30 pl-4 ml-1 opacity-70">
                            {selectedClient ? 'Reporte Operativo Detallado' : 'Gestión Centralizada por Cliente'}
                        </p>
                    </div>
                </div>

                {selectedClient && (
                    <div className="flex gap-3 w-full md:w-auto h-fit">
                        <button
                            onClick={handleExportCSV}
                            disabled={isExportingCSV}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2.5 transition-all active:scale-95 disabled:opacity-50 text-[11px] font-black uppercase tracking-widest group"
                        >
                            {isExportingCSV ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Package size={16} className="group-hover:scale-110 transition-transform" />}
                            <span className="hidden sm:inline">CSV</span>
                        </button>
                        <button
                            onClick={handleExportPDF}
                            disabled={isExporting}
                            className="bg-tertiary border border-color hover:bg-secondary text-text-primary px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-2.5 transition-all active:scale-95 disabled:opacity-50 text-[11px] font-black uppercase tracking-widest group"
                        >
                            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin text-primary-500" /> : <FileText size={16} className="text-primary-500 group-hover:scale-110 transition-transform" />}
                            <span className="hidden sm:inline">PDF</span>
                        </button>
                        <button
                            onClick={handleGenerateReport}
                            disabled={isGenerating}
                            className="bg-primary-500 hover:bg-primary-600 text-white px-7 py-2.5 rounded-xl shadow-xl shadow-primary-500/20 flex items-center gap-2.5 transition-all active:scale-95 disabled:opacity-50 text-[11px] font-black uppercase tracking-widest group"
                        >
                            {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                            <span>Sincronizar</span>
                        </button>
                    </div>
                )}
            </div>

            {!selectedClient ? (
                <div className="space-y-8">
                    {/* Search Field */}
                    <div className="relative group/search max-w-2xl">
                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-text-muted group-focus-within/search:text-primary-500 transition-colors">
                            <Search size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder="Encontrar cliente o entidad..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-14 pr-6 py-4 bg-secondary border border-color rounded-2xl text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all shadow-premium/5"
                        />
                    </div>

                    {/* Client Selection Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredClients.map((client, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSelectClient(client.name)}
                                className="bg-secondary p-7 rounded-2xl border border-color hover:border-primary-500/40 transition-all text-left flex items-center justify-between group shadow-premium/5 hover:shadow-xl hover:-translate-y-1"
                            >
                                <div className="flex items-center gap-5">
                                    <div className="bg-primary-500/10 p-3.5 rounded-2xl text-primary-500 group-hover:scale-110 transition-transform duration-500">
                                        <Building2 size={22} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[16px] text-text-primary uppercase tracking-tight group-hover:text-primary-500 transition-colors">{client.name}</h4>
                                        <div className="flex items-center gap-3 mt-1 opacity-60">
                                            <div className="px-2.5 py-0.5 bg-tertiary rounded-lg text-[10px] font-black text-text-muted uppercase tracking-widest border border-color">
                                                {client.count} Activos
                                            </div>
                                            <span className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">Último reporte: {new Date(client.lastActivity).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-2.5 bg-tertiary border border-color rounded-xl text-text-muted group-hover:text-primary-500 group-hover:bg-primary-500/10 transition-all">
                                    <ChevronLeft size={18} className="rotate-180" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-10">
                    {/* Sticky Metrics & Filters */}
                    <div className="transition-all bg-secondary p-5 rounded-2xl border border-color shadow-xl">
                        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                            <div className="col-span-2 lg:col-span-1 bg-tertiary p-3 rounded-xl border border-color hover:border-primary-500/30 transition-colors flex flex-col justify-center">
                                <label className="text-[9px] uppercase font-black text-primary-500 tracking-[0.2em] block mb-1.5 opacity-80 pl-1">Proyecto GLPI</label>
                                <input
                                    type="number"
                                    placeholder="ID Proyecto"
                                    value={projectId}
                                    onChange={(e) => setProjectId(e.target.value)}
                                    className="w-full bg-secondary border border-color rounded-lg px-3 py-2 text-[11px] font-black text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all shadow-inner"
                                />
                            </div>

                            <button
                                onClick={() => { setFilterType('ALL'); setCurrentPage(1); }}
                                className={cn(
                                    "p-3 rounded-xl border transition-all text-center flex flex-col justify-center gap-1 group",
                                    filterType === 'ALL'
                                        ? "bg-primary-500 border-primary-500 text-white shadow-lg shadow-primary-500/20 scale-[1.02]"
                                        : "bg-tertiary border-color hover:bg-tertiary"
                                )}
                            >
                                <span className={cn("text-xl font-black tabular-nums tracking-tighter", filterType === 'ALL' ? "text-white" : "text-text-primary")}>
                                    {clientActs.length}
                                </span>
                                <p className={cn("text-[9px] uppercase font-black tracking-widest", filterType === 'ALL' ? "text-white/70" : "text-text-muted")}>Registros</p>
                            </button>

                            {[
                                { id: 'PREVENTIVO', label: 'Prev.', color: 'text-indigo-500', bg: 'bg-indigo-500/20' },
                                { id: 'CORRECTIVO', label: 'Corr.', color: 'text-amber-500', bg: 'bg-amber-500/20' },
                                { id: 'ENTREGA', label: 'Entrega', color: 'text-emerald-500', bg: 'bg-emerald-500/20' }
                            ].map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => { setFilterType(item.id); setCurrentPage(1); }}
                                    className={cn(
                                        "p-3 rounded-xl border transition-all text-center flex flex-col justify-center gap-1 group",
                                        filterType === item.id
                                            ? item.bg + " border-" + item.color.split('-')[1] + "-500/50 shadow-lg scale-[1.02]"
                                            : "bg-tertiary border-color hover:bg-tertiary"
                                    )}
                                >
                                    <span className={cn("text-xl font-black tabular-nums tracking-tighter", filterType === item.id ? item.color : "text-text-primary")}>
                                        {clientActs.filter(a => a.type === item.id).length}
                                    </span>
                                    <p className={cn("text-[9px] uppercase font-black tracking-widest", filterType === item.id ? "opacity-70" : "text-text-muted")}>{item.label}</p>
                                </button>
                            ))}

                            <div className="col-span-2 lg:col-span-1 bg-tertiary p-3 rounded-xl border border-color flex flex-col justify-center relative group/date">
                                <label className="text-[9px] uppercase font-black text-text-muted mb-1.5 text-center tracking-[0.2em] opacity-60">Filtrar Fecha</label>
                                <button
                                    onClick={() => setShowDatePicker(true)}
                                    className="w-full bg-secondary border border-color rounded-lg px-2.5 py-2 text-[10px] font-black text-text-primary flex items-center justify-between hover:bg-tertiary transition-all shadow-inner group-hover/date:border-primary-500/40"
                                >
                                    <span className="truncate">{selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString() : 'Todas'}</span>
                                    <Calendar size={14} className="text-primary-500" />
                                </button>

                                {showDatePicker && (
                                    <CustomDatePicker
                                        value={selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date()}
                                        hideTime={true}
                                        onChange={(val) => {
                                            setSelectedDate(new Date(val).toISOString().split('T')[0]);
                                            setShowDatePicker(false);
                                            setCurrentPage(1);
                                        }}
                                        onClose={() => setShowDatePicker(false)}
                                    />
                                )}

                                {selectedDate && (
                                    <button
                                        onClick={() => setSelectedDate('')}
                                        className="text-[8px] text-primary-500 font-black uppercase tracking-widest mt-1 hover:underline text-center w-full"
                                    >
                                        Limpiar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Service Records Detailed List (Table View) */}
                    {(() => {
                        const filteredResults = clientActs.filter(act => {
                            const matchesType = filterType === 'ALL' || act.type === filterType;
                            const actDateString = act.scheduled_date || act.createdAt;
                            const actDate = new Date(actDateString).toISOString().split('T')[0];
                            const matchesDate = !selectedDate || actDate === selectedDate;
                            return matchesType && matchesDate;
                        });

                        const ITEMS_PER_PAGE = 10;
                        const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
                        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                        const paginatedResults = filteredResults.slice(startIndex, startIndex + ITEMS_PER_PAGE);

                        return (
                            <div className="space-y-6">
                                <div className="bg-secondary rounded-2xl border border-color shadow-sm overflow-hidden transition-all">
                                    {/* Desktop View Table */}
                                    <div className="hidden lg:block overflow-x-auto no-scrollbar">
                                        <table className="w-full text-left border-collapse min-w-full">
                                            <thead>
                                                <tr className="bg-tertiary border-b border-color">
                                                    <th className="pl-10 pr-4 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">ID Ticket</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Equipo / Host</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Modelo</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Serial</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Tipo</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Fecha / Creación</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right pr-10">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-color">
                                                {paginatedResults.length > 0 ? (
                                                    paginatedResults.map(act => (
                                                        <tr key={act.id} className="hover:bg-tertiary/30 transition-colors group">
                                                            <td className="pl-10 pr-4 py-3.5 align-middle">
                                                                <span className="text-[12px] font-black text-primary-500 tabular-nums">#{act.glpi_ticket_id || '---'}</span>
                                                            </td>
                                                            <td className="px-6 py-3.5 align-middle">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[12px] font-black text-text-primary uppercase tracking-tight">{act.equipment_model || 'Genérico'}</span>
                                                                    <span className="text-[10px] font-bold text-text-muted opacity-60 uppercase tracking-tighter">{act.equipment_hostname || 'SIN HOST'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-3.5 align-middle">
                                                                <span className="text-[11px] font-semibold text-text-secondary uppercase">{act.equipment_model || '---'}</span>
                                                            </td>
                                                            <td className="px-6 py-3.5 align-middle">
                                                                <span className="text-[11px] font-black text-text-muted tabular-nums opacity-80 uppercase tracking-widest">{act.equipment_serial || '---'}</span>
                                                            </td>
                                                            <td className="px-6 py-3.5 align-middle">
                                                                <span className={cn(
                                                                    "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                                                                    act.type === 'PREVENTIVO' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' :
                                                                        act.type === 'ENTREGA' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                                                            'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                                )}>
                                                                    {act.type}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-3.5 align-middle">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[11px] font-black text-text-primary uppercase tracking-tight">
                                                                        {new Date(act.scheduled_date || act.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                    </span>
                                                                    <span className="text-[9px] font-bold text-text-muted opacity-50 uppercase tracking-tighter">
                                                                        Registro: {new Date(act.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-3.5 align-middle">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={cn(
                                                                        "w-1.5 h-1.5 rounded-full shrink-0",
                                                                        act.type === 'PREVENTIVO' ? 'bg-indigo-500' :
                                                                            act.type === 'ENTREGA' ? 'bg-emerald-500' : 'bg-amber-500'
                                                                    )} />
                                                                    <span className="text-[11px] font-black text-text-secondary uppercase tracking-tight">
                                                                        {act.checklist?.estado_final || 'FINALIZADO'}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={7} className="py-20 text-center">
                                                            <div className="flex flex-col items-center gap-3 opacity-30">
                                                                <RefreshCw size={40} className="animate-spin-slow" />
                                                                <p className="font-black uppercase tracking-[0.2em] text-[11px]">Sin registros encontrados</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile View Cards */}
                                    <div className="lg:hidden flex flex-col divide-y divide-color/40">
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
                                                    <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 opacity-70">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar size={12} className="text-primary-500" />
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-tighter">
                                                                    {new Date(act.scheduled_date || act.createdAt).toLocaleDateString()}
                                                                </span>
                                                                <span className="text-[8px] font-bold text-text-muted opacity-50 uppercase">
                                                                    Creación: {new Date(act.createdAt).toLocaleDateString()}
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
                                {totalPages > 1 && (
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-1">
                                        <p className="text-[10px] text-text-muted font-black uppercase tracking-widest opacity-60">
                                            Mostrando <span className="text-primary-500">{startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredResults.length)}</span> de <span className="text-primary-500">{filteredResults.length}</span>
                                        </p>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(p => p - 1)}
                                                className="h-8 px-3 rounded-lg border border-color text-[10px] font-black uppercase tracking-widest text-text-secondary hover:bg-tertiary transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95"
                                            >
                                                Ant.
                                            </button>
                                            <div className="flex items-center gap-1">
                                                {[...Array(totalPages)].map((_, i) => (
                                                    <button
                                                        key={i + 1}
                                                        onClick={() => setCurrentPage(i + 1)}
                                                        className={cn(
                                                            "w-8 h-8 rounded-lg text-[10px] font-black transition-all border",
                                                            currentPage === i + 1
                                                                ? "bg-primary-500 border-primary-500 text-white shadow-md"
                                                                : "bg-tertiary border-color text-text-muted hover:border-primary-500/40"
                                                        )}
                                                    >
                                                        {i + 1}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(p => p + 1)}
                                                className="h-8 px-3 rounded-lg border border-color text-[10px] font-black uppercase tracking-widest text-text-secondary hover:bg-tertiary transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95"
                                            >
                                                Sig.
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            <br />
        </div>
    );
};

export default ClientConsolidated;
