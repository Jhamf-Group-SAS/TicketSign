import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowLeft, FileText, CheckCircle, XCircle, ShoppingCart,
    Eye, Clock, Loader2, MessageSquare, Send, AlertTriangle,
    User, Calendar, DollarSign, Tag, Hash, ChevronRight, Download, Building, ChevronDown, Settings2, Trash2, Camera, X, Plus, Upload
} from 'lucide-react';
import { cn } from '../utils/cn';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const STATUS_CONFIG = {
    PENDIENTE: { label: 'Pendiente', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20', icon: Clock },
    EN_REVISION: { label: 'En Revisión', color: 'text-primary-500 bg-primary-500/10 border-primary-500/20', icon: Eye },
    APROBADA: { label: 'Aprobada', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle },
    RECHAZADA: { label: 'Rechazada', color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: XCircle },
    COMPRADA: { label: 'Comprada', color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', icon: ShoppingCart },
    CANCELADA: { label: 'Cancelada', color: 'text-text-muted bg-tertiary border-color', icon: XCircle },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDIENTE;
    const Icon = cfg.icon;
    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 text-[10px] font-[600] uppercase tracking-wide px-2.5 py-1 rounded-full border shadow-sm",
            cfg.color
        )}>
            <Icon size={12} />{cfg.label}
        </span>
    );
}

const DetailRow = ({ label, value, icon: Icon, color = "text-primary-500" }) => {
    if (!value) return null;
    return (
        <div className="flex items-center gap-4 py-3 border-b border-color last:border-0 group">
            <div className={cn("w-10 h-10 rounded-xl bg-tertiary flex items-center justify-center border border-color group-hover:scale-105 transition-transform shadow-sm", color)}>
                <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-[600] text-text-muted uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-[14px] font-[600] text-text-primary truncate uppercase">{value}</p>
            </div>
        </div>
    );
};

