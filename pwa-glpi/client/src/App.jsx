import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './store/db'
import MaintenanceForm from './components/MaintenanceForm'
import MaintenancePreview from './components/MaintenancePreview'
import ClientConsolidated from './components/ClientConsolidated'
import Login from './components/Login'
import HistoryList from './components/HistoryList'
import { Plus, History, Wifi, WifiOff, Settings, Calendar, User, ClipboardList, LogOut, Users, FileText } from 'lucide-react'

function App() {
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [user, setUser] = useState(null)
    const [view, setView] = useState('home') // home, form-preventive, form-corrective, preview, consolidated
    const [selectedAct, setSelectedAct] = useState(null)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [theme, setTheme] = useState(localStorage.getItem('glpi_pro_theme') || 'dark')

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

    const renderHome = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Section / Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                    onClick={() => setView('form-preventive')}
                    className="group relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-3xl shadow-2xl flex flex-col items-start gap-4 transition-all hover:scale-[1.02] active:scale-95 border border-white/10"
                >
                    <div className="bg-white/10 p-4 rounded-2xl group-hover:bg-white/20 transition-colors">
                        <ClipboardList className="text-white" size={32} />
                    </div>
                    <div className="text-left text-white">
                        <span className="text-xl font-bold block">Preventivo</span>
                        <p className="text-sm text-blue-100/70">Mantenimiento de rutina.</p>
                    </div>
                </button>

                <button
                    onClick={() => setView('form-corrective')}
                    className="group relative overflow-hidden bg-gradient-to-br from-orange-500 to-red-600 p-8 rounded-3xl shadow-2xl flex flex-col items-start gap-4 transition-all hover:scale-[1.02] active:scale-95 border border-white/10"
                >
                    <div className="bg-white/10 p-4 rounded-2xl group-hover:bg-white/20 transition-colors">
                        <Plus className="text-white" size={32} />
                    </div>
                    <div className="text-left text-white">
                        <span className="text-xl font-bold block">Correctivo</span>
                        <p className="text-sm text-red-100/70">Fallas y diagnósticos.</p>
                    </div>
                </button>

                <button
                    onClick={() => setView('history')}
                    className="group relative overflow-hidden bg-white dark:bg-slate-900/40 p-8 rounded-3xl shadow-xl dark:shadow-none flex flex-col items-start gap-4 transition-all hover:scale-[1.02] active:scale-95 border border-slate-200 dark:border-white/5"
                >
                    <div className="bg-purple-500/10 p-4 rounded-2xl group-hover:bg-purple-500/20 transition-colors">
                        <History size={32} className="text-purple-500" />
                    </div>
                    <div className="text-left">
                        <span className="text-xl font-bold block text-slate-900 dark:text-white">Historial</span>
                        <p className="text-sm text-slate-400 dark:text-slate-500">Bitácora de procesos.</p>
                    </div>
                </button>
            </div>

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
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-400 dark:text-slate-300 flex items-center gap-2 transition-colors">
                        <History size={18} />
                        Actividad Reciente
                    </h3>
                    <button onClick={() => setView('history')} className="text-xs text-blue-500 font-bold hover:underline transition-all">Ver todo</button>
                </div>

                <div className="space-y-3">
                    {pendingActs.length > 0 ? pendingActs.map(act => (
                        <div
                            key={act.id}
                            onClick={() => {
                                setSelectedAct(act)
                                setView('preview')
                            }}
                            className="bg-slate-900/30 backdrop-blur-sm p-5 rounded-2xl border border-white/5 hover:bg-slate-800/50 transition-all group cursor-pointer active:scale-[0.98]"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${act.type === 'PREVENTIVO' ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'}`}>
                                        <ClipboardList size={18} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">Ticket #{act.glpi_ticket_id || '---'}</h4>
                                        <p className="text-xs text-slate-500 flex items-center gap-2">
                                            {act.client_name || 'Sin cliente'}
                                            <span className="text-[9px] text-blue-400 font-bold bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">
                                                {act.inventory_number || 'S/E'}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${act.status === 'BORRADOR' ? 'bg-slate-800 text-slate-400' :
                                    act.status === 'PENDIENTE_SINCRONIZACION' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                                        'bg-green-500/10 text-green-500 border border-green-500/20'
                                    }`}>
                                    {act.status}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-slate-800/50">
                                <div className="flex gap-4">
                                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                        <Calendar size={12} /> {new Date(act.createdAt).toLocaleDateString()}
                                    </span>
                                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                        <User size={12} /> {act.technical_name || 'Técnico'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="p-12 text-center bg-slate-900/20 border-2 border-dashed border-slate-800/50 rounded-3xl">
                            <ClipboardList className="mx-auto text-slate-700 mb-2" size={40} />
                            <p className="text-slate-500 text-sm">No hay registros aún.</p>
                            <p className="text-slate-700 text-[11px] mt-1">Inicia un mantenimiento arriba.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    )

    if (!isAuthenticated) {
        return <Login onLoginSuccess={(u) => {
            setIsAuthenticated(true)
            setUser(u)
        }} />
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
            {/* Dynamic Background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full"></div>
            </div>

            {/* Navbar Premium */}
            <nav className="p-4 bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-200 dark:border-white/5 flex justify-between items-center shadow-sm dark:shadow-2xl">
                <div
                    className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-all active:scale-[0.98]"
                    onClick={() => setView('home')}
                >
                    <div className="bg-[#0f172a] p-1.5 rounded-xl shadow-lg border border-slate-200 dark:border-white/10 group-hover:shadow-blue-500/10 transition-all">
                        <img src="/logo.png" className="h-8 w-auto object-contain" alt="jhamf" />
                    </div>
                    <div className="hidden sm:block leading-tight">
                        <span className="font-black text-lg tracking-tight block text-slate-900 dark:text-white transition-colors">Ticket<span className="text-blue-500">Sign</span></span>
                        <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-slate-400 dark:text-slate-500">Mantenimiento TI</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${isOnline ? 'bg-green-500/10 text-green-500 ring-1 ring-green-500/20' : 'bg-red-500/10 text-red-500 ring-1 ring-red-500/20'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></span>
                        {isOnline ? 'En Línea' : 'Sin Red'}
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl border border-slate-200 dark:border-white/5 transition-all active:scale-95"
                        >
                            <div className="bg-blue-500/10 p-2 rounded-xl text-blue-500">
                                <User size={18} />
                            </div>
                            <div className="text-left hidden xs:block">
                                <p className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 leading-none mb-1">Técnico</p>
                                <p className="text-xs font-bold text-slate-900 dark:text-white leading-none truncate max-w-[100px]">{user?.name || user?.username || 'Usuario'}</p>
                            </div>
                        </button>

                        {isMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                                <div className="absolute right-0 mt-3 w-48 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-3xl z-20 animate-in fade-in zoom-in-95 duration-200 p-1">
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
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 relative z-10 p-4 pt-6 max-w-4xl mx-auto w-full">
                {view === 'home' && renderHome()}

                {(view === 'form-preventive' || view === 'form-corrective') && (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                        <MaintenanceForm
                            type={view === 'form-preventive' ? 'PREVENTIVO' : 'CORRECTIVO'}
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

                {view === 'history' && (
                    <HistoryList
                        onSelectAct={(act) => {
                            setSelectedAct(act)
                            setView('preview')
                        }}
                        onBack={() => setView('home')}
                    />
                )}
            </main>

            {/* Status Bar / Mobile Indicator */}
            <div className="md:hidden h-20"></div> {/* Spacer for fixed footer if needed */}
        </div>
    )
}

export default App
