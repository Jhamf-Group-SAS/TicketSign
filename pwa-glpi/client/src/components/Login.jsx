import { useState } from 'react';
import { Lock, User, LogIn, AlertCircle } from 'lucide-react';

const Login = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('glpi_pro_token', data.token);
                localStorage.setItem('glpi_pro_user', JSON.stringify(data.user));
                onLoginSuccess(data.user);
            } else {
                setError(data.message || 'Error al iniciar sesión');
            }
        } catch (err) {
            setError('No se pudo conectar con el servidor. Verifica tu conexión.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-[#020617] relative overflow-hidden transition-colors duration-300">
            {/* Background blur elements */}
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-600/10 blur-[150px] rounded-full"></div>
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-indigo-600/10 blur-[150px] rounded-full"></div>

            <div className="w-full max-w-sm space-y-8 relative z-10 animate-in fade-in zoom-in-95 duration-700">
                <div className="text-center">
                    <div className={`bg-white p-3 rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-white/20 inline-block mb-6`}>
                        <img src="/logo-jhamf.png" className="h-12 w-auto object-contain" alt="Logo" />
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white transition-colors">Ticket<span className="text-blue-500">Sign</span></h2>
                    <p className="text-slate-400 dark:text-slate-500 text-sm mt-2 font-medium uppercase tracking-[0.2em] transition-colors">Acceso Técnicos TI</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-xl dark:shadow-2xl space-y-6 transition-colors">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl flex items-center gap-3 text-sm animate-in shake duration-300">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1 transition-colors">Usuario GLPI</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition-colors">
                                <User size={18} />
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="block w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                                placeholder="Ingresa tu usuario"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1 transition-colors">Contraseña</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition-colors">
                                <Lock size={18} />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <LogIn size={18} />
                                <span>Ingresar</span>
                            </>
                        )}
                    </button>
                </form>

                <p className="text-center text-slate-400 dark:text-slate-600 text-[10px] uppercase font-bold tracking-widest transition-colors">
                    Soporte Técnico Local &copy; 2026
                </p>
            </div>
        </div>
    );
};

export default Login;
