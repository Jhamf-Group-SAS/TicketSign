import React, { useState, useEffect } from 'react';
import { db } from '../store/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Eye, Trash2, Calendar, FileText, Download, CheckCircle, Clock, Loader2, User, ChevronLeft, AlertTriangle } from 'lucide-react';
import { toast } from './Toast';
import { cn } from '../utils/cn';
import { downloadBlob } from '../utils/download';

const HistoricalActs = ({ onViewAct, globalSearch }) => {
    const [searchTerm, setSearchTerm] = useState(globalSearch || '');
    const [filterType, setFilterType] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [isExporting, setIsExporting] = useState(false);
    const [pdfLoadingId, setPdfLoadingId] = useState(null);
    const [confirmDeleteAct, setConfirmDeleteAct] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const ITEMS_PER_PAGE = 20;

    const allActs = useLiveQuery(async () => {
        return await db.acts.orderBy('createdAt').reverse().toArray();
    }, []) || [];

    useEffect(() => {
        if (globalSearch !== undefined) {
            setSearchTerm(globalSearch);
            setCurrentPage(1);
        }
    }, [globalSearch]);

    const filteredActs = allActs.filter(act => {
        const matchesType = filterType === 'ALL' || act.type === filterType;
        const searchLower = searchTerm.toLowerCase();

        const clientNameMatch = act.client_name?.toLowerCase().includes(searchLower);
        const contactMatch = act.contact_name?.toLowerCase().includes(searchLower);
        const refMatch = act.reference?.toLowerCase().includes(searchLower);
        const ticketMatch = act.glpi_ticket_id?.toLowerCase().includes(searchLower);

        return matchesType && (clientNameMatch || contactMatch || refMatch || ticketMatch);
    });

    const paginatedActs = filteredActs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(filteredActs.length / ITEMS_PER_PAGE);

    const handleDelete = (act) => {
        setConfirmDeleteAct(act);
    };

    const executeDelete = async () => {
        if (!confirmDeleteAct) return;
        setIsDeleting(true);
        try {
            // Si el acta ya estaba sincronizada y generada en el backend, mandamos petición de eliminación.
            if (confirmDeleteAct._id && confirmDeleteAct.status === 'SINCRONIZADO') {
                const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/sync/maintenance/${confirmDeleteAct._id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                    }
                });
                if (!response.ok) {
                    throw new Error('Hubo un error al intentar eliminar el acta del servidor.');
                }
            }

            await db.acts.delete(confirmDeleteAct.id);
            toast.success('Acta eliminada permanentemente con éxito.');
        } catch (err) {
            toast.error(err.message || 'No se pudo eliminar el acta.');
        } finally {
            setIsDeleting(false);
            setConfirmDeleteAct(null);
        }
    };

    const handleDownloadPDF = async (act) => {
        setPdfLoadingId(act.id);
        setIsExporting(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/reports/individual`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('glpi_pro_token')}`
                },
                body: JSON.stringify(act)
            });

            if (response.ok) {
                const data = await response.blob();
                await downloadBlob(data, `Acta_${act.type || 'Historico'}_${act.glpi_ticket_id || act.client_name || act.id}.pdf`);
                toast.success('PDF descargado correctactamente');
            } else {
                toast.error('Error al generar PDF en servidor');
            }
        } catch (error) {
            toast.error('Error de red al intentar descargar');
        } finally {
            setIsExporting(false);
            setPdfLoadingId(null);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-32 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-secondary p-6 rounded-2xl shadow-sm border border-color flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-text-primary tracking-tight">Actas</h1>
                        <p className="text-text-muted text-sm mt-1">Gestione, visualice o descargue todo el registro de actas de mantenimiento.</p>
                    </div>
                </div>

                <div className="flex bg-tertiary rounded-xl p-1 shrink-0 w-full md:w-auto overflow-x-auto no-scrollbar border border-color shadow-inner">
                    {['ALL', 'PREVENTIVO', 'CORRECTIVO', 'ENTREGA'].map(type => (
                        <button
                            key={type}
                            onClick={() => { setFilterType(type); setCurrentPage(1); }}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all",
                                filterType === type
                                    ? "bg-secondary text-[#0695c4] shadow-sm border border-[#0695c4]/30"
                                    : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                            )}
                        >
                            {type === 'ALL' ? 'Todas' : type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter */}
            <div className="bg-secondary p-4 rounded-xl shadow-sm border border-color">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente, contacto o ticket GLPI..."
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full bg-tertiary border border-color rounded-xl pl-12 pr-4 h-12 text-sm text-text-primary focus:border-[#0695c4] focus:ring-1 focus:ring-[#0695c4]/30 transition-all outline-none"
                    />
                </div>
            </div>

            {/* List */}
            {filteredActs.length === 0 ? (
                <div className="text-center py-20 bg-secondary rounded-[16px] border border-color">
                    <FileText className="mx-auto h-16 w-16 text-text-muted opacity-50 mb-4" />
                    <h3 className="text-sm font-bold text-text-secondary uppercase tracking-widest">No hay actas registradas</h3>
                    <p className="text-xs text-text-muted mt-2">Intente cambiar los filtros de búsqueda.</p>
                </div>
            ) : (
                <>
                    <div className="bg-secondary rounded-[16px] border border-color shadow-sm overflow-hidden">
                        {/* Desktop View Table */}
                        <div className="hidden md:block overflow-x-auto no-scrollbar">
                            <table className="w-full text-left border-collapse min-w-full">
                                <thead>
                                    <tr className="bg-tertiary border-b border-color">
                                        <th className="px-5 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider pl-5">TIPO</th>
                                        <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider">CLIENTE</th>
                                        <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider">TÉCNICO</th>
                                        <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider">TICKET GLPI</th>
                                        <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider">CREADA EL</th>
                                        <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider">ESTADO</th>
                                        <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider text-right pr-6">ACCIONES</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-color">
                                    {paginatedActs.map(act => (
                                        <tr key={act.id} className="hover:bg-tertiary/50 transition-colors">
                                            <td className="px-5 py-3 align-middle pl-5">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn(
                                                        "w-1.5 h-1.5 rounded-full shrink-0",
                                                        act.type === 'PREVENTIVO' ? "bg-primary-500" : act.type === 'ENTREGA' ? "bg-purple-500" : "bg-orange-500"
                                                     )} />
                                                    <span className="text-[10px] font-black uppercase text-text-muted tracking-widest">{act.type}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                <span className="text-[12px] text-[#0695c4] font-[700] hover:underline cursor-pointer max-w-[180px] truncate block" title={act.client_name || 'Sin Cliente'} onClick={() => onViewAct(act)}>
                                                    {act.client_name || 'Sin Cliente'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 align-middle text-[11px] text-text-secondary font-[600] max-w-[150px] truncate" title={act.technical_name || 'Sin Técnico'}>
                                                <span className="flex items-center gap-1.5 uppercase">
                                                    <User size={12} className="text-text-muted shrink-0" /> {act.technical_name || 'Sin Técnico'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                {act.glpi_ticket_id ? (
                                                    <span className="bg-tertiary/60 px-2 py-0.5 rounded text-[11px] font-bold text-[#0695c4] border border-color">
                                                        #{act.glpi_ticket_id}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-text-muted italic">---</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-[11px] text-[#64748b]">
                                                {new Date(act.createdAt).toLocaleString([], { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                {act.status === 'SINCRONIZADO' ? (
                                                    <div className="flex items-center gap-1.5 w-max text-green-500 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-md">
                                                        <CheckCircle size={10} />
                                                        <span className="text-[9px] font-bold uppercase tracking-widest">Sincronizado</span>
                                                    </div>
                                                ) : act.status === 'BORRADOR' ? (
                                                    <div className="flex items-center gap-1.5 w-max text-amber-500 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md">
                                                        <FileText size={10} />
                                                        <span className="text-[9px] font-bold uppercase tracking-widest">Borrador</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 w-max text-orange-500 px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-md">
                                                        <Clock size={10} />
                                                        <span className="text-[9px] font-bold uppercase tracking-widest">Pendiente</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-right pr-6">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleDownloadPDF(act)}
                                                        disabled={isExporting}
                                                        className="h-7 w-7 rounded-lg bg-tertiary text-text-muted hover:text-[#0695c4] hover:bg-[#0695c4]/10 flex items-center justify-center transition-colors border border-color"
                                                        title="Descargar PDF"
                                                    >
                                                        {pdfLoadingId === act.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                                                    </button>
                                                    <button
                                                        onClick={() => onViewAct(act)}
                                                        className="h-7 w-7 rounded-lg bg-tertiary text-text-muted hover:text-primary-500 hover:bg-primary-500/10 flex items-center justify-center transition-colors border border-color ml-1"
                                                        title="Ver / Editar"
                                                    >
                                                        <Eye size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(act)}
                                                        className="h-7 w-7 rounded-lg bg-tertiary text-text-muted hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors border border-color ml-1"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View Cards */}
                        <div className="md:hidden flex flex-col divide-y divide-color">
                            {paginatedActs.map(act => (
                                <div key={act.id} className="p-5 active:bg-tertiary transition-colors flex flex-col gap-3">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex flex-wrap gap-2">
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-tertiary border border-color">
                                                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", act.type === 'PREVENTIVO' ? "bg-primary-500" : act.type === 'ENTREGA' ? "bg-purple-500" : "bg-orange-500")} />
                                                <span className="text-[9px] font-black uppercase text-text-muted tracking-widest">{act.type}</span>
                                            </div>
                                            {act.status === 'SINCRONIZADO' ? (
                                                <div className="flex items-center gap-1 text-green-500 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded">
                                                    <CheckCircle size={10} />
                                                    <span className="text-[9px] font-bold uppercase tracking-widest">Sincroniz.</span>
                                                </div>
                                            ) : act.status === 'BORRADOR' ? (
                                                <div className="flex items-center gap-1 text-amber-500 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded">
                                                    <FileText size={10} />
                                                    <span className="text-[9px] font-bold uppercase tracking-widest">Borrador</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-orange-500 px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded">
                                                    <Clock size={10} />
                                                    <span className="text-[9px] font-bold uppercase tracking-widest">Pendiente</span>
                                                </div>
                                            )}
                                        </div>
                                        {act.glpi_ticket_id && (
                                            <span className="text-[10px] font-bold text-[#0695c4] bg-[#0695c4]/10 border border-[#0695c4]/20 px-2 py-1 rounded">
                                                TKT: {act.glpi_ticket_id}
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="text-[15px] font-black text-text-primary leading-tight hover:underline cursor-pointer" onClick={() => onViewAct(act)}>
                                        {act.client_name || 'Sin Cliente'}
                                    </h4>
                                    <div className="flex flex-wrap gap-4 mt-1">
                                        <div className="flex items-center gap-1.5 text-text-muted">
                                            <Clock size={13} />
                                            <span className="text-[11px] font-bold">{new Date(act.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-text-muted max-w-full">
                                            <User size={13} className="shrink-0" />
                                            <span className="text-[11px] font-bold truncate uppercase">{act.technical_name || 'Sin Técnico'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-color">
                                        <button onClick={() => handleDownloadPDF(act)} disabled={isExporting} className="flex-1 h-9 rounded-xl bg-tertiary text-text-secondary hover:text-white hover:bg-[#0695c4] font-bold text-[10px] uppercase tracking-widest transition-all border border-color flex items-center justify-center gap-2">
                                            {pdfLoadingId === act.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PDF
                                        </button>
                                        <button onClick={() => onViewAct(act)} className="h-9 px-4 rounded-xl bg-tertiary text-text-secondary hover:text-white hover:bg-primary-500 font-bold text-[10px] uppercase transition-all border border-color flex items-center justify-center">
                                            <Eye size={14} />
                                        </button>
                                        <button onClick={() => handleDelete(act)} className="h-9 px-4 rounded-xl bg-tertiary text-text-muted hover:text-red-500 hover:bg-red-500/10 font-bold text-[10px] uppercase transition-all border border-color flex items-center justify-center">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pagination Footer */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-2 pt-4">
                            <p className="text-[11px] text-text-muted font-[500] hidden sm:block">
                                Mostrando <span className="text-text-primary font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="text-text-primary font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filteredActs.length)}</span> de <span className="text-text-primary font-bold">{filteredActs.length}</span> actas
                            </p>
                            <div className="flex items-center gap-1 ml-auto">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => p - 1)}
                                    className="h-8 px-3 rounded-lg border border-color text-[11px] font-bold text-text-secondary hover:bg-tertiary transition-all disabled:opacity-30 disabled:pointer-events-none"
                                >
                                    Anterior
                                </button>
                                <div className="flex items-center gap-1 mx-2">
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i + 1}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={cn(
                                                "w-8 h-8 rounded-lg text-[11px] font-bold transition-all",
                                                currentPage === i + 1
                                                    ? "bg-primary-500 text-white shadow-sm"
                                                    : "text-text-muted hover:bg-tertiary"
                                            )}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    className="h-8 px-3 rounded-lg border border-color text-[11px] font-bold text-text-secondary hover:bg-tertiary transition-all disabled:opacity-30 disabled:pointer-events-none"
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Styled Confirm Modal */}
            {confirmDeleteAct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm shadow-2xl animate-in fade-in duration-300">
                    <div className="bg-secondary rounded-2xl border border-color shadow-2xl p-8 max-w-sm w-full mx-auto animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 mx-auto">
                            {isDeleting ? <Loader2 size={32} className="animate-spin" /> : <AlertTriangle size={32} />}
                        </div>
                        <h3 className="text-[16px] font-black text-center uppercase tracking-tight text-text-primary">¿Eliminar Acta?</h3>
                        <p className="text-[13px] font-medium text-text-muted mt-2 text-center">
                            {confirmDeleteAct.status === 'PENDIENTE_SINCRONIZACION' ?
                                'Esta acta no ha sido sincronizada. Si la eliminas, perderás la información definitivamente.' :
                                '¿Estás seguro de querer borrar esta acta de la memoria local y de la nube del sistema PWA?'
                            }
                        </p>
                        <div className="mt-8 flex items-center gap-3">
                            <button
                                onClick={() => setConfirmDeleteAct(null)}
                                disabled={isDeleting}
                                className="flex-1 bg-tertiary hover:bg-white/5 border border-color text-text-secondary hover:text-text-primary h-12 rounded-xl text-[11px] tracking-widest font-bold uppercase transition-all disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeDelete}
                                disabled={isDeleting}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white h-12 rounded-xl text-[11px] tracking-widest font-bold uppercase shadow-lg shadow-red-500/20 active:scale-95 transition-all disabled:opacity-50"
                            >
                                Sí, Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoricalActs;
