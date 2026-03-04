import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getHistory } from '../store/db';
import { Search, Calendar, User, ChevronRight, FileCheck, Filter, History, ChevronLeft, X, Building2, Loader2, Eye } from 'lucide-react';
import CustomDatePicker from './CustomDatePicker';
import { cn } from '../utils/cn';

const HistoryList = ({ onSelectAct, onBack }) => {
    const history = useLiveQuery(() => getHistory(), []) || [];
    const loading = !history;

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [selectedDate, setSelectedDate] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerAnchor, setDatePickerAnchor] = useState(null);

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
        <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between bg-secondary py-4 px-6 rounded-[12px] border border-color shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="w-10 h-10 flex items-center justify-center hover:bg-tertiary border border-color rounded-xl text-text-muted transition-all">
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-[17px] font-[700] text-text-primary uppercase tracking-tight flex items-center gap-2">
                            <History className="text-primary-500" size={20} />
                            HISTORIAL
                        </h2>
                        <p className="text-[11px] font-[600] text-text-muted uppercase tracking-[1px]">Bitácora de actas finalizadas</p>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-secondary p-4 rounded-xl border border-color shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={15} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente, ticket o activo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 bg-tertiary border border-color rounded-lg text-[13px] text-text-primary outline-none focus:border-primary-500 transition-all placeholder:text-text-muted/40"
                    />
                </div>

                <div className="flex bg-tertiary p-1 rounded-lg shrink-0 border border-color overflow-x-auto no-scrollbar">
                    {['ALL', 'PREVENTIVO', 'CORRECTIVO', 'ENTREGA', 'COTIZ'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={cn(
                                "flex-1 py-1.5 text-[10px] font-[700] uppercase tracking-wide rounded-md transition-all",
                                filterType === type ? "bg-secondary text-primary-500 shadow-sm" : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            {type === 'ALL' ? 'Todos' : type.slice(0, 4)}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <button
                        onClick={(e) => {
                            setShowDatePicker(true);
                            setDatePickerAnchor(e.currentTarget);
                        }}
                        className={cn(
                            "w-full h-10 flex items-center justify-between px-3 bg-tertiary border rounded-lg transition-all",
                            selectedDate ? "border-primary-500 text-primary-500" : "border-color text-text-muted"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Calendar size={14} />
                            <span className="text-[11px] font-[600] uppercase">
                                {selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString() : 'Por Fecha'}
                            </span>
                        </div>
                        {selectedDate && <X size={12} onClick={(e) => { e.stopPropagation(); setSelectedDate(''); }} />}
                    </button>

                    {showDatePicker && (
                        <CustomDatePicker
                            anchorEl={datePickerAnchor}
                            value={selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date()}
                            hideTime={true}
                            onChange={(val) => {
                                setSelectedDate(new Date(val).toISOString().split('T')[0]);
                                setShowDatePicker(false);
                                setDatePickerAnchor(null);
                            }}
                            onClose={() => {
                                setShowDatePicker(false);
                                setDatePickerAnchor(null);
                            }}
                        />
                    )}
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24">
                    <Loader2 className="animate-spin text-primary-500" size={32} />
                </div>
            ) : filteredHistory.length > 0 ? (
                <div className="bg-secondary rounded-[16px] border border-color shadow-sm overflow-hidden">
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="bg-tertiary border-b border-color">
                                    <th className="pl-10 pr-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider">ID</th>
                                    <th className="px-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider">CLIENTE / ENTIDAD</th>
                                    <th className="px-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider">TIPO</th>
                                    <th className="px-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider">ESTADO</th>
                                    <th className="px-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider">FECHA</th>
                                    <th className="px-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider">TICKET GLPI</th>
                                    <th className="px-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider">TÉCNICO</th>
                                    <th className="px-4 py-4 text-[10px] font-[800] text-text-muted uppercase tracking-wider text-right pr-10">ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-color">
                                {filteredHistory.map((act) => {
                                    let typeColor = 'bg-tertiary text-text-muted';
                                    if (act.type === 'CORRECTIVO') typeColor = 'bg-orange-500/10 text-orange-500';
                                    else if (act.type === 'PREVENTIVO') typeColor = 'bg-emerald-500/10 text-emerald-500';
                                    else if (act.type === 'ENTREGA') typeColor = 'bg-purple-500/10 text-purple-500';

                                    const statusStyles = {
                                        'PENDIENTE_SINCRONIZACION': { label: 'Pendiente Sync', color: 'text-orange-500', bg: 'bg-orange-500' },
                                        'BORRADOR': { label: 'Borrador', color: 'text-amber-500', bg: 'bg-amber-500' },
                                        'SINCRONIZADO': { label: 'Sincronizado', color: 'text-emerald-500', bg: 'bg-emerald-500' },
                                        'PENDIENTE': { label: 'Pendiente', color: 'text-orange-500', bg: 'bg-orange-500' },
                                        'EN_REVISION': { label: 'En Revisión', color: 'text-primary-500', bg: 'bg-primary-500' },
                                        'APROBADA': { label: 'Aprobada', color: 'text-emerald-500', bg: 'bg-emerald-500' },
                                        'RECHAZADA': { label: 'Rechazada', color: 'text-red-500', bg: 'bg-red-500' },
                                        'COMPRADA': { label: 'Comprada', color: 'text-purple-500', bg: 'bg-purple-500' },
                                        'CANCELADA': { label: 'Cancelada', color: 'text-text-muted', bg: 'bg-slate-400' },
                                    };

                                    const statusStyle = statusStyles[act.status] || { label: act.status || 'Completado', color: 'text-emerald-500', bg: 'bg-emerald-500' };

                                    if (act.isQuotation) {
                                        typeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-500';
                                    }

                                    return (
                                        <tr key={act.id} className="hover:bg-tertiary transition-colors">
                                            <td className="pl-10 pr-4 py-4 align-middle text-[13px] text-text-muted font-[600]">
                                                {act.id}
                                            </td>
                                            <td className="px-4 py-4 align-middle text-[13px] text-primary-500 font-[700] hover:underline cursor-pointer" onClick={() => onSelectAct(act)}>
                                                {act.client_name || 'Cliente Genérico'}
                                            </td>
                                            <td className="px-4 py-4 align-middle">
                                                <span className={cn("px-2 py-1 rounded text-[11px] font-[700] uppercase", typeColor)}>
                                                    {act.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 align-middle text-[13px] text-text-primary font-[600] flex items-center gap-2 h-full min-h-[50px]">
                                                <div className={cn("w-2 h-2 rounded-full shrink-0", statusStyle.bg)} /> {statusStyle.label}
                                            </td>
                                            <td className="px-4 py-4 align-middle text-[12px] text-text-muted">
                                                {new Date(act.createdAt).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-4 align-middle text-[12px] text-text-muted font-[600]">
                                                {act.glpi_ticket_id ? `#${act.glpi_ticket_id}` : '---'}
                                            </td>
                                            <td className="px-4 py-4 align-middle text-[12px] text-text-primary font-[500]">
                                                {act.technical_name || '---'}
                                            </td>
                                            <td className="px-4 py-4 align-middle text-right pr-10">
                                                <button
                                                    onClick={() => onSelectAct(act)}
                                                    className="w-8 h-8 rounded-lg bg-tertiary text-text-muted flex items-center justify-center hover:bg-secondary hover:text-primary-500 border border-color transition-colors ml-auto"
                                                    title="Ver Acta"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-secondary rounded-2xl border border-dashed border-color py-32 text-center">
                    <History size={48} className="text-text-muted mx-auto mb-4 opacity-40" />
                    <p className="text-text-primary text-[11px] font-[700] uppercase tracking-[1px]">Sin registros encontrados</p>
                    <p className="text-text-muted text-[12px] mt-1 font-medium italic">Intenta ajustar los filtros de búsqueda</p>
                </div>
            )}
        </div>
    );
};

export default HistoryList;
