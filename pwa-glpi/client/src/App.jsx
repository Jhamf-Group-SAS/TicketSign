import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './store/db';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import TicketList from './components/TicketList';
import TicketDetail from './components/TicketDetail';
import MaintenanceForm from './components/MaintenanceForm';
import MaintenancePreview from './components/MaintenancePreview';
import ClientConsolidated from './components/ClientConsolidated';
import HistoricalActs from './components/HistoricalActs';
import DashboardSummary from './components/DashboardSummary';
import TaskBoard from './components/TaskBoard';
import TaskList from './components/TaskList';
import SyncManager from './components/SyncManager';
import QuotationList from './components/QuotationList';
import QuotationForm from './components/QuotationForm';
import QuotationDetail from './components/QuotationDetail';
import { GlobalSyncIndicator } from './components/SyncStatus';
import { ToastContainer } from './components/Toast';
import Login from './components/Login';
import InDevelopment from './components/InDevelopment';
import ConfigManager from './components/ConfigManager';
import AutomaticUpdateHandler from './components/AutomaticUpdateHandler';
import NotificationService from './services/NotificationService';
import {
    ClipboardList,
    History,
    ArrowRight,
    LayoutDashboard,
    Building2,
    Cloud,
    RefreshCw,
    CheckCircle2,
    Clock,
    Calendar,
    User,
    ChevronRight,
    Loader2,
    Settings
} from 'lucide-react';
import { cn } from './utils/cn';

