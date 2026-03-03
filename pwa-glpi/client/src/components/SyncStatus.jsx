import React from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { cn } from '../utils/cn';

/**
 * SyncDot - A compact dot indicating sync status for tables or lists
 */
export const SyncDot = ({ status, className }) => {
    const statusConfig = {
        offline: { color: 'bg-slate-400', icon: CloudOff },
        local: { color: 'bg-amber-400', icon: Save },
        pending: { color: 'bg-blue-400', icon: RefreshCw },
        syncing: { color: 'bg-primary-500 animate-spin', icon: RefreshCw },
        synced: { color: 'bg-emerald-500', icon: CheckCircle2 },
        error: { color: 'bg-red-500', icon: AlertCircle },
    };

    const config = statusConfig[status] || statusConfig.offline;

    return (
        <div className={cn("relative flex h-2 w-2", className)}>
            {status === 'syncing' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
            )}
            <span className={cn("relative inline-flex rounded-full h-2 w-2", config.color)}></span>
        </div>
    );
};

/**
 * SyncBadge - A more descriptive badge for forms or details
 */
export const SyncBadge = ({ status, className }) => {
    const statusConfig = {
        offline: {
            label: 'Sin conexión',
            icon: CloudOff,
            styles: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
        },
        local: {
            label: 'Guardado local',
            icon: Save,
            styles: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900 dark:text-amber-400 dark:border-amber-800'
        },
        pending: {
            label: 'Pendiente',
            icon: RefreshCw,
            styles: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-400 dark:border-blue-800'
        },
        syncing: {
            label: 'Sincronizando...',
            icon: RefreshCw,
            styles: 'bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900 dark:text-primary-400 dark:border-primary-800',
            animateIcon: 'animate-spin'
        },
        synced: {
            label: 'Sincronizado',
            icon: CheckCircle2,
            styles: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-400 dark:border-emerald-800'
        },
        error: {
            label: 'Error de sincronización',
            icon: AlertCircle,
            styles: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-400 dark:border-red-800'
        },
    };

    const config = statusConfig[status] || statusConfig.offline;
    const Icon = config.icon;

    return (
        <div className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors",
            config.styles,
            className
        )}>
            <Icon size={12} className={config.animateIcon} />
            <span>{config.label}</span>
        </div>
    );
};

/**
 * GlobalSyncIndicator - Minimal indicator for the Topbar
 */
export const GlobalSyncIndicator = ({ status, className }) => {
    const isSyncing = status === 'syncing';
    const Icon = status === 'error' ? AlertCircle : status === 'offline' ? CloudOff : isSyncing ? RefreshCw : Cloud;

    const getStatusStyles = () => {
        if (status === 'error') return "bg-tertiary text-red-500 border-red-500";
        if (status === 'offline') return "bg-tertiary text-orange-600 dark:text-orange-500 border-orange-500";
        if (isSyncing) return "bg-tertiary text-primary-500 border-primary-500";
        return "bg-tertiary text-emerald-600 dark:text-emerald-500 border-emerald-500"; // Online
    };

    return (
        <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-[600] uppercase tracking-wide transition-all border shadow-sm",
            getStatusStyles(),
            className
        )}>
            <div className="relative flex h-2 w-2 shrink-0">
                {isSyncing && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-40"></span>}
                <span className={cn("relative inline-flex rounded-full h-2 w-2 bg-current")}></span>
            </div>
            <Icon size={14} className={cn("shrink-0", isSyncing && 'animate-spin')} />
            <span className="hidden md:inline leading-none">
                {status === 'error' ? 'Offline' :
                    status === 'offline' ? 'Offline' :
                        isSyncing ? 'Sincronizando' : 'Online'}
            </span>
        </div>
    );
};
