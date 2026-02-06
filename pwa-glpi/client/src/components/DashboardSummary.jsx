import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import {
    ClipboardList,
    CheckCircle2,
    Clock,
    TrendingUp,
    Calendar as CalendarIcon,
    ArrowUpRight
} from 'lucide-react';

const DashboardSummary = ({ onNavigate }) => {
    const [user] = React.useState(JSON.parse(localStorage.getItem('glpi_pro_user') || '{}'));
    const isAdmin = (user.profile || '').includes('Super-Admin') || (user.profile || '').includes('Admin-Mesa');

    const stats = useLiveQuery(async () => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const allActs = await db.acts.toArray();
        const allTasks = await db.tasks.toArray();

        // Filtrar tareas por usuario si no es Admin
        const myTasks = allTasks.filter(t => {
            if (isAdmin) return true;
            const isCreator = t.createdBy === user.username;
            const isAssigned = (t.assigned_technicians || []).includes(user.name) || (t.assigned_technicians || []).includes(user.displayName);
            return isCreator || isAssigned;
        });

        const actsToday = allActs.filter(a => a.createdAt >= startOfDay).length;
        const actsMonth = allActs.filter(a => a.createdAt >= startOfMonth).length;
        const pendingSync = allActs.filter(a => a.status === 'PENDIENTE_SINCRONIZACION').length;
        const drafts = allActs.filter(a => a.status === 'BORRADOR').length;

        const tasksToday = myTasks.filter(t => {
            if (!t.scheduled_at) return false;
            const scheduledDate = new Date(t.scheduled_at).toISOString().split('T')[0];
            const todayStr = now.toISOString().split('T')[0];
            return scheduledDate === todayStr && t.status !== 'COMPLETADA';
        }).length;

        const upcomingTasks = myTasks.filter(t => {
            if (!t.scheduled_at) return false;
            return new Date(t.scheduled_at) > now && t.status !== 'COMPLETADA';
        }).length;

        return {
            actsToday,
            actsMonth,
            pendingSync,
            drafts,
            tasksToday,
            upcomingTasks
        };
    }, []) || { actsToday: 0, actsMonth: 0, pendingSync: 0, drafts: 0, tasksToday: 0, upcomingTasks: 0 };

    const cards = [
        {
            title: "Servicios Hoy",
            value: stats.actsToday,
            icon: ClipboardList,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            label: "Actas generadas hoy"
        },
        {
            title: "Tareas Hoy",
            value: stats.tasksToday,
            icon: CalendarIcon,
            color: "text-indigo-500",
            bg: "bg-indigo-500/10",
            label: "Programadas en calendario"
        },
        {
            title: "Pendientes Sincro",
            value: stats.pendingSync,
            icon: Clock,
            color: "text-orange-500",
            bg: "bg-orange-500/10",
            label: "Esperando conexión"
        },
        {
            title: "Tareas Próximas",
            value: stats.upcomingTasks,
            icon: CheckCircle2,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            label: "Próximos días"
        }
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {cards.map((card, i) => (
                    <div
                        key={i}
                        className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-5 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col gap-3 transition-all hover:scale-[1.02]"
                    >
                        <div className="flex justify-between items-start">
                            <div className={`${card.bg} ${card.color} p-2.5 rounded-2xl`}>
                                <card.icon size={20} />
                            </div>
                        </div>
                        <div>
                            <span className="text-3xl font-black text-slate-900 dark:text-white leading-none">{card.value}</span>
                            <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">{card.title}</h4>
                            <p className="text-[9px] text-slate-400 dark:text-slate-600 font-medium mt-1 leading-tight">{card.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Monthly Highlight */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-[2.5rem] shadow-xl shadow-blue-500/20 flex items-center justify-between text-white relative overflow-hidden group">
                <div className="absolute right-[-20px] top-[-20px] opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <TrendingUp size={160} />
                </div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="bg-white/20 backdrop-blur-md p-4 rounded-3xl">
                        <TrendingUp size={32} />
                    </div>
                    <div>
                        <h4 className="text-xl font-black tracking-tight leading-none mb-1">Actividad Mensual</h4>
                        <p className="text-xs text-blue-100/70 font-medium uppercase tracking-widest">Has realizado <span className="text-white font-black">{stats.actsMonth}</span> mantenimientos este mes</p>
                    </div>
                </div>
                <button
                    onClick={() => onNavigate('history')}
                    className="relative z-10 bg-white/20 hover:bg-white/30 backdrop-blur-md p-3 rounded-2xl transition-all active:scale-90"
                >
                    <ArrowUpRight size={24} />
                </button>
            </div>
        </div>
    );
};

export default DashboardSummary;