function App() {
    const [view, setView] = useState(() => localStorage.getItem('glpi_pro_view') || 'home');
    const [selectedTicketId, setSelectedTicketId] = useState(() => localStorage.getItem('glpi_pro_ticket_id'));
    const [selectedAct, setSelectedAct] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('glpi_pro_act') || 'null');
        } catch (e) { return null; }
    });
    const [selectedQuotationId, setSelectedQuotationId] = useState(() => localStorage.getItem('glpi_pro_quotation_id'));
    const [user, setUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('glpi_pro_user') || 'null');
        } catch (e) {
            return null;
        }
    });

    // Persistencia de navegación
    useEffect(() => {
        localStorage.setItem('glpi_pro_view', view);
        if (selectedTicketId) localStorage.setItem('glpi_pro_ticket_id', selectedTicketId);
        else localStorage.removeItem('glpi_pro_ticket_id');

        if (selectedQuotationId) localStorage.setItem('glpi_pro_quotation_id', selectedQuotationId);
        else localStorage.removeItem('glpi_pro_quotation_id');

        if (selectedAct) localStorage.setItem('glpi_pro_act', JSON.stringify(selectedAct));
        else localStorage.removeItem('glpi_pro_act');
    }, [view, selectedTicketId, selectedQuotationId, selectedAct]);
    const [isOnline, setIsOnline] = useState(window.navigator.onLine);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [theme, setTheme] = useState(() => localStorage.getItem('glpi_pro_theme') || 'light');

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

    useEffect(() => {
        // Cargar preferencias globales en caso de limpieza de historial/caché
        const loadGlobalBranding = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/config/public`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.theme && !localStorage.getItem('glpi_pro_theme')) {
                        setTheme(data.theme);
                    }
                }
            } catch (e) { }
        };
        if (!localStorage.getItem('glpi_pro_theme')) {
            loadGlobalBranding();
        }
    }, [API_BASE_URL]);

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('glpi_pro_theme', theme);

        // Guardar el tema como configuración global silenciosamente (Solo para administradores, los demás ignoran el 403)
        const token = localStorage.getItem('glpi_pro_token');
        if (token && user) {
            fetch(`${API_BASE_URL}/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ theme })
            }).catch(() => { });
        }
    }, [theme, API_BASE_URL, user]);
    const [notificationToast, setNotificationToast] = useState(null);
    const [isConfigured, setIsConfigured] = useState(true);
    const [showSetupNotice, setShowSetupNotice] = useState(false);


    const checkConfig = async () => {
        const tokenToken = localStorage.getItem('glpi_pro_token');
        if (!tokenToken || tokenToken === 'undefined') return;
        try {
            const res = await fetch(`${API_BASE_URL}/config`, {
                headers: { 'Authorization': `Bearer ${tokenToken}` }
            });
            if (res.status === 401) {
                handleLogout();
                return;
            }
            if (res.status === 403) return; // No tiene permiso para ver config, ignorar
            if (res.ok) {
                const data = await res.json();
                const hasGLPI = !!(data.glpi_api_url && data.glpi_app_token);
                setIsConfigured(hasGLPI);
                if (!hasGLPI && view !== 'config') setShowSetupNotice(true);
                else setShowSetupNotice(false);

                if (hasGLPI && navigator.onLine) {
                    SyncService.syncGLPICache(); // Precarga silenciosa
                }
            }
        } catch (err) {
            // error checking config
        }
    };

    useEffect(() => {
        if (user) checkConfig();
    }, [user, API_BASE_URL]);

    // Sync state
    const pendingActs = useLiveQuery(() => db.acts.filter(a => a.status === 'PENDIENTE_SINCRONIZACION').toArray()) || [];

    const consolidatedStats = useLiveQuery(async () => {
        const dbActs = await db.acts.toArray();
        const empresas = new Set(dbActs.map(a => a.client_name).filter(Boolean)).size;
        const preventivas = dbActs.filter(a => a.type === 'PREVENTIVO').length;
        const correctivas = dbActs.filter(a => a.type === 'CORRECTIVO').length;
        const entregas = dbActs.filter(a => a.type === 'ENTREGA').length;
        return { empresas, preventivas, correctivas, entregas };
    }, []) || { empresas: 0, preventivas: 0, correctivas: 0, entregas: 0 };

    const recentActs = useLiveQuery(async () => {
        const acts = await db.acts.orderBy('createdAt').reverse().toArray();
        // Filtrar duplicados por glpi_ticket_id (quedarnos con el más reciente)
        const seen = new Set();
        return acts.filter(act => {
            if (!act.glpi_ticket_id) return true;
            if (seen.has(act.glpi_ticket_id)) return false;
            seen.add(act.glpi_ticket_id);
            return true;
        }).slice(0, 3);
    }) || [];

    const isSyncing = false; // Mocking sync state for now

    // Notificaciones
    const notificationsList = useLiveQuery(() => db.notifications.orderBy('createdAt').reverse().limit(20).toArray()) || [];
    const unreadCount = useLiveQuery(() => db.notifications.where('read').equals(0).count()) || 0;

    useEffect(() => {
        if (user) {
            NotificationService.start();
        }
        return () => NotificationService.stop();
    }, [user]);

    const handleMarkAllRead = async () => {
        await db.notifications.where('read').equals(0).modify({ read: 1 });
    };

    const handleDeleteNotification = async (id) => {
        await db.notifications.delete(id);
    };

    const handleClearAllNotifications = async () => {
        await db.notifications.clear();
    };
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('glpi_pro_token');
        localStorage.removeItem('glpi_pro_user');
        setUser(null);
        setView('login');
    };

    const handleNavClick = (newView) => {
        setView(newView);
        setIsMobileSidebarOpen(false);
    };

    if (!user) {
        return <Login onLogin={(u) => { setUser(u); setView('home'); }} />;
    }

    return (
        <div className="min-h-screen bg-primary transition-colors duration-300">
            <AutomaticUpdateHandler />

            {/* Sidebar - Desktop */}
            <div className="hidden lg:block">
                <Sidebar
                    activeView={view}
                    onViewChange={handleNavClick}
                    user={user}
                    onLogout={handleLogout}
                    isCollapsed={isSidebarCollapsed}
                    onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                />
            </div>

            {/* Mobile Sidebar */}
            {isMobileSidebarOpen && (
                <div className="fixed inset-0 z-[150] lg:hidden">
                    <div className="absolute inset-0 bg-[#1e293b]/60 backdrop-blur-sm" onClick={() => setIsMobileSidebarOpen(false)} />
                    <Sidebar
                        activeView={view}
                        onViewChange={handleNavClick}
                        user={user}
                        onLogout={handleLogout}
                    />
                </div>
            )}

            {/* Main Content Area */}
            <div className={cn(
                "flex flex-col min-w-0 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                isSidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-[238px]"
            )}>
                <div className={cn(
                    "fixed top-0 right-0 left-0 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] z-[100]",
                    isSidebarCollapsed ? "lg:left-[68px]" : "lg:left-[238px]"
                )}>
                    <Topbar
                        view={view}
                        user={user}
                        isOnline={isOnline}
                        syncStatus={isSyncing ? 'syncing' : (pendingActs.length > 0 ? 'pending' : 'synced')}
                        theme={theme}
                        onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        onLogout={handleLogout}
                        unreadCount={unreadCount}
                        notifications={notificationsList}
                        onMarkAllRead={handleMarkAllRead}
                        onDeleteNotification={handleDeleteNotification}
                        onClearAllNotifications={handleClearAllNotifications}
                        onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                    />
                </div>

                <main className="flex-1 p-[16px] md:p-[26px] mt-[62px] min-h-[calc(100vh-62px)]">
                    {showSetupNotice && (
                        <div className="mb-8 p-6 bg-amber-500/20 border border-amber-500/30 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4 duration-500 shadow-sm shadow-amber-500/5">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-inner">
                                    <Clock size={24} className="animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-[15px] font-[800] text-amber-600 dark:text-amber-500">Configuración Requerida</h3>
                                    <p className="text-[13px] font-[500] text-amber-700/80 dark:text-amber-400/80 mt-0.5">Para comenzar a operar, es necesario completar la integración con GLPI y otros servicios.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setView('config')}
                                className="px-5 h-11 bg-amber-600 text-white text-[13px] font-[700] rounded-xl hover:bg-amber-700 transition-all active:scale-95 shadow-lg shadow-amber-600/20"
                            >
                                Configurar Ahora
                            </button>
                        </div>
                    )}

                    {view === 'home' && (
                        <div className="space-y-8 animate-in fade-in duration-500 w-full px-4">
                            <DashboardSummary onNavigate={handleNavClick} />

                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                                {/* Left Side: Recent Activity */}
                                <div className="xl:col-span-2 space-y-4">
                                    <div className="flex justify-between items-center mb-1 px-1">
                                        <h4 className="text-[14px] font-[800] text-text-primary">
                                            Actividad Reciente
                                        </h4>
                                        <button
                                            onClick={() => handleNavClick('history')}
                                            className="text-[12px] font-[600] text-primary-500 flex items-center gap-1 hover:underline"
                                        >
                                            Ver todo <ArrowRight size={14} />
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {recentActs.length > 0 ? recentActs.map(act => (
                                            <RecentActCard key={act.id} act={act} onClick={() => { setSelectedAct(act); setView('preview'); }} />
                                        )) : (
                                            <div className="p-8 bg-secondary border border-color rounded-[12px] flex items-center shadow-sm relative overflow-hidden h-[120px]">
                                                <div className="w-[4px] absolute left-0 top-3 bottom-3 bg-primary-500 rounded-r-lg" />
                                                <div className="flex-1 ml-4">
                                                    <p className="text-text-primary text-[13.5px] font-[800]">No hay actividades registradas aún</p>
                                                    <p className="text-text-muted text-[12px] font-[500] mt-0.5">Las actas sincronizadas aparecerán aquí automáticamente.</p>
                                                    <span className="inline-block mt-3 px-3 py-1 bg-tertiary text-text-muted text-[10px] font-[700] rounded-full uppercase tracking-wide">Sin datos</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Side: Widgets */}
                                <div className="space-y-6">
                                    {/* Consolidated Companies Widget */}
                                    <div className="bg-secondary rounded-[12px] border border-color shadow-sm overflow-hidden text-text-primary">
                                        <div className="p-4 border-b border-color bg-tertiary flex items-center gap-2">
                                            <Building2 size={16} className="text-primary-500" />
                                            <h4 className="text-[12px] font-[800] text-text-primary">Consolidado Empresas</h4>
                                        </div>
                                        <div className="divide-y divide-color">
                                            <div className="p-4 flex justify-between items-center group hover:bg-tertiary transition-colors">
                                                <span className="text-[12px] text-text-secondary font-[500]">Empresas atendidas</span>
                                                <span className="text-[13px] font-[700] text-text-primary">{consolidatedStats.empresas}</span>
                                            </div>
                                            <div className="p-4 flex justify-between items-center group hover:bg-tertiary transition-colors">
                                                <span className="text-[12px] text-text-secondary font-[500]">Actas Preventivas</span>
                                                <span className="text-[13px] font-[700] text-text-primary">{consolidatedStats.preventivas}</span>
                                            </div>
                                            <div className="p-4 flex justify-between items-center group hover:bg-tertiary transition-colors">
                                                <span className="text-[12px] text-text-secondary font-[500]">Actas Correctivas</span>
                                                <span className="text-[13px] font-[700] text-text-primary">{consolidatedStats.correctivas}</span>
                                            </div>
                                            <div className="p-4 flex justify-between items-center group hover:bg-tertiary transition-colors">
                                                <span className="text-[12px] text-text-secondary font-[500]">Entregas</span>
                                                <span className="text-[13px] font-[700] text-text-primary">{consolidatedStats.entregas}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sync Status Widget */}
                                    <div className="bg-secondary rounded-[12px] border border-color shadow-sm overflow-hidden text-text-primary">
                                        <div className="p-4 border-b border-color bg-tertiary flex items-center gap-2">
                                            <Cloud size={16} className="text-primary-500" />
                                            <h4 className="text-[12px] font-[800] text-text-primary">Estado de Sincronización</h4>
                                        </div>
                                        <div className="p-5 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[12px] text-text-secondary font-[500]">Última sincronización</span>
                                                <span className="text-[12px] font-[600] text-text-primary">Hace 5 min</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[12px] text-text-secondary font-[500]">Registros pendientes</span>
                                                <span className="text-[12px] font-[700] text-orange-500">{pendingActs.length}</span>
                                            </div>
                                            <div className="pt-2 border-t border-color flex justify-between items-center">
                                                <span className="text-[12px] text-text-secondary font-[500]">Conexión GLPI</span>
                                                <span className="flex items-center gap-1 text-[12px] font-[700] text-emerald-500">
                                                    <CheckCircle2 size={12} /> Activa
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {(view === 'form-preventive' || view === 'form-corrective' || view === 'form-delivery') && (
                        <MaintenanceForm
                            type={view === 'form-preventive' ? 'PREVENTIVO' : view === 'form-delivery' ? 'ENTREGA' : 'CORRECTIVO'}
                            onCancel={() => setView('home')}
                            onSave={() => setView('home')}
                            theme={theme}
                        />
                    )}

                    {view === 'preview' && selectedAct && (
                        <MaintenancePreview act={selectedAct} onBack={() => setView('home')} theme={theme} />
                    )}

                    {view === 'consolidated' && <ClientConsolidated onBack={() => setView('home')} />}
                    {view === 'kanban' && <TaskBoard onBack={() => setView('home')} />}
                    {view === 'task-list' && <TaskList onBack={() => setView('home')} />}
                    {view === 'history' && (
                        <HistoricalActs
                            onViewAct={(act) => {
                                if (act.isQuotation) {
                                    setSelectedQuotationId(act.id);
                                    setView('quotation-detail');
                                } else {
                                    setSelectedAct(act);
                                    setView('preview');
                                }
                            }}
                            onBack={() => setView('home')}
                        />
                    )}
                    {view === 'tickets' && (
                        <InDevelopment title="Soporte GLPI" onBack={() => setView('home')} />
                    )}
                    {view === 'ticket-detail' && selectedTicketId && (
                        <TicketDetail ticketId={selectedTicketId} onBack={() => setView('tickets')} />
                    )}
                    {view === 'quotations' && (
                        <QuotationList user={user} onNew={() => setView('quotation-form')} onSelect={(id) => { setSelectedQuotationId(id); setView('quotation-detail'); }} />
                    )}
                    {view === 'quotation-form' && (
                        <QuotationForm user={user} onBack={() => setView('quotations')} onCreated={(id) => { setSelectedQuotationId(id); setView('quotation-detail'); }} />
                    )}
                    {view === 'quotation-detail' && selectedQuotationId && (
                        <QuotationDetail quotationId={selectedQuotationId} user={user} onBack={() => setView('quotations')} />
                    )}
                    {view === 'sync' && <SyncManager onBack={() => setView('home')} />}
                    {view === 'config' && (
                        ['Super-Admin', 'Admin-Mesa'].some(r => user?.profile?.includes(r)) ? (
                            <ConfigManager onBack={() => setView('home')} onLogout={handleLogout} />
                        ) : (
                            <div className="flex flex-col items-center justify-center p-12 bg-secondary border border-color rounded-2xl animate-in fade-in duration-500">
                                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6">
                                    <Settings size={32} />
                                </div>
                                <h3 className="text-[16px] font-[800] text-text-primary uppercase tracking-tight">Acceso Restringido</h3>
                                <p className="text-[13px] text-text-muted font-[500] mt-2 text-center max-w-[300px]">Solo los administradores autorizados tienen acceso a la configuración del sistema.</p>
                                <button
                                    onClick={() => setView('home')}
                                    className="mt-8 px-8 h-12 bg-primary-500 text-white text-[12px] font-[700] uppercase tracking-widest rounded-xl hover:bg-primary-600 transition-all active:scale-95 shadow-lg shadow-primary-500/20"
                                >
                                    Volver al Inicio
                                </button>
                            </div>
                        )
                    )}
                </main>
            </div>

            <ToastContainer />
        </div>
    );
}

