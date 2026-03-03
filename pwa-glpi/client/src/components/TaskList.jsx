import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import {
    Plus,
    Search,
    Eye,
    FileText,
    Edit3,
    Clock,
    CheckCircle2,
    AlertCircle,
    RefreshCcw,
    MapPin,
    Tag,
    ChevronDown,
    Filter,
    Circle,
    Trash2,
    Loader2
} from 'lucide-react';
import { cn } from '../utils/cn';
import TaskForm from './TaskForm';
import MaintenanceForm from './MaintenanceForm';

const TaskList = ({ onBack }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('Todas');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [selectedTech, setSelectedTech] = useState('Todos');
    const [isTechDropdownOpen, setIsTechDropdownOpen] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // For FileText action to create Acta
    const [taskForActa, setTaskForActa] = useState(null);
    const [selectedTasks, setSelectedTasks] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsTechDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const tasks = useLiveQuery(() => db.tasks.toArray()) || [];
    const technicians = useLiveQuery(() => db.glpi_technicians.toArray()) || [];

    const [user] = useState(JSON.parse(localStorage.getItem('glpi_pro_user') || '{}'));

    // Map to get fullName from technician name/username
    const techNameMap = React.useMemo(() => {
        const map = {};

        // Add current user to map
        if (user.username) {
            const currentFullName = `${user.firstname || ''} ${user.realname || ''}`.trim();
            if (currentFullName) map[user.username] = currentFullName;
        }

        technicians.forEach(t => {
            if (t.fullName) {
                map[t.fullName] = t.fullName;
                // Extract username from label if it follows "Name (username)"
                const match = /\(([^)]+)\)$/.exec(t.label);
                if (match && match[1]) {
                    map[match[1]] = t.fullName;
                }
            }
        });
        return map;
    }, [technicians, user]);

    const filters = ["Todas", "PROGRAMADA", "ASIGNADA", "EJECUCIÓN", "CANCELADA", "COMPLETADA", "VENCIDA"];

    const filteredTasks = tasks.filter(task => {
        const matchesSearch = !searchTerm ||
            task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.glpi_ticket_id?.toString().includes(searchTerm) ||
            (task.assigned_technicians || []).some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        if (activeFilter === 'PROGRAMADA') return task.status === 'PROGRAMADA';
        if (activeFilter === 'ASIGNADA') return task.status === 'ASIGNADA';
        if (activeFilter === 'EJECUCIÓN') return task.status === 'EN_EJECUCION';
        if (activeFilter === 'CANCELADA') return task.status === 'CANCELADA';
        if (activeFilter === 'COMPLETADA') return task.status === 'COMPLETADA';
        if (activeFilter === 'VENCIDA') return task.status === 'VENCIDA';

        if (selectedTech && selectedTech !== 'Todos') {
            const hasTech = (task.assigned_technicians || []).some(t =>
                t.toLowerCase() === selectedTech.toLowerCase() ||
                (t.split(' ')[0] && selectedTech.toLowerCase().includes(t.split(' ')[0].toLowerCase()))
            );
            if (!hasTech) return false;
        }

        return true;
    });

    const stats = {
        total: tasks.length,
        urgent: tasks.filter(t => t.priority === 'CRITICA' || t.priority === 'ALTA').length,
        pendingSync: tasks.filter(t => !t.sincronizado).length // Assuming a field
    };

    const handleDeleteSelected = async () => {
        if (!selectedTasks.length) return;
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            // Eliminar de base local (puede ser .id numérico o string '_id')
            await Promise.all(selectedTasks.map(id => db.tasks.delete(id)));

            // Eliminar del backend si hay red
            if (navigator.onLine) {
                const token = localStorage.getItem('glpi_pro_token');
                const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

                // Mapear los seleccionados a sus equivalentes remotos (_id)
                const tasksToDelete = filteredTasks.filter(t => selectedTasks.includes(t.id || t._id));
                const backendIds = tasksToDelete.map(t => t._id).filter(id => id && id.length === 24);

                await Promise.all(
                    backendIds.map(id =>
                        fetch(`${baseUrl}/tasks/${id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        }).catch(e => console.warn(`Error borrando remoto ${id}`, e))
                    )
                );
            }
            setSelectedTasks([]);
        } catch (error) {
            console.error('Error al eliminar tareas', error);
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedTasks(filteredTasks.map(t => t.id || t._id));
        else setSelectedTasks([]);
    };

    const handleSelectTask = (taskId) => {
        setSelectedTasks(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
    };

    return (
        <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-[26px] font-[800] text-text-primary">Tareas</h2>
                    <p className="text-[13px] text-text-muted font-[500] mt-1">
                        {stats.total} tareas en total · {stats.urgent} urgentes
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {selectedTasks.length > 0 && (
                        <button
                            onClick={handleDeleteSelected}
                            disabled={isDeleting}
                            className="bg-secondary hover:bg-tertiary text-red-500 px-4 py-2.5 rounded-[12px] text-[13px] font-[700] flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 border border-red-500"
                        >
                            {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                            Eliminar ({selectedTasks.length})
                        </button>
                    )}
                    <button
                        onClick={() => { setEditingTask(null); setIsFormOpen(true); }}
                        className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-[12px] text-[13px] font-[700] flex items-center gap-2 shadow-lg shadow-primary-500/20 transition-all active:scale-95 border border-primary-400/30"
                    >
                        <Plus size={18} />
                        Nueva Tarea
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[180px] w-full sm:w-auto">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={15} />
                    <input
                        type="text"
                        placeholder="Buscar Labor..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full bg-secondary border border-color rounded-[12px] h-[38px] pl-10 pr-4 text-[12px] font-[500] outline-none focus:border-primary-500 transition-all text-text-primary"
                    />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1 bg-secondary p-1 rounded-[12px] border border-color">
                    {filters.map(f => (
                        <button
                            key={f}
                            onClick={() => { setActiveFilter(f); setCurrentPage(1); }}
                            className={cn(
                                "px-2.5 py-1.5 rounded-[9px] text-[10.5px] font-[700] transition-all whitespace-nowrap",
                                activeFilter === f ? "bg-primary-500 text-white shadow-sm" : "text-text-muted hover:bg-tertiary"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsTechDropdownOpen(!isTechDropdownOpen)}
                        className="h-[40px] px-4 bg-secondary border border-color rounded-[12px] text-[11px] font-[700] text-text-secondary flex items-center gap-2 hover:bg-tertiary transition-all"
                    >
                        {selectedTech === 'Todos' ? 'Técnico' : (selectedTech.length > 12 ? selectedTech.substring(0, 12) + '...' : selectedTech)}
                        <ChevronDown size={14} className={cn("transition-transform duration-200", isTechDropdownOpen && "rotate-180")} />
                    </button>
                    {isTechDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-secondary rounded-[16px] shadow-xl border border-color z-[100] py-2 max-h-[300px] overflow-y-auto no-scrollbar animate-in slide-in-from-top-2">
                            <button
                                onClick={() => { setSelectedTech('Todos'); setIsTechDropdownOpen(false); }}
                                className={cn("w-full text-left px-5 py-3 text-[13px] hover:bg-tertiary transition-colors", selectedTech === 'Todos' ? "font-[800] text-primary-500 bg-tertiary" : "text-text-secondary font-[500]")}
                            >
                                Todos los técnicos
                            </button>
                            <div className="h-[1px] bg-color my-1 mx-2" />
                            {technicians.map(tech => {
                                const techName = tech.fullName || tech.label;
                                return (
                                    <button
                                        key={tech.id}
                                        onClick={() => { setSelectedTech(techName); setIsTechDropdownOpen(false); }}
                                        className={cn("w-full text-left px-5 py-2.5 text-[13px] hover:bg-tertiary transition-colors", selectedTech === techName ? "font-[800] text-primary-500 bg-tertiary" : "text-text-secondary font-[500]")}
                                    >
                                        {techName}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Table View */}
            {(() => {
                const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const paginatedTasks = filteredTasks.slice(startIndex, startIndex + itemsPerPage);

                return (
                    <>
                        <div className="bg-secondary rounded-[16px] border border-color shadow-sm overflow-hidden">
                            {/* Desktop View Table */}
                            <div className="hidden md:block overflow-x-auto no-scrollbar">
                                <table className="w-full text-left border-collapse min-w-full">
                                    <thead>
                                        <tr className="bg-tertiary border-b border-color">
                                            <th className="px-3 py-4 w-10 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={filteredTasks.length > 0 && selectedTasks.length === filteredTasks.length}
                                                    onChange={handleSelectAll}
                                                    className="w-3.5 h-3.5 rounded text-[#0695c4] focus:ring-[#0695c4] border-gray-300"
                                                />
                                            </th>
                                            <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider">ID</th>
                                            <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider">TÍTULO</th>
                                            <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider">EMPRESA</th>
                                            <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider">FECHA EJECUCIÓN</th>
                                            <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider">PRIORIDAD</th>
                                            <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider">ESTADO</th>
                                            <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider">SOLICITANTE</th>
                                            <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider">ASIGNADO A</th>
                                            <th className="px-3 py-4 text-[9px] font-[800] text-[#94a3b8] uppercase tracking-wider text-right pr-4">ACCIONES</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-color">
                                        {paginatedTasks.length > 0 ? (
                                            paginatedTasks.map(task => {
                                                const taskId = task.id || task._id;
                                                const isSelected = selectedTasks.includes(taskId);

                                                const priorityMap = {
                                                    'CRITICA': 'bg-red-500/10 text-red-500 border border-red-500/20',
                                                    'ALTA': 'bg-orange-500/10 text-orange-500 border border-orange-500/20',
                                                    'MEDIA': 'bg-primary-500/10 text-primary-500 border border-primary-500/20',
                                                    'BAJA': 'bg-tertiary text-text-muted border border-color'
                                                };

                                                const statusMap = {
                                                    'PROGRAMADA': { label: 'PROGRAMADA', color: 'text-blue-500', bg: 'bg-blue-500' },
                                                    'ASIGNADA': { label: 'ASIGNADA', color: 'text-purple-500', bg: 'bg-purple-500' },
                                                    'EN_EJECUCION': { label: 'EJECUCIÓN', color: 'text-amber-500', bg: 'bg-amber-500' },
                                                    'CANCELADA': { label: 'CANCELADA', color: 'text-gray-500', bg: 'bg-gray-500' },
                                                    'COMPLETADA': { label: 'COMPLETADA', color: 'text-green-500', bg: 'bg-green-500' },
                                                    'VENCIDA': { label: 'VENCIDA', color: 'text-red-500', bg: 'bg-red-500' }
                                                };

                                                const pColor = priorityMap[task.priority] || priorityMap['MEDIA'];
                                                const s = statusMap[task.status] || statusMap['PROGRAMADA'];

                                                return (
                                                    <tr key={taskId} className={cn("hover:bg-tertiary/50 transition-colors", isSelected && "bg-tertiary/30")}>
                                                        <td className="px-3 py-3 w-10 text-center align-middle">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => handleSelectTask(taskId)}
                                                                className="w-3.5 h-3.5 rounded text-[#0695c4] focus:ring-[#0695c4] border-gray-300"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-3 align-middle text-[12px] text-[#64748b] font-[600]">
                                                            {typeof taskId === 'string' && taskId.length > 10 ? taskId.substring(taskId.length - 6).toUpperCase() : taskId}
                                                        </td>
                                                        <td className="px-3 py-3 align-middle text-[12px] text-[#0695c4] font-[700] hover:underline cursor-pointer max-w-[200px] truncate" title={task.title} onClick={() => { setEditingTask(task); setIsFormOpen(true); }}>
                                                            {task.title}
                                                        </td>
                                                        <td className="px-3 py-3 align-middle text-[11px] text-text-secondary font-[500] max-w-[120px] truncate">
                                                            <span className="bg-tertiary/60 px-2 py-0.5 rounded text-text-muted border border-color">{task.entity_name || 'Jhamf Group SAS'}</span>
                                                        </td>
                                                        <td className="px-3 py-3 align-middle text-[11px] text-[#64748b]">
                                                            {task.scheduled_at ? new Date(task.scheduled_at).toLocaleString([], { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '---'}
                                                        </td>
                                                        <td className="px-3 py-3 align-middle">
                                                            <span className={cn("px-2 py-0.5 rounded text-[10px] font-[700] whitespace-nowrap", pColor)}>{task.priority === 'CRITICA' ? 'Muy Alta' : task.priority.charAt(0).toUpperCase() + task.priority.slice(1).toLowerCase()}</span>
                                                        </td>
                                                        <td className="px-3 py-3 align-middle text-[11px] text-[#475569] font-[600]">
                                                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.bg)} />
                                                                {s.label}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 align-middle text-[11px] text-[#475569] font-[500] truncate max-w-[100px]" title={techNameMap[task.createdBy] || task.createdBy}>
                                                            {techNameMap[task.createdBy] || task.createdBy || '---'}
                                                        </td>
                                                        <td className="px-3 py-3 align-middle text-[11px] text-[#475569] font-[500] truncate max-w-[150px]" title={(task.assigned_technicians || []).map(t => techNameMap[t] || t).join(', ')}>
                                                            {(task.assigned_technicians || []).length > 0
                                                                ? task.assigned_technicians.map(t => techNameMap[t] || t).join(', ')
                                                                : '---'}
                                                        </td>
                                                        <td className="px-3 py-3 align-middle text-right pr-4">
                                                            <button
                                                                onClick={() => { setEditingTask(task); setIsFormOpen(true); }}
                                                                className="w-7 h-7 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center hover:bg-orange-100 transition-colors ml-auto"
                                                                title="Editar"
                                                            >
                                                                <Edit3 size={13} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={10} className="text-center py-20">
                                                    <div className="w-16 h-16 bg-tertiary rounded-full flex items-center justify-center mx-auto mb-4 text-text-muted border border-color">
                                                        <Filter size={32} />
                                                    </div>
                                                    <p className="text-[14px] font-[700] text-text-primary">No se encontraron tareas</p>
                                                    <p className="text-[12px] text-text-muted mt-1">Intenta con otros filtros o términos de búsqueda</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile View Cards */}
                            <div className="md:hidden flex flex-col divide-y divide-color">
                                {paginatedTasks.length > 0 ? (
                                    paginatedTasks.map(task => {
                                        const taskId = task.id || task._id;
                                        const statusMap = {
                                            'PROGRAMADA': { label: 'PROGRAMADA', bg: 'bg-blue-500' },
                                            'ASIGNADA': { label: 'ASIGNADA', bg: 'bg-purple-500' },
                                            'EN_EJECUCION': { label: 'EJECUCIÓN', bg: 'bg-amber-500' },
                                            'CANCELADA': { label: 'CANCELADA', bg: 'bg-gray-500' },
                                            'COMPLETADA': { label: 'COMPLETADA', bg: 'bg-emerald-500' },
                                            'VENCIDA': { label: 'VENCIDA', bg: 'bg-red-500' }
                                        };
                                        const s = statusMap[task.status] || statusMap['PROGRAMADA'];

                                        return (
                                            <div
                                                key={taskId}
                                                className="p-5 active:bg-tertiary transition-colors"
                                                onClick={() => { setEditingTask(task); setIsFormOpen(true); }}
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("w-2 h-2 rounded-full", s.bg)} />
                                                        <span className="text-[10px] font-black uppercase text-text-muted tracking-widest">{s.label}</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-text-muted bg-tertiary px-2 py-0.5 rounded">
                                                        ID: {typeof taskId === 'string' && taskId.length > 10 ? taskId.substring(taskId.length - 6).toUpperCase() : taskId}
                                                    </span>
                                                </div>
                                                <h4 className="text-[15px] font-black text-text-primary leading-tight mb-2">{task.title}</h4>
                                                <div className="flex flex-wrap gap-4 mt-4">
                                                    <div className="flex items-center gap-1.5 grayscale opacity-70">
                                                        <Clock size={14} />
                                                        <span className="text-[11px] font-bold">{task.scheduled_at ? new Date(task.scheduled_at).toLocaleDateString() : '---'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 grayscale opacity-70">
                                                        <Tag size={14} />
                                                        <span className="text-[11px] font-bold truncate max-w-[100px]">{task.entity_name || 'Jhamf Group'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="py-20 text-center">
                                        <p className="text-[14px] font-black text-text-muted">No hay tareas</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pagination Footer */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-2 pt-4">
                                <p className="text-[11px] text-text-muted font-[500]">
                                    Mostrando <span className="text-text-primary font-bold">{startIndex + 1}</span> - <span className="text-text-primary font-bold">{Math.min(startIndex + itemsPerPage, filteredTasks.length)}</span> de <span className="text-text-primary font-bold">{filteredTasks.length}</span> tareas
                                </p>
                                <div className="flex items-center gap-1">
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
                );
            })()}

            {isFormOpen && (
                <TaskForm
                    initialData={editingTask}
                    onCancel={() => setIsFormOpen(false)}
                    onSave={() => setIsFormOpen(false)}
                />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-[#020617]/80 z-[3000] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-secondary rounded-[24px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-color">
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 mx-auto text-red-500">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-black text-text-primary mb-3">Eliminar tareas</h3>
                            <p className="text-text-muted text-[14px] leading-relaxed">
                                ¿Estás seguro de que deseas eliminar <b>{selectedTasks.length}</b> tarea{selectedTasks.length > 1 ? 's' : ''}? Esta acción no se puede deshacer y se borrará del servidor.
                            </p>
                        </div>
                        <div className="px-8 py-6 bg-tertiary border-t border-color flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                disabled={isDeleting}
                                className="flex-1 h-11 bg-secondary border border-color text-text-muted font-bold text-[12px] rounded-xl uppercase tracking-widest hover:bg-tertiary transition-all disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="flex-[1.5] h-11 bg-red-500 text-white font-black text-[12px] rounded-xl uppercase tracking-[1.5px] shadow-lg shadow-red-500/20 hover:shadow-red-500/40 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskList;