export default function QuotationDetail({ quotationId, user, onBack }) {
    const [q, setQ] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [comment, setComment] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [error, setError] = useState('');
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [previewFile, setPreviewFile] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadType, setUploadType] = useState('document');
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploading, setUploading] = useState(false);

    const token = localStorage.getItem('glpi_pro_token');
    const userNames = [user?.username, user?.displayName, user?.name, user?.fullName].filter(Boolean);
    const isOwnerOrAssignee = q && (
        userNames.includes(q.createdBy) ||
        userNames.includes(q.createdByName) ||
        (q.assigned_to && userNames.includes(q.assigned_to))
    );
    const isAdminOrBuyer = ['Super-Admin', 'Admin-Mesa', 'Compras'].some(r => (user?.profile || '').includes(r));
    const canDelete = ['Super-Admin', 'Admin-Mesa'].some(r => (user?.profile || '').includes(r));
    const canUpload = q && isOwnerOrAssignee;

    const fetchQuotation = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/quotations/${quotationId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setQ(data);
        } catch (e) { /* error fetch */ } finally { setLoading(false); }
    }, [quotationId, token]);

    useEffect(() => { fetchQuotation(); }, [fetchQuotation]);

    // Simplified preview logic: using the new server /view/ endpoint
    const getPreviewUrl = (url) => {
        if (!url) return '';
        const filename = (url || '').split(/[\\/]/).pop();
        const token = localStorage.getItem('glpi_pro_token');
        return `${API_BASE}/quotations/view/${filename}?token=${token}`;
    };

    const getDownloadUrl = (url, originalName) => {
        if (!url) return '';
        const filename = (url || '').split(/[\\/]/).pop();
        const token = localStorage.getItem('glpi_pro_token');
        return `${API_BASE}/quotations/view/${filename}?download=1&name=${encodeURIComponent(originalName || filename)}&token=${token}`;
    };

    const changeStatus = async (newStatus, extra = {}) => {
        setActionLoading(true);
        try {
            const res = await fetch(`${API_BASE}/quotations/${quotationId}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, ...extra })
            });
            if (!res.ok) throw new Error('Error al actualizar');
            await fetchQuotation();
            setShowRejectModal(false);
        } catch (e) { setError(e.message); } finally { setActionLoading(false); }
    };

    const sendComment = async () => {
        if (!comment.trim()) return;
        setCommentLoading(true);
        try {
            await fetch(`${API_BASE}/quotations/${quotationId}/comments`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: comment.trim() })
            });
            setComment('');
            await fetchQuotation();
        } catch (e) { /* error comment */ } finally { setCommentLoading(false); }
    };

    const handleDelete = async () => {
        if (!window.confirm('¿Seguro que deseas eliminar esta cotización? Esta acción no se puede deshacer.')) return;
        setActionLoading(true);
        try {
            const res = await fetch(`${API_BASE}/quotations/${quotationId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error al eliminar');
            onBack(); // Regresar a la lista después de borrar
        } catch (e) {
            setError(e.message);
            setActionLoading(false);
        }
    };

    const handleUploadFiles = async () => {
        if (!uploadFiles || uploadFiles.length === 0) return;
        setUploading(true);
        try {
            const formData = new FormData();
            if (uploadType === 'document') {
                formData.append('file', uploadFiles[0]);
            } else {
                uploadFiles.forEach(file => formData.append('images', file));
            }
            const res = await fetch(`${API_BASE}/quotations/${quotationId}/upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw new Error('Error al subir archivos');
            await fetchQuotation();
            setShowUploadModal(false);
            setUploadFiles([]);
        } catch (e) {
            setError(e.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            setActionLoading(true);
            const token = localStorage.getItem('glpi_pro_token');
            const url = `${API_BASE}/quotations/${quotationId}/pdf?token=${token}`;
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
            }, 1000);
        } catch (e) {
            setError(e.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="animate-spin text-primary-500" size={40} />
            <p className="mt-4 text-[11px] font-[700] uppercase tracking-widest text-text-muted">Cargando expediente...</p>
        </div>
    );

    if (!q) return <div className="p-10 text-center text-text-muted">No se encontró el registro</div>;

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500 max-w-6xl mx-auto">
            {/* Header / Actions Bar */}
            <div className="flex items-center justify-between bg-secondary py-4 px-6 rounded-[12px] border border-color shadow-sm sticky top-0 z-40">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="w-10 h-10 flex items-center justify-center hover:bg-tertiary border border-color rounded-xl text-text-secondary transition-all">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-[17px] font-[700] text-text-primary uppercase tracking-tight">Expediente {q.quotation_number ? `#${q.quotation_number}` : ''}</h2>
                            <StatusBadge status={q.status} />
                        </div>
                        <p className="text-[11px] font-[600] text-text-muted uppercase tracking-[1px]">Sincronizado: {new Date(q.updatedAt).toLocaleString()}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDownloadPDF}
                        disabled={actionLoading}
                        className="bg-secondary hover:bg-tertiary text-primary-500 border border-primary-500/30 hover:border-primary-500 px-4 h-10 rounded-xl text-[12px] font-[700] uppercase tracking-wide shadow-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        <span className="hidden sm:inline">Exportar PDF</span>
                    </button>

                    {(isAdminOrBuyer || isOwnerOrAssignee) && (
                        <div className="relative">
                            <button
                                onClick={() => setShowActionsMenu(!showActionsMenu)}
                                className="bg-[#0695c4] hover:bg-[#0578a0] text-white px-5 h-10 rounded-xl text-[12px] font-[700] uppercase tracking-wide shadow-sm flex items-center gap-2 transition-all active:scale-95"
                            >
                                <Settings2 size={16} /> Acciones <ChevronDown size={14} className={showActionsMenu ? "rotate-180 transition-transform" : "transition-transform"} />
                            </button>

                            {showActionsMenu && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setShowActionsMenu(false)} />
                                    <div className="absolute right-0 mt-2 w-48 bg-secondary rounded-xl shadow-lg border border-color py-2 z-40 animate-in fade-in slide-in-from-top-2">
                                        {Object.keys(STATUS_CONFIG).map((status) => {
                                            const StatusIcon = STATUS_CONFIG[status].icon;
                                            return (
                                                <button
                                                    key={status}
                                                    onClick={() => {
                                                        if (status === 'RECHAZADA') setShowRejectModal(true);
                                                        else changeStatus(status);
                                                        setShowActionsMenu(false);
                                                    }}
                                                    className={cn(
                                                        "w-full text-left px-4 py-2.5 text-[12px] font-[600] uppercase flex items-center gap-3 hover:bg-tertiary transition-colors",
                                                        q.status === status ? "text-primary-500 bg-primary-500/10" : "text-text-secondary"
                                                    )}
                                                >
                                                    <StatusIcon size={14} />
                                                    {STATUS_CONFIG[status].label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {canDelete && (
                        <button
                            onClick={handleDelete}
                            disabled={actionLoading}
                            className="w-10 h-10 flex items-center justify-center bg-secondary hover:bg-red-500/10 text-text-muted hover:text-red-500 border border-color hover:border-red-500/20 rounded-xl transition-all active:scale-95 ml-2 disabled:opacity-50 shadow-sm"
                            title="Eliminar Cotización"
                        >
                            {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Information Grid */}
                    <section className="bg-secondary rounded-[12px] p-[24px_28px] shadow-sm border border-color">
                        <h3 className="text-[12px] font-[700] uppercase tracking-[.7px] text-primary-500 mb-6 pb-[12px] border-b border-color flex items-center gap-2">
                            <Tag size={16} /> Especificaciones Técnicas
                        </h3>

                        <div className="mb-8 p-6 bg-tertiary rounded-2xl border border-color shadow-inner">
                            <h4 className="text-[16px] font-[800] text-text-primary uppercase mb-2 leading-tight">"{q.title}"</h4>
                            <p className="text-[14px] text-text-secondary leading-relaxed whitespace-pre-wrap font-[500]">{q.description}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                            <DetailRow label="Empresa / Cliente" value={q.company} icon={Building} />
                            <DetailRow label="Categoría" value={q.category} icon={Tag} color="text-purple-500" />
                            <DetailRow label="Cantidad Requerida" value={`${q.quantity || ''} ${q.unit || ''}`.trim()} icon={Hash} color="text-orange-500" />
                            <DetailRow label="Asignado a" value={q.assigned_to} icon={User} color="text-emerald-500" />
                        </div>
                    </section>

                    {/* Evidence & Files */}
                    {/* Evidence & Files */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <section className="bg-secondary rounded-[12px] p-[20px_22px] shadow-sm border border-color">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[11px] font-[700] uppercase tracking-[1px] text-primary-500 flex items-center gap-2">
                                    <FileText size={16} /> Documentos
                                </h3>
                                {canUpload && !q.file_name && (
                                    <button
                                        onClick={() => { setUploadType('document'); setShowUploadModal(true); }}
                                        className="text-primary-500 hover:bg-primary-500/10 p-1.5 rounded-md transition-colors"
                                        title="Adjuntar documento"
                                    >
                                        <Plus size={16} />
                                    </button>
                                )}
                            </div>
                            {q.file_name ? (
                                <div className="p-3 bg-tertiary rounded-xl border border-color flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center text-primary-500 shrink-0">
                                            <FileText size={20} />
                                        </div>
                                        <span className="text-[13px] font-[600] text-text-secondary truncate uppercase" title={q.file_name}>{q.file_name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => setPreviewFile({
                                                url: getPreviewUrl(q.file_url),
                                                type: q.file_type?.includes('pdf') || q.file_name?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image',
                                                name: q.file_name,
                                                downloadUrl: getDownloadUrl(q.file_url, q.file_name)
                                            })}
                                            className="p-2 text-text-muted hover:text-primary-500 hover:bg-primary-500/10 rounded-lg transition-colors"
                                            title="Ver documento"
                                        >
                                            <Eye size={18} />
                                        </button>
                                        <a
                                            href={getDownloadUrl(q.file_url, q.file_name)}
                                            className="p-2 text-text-muted hover:text-primary-500 hover:bg-primary-500/10 rounded-lg transition-colors"
                                            title="Descargar documento"
                                        >
                                            <Download size={18} />
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[12px] text-text-muted italic">Sin documentos adjuntos</p>
                            )}
                        </section>

                        <section className="bg-secondary rounded-[12px] p-[20px_22px] shadow-sm border border-color">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[11px] font-[700] uppercase tracking-[1px] text-primary-500 flex items-center gap-2">
                                    <Camera size={16} /> Evidencias ({q.images?.length || 0})
                                </h3>
                                {canUpload && (
                                    <button
                                        onClick={() => { setUploadType('evidence'); setShowUploadModal(true); }}
                                        className="text-primary-500 hover:bg-primary-500/10 p-1.5 rounded-md transition-colors"
                                        title="Adjuntar evidencias"
                                    >
                                        <Plus size={16} />
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {q.images?.map((img, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setPreviewFile({
                                            url: getPreviewUrl(img.url),
                                            type: 'image',
                                            name: img.name || `Evidencia ${i + 1}`,
                                            downloadUrl: getDownloadUrl(img.url, img.name || `Evidencia ${i + 1}`)
                                        })}
                                        className="aspect-square bg-tertiary rounded-lg overflow-hidden border border-color hover:border-primary-500 transition-colors relative group outline-none"
                                    >
                                        <img src={getPreviewUrl(img.url)} className="w-full h-full object-cover outline-none" alt="" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Eye className="text-white" size={24} />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>

                <aside className="space-y-6">
                    {/* Activity Feed */}
                    <section className="bg-secondary rounded-[12px] border border-color shadow-sm flex flex-col h-[500px]">
                        <div className="p-4 border-b border-color flex items-center justify-between bg-tertiary">
                            <h3 className="text-[11px] font-[700] uppercase tracking-[1px] text-primary-500 flex items-center gap-2">
                                <MessageSquare size={16} /> Feedback Técnico
                            </h3>
                            <span className="text-[10px] bg-secondary text-text-secondary px-2 py-0.5 rounded font-[700] border border-color">{q.comments?.length || 0}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {q.comments?.map((c, i) => (
                                <div key={i} className={cn(
                                    "p-3 rounded-xl text-[13px] border",
                                    c.author === user?.name ? "bg-primary-500/10 border-primary-500/20 ml-6" : "bg-tertiary border-color mr-6"
                                )}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[11px] font-[700] uppercase text-primary-500">{c.author}</span>
                                        <span className="text-[10px] text-text-muted">{new Date(c.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-text-secondary leading-tight font-[500]">{c.text}</p>
                                </div>
                            ))}
                        </div>
                        <div className="p-3 border-t border-color bg-tertiary flex gap-2">
                            <input
                                type="text"
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && sendComment()}
                                placeholder="Escribir nota..."
                                className="flex-1 h-9 bg-secondary border border-color text-text-primary rounded-lg px-3 text-[13px] outline-none focus:border-primary-500 placeholder:text-text-muted/50"
                            />
                            <button
                                onClick={sendComment}
                                disabled={commentLoading || !comment.trim()}
                                className="w-9 h-9 bg-primary-500 text-white rounded-lg flex items-center justify-center hover:bg-primary-600 shadow-lg shadow-primary-500/20 transition-all border border-primary-400/30"
                            >
                                {commentLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                    </section>

                    {/* History Timeline */}
                    <section className="bg-secondary rounded-[12px] p-[20px_22px] shadow-sm border border-color">
                        <h3 className="text-[11px] font-[700] uppercase tracking-[1px] text-primary-500 mb-5 flex items-center gap-2">
                            <Clock size={16} /> Trazabilidad
                        </h3>
                        <div className="space-y-4">
                            {q.history?.map((h, i) => (
                                <div key={i} className="relative pl-5 border-l-2 border-color pb-2 last:pb-0">
                                    <div className="absolute -left-[7px] top-0 w-3 h-3 rounded-full bg-secondary border-2 border-primary-500 shadow-sm" />
                                    <p className="text-[11px] font-[700] text-text-primary uppercase leading-none mb-1">{h.to}</p>
                                    <p className="text-[10px] text-text-muted font-[600] uppercase tracking-wide">{h.by} &bull; {new Date(h.at).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#020617]/80 animate-in fade-in duration-300">
                    <div className="bg-secondary rounded-[16px] border border-color p-8 w-full max-w-md shadow-2xl space-y-5">
                        <div className="flex items-center gap-4 border-b border-color pb-4 text-red-500">
                            <XCircle size={28} />
                            <h3 className="text-[18px] font-[700] uppercase tracking-tight text-text-primary">Rechazar Solicitud</h3>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[12px] font-[600] text-text-primary uppercase tracking-wide">Motivo del Rechazo</label>
                            <textarea
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                placeholder="Explique por qué se rechaza esta cotización..."
                                className="w-full h-32 bg-tertiary border border-color rounded-[12px] p-4 text-[13px] text-text-primary outline-none focus:border-red-500 transition-all resize-none font-[500] placeholder:text-text-muted/50"
                            />
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setShowRejectModal(false)} className="flex-1 h-12 bg-tertiary text-text-secondary border border-color rounded-[12px] font-[600] text-[13px] uppercase tracking-widest hover:bg-secondary">Cancelar</button>
                            <button
                                onClick={() => changeStatus('RECHAZADA', { rejection_reason: rejectionReason })}
                                disabled={!rejectionReason.trim() || actionLoading}
                                className="flex-1 h-12 bg-red-600 text-white rounded-[12px] font-[700] text-[13px] uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-700 disabled:opacity-50 border border-red-500/30"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#020617]/80 animate-in fade-in duration-300">
                    <div className="bg-secondary rounded-[16px] border border-color p-8 w-full max-w-md shadow-2xl space-y-5 relative">
                        <div className="flex items-center gap-4 border-b border-color pb-4 text-primary-500">
                            <Upload size={28} />
                            <h3 className="text-[18px] font-[700] uppercase tracking-tight text-text-primary">
                                Adjuntar {uploadType === 'document' ? 'Documento' : 'Evidencias'}
                            </h3>
                        </div>

                        <div className="space-y-4 pt-2">
                            <div className="relative">
                                <input
                                    type="file"
                                    multiple={uploadType === 'evidence'}
                                    accept={uploadType === 'evidence' ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx'}
                                    onChange={e => setUploadFiles(Array.from(e.target.files))}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="w-full h-32 border-2 border-dashed border-color rounded-2xl flex flex-col items-center justify-center gap-2 bg-tertiary text-text-muted hover:border-primary-500 transition-colors">
                                    <Upload className="text-text-muted" size={32} />
                                    <p className="text-[12px] font-[600] uppercase tracking-wide text-center px-4">
                                        Haz clic o arrastra {uploadType === 'document' ? 'tu archivo' : 'tus imágenes'} aquí
                                    </p>
                                </div>
                            </div>

                            {uploadFiles.length > 0 && (
                                <div className="bg-primary-500/10 p-3 rounded-xl border border-primary-500/20 max-h-32 overflow-y-auto">
                                    <p className="text-[12px] font-[700] text-primary-500 mb-1 uppercase tracking-wide sticky top-0 bg-secondary px-2 py-0.5 rounded border border-primary-500/20 shadow-sm">Archivos seleccionados:</p>
                                    <ul className="text-[12px] text-primary-500/80 space-y-1 mt-2">
                                        {uploadFiles.map((f, i) => (
                                            <li key={i} className="flex items-center gap-2 truncate">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
                                                <span className="truncate font-[500]" title={f.name}>{f.name}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 mt-6">
                            <button
                                onClick={() => { setShowUploadModal(false); setUploadFiles([]); }}
                                className="flex-1 h-12 bg-tertiary text-text-secondary border border-color rounded-[12px] font-[600] text-[13px] uppercase tracking-widest hover:bg-secondary"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleUploadFiles}
                                disabled={uploadFiles.length === 0 || uploading}
                                className="flex-1 h-12 bg-primary-500 text-white rounded-[12px] font-[700] text-[13px] uppercase tracking-widest shadow-lg shadow-primary-500/20 hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2 border border-primary-400/30"
                            >
                                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                {uploading ? 'Subiendo...' : 'Subir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* File Preview Modal (usando Portal para cubrir TODA la pantalla) */}
            {previewFile && createPortal(
                <div className="fixed top-0 left-0 w-screen h-screen z-[2147483647] flex items-center justify-center bg-[#020617] animate-in fade-in duration-300 overflow-hidden">
                    <button
                        onClick={() => setPreviewFile(null)}
                        className="absolute right-8 top-8 bg-red-500 hover:bg-red-600 text-white p-3 rounded-2xl shadow-lg shadow-red-500/20 transition-all z-[20] active:scale-90"
                        title="Cerrar vista previa"
                    >
                        <X size={28} />
                    </button>

                    <div className="w-full h-full p-4 md:p-12 flex flex-col items-center justify-center relative">
                        {previewFile.type === 'pdf' ? (
                            <iframe
                                src={previewFile.url}
                                className="w-full h-full bg-white rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)] border-none outline-none ring-0 overflow-hidden"
                                title="Vista previa del documento"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center relative bg-transparent border-none outline-none ring-0">
                                <img
                                    src={previewFile.url}
                                    alt="Vista previa"
                                    className="max-h-full max-w-full object-contain rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.9)] border-none outline-none ring-0 bg-transparent block"
                                />
                            </div>
                        )}
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-secondary border border-color px-8 py-5 rounded-[24px] flex flex-col md:flex-row items-center gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[20] w-[90%] md:w-auto">
                            <span className="text-text-primary text-[15px] font-[800] max-w-[200px] md:max-w-[500px] truncate text-center uppercase tracking-widest">{previewFile.name}</span>
                            <div className="flex items-center gap-4">
                                <a
                                    href={previewFile.downloadUrl}
                                    className="flex shrink-0 items-center justify-center gap-2 text-white bg-primary-500 hover:bg-primary-600 px-8 py-3 rounded-2xl text-[13px] font-[900] uppercase transition-all hover:scale-105 active:scale-95 shadow-xl shadow-primary-500/40 border border-primary-400/30"
                                >
                                    <Download size={20} /> Descargar Original
                                </a>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
