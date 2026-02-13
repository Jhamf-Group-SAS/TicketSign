import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { db } from './store/db'
import MaintenanceForm from './components/MaintenanceForm'
import MaintenancePreview from './components/MaintenancePreview'
import ClientConsolidated from './components/ClientConsolidated'
import Login from './components/Login'
import HistoryList from './components/HistoryList'
import TaskBoard from './components/TaskBoard'
import DashboardSummary from './components/DashboardSummary'
import Toast from './components/Toast'
import TicketList from './components/TicketList'
import TicketDetail from './components/TicketDetail'
import { Plus, History, Wifi, WifiOff, Settings, Calendar, User, ClipboardList, LogOut, Users, FileText, Kanban, LayoutDashboard, Bell, Menu, X, MessageSquare, Package } from 'lucide-react'

const cn = (...inputs) => twMerge(clsx(inputs));

function App() {
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [user, setUser] = useState(null)
    const [view, setView] = useState('home') // home, form-preventive, form-corrective, form-delivery, preview, consolidated, tickets, ticket-detail
    const [selectedAct, setSelectedAct] = useState(null)
    const [selectedTicketId, setSelectedTicketId] = useState(null)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
    const [theme, setTheme] = useState(localStorage.getItem('glpi_pro_theme') || 'dark')
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [notificationToast, setNotificationToast] = useState(null)

    // Referencias para manejo de estado sin re-render
    const processingRef = useRef(new Set());
    const audioContextRef = useRef(null);

    const playNotificationSound = async () => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioContextRef.current;
            if (ctx.state === 'suspended') await ctx.resume();

            // Oscilador para el primer beep
            const oscillator1 = ctx.createOscillator();
            const gainNode1 = ctx.createGain();
            oscillator1.connect(gainNode1);
            gainNode1.connect(ctx.destination);

            oscillator1.type = 'sawtooth';
            oscillator1.frequency.setValueAtTime(900, ctx.currentTime);
            gainNode1.gain.setValueAtTime(0.6, ctx.currentTime);
            gainNode1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

            oscillator1.start(ctx.currentTime);
            oscillator1.stop(ctx.currentTime + 0.15);

            // Oscilador para el segundo beep
            const oscillator2 = ctx.createOscillator();
            const gainNode2 = ctx.createGain();
            oscillator2.connect(gainNode2);
            gainNode2.connect(ctx.destination);

            oscillator2.type = 'sawtooth';
            oscillator2.frequency.setValueAtTime(1200, ctx.currentTime + 0.2);
            gainNode2.gain.setValueAtTime(0.6, ctx.currentTime + 0.2);
            gainNode2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

            oscillator2.start(ctx.currentTime + 0.2);
            oscillator2.stop(ctx.currentTime + 0.4);
        } catch (e) {
            console.error("Error reproduciendo sonido:", e);
        }
    };

    // Global Reminder Watcher Mejorado y Anti-Duplicados
    useEffect(() => {
        const checkReminders = async () => {
            if (!user) return;
            const now = new Date().getTime();

            // Buscar tareas con recordatorio configurado que no estén completadas
            const tasksWithReminders = await db.tasks
                .where('reminder_at')
                .notEqual('')
                .and(t => {
                    // Verificación de fecha válida
                    if (!t.reminder_at || t.status === 'COMPLETADA' || t.status === 'CANCELADA') return false;

                    // Verificación de asignación
                    const isCreator = t.createdBy === user.username;
                    const isAssigned = (t.assigned_technicians || []).some(tech =>
                        tech === user.name || tech === user.username || tech === user.displayName
                    );

                    return isCreator || isAssigned;
                })
                .toArray();

            for (const task of tasksWithReminders) {
                // Verificar si ya se mostró notificación LOCALMENTE para esta tarea
                try {
                    // Usamos la clave primaria directamente (task.id)
                    const alreadyNotified = await db.notification_log.get(task.id);
                    if (alreadyNotified) continue;
                } catch (e) {
                    console.warn('Error checking notification log', e);
                }

                if (processingRef.current.has(task.id)) continue;

                const reminderTime = new Date(task.reminder_at).getTime();
                const windowStart = now - (30 * 60 * 1000); // 30 minutos de ventana hacia atrás

                // Si ya pasó la hora del recordatorio pero no hace más de 30 min (para evitar flood de tareas viejas)
                if (reminderTime <= now && reminderTime > windowStart) {
                    processingRef.current.add(task.id);

                    try {
                        playNotificationSound();

                        // 1. Mostrar Popup Visual en la App (Toast)
                        setNotificationToast({
                            message: `🔔 RECORDATORIO: ${task.title}`,
                            type: 'warning',
                            duration: 10000
                        });

                        const newNotification = {
                            id: Date.now() + Math.random(),
                            title: 'Recordatorio',
                            message: `Es hora de: ${task.title}`,
                            time: 'Ahora',
                            type: 'warning',
                            task_id: task.id
                        };

                        setIsNotificationsOpen(false); // No abrir automáticamente, solo sumar al counter
                        setUnreadCount(prev => prev + 1);
                        setNotifications(prev => {
                            const exists = prev.some(n => n.task_id === task.id && n.time === 'Ahora');
                            if (exists) return prev;
                            return [newNotification, ...prev];
                        });

                        // 2. Notificación del Sistema (OS / Mobile Lock Screen)
                        if ('Notification' in window && Notification.permission === 'granted') {
                            try {
                                if ('serviceWorker' in navigator) {
                                    navigator.serviceWorker.ready.then(registration => {
                                        registration.showNotification('⏰ Recordatorio de Tarea', {
                                            body: `Es hora de: ${task.title}`,
                                            icon: '/logo.png',
                                            badge: '/logo.png',
                                            vibrate: [200, 100, 200],
                                            tag: `task-${task.id}`,
                                            requireInteraction: true,
                                            data: { taskId: task.id }
                                        });
                                    });
                                } else {
                                    const notification = new Notification('⏰ Recordatorio de Tarea', {
                                        body: `Es hora de: ${task.title}`,
                                        icon: '/logo.png',
                                        tag: `task-${task.id}`
                                    });
                                    notification.onclick = () => {
                                        window.focus();
                                        setView('kanban');
                                    };
                                }
                            } catch (e) {
                                console.error("Error lanzando notificación nativa:", e);
                            }
                        }

                        // Marcar como notificado LOCALMENTE
                        await db.notification_log.add({ task_id: task.id, sent_at: now });
                    } catch (err) {
                        console.error("Error procesando recordatorio:", err);
                    }

                    setTimeout(() => {
                        if (processingRef.current) processingRef.current.delete(task.id);
                    }, 5000);
                }
            }
        };

        const interval = setInterval(checkReminders, 5000);
        checkReminders(); // Check immediately on mount

        return () => clearInterval(interval);
    }, [user]);
    const notificationsRef = useRef(null);
    const userMenuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
                setIsNotificationsOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);



    // Reactive query for recent acts
    const pendingActs = useLiveQuery(() => db.acts.orderBy('createdAt').reverse().limit(10).toArray()) || []

    useEffect(() => {
        // Apply theme
        if (theme === 'dark') {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
        localStorage.setItem('glpi_pro_theme', theme)

        const savedToken = localStorage.getItem('glpi_pro_token')
        const savedUser = localStorage.getItem('glpi_pro_user')
        if (savedToken && savedUser) {
            setIsAuthenticated(true)
            setUser(JSON.parse(savedUser))
            // Inicializar servicio de sincronización si hay sesión
            import('./services/SyncService').then(({ SyncService }) => {
                SyncService.init();
            }).catch(console.error);
        }

        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [theme])

    // Inicializar audio y permisos en la primera interacción
    useEffect(() => {
        const initAudioAndPermissions = () => {
            // Audio Context
            if (!audioContextRef.current) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    audioContextRef.current = new AudioContext();
                }
            }

            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().then(() => {
                    console.log('AudioContext resumed successfully');
                }).catch(e => console.error('AudioContext resume failed', e));
            }

            // Notification Permissions - Force request
            if ('Notification' in window) {
                if (Notification.permission === 'default' || Notification.permission === 'denied') {
                    Notification.requestPermission().then(permission => {
                        console.log('Notification permission:', permission);
                    });
                }
            }
        };

        // Listeners para iniciar audio en cualquier interacción
        const events = ['click', 'touchstart', 'touchend', 'keydown'];
        events.forEach(event => window.addEventListener(event, initAudioAndPermissions));

        return () => {
            events.forEach(event => window.removeEventListener(event, initAudioAndPermissions));
        };
    }, []);



    const renderHome = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* New Dashboard Summary Section */}
            <DashboardSummary onNavigate={setView} />

            {/* Consolidated Reports Quick Link */}
            <div className="bg-white dark:bg-slate-900/40 p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/5 backdrop-blur-md flex items-center justify-between group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all active:scale-95 shadow-sm dark:shadow-xl" onClick={() => setView('consolidated')}>
                <div className="flex items-center gap-4">
                    <div className="bg-purple-500/10 p-4 rounded-3xl text-purple-500 group-hover:scale-110 transition-transform">
                        <Users size={28} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white leading-tight">Consolidados por Empresa</h4>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Resumen maestro corporativo.</p>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-full text-slate-300 dark:text-slate-600 group-hover:text-purple-500 transition-colors">
                    <History size={20} className="rotate-180" />
                </div>
            </div>

            {/* Recent List */}
            <section>
                <div className="flex justify-between items-center mb-4 px-2">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-500 flex items-center gap-2 transition-colors">
                        <History size={14} />
                        Actividad Reciente
                    </h3>
                    <button onClick={() => setView('history')} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 transition-all">Ver todo</button>
                </div>

                <div className="space-y-3">
                    {pendingActs.length > 0 ? pendingActs.map(act => (
                        <div
                            key={act.id}
                            onClick={() => {
                                setSelectedAct(act)
                                setView('preview')
                            }}
                            className="bg-white/40 dark:bg-slate-900/10 backdrop-blur-sm p-5 rounded-[2rem] border border-slate-200 dark:border-white/5 hover:bg-white dark:hover:bg-slate-900/40 transition-all group cursor-pointer active:scale-[0.99] shadow-sm"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl ${act.type === 'PREVENTIVO' ? 'bg-blue-500/10 text-blue-500' : act.type === 'ENTREGA' ? 'bg-purple-500/10 text-purple-500' : 'bg-orange-500/10 text-orange-500'}`}>
                                        {act.type === 'ENTREGA' ? <Package size={20} /> : <ClipboardList size={20} />}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-sm text-slate-900 dark:text-white">Ticket #{act.glpi_ticket_id || '---'}</h4>
                                        <p className="text-[11px] text-slate-500 font-bold flex items-center gap-2">
                                            {act.client_name || 'Sin cliente'}
                                            <span className="text-[9px] text-blue-400 font-black bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/20">
                                                {act.inventory_number || 'S/E'}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border ${act.status === 'BORRADOR'
                                    ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-950 dark:text-slate-500 dark:border-white/5'
                                    : act.status === 'PENDIENTE_SINCRONIZACION'
                                        ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                                        : 'bg-green-500/10 text-green-600 border-green-500/20'
                                    }`}>
                                    {act.status}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-white/5 mt-1">
                                <div className="flex gap-5">
                                    <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        <Calendar size={12} className="text-blue-500" /> {new Date(act.createdAt).toLocaleDateString()}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        <User size={12} className="text-blue-500" /> {act.technical_name || 'Técnico'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="p-12 text-center bg-slate-900/20 border-2 border-dashed border-slate-800/50 rounded-3xl">
                            <ClipboardList className="mx-auto text-slate-700 mb-2" size={40} />
                            <p className="text-slate-500 text-sm">No hay registros aún.</p>
                            <p className="text-slate-700 text-[11px] mt-1">Realiza un servicio desde el menú superior.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    )

    if (!isAuthenticated) {
        return <Login onLoginSuccess={async (u) => {
            setIsAuthenticated(true)
            setUser(u)
            // Disparar sincronización inicial inmediatamente después del login e inicializar
            const { SyncService } = await import('./services/SyncService');
            SyncService.init(); // init() ya llama a pullRemoteChanges internally
        }} />
    }

    const navItems = [
        { id: 'home', label: 'Inicio', icon: LayoutDashboard },
        { id: 'form-preventive', label: 'Preventivo', icon: ClipboardList, color: 'text-blue-500', bg: 'hover:bg-blue-500/10' },
        { id: 'form-corrective', label: 'Correctivo', icon: Plus, color: 'text-orange-500', bg: 'hover:bg-orange-500/10' },
        { id: 'form-delivery', label: 'Entrega', icon: Package, color: 'text-purple-500', bg: 'hover:bg-purple-500/10' },
        { id: 'kanban', label: 'Tareas', icon: Kanban, color: 'text-indigo-500', bg: 'hover:bg-indigo-500/10' },
        { id: 'tickets', label: 'Soporte GLPI', icon: MessageSquare, color: 'text-cyan-500', bg: 'hover:bg-cyan-500/10' },
        { id: 'history', label: 'Historial', icon: History, color: 'text-purple-500', bg: 'hover:bg-purple-500/10' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
            {/* Dynamic Background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full"></div>
            </div>

            {/* Sidebar / Drawer for Mobile Navigation */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-[60] sm:hidden">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in transition-all"
                        onClick={() => setIsSidebarOpen(false)}
                    />

                    {/* Sidebar Content */}
                    <div className="absolute top-0 left-0 bottom-0 w-[280px] bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-white/10 shadow-2xl animate-in slide-in-from-left duration-300">
                        <div className="p-6 flex flex-col h-full uppercase tracking-tighter">
                            <div className="flex items-center justify-between mb-8">
                                <div className="bg-[#0f172a] p-2 rounded-xl border border-white/10">
                                    <img src="/logo-white.png" className="h-8 w-auto" alt="jhamf" />
                                </div>
                                <button
                                    onClick={() => setIsSidebarOpen(false)}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 space-y-2">
                                <p className="text-[10px] font-black text-slate-400 mb-4 px-2 tracking-[0.2em]">Navegación</p>
                                {navItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setView(item.id);
                                            setIsSidebarOpen(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group active:scale-[0.98]",
                                            view === item.id
                                                ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"
                                        )}
                                    >
                                        <item.icon size={20} className={cn(
                                            view === item.id ? "text-blue-500" : item.color
                                        )} />
                                        <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="mt-auto pt-6 border-t border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
                                    <div className="bg-blue-500/20 p-2 rounded-lg text-blue-500">
                                        <User size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-slate-400 leading-none mb-1">Técnico</p>
                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.name || user?.username}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )
            }


            <nav className="p-3 sm:p-4 bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-200 dark:border-white/5 flex justify-between items-center shadow-sm dark:shadow-2xl">
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    {/* Hamburger Button for Mobile */}
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 sm:hidden text-slate-500 hover:text-blue-500 hover:bg-blue-500/5 rounded-xl transition-all active:scale-90"
                    >
                        <Menu size={24} />
                    </button>

                    <div
                        className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-all active:scale-[0.98]"
                        onClick={() => setView('home')}
                    >
                        <div className="bg-[#0f172a] p-1.5 rounded-xl shadow-lg border border-slate-200 dark:border-white/10 group-hover:shadow-blue-500/10 transition-all">
                            <img src="/logo-white.png" className="h-6 sm:h-8 w-auto object-contain" alt="jhamf" />
                        </div>
                    </div>
                </div>

                <div className="hidden sm:flex flex-1 justify-center px-4">
                    <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-white/5 p-1 rounded-[1.2rem] border border-slate-200/50 dark:border-white/5 overflow-x-auto no-scrollbar max-w-full">
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setView(item.id)}
                                className={cn(
                                    "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-2xl transition-all active:scale-95 group/nav shrink-0",
                                    view === item.id
                                        ? "bg-white dark:bg-white/10 shadow-sm text-blue-500"
                                        : `text-slate-500 hover:text-slate-900 dark:hover:text-white ${item.bg}`
                                )}
                            >
                                <item.icon size={16} className={cn(
                                    "transition-transform group-hover/nav:scale-110",
                                    view === item.id ? "text-blue-500" : item.color
                                )} />
                                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative" ref={notificationsRef}>
                        <button
                            onClick={() => {
                                setIsNotificationsOpen(!isNotificationsOpen);
                                if (!isNotificationsOpen) setUnreadCount(0);
                            }}
                            className="relative p-2 text-slate-500 hover:text-blue-500 hover:bg-blue-500/5 rounded-xl transition-all active:scale-90 group"
                        >
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950 shadow-sm animate-in zoom-in px-1">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {isNotificationsOpen && (
                            <div className="absolute right-0 top-full pt-2 w-[280px] xs:w-80 z-20">
                                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Notificaciones</h4>
                                        <span className="text-[9px] font-bold bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-lg">{notifications.length} Nuevas</span>
                                    </div>
                                    <div className="max-h-[350px] overflow-y-auto no-scrollbar">
                                        {notifications.length > 0 ? (
                                            notifications.map(n => (
                                                <div key={n.id} className="p-4 border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                                                            n.type === 'warning' ? "bg-amber-500/10 text-amber-600" :
                                                                n.type === 'success' ? "bg-green-500/10 text-green-600" :
                                                                    "bg-blue-500/10 text-blue-600"
                                                        )}>
                                                            {n.title}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 font-bold">{n.time}</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{n.message}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-10 text-center">
                                                <Bell className="mx-auto text-slate-300 dark:text-slate-800 mb-2" size={32} />
                                                <p className="text-slate-400 text-xs font-bold">Sin alertas nuevas</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 bg-slate-50/50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5">
                                        <button className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-500 transition-colors">Ver todas las alertas</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors ${isOnline ? 'bg-green-500/10 text-green-500 ring-1 ring-green-500/20' : 'bg-red-500/10 text-red-500 ring-1 ring-red-500/20'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></span>
                        <span className="hidden xs:inline">{isOnline ? 'En Línea' : 'Sin Red'}</span>
                    </div>

                    <div className="relative" ref={userMenuRef}>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl border border-slate-200 dark:border-white/5 transition-all active:scale-95"
                        >
                            <div className="bg-blue-500/10 p-2 rounded-xl text-blue-500">
                                <User size={18} />
                            </div>
                            <div className="text-left hidden xs:block lg:hidden xl:block">
                                <p className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 leading-none mb-1">Técnico</p>
                                <p className="text-xs font-bold text-slate-900 dark:text-white leading-none truncate max-w-[80px]">{user?.name || user?.username || 'Usuario'}</p>
                            </div>
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 top-full pt-2 w-48 z-20">
                                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200 p-1">
                                    <div className="p-3 border-b border-slate-100 dark:border-white/5 xs:hidden">
                                        <p className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1">Técnico</p>
                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.name || user?.username}</p>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setView('history')
                                            setIsMenuOpen(false)
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-left"
                                    >
                                        <History size={16} />
                                        <span className="text-xs font-bold uppercase tracking-wider">Historial</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setTheme(theme === 'dark' ? 'light' : 'dark')
                                            setIsMenuOpen(false)
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-left"
                                    >
                                        {theme === 'dark' ? <Plus size={16} className="rotate-45" /> : <History size={16} />}
                                        <span className="text-xs font-bold uppercase tracking-wider">{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            localStorage.removeItem('glpi_pro_token')
                                            localStorage.removeItem('glpi_pro_user')
                                            setIsAuthenticated(false)
                                            setIsMenuOpen(false)
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-red-500 dark:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors text-left"
                                    >
                                        <LogOut size={16} />
                                        <span className="text-xs font-bold uppercase tracking-wider">Cerrar Sesión</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 relative z-10 p-4 pt-6 max-w-4xl mx-auto w-full">
                {view === 'home' && renderHome()}

                {(view === 'form-preventive' || view === 'form-corrective' || view === 'form-delivery') && (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                        <MaintenanceForm
                            type={view === 'form-preventive' ? 'PREVENTIVO' : view === 'form-delivery' ? 'ENTREGA' : 'CORRECTIVO'}
                            onCancel={() => setView('home')}
                            onSave={() => setView('home')}
                            theme={theme}
                        />
                    </div>
                )}

                {view === 'preview' && selectedAct && (
                    <MaintenancePreview
                        act={selectedAct}
                        onBack={() => setView('home')}
                        theme={theme}
                    />
                )}

                {view === 'consolidated' && (
                    <ClientConsolidated
                        onBack={() => setView('home')}
                    />
                )}

                {view === 'kanban' && (
                    <TaskBoard
                        onBack={() => setView('home')}
                    />
                )}

                {view === 'history' && (
                    <HistoryList
                        onSelectAct={(act) => {
                            setSelectedAct(act)
                            setView('preview')
                        }}
                        onBack={() => setView('home')}
                    />
                )}

                {view === 'tickets' && (
                    <TicketList
                        user={user}
                        onSelectTicket={(id) => {
                            setSelectedTicketId(id);
                            setView('ticket-detail');
                        }}
                        onBack={() => setView('home')}
                    />
                )}

                {view === 'ticket-detail' && selectedTicketId && (
                    <TicketDetail
                        ticketId={selectedTicketId}
                        onBack={() => setView('tickets')}
                    />
                )}
            </main>

            {/* Status Bar / Mobile Indicator */}
            <div className="md:hidden h-20"></div> {/* Spacer for fixed footer if needed */}
        </div >
    )
}

export default App
