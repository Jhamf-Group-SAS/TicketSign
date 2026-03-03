import { useState, useEffect } from 'react';
import { Lock, User, LogIn, AlertCircle, ShieldCheck, Loader2, Eye, EyeOff } from 'lucide-react';
import { db } from '../store/db';
import { cn } from '../utils/cn';

const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [customLogo, setCustomLogo] = useState('');

    useEffect(() => {
        const loadBranding = async () => {
            const setting = await db.settings.get('loginImage');
            if (setting?.value) setCustomLogo(setting.value);
        };
        loadBranding();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('glpi_pro_token', data.token);
                localStorage.setItem('glpi_pro_user', JSON.stringify(data.user));
                onLogin(data.user);
            } else {
                setError(data.message || 'Error al iniciar sesión');
            }
        } catch (err) {
            setError('No se pudo conectar con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-primary transition-colors duration-500 relative overflow-hidden font-['Inter',system-ui,sans-serif]">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary rounded-full blur-[120px] -mr-64 -mt-64 opacity-50 transition-colors border border-primary-500/10" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary rounded-full blur-[120px] -ml-64 -mb-64 opacity-70 transition-colors border border-primary-500/5" />

            <div className="w-full max-w-[420px] relative z-10">
                {/* Logo Area */}
                <div className="text-center mb-10">
                    <div className={cn(
                        "inline-flex items-center justify-center mb-6 transition-all duration-500",
                        customLogo
                            ? "w-full max-w-[280px] bg-transparent shadow-none"
                            : "w-[64px] h-[64px] bg-[linear-gradient(135deg,#0695c4,#0578a0)] rounded-[18px] shadow-[0_8px_20px_rgba(6,149,196,.3)] overflow-hidden"
                    )}>
                        <img
                            src={customLogo || "/logo-white.png"}
                            className={cn(
                                "object-contain transition-all duration-500",
                                customLogo ? "w-full h-auto max-h-[100px]" : "h-8 w-auto"
                            )}
                            alt="Logo"
                        />
                    </div>
                    <h1 className="text-[32px] font-[800] text-text-primary tracking-tight leading-none mb-2">
                        Ticket<span className="text-primary-500">Sign</span>
                    </h1>
                    <p className="text-[11px] font-[600] text-text-muted uppercase tracking-[3px] ml-1">Enterprise Infraestructure</p>
                </div>

                <div className="bg-secondary p-[40px] rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,.04)] border border-color transition-colors duration-300">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-secondary border border-red-500/50 text-red-500 p-4 rounded-xl flex items-center gap-3 text-[13px] font-[500] animate-in shake duration-300">
                                <AlertCircle size={18} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[12px] font-[600] text-text-primary uppercase tracking-wide ml-1">Usuario</label>
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-muted group-focus-within/input:text-primary-500 transition-colors">
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="block w-full h-[48px] pl-11 pr-4 bg-tertiary border border-color rounded-xl text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-primary-500 focus:bg-secondary focus:shadow-sm transition-all font-[500] text-[15px]"
                                    placeholder="usuario"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[12px] font-[600] text-text-primary uppercase tracking-wide ml-1">Contraseña</label>
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-muted group-focus-within/input:text-primary-500 transition-colors">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full h-[48px] pl-11 pr-12 bg-tertiary border border-color rounded-xl text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-primary-500 focus:bg-secondary focus:shadow-sm transition-all font-[500] text-[15px]"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-muted hover:text-primary-500 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full relative group/btn flex items-center justify-center gap-2 h-[52px] bg-[linear-gradient(135deg,#0695c4,#0578a0)] text-white font-[700] uppercase tracking-[1px] text-[13px] rounded-xl shadow-[0_8px_16px_rgba(6,149,196,.25)] hover:shadow-[0_12px_24px_rgba(6,149,196,.35)] transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 size={24} className="animate-spin" />
                            ) : (
                                <>
                                    <span>Iniciar Sesión</span>
                                    <LogIn size={20} className="group-hover/btn:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-color flex items-center justify-center gap-2 opacity-60">
                        <ShieldCheck size={14} className="text-primary-500" />
                        <span className="text-[10px] font-[700] text-text-muted uppercase tracking-[1px]">Protocolo GLPI Seguro</span>
                    </div>
                </div>

                <div className="mt-8 text-center flex flex-col items-center gap-1">
                    <p className="text-[11px] text-text-muted font-[500]">
                        &copy; {new Date().getFullYear()} Jhamf Group SAS. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
