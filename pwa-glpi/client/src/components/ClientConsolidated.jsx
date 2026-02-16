import { useState, useEffect } from 'react';
import { db } from '../store/db';
import { ChevronLeft, Users, FileText, Send, Search, Building2, Package, CheckCircle, Calendar } from 'lucide-react';
import Toast from './Toast';
import CustomDatePicker from './CustomDatePicker';

const ClientConsolidated = ({ onBack }) => {
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientActs, setClientActs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [projectId, setProjectId] = useState('');
    const [toast, setToast] = useState(null);
    const [filterType, setFilterType] = useState('ALL');
    const [selectedDate, setSelectedDate] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);

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
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/reports/export-consolidated`, {
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
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Consolidado_${selectedClient.replace(/\s+/g, '_')}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setToast({ message: 'PDF exportado con éxito', type: 'success' });
            } else {
                setToast({ message: 'Error al exportar PDF', type: 'error' });
            }
        } catch (error) {
            setToast({ message: 'Error de conexión', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportCSV = async () => {
        setIsExportingCSV(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/reports/export-csv`, {
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
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Consolidado_${selectedClient.replace(/\s+/g, '_')}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setToast({ message: 'Excel (CSV) exportado con éxito', type: 'success' });
            } else {
                setToast({ message: 'Error al exportar CSV', type: 'error' });
            }
        } catch (error) {
            setToast({ message: 'Error de conexión', type: 'error' });
        } finally {
            setIsExportingCSV(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!projectId) {
            setToast({ message: 'Debe especificar el ID de la Tarea de Proyecto de GLPI', type: 'error' });
            return;
        }

        setIsGenerating(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/reports/consolidated`, {
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
                setToast({ message: `Sincronizado con éxito en Proyecto ID: ${data.glpiId}`, type: 'success' });
            } else {
                const err = await response.json();
                setToast({ message: `Error: ${err.message}`, type: 'error' });
            }
        } catch (error) {
            setToast({ message: 'Error de conexión con el servidor', type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 pb-32 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-[73px] z-40 bg-slate-50/80 dark:bg-[#020617]/80 backdrop-blur-md py-4 border-b border-slate-200 dark:border-white/5 mx-[-1rem] px-4 transition-colors">
                <div className="flex items-center gap-3">
                    <button onClick={selectedClient ? () => setSelectedClient(null) : onBack} className="p-2 hover:bg-slate-200 dark:hover:bg-white/5 rounded-full text-slate-500 dark:text-slate-400 shrink-0">
                        <ChevronLeft size={24} />
                    </button>
                    <div className="min-w-0">
                        <h2 className="text-sm md:text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white truncate">
                            {selectedClient ? (
                                <>
                                    <Building2 size={18} className="text-blue-500 shrink-0" />
                                    <span className="truncate">Resumen: {selectedClient}</span>
                                </>
                            ) : (
                                <>
                                    <Users size={20} className="text-blue-500 shrink-0" />
                                    <span>Consolidado por Cliente</span>
                                </>
                            )}
                        </h2>
                        <p className="text-[9px] md:text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest truncate">
                            {selectedClient ? 'Revisión y Generación' : 'Selecciona un cliente'}
                        </p>
                    </div>
                </div>
                {selectedClient && (
                    <div className="flex gap-2 w-full md:w-auto justify-between md:justify-end pl-11 md:pl-0">
                        <button
                            onClick={handleExportCSV}
                            disabled={isExportingCSV}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-xs font-bold"
                        >
                            {isExportingCSV ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Building2 size={16} />}
                            <span className="hidden sm:inline">Excel</span>
                        </button>
                        <button
                            onClick={handleExportPDF}
                            disabled={isExporting}
                            className="bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-white px-4 py-2 rounded-xl shadow-sm dark:shadow-lg border border-slate-200 dark:border-white/5 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-xs font-bold"
                        >
                            {isExporting ? <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div> : <FileText size={16} />}
                            <span className="hidden sm:inline">PDF</span>
                        </button>
                        <button
                            onClick={handleGenerateReport}
                            disabled={isGenerating}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-xs font-bold"
                        >
                            {isGenerating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Send size={16} />}
                            <span>Enviar</span>
                        </button>
                    </div>
                )}
            </div>

            {!selectedClient ? (
                <div className="space-y-6">
                    {/* Search */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition-colors">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm dark:shadow-2xl"
                        />
                    </div>

                    {/* Client Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredClients.map((client, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSelectClient(client.name)}
                                className="bg-white dark:bg-slate-900/30 backdrop-blur-sm p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-left flex items-center justify-between group shadow-sm dark:shadow-none"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-500/10 p-3 rounded-2xl text-blue-500 group-hover:scale-110 transition-transform">
                                        <Building2 size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">{client.name}</h4>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                                            {client.count} Computadores registrados
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-slate-100 dark:bg-white/5 p-2 rounded-full text-slate-400 dark:text-slate-600 group-hover:text-blue-500 transition-colors">
                                    <ChevronLeft size={20} className="rotate-180" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Project & Stats - Sticky on Desktop */}
                    <div className="md:sticky md:top-[160px] z-30 transition-all md:bg-slate-50/95 md:dark:bg-[#020617]/95 md:backdrop-blur-md md:py-4 md:mx-[-1rem] md:px-4 md:border-b md:border-slate-200 md:dark:border-white/5">
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                            <div className="col-span-2 md:col-span-1 bg-slate-900/40 p-3 rounded-2xl border border-white/5 space-y-1">
                                <label className="text-[9px] uppercase font-black text-blue-500 tracking-widest block">ID Tarea GLPI</label>
                                <input
                                    type="number"
                                    placeholder="Ej: 4"
                                    value={projectId}
                                    onChange={(e) => setProjectId(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                />
                            </div>

                            <button
                                onClick={() => setFilterType('ALL')}
                                className={`p-3 rounded-2xl border transition-all text-center flex flex-col justify-center ${filterType === 'ALL' ? 'bg-blue-500/20 border-blue-500/50 shadow-lg scale-105' : 'bg-slate-900/40 border-white/5 hover:bg-slate-800/60'}`}
                            >
                                <span className="text-xl font-black text-white">{clientActs.length}</span>
                                <p className="text-[8px] uppercase font-bold text-slate-500">Equipos</p>
                            </button>

                            <button
                                onClick={() => setFilterType('PREVENTIVO')}
                                className={`p-3 rounded-2xl border transition-all text-center flex flex-col justify-center ${filterType === 'PREVENTIVO' ? 'bg-blue-500/20 border-blue-500/50 shadow-lg scale-105' : 'bg-slate-900/40 border-white/5 hover:bg-slate-800/60'}`}
                            >
                                <span className="text-xl font-black text-blue-500">
                                    {clientActs.filter(a => a.type === 'PREVENTIVO').length}
                                </span>
                                <p className="text-[8px] uppercase font-bold text-slate-500">Prev.</p>
                            </button>

                            <button
                                onClick={() => setFilterType('CORRECTIVO')}
                                className={`p-3 rounded-2xl border transition-all text-center flex flex-col justify-center ${filterType === 'CORRECTIVO' ? 'bg-orange-500/20 border-orange-500/50 shadow-lg scale-105' : 'bg-slate-900/40 border-white/5 hover:bg-slate-800/60'}`}
                            >
                                <span className="text-xl font-black text-orange-500">
                                    {clientActs.filter(a => a.type === 'CORRECTIVO').length}
                                </span>
                                <p className="text-[8px] uppercase font-bold text-slate-500">Corr.</p>
                            </button>

                            <button
                                onClick={() => setFilterType('ENTREGA')}
                                className={`p-3 rounded-2xl border transition-all text-center flex flex-col justify-center ${filterType === 'ENTREGA' ? 'bg-emerald-500/20 border-emerald-500/50 shadow-lg scale-105' : 'bg-slate-900/40 border-white/5 hover:bg-slate-800/60'}`}
                            >
                                <span className="text-xl font-black text-emerald-500">
                                    {clientActs.filter(a => a.type === 'ENTREGA').length}
                                </span>
                                <p className="text-[8px] uppercase font-bold text-slate-500">Entregas</p>
                            </button>

                            <div className="col-span-2 md:col-span-1 bg-slate-900/40 p-3 rounded-2xl border border-white/5 flex flex-col justify-center relative">
                                <label className="text-[8px] uppercase font-black text-slate-500 mb-1 text-center">Filtrar Fecha</label>
                                <button
                                    onClick={() => setShowDatePicker(true)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white flex items-center justify-between hover:bg-slate-900 transition-colors"
                                >
                                    <span>{selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString() : 'Seleccionar'}</span>
                                    <Calendar size={14} className="text-blue-500" />
                                </button>

                                {showDatePicker && (
                                    <CustomDatePicker
                                        value={selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date()}
                                        hideTime={true}
                                        onChange={(val) => {
                                            setSelectedDate(new Date(val).toISOString().split('T')[0]);
                                            setShowDatePicker(false);
                                        }}
                                        onClose={() => setShowDatePicker(false)}
                                    />
                                )}

                                {selectedDate && (
                                    <button
                                        onClick={() => setSelectedDate('')}
                                        className="text-[8px] text-blue-500 font-bold mt-1 hover:underline"
                                    >
                                        Limpiar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Detailed List */}
                    <div className="space-y-4">
                        {clientActs.filter(act => {
                            const matchesType = filterType === 'ALL' || act.type === filterType;
                            const actDate = new Date(act.createdAt).toISOString().split('T')[0];
                            const matchesDate = !selectedDate || actDate === selectedDate;
                            return matchesType && matchesDate;
                        }).map(act => (
                            <div key={act.id} className="bg-slate-900/30 backdrop-blur-sm p-6 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all shadow-lg group">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-2xl shadow-inner ${act.type === 'PREVENTIVO' ? 'bg-blue-500/10 text-blue-500' :
                                            act.type === 'ENTREGA' ? 'bg-emerald-500/10 text-emerald-500' :
                                                'bg-orange-500/10 text-orange-500'
                                            }`}>
                                            <Package size={24} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h5 className="text-base font-black text-white">
                                                    {act.equipment_model} - <span className="text-blue-500">{act.equipment_hostname || 'S/H'}</span>
                                                </h5>
                                                <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${act.type === 'PREVENTIVO' ? 'bg-blue-500/10 text-blue-400' :
                                                    act.type === 'ENTREGA' ? 'bg-emerald-500/10 text-emerald-400' :
                                                        'bg-orange-500/10 text-orange-400'
                                                    }`}>
                                                    {act.type}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                                                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 uppercase tracking-wide font-medium">
                                                    <span className="text-slate-600 font-bold">SN:</span> {act.equipment_serial}
                                                </p>
                                                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 uppercase tracking-wide font-medium">
                                                    <span className="text-slate-600 font-bold">MOD:</span> {act.equipment_model || 'Genérico'}
                                                </p>
                                                <p className="text-[11px] text-white flex items-center gap-1.5 uppercase tracking-wide font-black">
                                                    <span className="text-blue-500 font-bold">USER:</span> {act.assigned_user}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em]">{new Date(act.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                            <p className="text-[11px] text-slate-300 font-medium">Ticket #{act.glpi_ticket_id}</p>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            {act.type === 'PREVENTIVO' ? (
                                                <span className="text-[9px] font-black text-green-500 bg-green-500/10 px-2 py-0.5 rounded-md uppercase tracking-widest border border-green-500/20">
                                                    MANT. COMPLETADO
                                                </span>
                                            ) : act.type === 'ENTREGA' ? (
                                                <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase tracking-widest border border-emerald-500/20">
                                                    EQUIPO ENTREGADO
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-black text-white bg-slate-800 px-2 py-0.5 rounded-md uppercase tracking-widest">
                                                    {act.checklist.estado_final || 'FINALIZADO'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default ClientConsolidated;
