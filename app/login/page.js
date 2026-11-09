"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dices, LogIn, Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        setCargando(true);

        try {
            const { data, error: errAuth } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password,
            });

            if (errAuth) {
                if (errAuth.message.includes('Invalid login credentials')) {
                    throw new Error('El correo o la contraseña son incorrectos.');
                }
                if (errAuth.message.includes('Email not confirmed')) {
                    throw new Error('Debes confirmar tu correo electrónico antes de entrar.');
                }
                throw errAuth;
            }

            if (data?.user) {
                router.push('/');
                router.refresh();
            }
        } catch (err) {
            console.error('Error al iniciar sesión:', err);
            setError(err.message || 'Ocurrió un error al intentar iniciar sesión.');
        } finally {
            setCargando(false);
        }
    };

    return (
        <main className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
            {/* Fondo ambiental */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/20 via-slate-950 to-slate-950 pointer-events-none" />

            <div className="w-full max-w-md z-10">
                {/* Volver */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white mb-6 transition-colors font-semibold"
                >
                    <ArrowLeft size={14} /> Volver al inicio
                </Link>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
                    {/* Header */}
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="w-12 h-12 bg-amber-900/40 border border-amber-700/50 rounded-xl flex items-center justify-center text-amber-400 mb-3 shadow-inner">
                            <Dices size={28} />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-white font-serif">
                            Mesa Arcana
                        </h1>
                        <p className="text-xs text-slate-400 mt-1">
                            Iniciá sesión para continuar tu crónica de aventuras
                        </p>
                    </div>

                    {/* Alerta de error */}
                    {error && (
                        <div className="mb-6 p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2">
                            <AlertCircle size={16} className="text-red-400 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Formulario */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                Correo Electrónico
                            </label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tu@aventurero.com"
                                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={cargando}
                            className="w-full mt-2 py-3 bg-amber-800 hover:bg-amber-700 active:bg-amber-900 disabled:opacity-50 text-amber-50 font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {cargando ? (
                                <span>Entrando al gremio...</span>
                            ) : (
                                <>
                                    <LogIn size={16} /> Entrar a la Partida
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer con link a Registro */}
                    <div className="mt-8 pt-6 border-t border-slate-800 text-center text-xs text-slate-400">
                        ¿Todavía no tenés una cuenta?{' '}
                        <Link
                            href="/registro"
                            className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-4 ml-1"
                        >
                            Registrate acá
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}

