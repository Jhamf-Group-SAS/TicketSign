import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import {
    ClipboardList,
    Clock,
    TrendingUp,
    Calendar as CalendarIcon,
    ArrowUpRight,
    RefreshCw,
    CheckCircle2
} from 'lucide-react';
import { cn } from '../utils/cn';

const DashboardSummary = ({ onNavigate }) => {
    const [user] = React.useState(JSON.parse(localStorage.getItem('glpi_pro_user') || '{}'));
    const isAdmin = (user.profile || '').includes('Super-Admin') || (user.profile || '').includes('Admin-Mesa');

    const stats = useLiveQuery(async () => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        const allActs = await db.acts.toArray();
        const allTasks = await db.tasks.toArray();

        // Tasks logic
        const myTasks = allTasks.filter(t => {
            if (isAdmin) return true;
            const myNames = [(user.name || ''), (user.displayName || ''), (user.username || '')].filter(Boolean).map(n => n.toLowerCase());
            const isCreator = myNames.includes((t.createdBy || '').toLowerCase());
            const isAssigned = (t.assigned_technicians || []).some(tech =>
                myNames.some(name => (tech || '').toLowerCase().includes(name))
            );
            return isCreator || isAssigned;
        });

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const actsMonth = allActs.filter(a => a.createdAt >= startOfMonth).length;

        const actsToday = allActs.filter(a => a.createdAt >= startOfDay).length;
        const pendingSync = allActs.filter(a => a.status === 'PENDIENTE_SINCRONIZACION').length;
        const tasksToday = myTasks.filter(t => {
            if (!t.scheduled_at) return false;
            return new Date(t.scheduled_at).toLocaleDateString() === now.toLocaleDateString() && t.status !== 'COMPLETADA';
        }).length;
        const tasksNext = myTasks.filter(t => {
            if (!t.scheduled_at) return false;
            const d = new Date(t.scheduled_at);
            return d > now && t.status !== 'COMPLETADA';
        }).length;

        return { actsToday, pendingSync, tasksToday, tasksNext, actsMonth };
    }, []) || { actsToday: 0, pendingSync: 0, tasksToday: 0, tasksNext: 0, actsMonth: 0 };

    const cards = [
        {
            title: "Servicios Hoy",
            value: stats.actsToday,
            icon: ClipboardList,
            color: "text-primary-500",
            borderColor: "border-l-primary-500",
            description: "Actas generadas hoy"
        },
        {
            title: "Tareas Hoy",
            value: stats.tasksToday,
            icon: CalendarIcon,
            color: "text-[#f97316]",
            borderColor: "border-l-[#f97316]",
            description: "Programadas en calendario"
        },
        {
            title: "Pendientes Sincro",
            value: stats.pendingSync,
            icon: RefreshCw,
            color: "text-primary-500",
            borderColor: "border-l-emerald-500",
            description: "Esperando conexión"
        },
        {
            title: "Tareas Próximas",
            value: stats.tasksNext,
            icon: CheckCircle2,
            color: "text-[#22c55e]",
            borderColor: "border-l-[#22c55e]",
            description: "Siguientes días"
        }
    ];

    const today = new Date();
    const formattedDate = today.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const formattedTime = today.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    // Dynamic greeting based on current hour
    const getGreeting = () => {
        const hour = today.getHours();
        if (hour < 12) return 'Buenos días';
        if (hour < 18) return 'Buenas tardes';
        return 'Buenas noches';
    };

    return (
        <div className="animate-in fade-in duration-700">
            {/* Greeting Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-[28px] font-[800] text-text-primary flex items-center gap-2">
                        {getGreeting()}, {user.name?.split(' ')[0] || user.username} 👋
                    </h1>
                    <p className="text-[14px] text-text-muted font-[500] mt-1">
                        {formattedDate} - {formattedTime}
                    </p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 w-full">
                {cards.map((card, i) => (
                    <div
                        key={i}
                        className={cn(
                            "bg-secondary rounded-[12px] p-[20px] shadow-sm border-l-4 relative overflow-hidden group hover:shadow-md transition-all border-color",
                            card.borderColor
                        )}
                    >
                        <div className="flex flex-col relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <div className={cn("p-1.5 rounded-lg bg-tertiary", card.color)}>
                                    <card.icon size={18} />
                                </div>
                                <span className="text-[10px] font-[700] text-text-muted uppercase tracking-wider">
                                    {card.title}
                                </span>
                            </div>
                            <span className="text-[32px] font-[800] text-text-primary leading-none mb-1 tabular-nums">
                                {card.value}
                            </span>
                            <p className="text-[11px] text-text-muted font-[500]">{card.description}</p>
                        </div>
                        {/* Circle decoration - making it solid subtle border instead of translucent circle */}
                        <div className="absolute top-[-20px] right-[-20px] w-[90px] h-[90px] bg-tertiary rounded-full pointer-events-none group-hover:scale-110 transition-transform border border-color" />
                    </div>
                ))}
            </div>

            {/* ACTIVIDAD MENSUAL BANNER */}
            <div className="relative rounded-[22px] bg-[linear-gradient(135deg,#1d4ed8,#2563eb)] p-6 md:p-[32px_44px] flex flex-row items-center gap-4 md:gap-[30px] shadow-[0_10px_40px_rgba(79,70,229,.25)] mb-8 overflow-hidden w-full border border-blue-400">
                {/* Decoration background - solid color divider */}
                <div className="absolute top-0 right-0 w-[150px] md:w-[300px] h-full bg-blue-600 skew-x-[-20deg] translate-x-10 opacity-50 md:opacity-100" />

                <div className="w-12 h-12 md:w-[56px] md:h-[56px] bg-secondary border border-white/20 rounded-2xl flex items-center justify-center shrink-0 shadow-lg relative z-10">
                    <TrendingUp size={24} className="text-white md:w-[30px] md:h-[30px]" />
                </div>

                <div className="flex-1 relative z-10">
                    <h4 className="text-[9px] md:text-[11px] font-[700] text-white uppercase tracking-[0.15em] mb-1">ACTIVIDAD MENSUAL</h4>
                    <p className="text-[14px] md:text-[18px] font-[800] text-white leading-tight">
                        Has realizado {stats.actsMonth} mantenimientos este mes
                    </p>
                    <p className="hidden xs:block text-[10px] md:text-[12px] text-white/90 font-[500] mt-1">
                        Consolidado de Preventivo, Correctivo y Entregas.
                    </p>
                </div>

                <div
                    onClick={() => onNavigate('history')}
                    className="shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-400 flex items-center justify-center text-white cursor-pointer hover:bg-white hover:text-blue-600 transition-all active:scale-95 relative z-10"
                >
                    <ArrowUpRight size={18} />
                </div>
            </div>
        </div >
    );
};

export default DashboardSummary;
