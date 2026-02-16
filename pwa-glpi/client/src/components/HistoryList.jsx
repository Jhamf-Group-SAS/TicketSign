import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getHistory } from '../store/db';
import { Search, Calendar, User, ChevronRight, FileCheck, Filter, Download, History, ChevronLeft, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import CustomDatePicker from './CustomDatePicker';

const cn = (...inputs) => twMerge(clsx(inputs));

const HistoryList = ({ onSelectAct, onBack }) => {
    // Usamos useLiveQuery para que la lista se actualice automáticamente
    // cuando SyncService guarde nuevos registros del servidor.
    const history = useLiveQuery(() => getHistory(), []) || [];
    const loading = !history; // useLiveQuery retorna undefined inicialmente

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [selectedDate, setSelectedDate] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Eliminamos useEffect y loadHistory ya que useLiveQuery maneja la suscripción

    const filteredHistory = history.filter(act => {
        const matchesSearch =
            act.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            act.glpi_ticket_id?.toString().includes(searchTerm) ||
            act.equipment_hostname?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType = filterType === 'ALL' || act.type === filterType;

        const matchesDate = !selectedDate || new Date(act.createdAt).toISOString().split('T')[0] === selectedDate;

        return matchesSearch && matchesType && matchesDate;
    });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                            <History className="text-blue-500" size={28} />
                            Historial de Procesos
                        </h2>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                            Bitácora local de actas sincronizadas
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition-colors">
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por cliente, ticket o hostname..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm dark:shadow-2xl"
                    />
                </div>
                <div className="flex bg-white dark:bg-slate-900/40 p-1 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                    {['ALL', 'PREVENTIVO', 'CORRECTIVO', 'ENTREGA'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all ${filterType === type
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
                                }`}
                        >
                            {type === 'ALL' ? 'Todos' : type === 'ENTREGA' ? 'Entregas' : type.slice(0, 4)}
                        </button>
                    ))}
                </div>

                {/* Date Filter */}
                <div className="relative">
                    <button
                        onClick={() => setShowDatePicker(true)}
                        className={cn(
                            "w-full h-full flex items-center justify-between gap-3 px-4 py-3.5 bg-white dark:bg-slate-900/40 backdrop-blur-xl border rounded-2xl transition-all",
                            selectedDate
                                ? "border-blue-500 text-blue-500 shadow-lg"
                                : "border-slate-200 dark:border-white/5 text-slate-400"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <Calendar size={18} />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString() : 'Filtrar por Fecha'}
                            </span>
                        </div>
                        {selectedDate && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDate('');
                                }}
                                className="p-1 hover:bg-blue-500/10 rounded-lg transition-colors"
                            >
                                <X size={14} />
                            </div>
                        )}
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
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando bitácora...</p>
                </div>
            ) : filteredHistory.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                    {filteredHistory.map((act) => (
                        <button
                            key={act.id}
                            onClick={() => onSelectAct(act)}
                            className="group bg-white dark:bg-slate-900/30 backdrop-blur-sm p-5 rounded-3xl border border-slate-200 dark:border-white/5 hover:border-blue-500/30 transition-all text-left flex items-center justify-between shadow-sm dark:shadow-none hover:shadow-xl dark:hover:shadow-blue-900/10 active:scale-[0.99]"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${act.type === 'PREVENTIVO' ? 'bg-blue-500/10 text-blue-500' :
                                    act.type === 'ENTREGA' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'
                                    } group-hover:scale-110 transition-transform`}>
                                    <FileCheck size={24} />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-slate-900 dark:text-white">{act.client_name}</h4>
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest ${act.type === 'PREVENTIVO' ? 'bg-blue-500/10 text-blue-500' :
                                            act.type === 'ENTREGA' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'
                                            }`}>
                                            {act.type}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} /> {new Date(act.createdAt).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1 font-bold text-blue-500 dark:text-blue-400">
                                            #{act.glpi_ticket_id}
                                        </span>
                                        <span className="hidden xs:inline text-slate-300 dark:text-slate-700">|</span>
                                        <span className="capitalize">{act.equipment_hostname || 'Sin Hostname'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-xl text-slate-300 dark:text-slate-700 group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-all">
                                <ChevronRight size={20} />
                            </div>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900/20 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-white/5 py-20 px-6 text-center">
                    <div className="bg-slate-100 dark:bg-white/5 p-4 rounded-3xl inline-block text-slate-300 dark:text-slate-800 mb-4">
                        <Filter size={40} />
                    </div>
                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">No hay procesos registrados</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto mt-2">
                        {searchTerm ? 'No se encontraron resultados para tu búsqueda.' : 'Las actas sincronizadas aparecerán aquí automáticamente.'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default HistoryList;
