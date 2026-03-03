import React from 'react';
import { Hammer, ArrowLeft, Construction, Clock } from 'lucide-react';

const InDevelopment = ({ title = "Módulo en Desarrollo", onBack }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 animate-in fade-in zoom-in-95 duration-700">
            <div className="relative mb-8">
                <div className="w-24 h-24 bg-tertiary rounded-[2rem] border border-color flex items-center justify-center text-primary-500 relative z-10 shadow-xl shadow-primary-500/10">
                    <Construction size={48} />
                </div>
                <div className="absolute -top-2 -right-2 w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-500 border-4 border-secondary z-20 animate-bounce">
                    <Hammer size={18} />
                </div>
                <div className="absolute inset-0 bg-primary-500 blur-[40px] opacity-10 rounded-full scale-150" />
            </div>

            <h2 className="text-[28px] font-[800] text-text-primary mb-3 text-center uppercase tracking-tight">
                {title}
            </h2>

            <p className="text-[14px] text-text-muted font-[600] text-center max-w-md mb-10 uppercase tracking-widest leading-relaxed">
                Estamos trabajando duro para traerte esta funcionalidad. Muy pronto podrás gestionar tus tickets de GLPI directamente desde aquí.
            </p>

            <div className="flex flex-col items-center gap-6 w-full max-w-sm">
                <div className="w-full bg-secondary border border-color rounded-2xl p-6 flex items-center gap-4 shadow-sm">
                    <div className="w-10 h-10 bg-tertiary rounded-xl flex items-center justify-center text-text-muted border border-color">
                        <Clock size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Lanzamiento Estimado</p>
                        <p className="text-[14px] font-[700] text-text-primary">Próximamente (Q2 2026)</p>
                    </div>
                </div>

                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-primary-500 font-[700] text-[13px] hover:underline uppercase tracking-wide group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Volver al Dashboard
                </button>
            </div>

            <div className="mt-16 pt-8 border-t border-color w-full max-w-xs text-center">
                <div className="text-[10px] items-center justify-center gap-2 text-text-muted font-[800] uppercase tracking-[0.2em] flex">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                    Progreso: 65% completado
                </div>
            </div>
        </div>
    );
};

export default InDevelopment;
