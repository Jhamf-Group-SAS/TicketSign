import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Menu, Sun, Moon, LogOut, User, ChevronRight, Settings, Trash2, X, FileText, CheckSquare, Clock } from 'lucide-react';
import { cn } from '../utils/cn';
import { GlobalSyncIndicator } from './SyncStatus';
import { db } from '../store/db';
import { useLiveQuery } from 'dexie-react-hooks';

const Topbar = ({
    view,
    user,
    isOnline,
    syncStatus = 'synced',
    theme,
    onThemeToggle,
    onLogout,
    unreadCount = 0,
    notifications = [],
    onMarkAllRead,
    onDeleteNotification,
    onClearAllNotifications,
    onOpenSidebar,
    onGlobalSearch
}) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const userMenuRef = useRef(null);
    const notificationsRef = useRef(null);
    const searchRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setIsUserMenuOpen(false);
            }
            if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
                setIsNotificationsOpen(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const searchResults = useLiveQuery(async () => {
        if (!searchQuery || searchQuery.trim().length < 2) return [];
        const query = searchQuery.toLowerCase().trim();

        const acts = await db.acts.toArray() || [];
        const tasks = await db.tasks?.toArray() || []; // Optional chaining since tasks might not exist or be empty easily

        const matchedActs = acts.filter(a =>
            a.client_name?.toLowerCase().includes(query) ||
            a.glpi_ticket_id?.toLowerCase().includes(query) ||
            a.status?.toLowerCase().includes(query) ||
            a.type?.toLowerCase().includes(query) ||
            a.assigned_user?.toLowerCase().includes(query)
        ).map(a => ({ ...a, resultType: 'act' }));

        const matchedTasks = tasks.filter(t =>
            t.title?.toLowerCase().includes(query) ||
            t.description?.toLowerCase().includes(query) ||
            t.glpi_ticket_id?.toLowerCase().includes(query)
        ).map(t => ({ ...t, resultType: 'task' }));

        const allResults = [...matchedActs, ...matchedTasks];

        // Sort newest first
        allResults.sort((a, b) => new Date(b.createdAt || new Date()) - new Date(a.createdAt || new Date()));

        return allResults.slice(0, 10); // Return top 10 results
    }, [searchQuery]) || [];

    const getBreadcrumbs = () => {
        const map = {
            'home': 'Dashboard',
            'form-preventive': 'Nuevo Preventivo',
            'form-corrective': 'Nuevo Correctivo',
            'form-delivery': 'Nueva Entrega',
            'kanban': 'Calendario',
            'task-list': 'Lista de Tareas',
            'quotations': 'Cotizaciones',
            'quotation-form': 'Nueva Cotización',
            'quotation-detail': 'Detalle de Cotización',
            'history': 'Actas',
            'sync': 'Sincronización',
            'config': 'Configuración',
            'tickets': 'Soporte GLPI',
            'ticket-detail': 'Detalle de Ticket'
        };

        return [
            { label: 'System', href: '#' },
            { label: map[view] || view, active: true }
        ];
    };

    const breadcrumbs = getBreadcrumbs();

    return (
        <header className="h-[62px] bg-secondary border-b border-color flex items-center justify-between px-[26px] shadow-[0_1px_8px_rgba(0,0,0,.04)] relative transition-colors duration-300">
            <div className="flex items-center gap-6">
                <button
                    onClick={onOpenSidebar}
                    className="lg:hidden p-2 bg-tertiary border border-color rounded-xl text-text-secondary hover:text-primary-500 transition-all active:scale-90"
                >
                    <Menu size={20} />
                </button>
            </div>

            {/* Center: Search (Premium) */}
            <div className="hidden md:flex flex-1 max-w-[1200px] px-8">
                <div className="relative w-full group" ref={searchRef}>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-[#0695c4] transition-colors" size={16} />
                    <input
                        type="text"
                        value={searchQuery}
                        placeholder="Búsqueda global por actas, tareas o tickets..."
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsSearchFocused(true);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setIsSearchFocused(false);
                                if (onGlobalSearch) onGlobalSearch(searchQuery);
                            }
                        }}
                        onFocus={() => setIsSearchFocused(true)}
                        className="w-full bg-primary border border-color focus:border-primary-500 focus:bg-secondary focus:ring-4 focus:ring-primary-500/5 rounded-xl h-[42px] pl-12 pr-6 text-[13px] font-medium transition-all outline-none shadow-sm placeholder:text-text-muted text-text-primary"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-40 pointer-events-none hidden lg:flex">
                        <kbd className="text-[10px] font-black border border-color px-1.5 py-0.5 rounded-md bg-tertiary text-text-muted">⌘</kbd>
                        <kbd className="text-[10px] font-black border border-color px-1.5 py-0.5 rounded-md bg-tertiary text-text-muted">K</kbd>
                    </div>

                    {/* Search Results Dropdown */}
                    {isSearchFocused && searchQuery.trim().length >= 2 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-secondary border border-color rounded-2xl shadow-2xl overflow-hidden z-[200] animate-in fade-in slide-in-from-top-2 duration-200">
                            {searchResults.length > 0 ? (
                                <div className="max-h-[350px] overflow-y-auto no-scrollbar custom-scrollbar">
                                    <div className="p-2.5 border-b border-color bg-tertiary sticky top-0 z-10 flex items-center justify-between">
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted ml-2">Resultados ({searchResults.length})</p>
                                    </div>
                                    <div className="p-1.5 flex flex-col gap-1">
                                        {searchResults.map((res, i) => (
                                            <div
                                                key={i}
                                                onClick={() => {
                                                    setIsSearchFocused(false);
                                                    setSearchQuery('');
                                                    if (onGlobalSearch) onGlobalSearch(res);
                                                }}
                                                className="p-3 rounded-xl hover:bg-tertiary transition-colors cursor-pointer flex items-center gap-4 group/result border border-transparent hover:border-color"
                                            >
                                                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 border border-color shadow-sm group-hover/result:scale-110 transition-transform">
                                                    {res.resultType === 'act' ? <FileText size={16} className="text-primary-500" /> : <CheckSquare size={16} className="text-purple-500" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-[8px] font-black text-white uppercase tracking-widest px-1.5 py-0.5 rounded border shadow-sm" style={{ backgroundColor: res.resultType === 'act' ? '#0695c4' : '#8b5cf6' }}>
                                                            {res.resultType === 'act' ? 'Acta' : 'Tarea'}
                                                        </span>
                                                        {(res.glpi_ticket_id || res.reference) && (
                                                            <span className="text-[10px] font-bold text-text-muted">
                                                                TICKET #{res.glpi_ticket_id || res.reference}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[13px] font-bold text-text-primary truncate">
                                                        {res.resultType === 'act' ? `${res.type} ${res.client_name ? `- ${res.client_name}` : ''}` : (res.title || 'Tarea sin título')}
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-tertiary text-text-muted opacity-0 group-hover/result:opacity-100 transition-all transform translate-x-2 group-hover/result:translate-x-0 group-active/result:scale-95">
                                                    <ChevronRight size={14} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-10 text-center flex flex-col items-center justify-center">
                                    <div className="w-14 h-14 bg-tertiary rounded-2xl flex items-center justify-center mb-3 shadow-inner border border-color">
                                        <Search size={24} className="text-text-muted opacity-50" />
                                    </div>
                                    <p className="text-[12px] font-black text-text-primary uppercase tracking-wider">Sin resultados</p>
                                    <p className="text-[11px] text-text-muted mt-1 font-medium">No se encontró nada para la búsqueda.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right section: Actions */}
            <div className="flex items-center gap-3">
                {/* Sync Status */}
                <div className="mr-2">
                    <GlobalSyncIndicator status={isOnline ? syncStatus : 'offline'} />
                </div>

                <div className="h-8 w-[1px] bg-color mx-1 hidden sm:block" />

                {/* Theme Toggle */}
                <button
                    onClick={onThemeToggle}
                    className="p-2.5 bg-tertiary border border-color text-text-secondary hover:text-primary-500 hover:bg-secondary rounded-xl transition-all active:scale-95 shadow-sm"
                    title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                {/* Notifications */}
                <div className="relative" ref={notificationsRef}>
                    <button
                        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                        className={cn(
                            "w-[36px] h-[36px] rounded-[9px] bg-tertiary border border-color text-text-secondary hover:text-primary-500 transition-all relative flex items-center justify-center active:scale-95",
                            isNotificationsOpen && "bg-secondary border-primary-500 text-primary-500"
                        )}
                    >
                        <Bell size={18} />
                        {unreadCount > 0 && (
                            <span className="absolute top-0 right-0 w-[8px] h-[8px] bg-red-500 rounded-full border border-secondary"></span>
                        )}
                    </button>

                    {isNotificationsOpen && (
                        <div className="absolute right-0 top-full pt-4 w-96 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="bg-secondary border border-color rounded-2xl shadow-2xl overflow-hidden">
                                <div className="p-4 border-b border-color bg-tertiary flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-primary">Notificaciones</h3>
                                        <span className="text-[10px] font-black bg-primary-500 text-white px-2 py-0.5 rounded-full shadow-lg shadow-primary-500/20">{notifications.length}</span>
                                    </div>
                                    {notifications.length > 0 && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onClearAllNotifications?.(); }}
                                            className="text-[9px] font-black uppercase text-red-500 hover:text-red-600 transition-colors flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-red-500/5"
                                        >
                                            <Trash2 size={12} />
                                            Limpiar todo
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-[450px] overflow-y-auto no-scrollbar custom-scrollbar">
                                    {notifications.length > 0 ? (
                                        notifications.map(n => (
                                            <div key={n.id} className="p-4 border-b border-color last:border-0 hover:bg-tertiary transition-all cursor-pointer group">
                                                <div className="flex gap-4 relative">
                                                    <div className="w-10 h-10 rounded-xl bg-tertiary flex items-center justify-center shrink-0 border border-color group-hover:scale-110 transition-transform">
                                                        <Bell size={16} className="text-primary-500" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <p className="text-xs font-black text-text-primary group-hover:text-primary-500 transition-colors truncate">{n.title}</p>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onDeleteNotification?.(n.id); }}
                                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-500 rounded-md transition-all text-text-muted"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                        <p className="text-[11px] text-text-muted mt-1 font-bold line-clamp-2 leading-relaxed">{n.message}</p>
                                                        <p className="text-[9px] text-text-muted mt-2 uppercase font-black tracking-widest opacity-60 flex items-center gap-1.5">
                                                            <span className="w-1 h-1 rounded-full bg-primary-500" /> {n.time}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-12 text-center text-text-muted">
                                            <div className="w-16 h-16 bg-tertiary rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                                                <Bell size={32} className="opacity-20" />
                                            </div>
                                            <p className="text-[11px] font-black uppercase tracking-widest">Sin notificaciones pendientes</p>
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 bg-tertiary text-center border-t border-color">
                                    <button
                                        onClick={() => { onMarkAllRead?.(); setIsNotificationsOpen(false); }}
                                        className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500 hover:text-primary-600 transition-colors"
                                    >
                                        Marcar todas como leídas
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* User Menu */}
                <div className="relative" ref={userMenuRef}>
                    <button
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className={cn(
                            "flex items-center justify-center w-[36px] h-[36px] rounded-full bg-[linear-gradient(135deg,#0695c4,#0578a0)] text-white text-[13px] font-bold shadow-sm active:scale-95 transition-transform",
                            isUserMenuOpen && "ring-2 ring-primary-500/20"
                        )}
                    >
                        {user?.name?.[0] || user?.username?.[0] || 'U'}
                    </button>

                    {isUserMenuOpen && (
                        <div className="absolute right-0 top-full pt-4 w-60 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="bg-secondary border border-color rounded-2xl shadow-2xl p-1.5 overflow-hidden">
                                <div className="p-4 border-b border-color mb-1.5 bg-tertiary rounded-t-xl">
                                    <p className="text-[9px] text-text-muted font-black uppercase tracking-[0.2em] mb-1 opacity-70">Sessión Iniciada</p>
                                    <p className="text-xs font-black text-text-primary truncate uppercase">{user?.name || user?.username}</p>
                                </div>
                                <button
                                    onClick={() => { setIsUserMenuOpen(false); /* Navegar a perfil */ }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-text-secondary hover:text-text-primary hover:bg-tertiary rounded-xl transition-all text-left group"
                                >
                                    <div className="p-2 rounded-lg bg-tertiary group-hover:bg-secondary group-hover:border group-hover:border-primary-500/30 transition-colors">
                                        <User size={16} className="group-hover:text-primary-500 transition-colors" />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-[10px]">Mi Perfil</span>
                                </button>
                                <button
                                    onClick={() => { setIsUserMenuOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-text-secondary hover:text-text-primary hover:bg-tertiary rounded-xl transition-all text-left group"
                                >
                                    <div className="p-2 rounded-lg bg-tertiary group-hover:bg-blue-500/10 transition-colors">
                                        <Settings size={16} className="group-hover:text-blue-500 transition-colors" />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-[10px]">Ajustes</span>
                                </button>
                                <div className="h-4" />
                                <button
                                    onClick={onLogout}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-tertiary rounded-xl transition-all text-left group"
                                >
                                    <div className="p-2 rounded-lg bg-tertiary group-hover:bg-red-500 transition-colors">
                                        <LogOut size={16} className="group-hover:text-white transition-transform" />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-[10px]">Cerrar Sesión</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
export default Topbar;
