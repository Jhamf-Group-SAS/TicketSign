import { useState, useRef, useCallback, useEffect } from 'react';
import {
    Upload, FileText, X, Loader2, ArrowLeft,
    ShoppingCart, Tag, User, Hash, AlignLeft,
    AlertTriangle, Info, Package, Building, Search,
    Check, ChevronDown, Camera, Plus
} from 'lucide-react';
import { cn } from '../utils/cn';
import CustomSelect from './CustomSelect';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const InputGroup = ({ label, name, value, placeholder, onChange, required, icon: Icon, type = "text" }) => (
    <div className="space-y-1.5 flex-1">
        <label className="text-[12px] font-[600] text-text-primary block ml-1 uppercase tracking-wide">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
            {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />}
            <input
                type={type}
                name={name}
                value={value}
                placeholder={placeholder}
                onChange={onChange}
                className={cn(
                    "h-[40px] w-full rounded-[8px] border border-color px-[12px] text-[13px] bg-tertiary text-text-primary outline-none transition-all placeholder:text-text-muted/50",
                    "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 focus:bg-secondary",
                    Icon && "pl-[36px]"
                )}
            />
        </div>
    </div>
);

const TextAreaGroup = ({ label, value, onChange, placeholder, required }) => (
    <div className="space-y-1.5 w-full">
        <label className="text-[12px] font-[600] text-text-primary block ml-1 uppercase tracking-wide">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <textarea
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={4}
            className={cn(
                "w-full rounded-[12px] border border-color p-[12px] text-[13px] bg-tertiary text-text-primary outline-none transition-all resize-none min-h-[120px] placeholder:text-text-muted/50",
                "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 focus:bg-secondary"
            )}
        />
    </div>
);

