import React, { useState, useEffect, useCallback } from 'react';
import { X, Bell, CheckCircle, AlertTriangle, Info, Timer } from 'lucide-react';
import { cn } from '../utils/cn';

let toastCount = 0;
const observers = new Set();

export const toast = {
    show: (options) => {
        const id = ++toastCount;
        observers.forEach(callback => callback({ id, ...options }));
        return id;
    },
    success: (message, options) => toast.show({ message, type: 'success', ...options }),
    error: (message, options) => toast.show({ message, type: 'error', ...options }),
    info: (message, options) => toast.show({ message, type: 'info', ...options }),
    warning: (message, options) => toast.show({ message, type: 'warning', ...options }),
    task: (title, message, options) => toast.show({ title, message, type: 'task', ...options }),
};

export const ToastContainer = () => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((toast) => {
        setToasts(prev => [...prev, toast]);
        if (toast.duration !== 0) {
            setTimeout(() => {
                removeToast(toast.id);
            }, toast.duration || 5000);
        }
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    useEffect(() => {
        observers.add(addToast);
        return () => observers.delete(addToast);
    }, [addToast]);

    return (
        <div className="fixed bottom-6 right-6 z-[2000] flex flex-col gap-3 w-full max-w-[400px] pointer-events-none px-6 md:px-0">
            {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
            ))}
        </div>
    );
};

const ToastItem = ({ toast, onRemove }) => {
    const [isExiting, setIsExiting] = useState(false);

    const handleRemove = () => {
        setIsExiting(true);
        setTimeout(onRemove, 300);
    };

    const icons = {
        success: <CheckCircle className="text-emerald-500" size={20} />,
        error: <AlertTriangle className="text-red-500" size={20} />,
        info: <Info className="text-blue-500" size={20} />,
        warning: <AlertTriangle className="text-amber-500" size={20} />,
        task: <Bell className="text-primary-500" size={20} />,
    };

    const gradients = {
        success: 'from-emerald-500/10 to-transparent border-emerald-500/20',
        error: 'from-red-500/10 to-transparent border-red-500/20',
        info: 'from-blue-500/10 to-transparent border-blue-500/20',
        warning: 'from-amber-500/10 to-transparent border-amber-500/20',
        task: 'from-primary-500/10 to-transparent border-primary-500/20',
    };

    return (
        <div
            className={cn(
                "pointer-events-auto relative overflow-hidden rounded-2xl bg-secondary/80 backdrop-blur-xl border p-4 shadow-2xl transition-all duration-300 flex items-start gap-4",
                gradients[toast.type || 'info'],
                isExiting ? "translate-x-full opacity-0" : "translate-x-0 animate-in slide-in-from-right-10"
            )}
        >
            <div className="w-10 h-10 rounded-xl bg-tertiary flex items-center justify-center shrink-0 shadow-inner">
                {icons[toast.type || 'info']}
            </div>

            <div className="flex-1 pt-0.5">
                {toast.title && <h5 className="text-[13px] font-black text-text-primary uppercase tracking-wider mb-0.5">{toast.title}</h5>}
                <p className="text-[13px] font-medium text-text-secondary leading-relaxed">{toast.message}</p>

                {toast.type === 'task' && (
                    <div className="mt-3 flex items-center gap-2">
                        <div className="px-2 py-0.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-[9px] font-black text-primary-500 uppercase tracking-widest flex items-center gap-1">
                            <Timer size={10} />
                            Nueva Tarea
                        </div>
                    </div>
                )}
            </div>

            <button
                onClick={handleRemove}
                className="p-1.5 hover:bg-tertiary rounded-lg text-text-muted transition-colors"
            >
                <X size={16} />
            </button>

            {/* Progress Bar */}
            {toast.duration !== 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-tertiary">
                    <div
                        className={cn(
                            "h-full transition-all linear",
                            toast.type === 'success' ? 'bg-emerald-500' :
                                toast.type === 'error' ? 'bg-red-500' :
                                    toast.type === 'task' ? 'bg-primary-500' : 'bg-blue-500'
                        )}
                        style={{
                            animation: `toast-progress ${toast.duration || 5000}ms linear forwards`
                        }}
                    />
                </div>
            )}
        </div>
    );
};

// Legacy Compatibility Component
const LegacyToast = ({ message, type, onClose }) => {
    useEffect(() => {
        if (message) {
            toast.show({ message, type });
            if (onClose) {
                // Small delay to ensure the component rendered before clearing state
                const timer = setTimeout(onClose, 100);
                return () => clearTimeout(timer);
            }
        }
    }, [message, type, onClose]);
    return null;
};

export default LegacyToast;
