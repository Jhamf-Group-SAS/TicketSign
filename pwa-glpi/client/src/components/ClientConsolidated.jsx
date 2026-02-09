import { useState, useEffect } from 'react';
import { db } from '../store/db';
import { ChevronLeft, Users, FileText, Send, Search, Building2, Package, CheckCircle } from 'lucide-react';
import Toast from './Toast';

const ClientConsolidated = ({ onBack }) => {
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientActs, setClientActs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [projectId, setProjectId] = useState('');
    const [toast, setToast] = useState(null);

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
            <div className="flex items-center justify-between sticky top-[73px] z-40 bg-slate-50/80 dark:bg-[#020617]/80 backdrop-blur-md py-4 border-b border-slate-200 dark:border-white/5 mx-[-1rem] px-4 transition-colors">
                <div className="flex items-center gap-3">
                    <button onClick={selectedClient ? () => setSelectedClient(null) : onBack} className="p-2 hover:bg-slate-200 dark:hover:bg-white/5 rounded-full text-slate-500 dark:text-slate-400">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                            <Users size={20} className="text-blue-500" />
                            {selectedClient ? `Resumen: ${selectedClient}` : 'Consolidado por Cliente'}
                        </h2>
                        <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest">
                            {selectedClient ? 'Revisión y Generación' : 'Selecciona un cliente'}
                        </p>
                    </div>
                </div>
                {selectedClient && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportPDF}
                            disabled={isExporting}
                            className="bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-white px-4 py-2 rounded-xl shadow-sm dark:shadow-lg border border-slate-200 dark:border-white/5 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-xs font-bold"
                        >
                            {isExporting ? <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div> : <FileText size={16} />}
                            <span className="hidden sm:inline">Exportar PDF</span>
                        </button>
                        <button
                            onClick={handleGenerateReport}
                            disabled={isGenerating}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-xs font-bold"
                        >
                            {isGenerating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Send size={16} />}
                            <span>Enviar a GLPI</span>
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
                    {/* Project & Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-1 bg-slate-900/40 p-4 rounded-3xl border border-white/5 space-y-2">
                            <label className="text-[10px] uppercase font-black text-blue-500 tracking-widest block">ID Tarea Proyecto GLPI</label>
                            <input
                                type="number"
                                placeholder="Ej: 4"
                                value={projectId}
                                onChange={(e) => setProjectId(e.target.value)}
                                className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                            />
                        </div>
                        <div className="bg-slate-900/40 p-4 rounded-3xl border border-white/5 text-center">
                            <span className="text-2xl font-black text-blue-500">{clientActs.length}</span>
                            <p className="text-[9px] uppercase font-bold text-slate-500 mt-1">Equipos</p>
                        </div>
                        <div className="bg-slate-900/40 p-4 rounded-3xl border border-white/5 text-center">
                            <span className="text-2xl font-black text-purple-500">
                                {clientActs.filter(a => a.type === 'PREVENTIVO').length}
                            </span>
                            <p className="text-[9px] uppercase font-bold text-slate-500 mt-1">Prev.</p>
                        </div>
                        <div className="bg-slate-900/40 p-4 rounded-3xl border border-white/5 text-center">
                            <span className="text-2xl font-black text-orange-500">
                                {clientActs.filter(a => a.type === 'CORRECTIVO').length}
                            </span>
                            <p className="text-[9px] uppercase font-bold text-slate-500 mt-1">Corr.</p>
                        </div>
                    </div>

                    {/* Detailed List */}
                    <div className="space-y-4">
                        {clientActs.map(act => (
                            <div key={act.id} className="bg-slate-900/30 backdrop-blur-sm p-6 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all shadow-lg group">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-2xl shadow-inner ${act.type === 'PREVENTIVO' ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'}`}>
                                            <Package size={24} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h5 className="text-base font-black text-white">
                                                    {act.equipment_model} - <span className="text-blue-500">{act.equipment_hostname || 'S/H'}</span>
                                                </h5>
                                                <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${act.type === 'PREVENTIVO' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
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