export default function QuotationForm({ onBack, onCreated }) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        quantity: '1',
        unit: 'unidad',
        category: '',
        glpi_ticket_id: '',
        priority: 'MEDIA',
        assigned_to: '',
        notes: '',
        company: '',
    });
    const [file, setFile] = useState(null);
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [technicians, setTechnicians] = useState([]);
    const fileInputRef = useRef(null);
    const imagesInputRef = useRef(null);

    const fetchTechnicians = useCallback(async () => {
        try {
            const token = localStorage.getItem('glpi_pro_token');
            const res = await fetch(`${API_BASE_URL}/glpi/technicians`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTechnicians(data.map(t => ({ id: t.fullName || t.name, label: t.fullName || t.name })));
            }
        } catch (e) {
            console.error('Error fetching technicians:', e);
        }
    }, []);

    useEffect(() => {
        fetchTechnicians();
    }, [fetchTechnicians]);

    const set = (field) => (e) => {
        const val = e?.target ? e.target.value : e;
        setForm(f => ({ ...f, [field]: val }));
    };

    const handleFile = useCallback((f) => {
        if (!f) return;
        setFile(f);
    }, []);

    const handleImages = useCallback((files) => {
        setImages(prev => [...prev, ...Array.from(files)].slice(0, 8));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) { setError('Indique el artículo o servicio requerido'); return; }
        if (!form.assigned_to) { setError('Debe asignar un responsable para esta cotización'); return; }
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('glpi_pro_token');
            const fd = new FormData();
            Object.keys(form).forEach(key => fd.append(key, form[key]));
            if (file) fd.append('file', file);
            images.forEach(img => fd.append('images', img));

            const res = await fetch(`${API_BASE_URL}/quotations`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });

            if (!res.ok) throw new Error('Fallo al procesar la solicitud');
            const created = await res.json();
            onCreated(created._id);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 pb-40 animate-in fade-in slide-in-from-bottom-6 duration-700 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between bg-secondary py-4 px-6 rounded-[12px] border border-color shadow-sm mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-500">
                        <ShoppingCart size={22} />
                    </div>
                    <div>
                        <h2 className="text-[17px] font-[700] text-text-primary uppercase tracking-tight">Solicitud de Cotización</h2>
                        <p className="text-[11px] font-[600] text-text-muted uppercase tracking-[1px]">Gestión de Adquisiciones</p>
                    </div>
                </div>
                <button onClick={onBack} className="p-2 hover:bg-tertiary rounded-lg text-text-muted transition-all">
                    <X size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Panel principal */}
                <section className="bg-secondary rounded-[12px] p-[20px_22px] shadow-sm border border-color">
                    <h3 className="text-[12px] font-[700] uppercase tracking-[.7px] text-primary-500 mb-5 pb-[10px] border-b border-color">
                        Especificaciones del Bien
                    </h3>

                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <InputGroup label="Empresa / Entidad" icon={Building} value={form.company} onChange={set('company')} placeholder="Ej: Jhamf Group" required />
                            <InputGroup label="Concepto / Artículo" icon={Tag} value={form.title} onChange={set('title')} placeholder="Ej: Laptop Dell XPS" required />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <InputGroup label="Cantidad" type="number" icon={Hash} value={form.quantity} onChange={set('quantity')} />
                            <CustomSelect
                                label="Unidad"
                                value={form.unit}
                                onChange={set('unit')}
                                options={[
                                    { id: 'unidad', label: 'Unidad' },
                                    { id: 'mes', label: 'Mensualidad' },
                                    { id: 'año', label: 'Anualidad' },
                                    { id: 'servicio', label: 'Servicio' }
                                ]}
                            />
                            <CustomSelect
                                label="Categoría"
                                value={form.category}
                                onChange={set('category')}
                                options={[
                                    { id: 'Hardware', label: 'Hardware' },
                                    { id: 'Software', label: 'Software' },
                                    { id: 'Insumos', label: 'Insumos' },
                                    { id: 'Redes', label: 'Redes' }
                                ]}
                            />
                        </div>

                        <TextAreaGroup label="Justificación Técnica" value={form.description} onChange={set('description')} placeholder="Explique la necesidad técnica..." required />
                    </div>
                </section>

                {/* Panel de Prioridad y Asignación */}
                <section className="bg-secondary rounded-[12px] p-[20px_22px] shadow-sm border border-color">
                    <h3 className="text-[12px] font-[700] uppercase tracking-[.7px] text-primary-500 mb-5 pb-[10px] border-b border-color">
                        Contexto, Prioridad & Asignación
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <CustomSelect
                            label="Prioridad"
                            value={form.priority}
                            onChange={set('priority')}
                            options={[
                                { id: 'BAJA', label: 'Baja' },
                                { id: 'MEDIA', label: 'Media' },
                                { id: 'ALTA', label: 'Alta' },
                                { id: 'URGENTE', label: 'Urgente' }
                            ]}
                        />
                        <CustomSelect
                            label="Asignar Responsable"
                            value={form.assigned_to}
                            onChange={set('assigned_to')}
                            placeholder="Seleccione responsable..."
                            options={technicians}
                            icon={User}
                            withSearch={true}
                            required
                        />
                        <InputGroup label="Ticket de Origen (Opcional)" icon={Hash} value={form.glpi_ticket_id} onChange={set('glpi_ticket_id')} placeholder="Nº Ticket GLPI" />
                    </div>
                </section>

                {/* Archivos Adjuntos */}
                <section className="bg-secondary rounded-[12px] p-[20px_22px] shadow-sm border border-color">
                    <h3 className="text-[12px] font-[700] uppercase tracking-[.7px] text-primary-500 mb-5 pb-[10px] border-b border-color">
                        Documentos y Evidencias
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="text-[11px] font-[600] text-text-muted uppercase">Cotización Base (PDF)</label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="h-[140px] border-2 border-dashed border-color bg-tertiary rounded-[12px] flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-500/5 transition-all"
                            >
                                <Upload size={24} className="text-text-muted mb-2" />
                                <span className="text-[10px] font-[700] text-text-muted uppercase tracking-widest">{file ? file.name : 'Subir Documento'}</span>
                                <input ref={fileInputRef} type="file" className="hidden" onChange={e => handleFile(e.target.files[0])} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[11px] font-[600] text-text-muted uppercase">Imágenes de Referencia ({images.length}/8)</label>
                            <div className="grid grid-cols-4 gap-2">
                                {images.map((img, i) => (
                                    <div key={i} className="aspect-square bg-tertiary rounded-lg overflow-hidden border border-color">
                                        <img src={URL.createObjectURL(img)} className="w-full h-full object-cover" alt="" />
                                    </div>
                                ))}
                                {images.length < 8 && (
                                    <button
                                        type="button"
                                        onClick={() => imagesInputRef.current?.click()}
                                        className="aspect-square border-2 border-dashed border-color rounded-lg flex items-center justify-center text-text-muted hover:border-primary-500 hover:bg-primary-500/5"
                                    >
                                        <Plus size={18} />
                                    </button>
                                )}
                            </div>
                            <input ref={imagesInputRef} type="file" multiple className="hidden" onChange={e => handleImages(e.target.files)} />
                        </div>
                    </div>
                </section>

                {error && (
                    <div className="p-4 bg-red-500/10 text-red-500 rounded-[12px] border border-red-500/20 text-[13px] font-[500] flex items-center gap-3">
                        <AlertTriangle size={18} />
                        {error}
                    </div>
                )}

                {/* Acciones del Formulario (Integradas) */}
                <div className="flex gap-[16px] mt-10 mb-20 pb-10">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex-1 bg-tertiary text-text-secondary border border-color rounded-[14px] h-[52px] font-[600] text-[14px] hover:bg-secondary transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-[3] bg-primary-500 text-white flex items-center justify-center gap-3 rounded-[14px] h-[52px] font-[700] text-[16px] shadow-lg shadow-primary-500/20 hover:bg-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-primary-400/30"
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : <ShoppingCart size={20} />}
                        {loading ? 'Procesando...' : 'Confirmar Solicitud'}
                    </button>
                </div>
            </form>
        </div>
    );
}