const RecentActCard = ({ act, onClick }) => {
    let accentColor = 'bg-[#94a3b8]'; // Bajo
    let iconBg = 'bg-[#94a3b8]/10';
    let iconColor = 'text-[#94a3b8]';

    if (act.type === 'CORRECTIVO') {
        accentColor = 'bg-[#f97316]';
        iconBg = 'bg-[#f97316]/10';
        iconColor = 'text-[#f97316]';
    } else if (act.type === 'PREVENTIVO') {
        accentColor = 'bg-[#22c55e]';
        iconBg = 'bg-[#22c55e]/10';
        iconColor = 'text-[#22c55e]';
    } else if (act.type === 'ENTREGA') {
        accentColor = 'bg-[#8b5cf6]';
        iconBg = 'bg-[#8b5cf6]/10';
        iconColor = 'text-[#8b5cf6]';
    }

    const statusStyles = {
        'PENDIENTE_SINCRONIZACION': 'bg-orange-500/10 text-orange-500 border-orange-500/30',
        'BORRADOR': 'bg-amber-500/10 text-amber-500 border-amber-500/30',
        'SINCRONIZADO': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
    };

    return (
        <div
            onClick={onClick}
            className="bg-secondary rounded-[20px] p-[20px] shadow-sm lg:hover:shadow-md flex items-center gap-[20px] border border-color transition-all cursor-pointer group relative overflow-hidden"
        >
            <div className={cn("w-[4px] absolute left-0 top-3 bottom-3 rounded-r-full", accentColor)} />

            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform", iconBg)}>
                <ClipboardList size={22} className={iconColor} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-[14px] font-[800] text-text-primary truncate uppercase">
                                Ticket #{act.glpi_ticket_id || '---'}
                            </h4>
                            <span className={cn(
                                "px-[8px] py-[2px] rounded-full text-[9px] font-[800] border uppercase tracking-wider",
                                statusStyles[act.status] || 'bg-tertiary text-text-muted border-color'
                            )}>
                                {act.status === 'PENDIENTE_SINCRONIZACION' ? 'PENDIENTE' : act.status}
                            </span>
                        </div>
                        <p className="text-[12px] text-text-secondary font-[600] mt-1 uppercase tracking-wide opacity-80">
                            {act.client_name || 'Consumidor Final'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-5 mt-4">
                    <span className="flex items-center gap-1.5 text-[11px] text-text-muted font-[700] uppercase tracking-wider">
                        <Calendar size={13} className="text-primary-500" />
                        {new Date(act.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-text-muted font-[700] uppercase tracking-wider truncate">
                        <User size={13} className="text-primary-500" />
                        {act.technical_name || 'Técnico'}
                    </span>
                </div>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-tertiary group-hover:bg-primary-500/10 transition-colors">
                <ChevronRight size={18} className="text-text-muted group-hover:text-primary-500 transition-colors" />
            </div>
        </div>
    );
};

export default App;
