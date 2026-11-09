"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dices, LogIn, Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { DragonCorner } from '../components/ui/DragonCorner';
import { BannerTitulo } from '../components/ui/BannerTitulo';

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
        <main className="min-h-screen w-full bg-[#18110c] text-amber-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
            {/* Fondo ambiental */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#4a1212]/30 via-[#18110c] to-[#18110c] pointer-events-none" />

            <div className="w-full max-w-md z-10">
                {/* Volver */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-xs font-cinzel text-[#c8a45a] hover:text-[#fef08a] mb-6 transition-colors font-semibold"
                >
                    <ArrowLeft size={14} /> Volver a la Mesa
                </Link>

                <div className="relative rounded-2xl border-2 border-[#8a6a3e] bg-pergamino-real p-8 shadow-[0_10px_40px_rgba(0,0,0,0.8)] text-[#241510]">
                    <DragonCorner position="top-left" size={28} />
                    <DragonCorner position="top-right" size={28} />
                    <DragonCorner position="bottom-left" size={28} />
                    <DragonCorner position="bottom-right" size={28} />

                    {/* Header */}
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="w-12 h-12 bg-[#241510] border-2 border-[#8a6a3e] rounded-xl flex items-center justify-center text-[#c8a45a] mb-2 shadow-inner">
                            <Dices size={28} />
                        </div>
                        <BannerTitulo>
                            Mesa Arcana
                        </BannerTitulo>
                        <p className="text-xs font-garamond italic text-[#5c3a21] mt-1">
                            Iniciá sesión para continuar tu crónica de aventuras
                        </p>
                    </div>

                    {/* Alerta de error */}
                    {error && (
                        <div className="mb-6 p-3 bg-[#4a1212] border-2 border-red-500 rounded-xl text-red-100 text-xs flex items-center gap-2">
                            <AlertCircle size={16} className="text-red-300 shrink-0" />
                            <span className="font-garamond">{error}</span>
                        </div>
                    )}

                    {/* Formulario */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-cinzel font-bold text-[#3d2716] uppercase tracking-wider mb-1.5">
                                Correo Electrónico
                            </label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a6a3e]" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="aventurero@reino.com"
                                    className="w-full bg-[#fbf6ec] border-2 border-[#8a6a3e] rounded-xl pl-10 pr-4 py-2.5 text-sm font-garamond text-[#241510] placeholder-[#8a6a3e]/60 focus:outline-none focus:border-[#7b1f1f] shadow-inner"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-cinzel font-bold text-[#3d2716] uppercase tracking-wider mb-1.5">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a6a3e]" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-[#fbf6ec] border-2 border-[#8a6a3e] rounded-xl pl-10 pr-4 py-2.5 text-sm font-garamond text-[#241510] placeholder-[#8a6a3e]/60 focus:outline-none focus:border-[#7b1f1f] shadow-inner"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={cargando}
                            className="w-full mt-4 bg-gradient-to-r from-[#7b1f1f] via-[#991b1b] to-[#7b1f1f] hover:brightness-110 disabled:opacity-50 text-[#fef08a] font-cinzel font-bold py-3 rounded-xl shadow-lg border border-[#c8a45a] flex items-center justify-center gap-2 text-xs uppercase tracking-widest transition-all cursor-pointer active:scale-95"
                        >
                            {cargando ? (
                                <span className="animate-pulse">Ingresando al Reino...</span>
                            ) : (
                                <>
                                    <LogIn size={16} /> Entrar a la Taberna
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer / Registro */}
                    <div className="mt-6 pt-4 border-t border-[#8a6a3e]/40 text-center">
                        <p className="text-xs font-garamond text-[#5c3a21]">
                            ¿Aún no tenés un héroe registrado?{' '}
                            <Link href="/registro" className="font-cinzel font-bold text-[#7b1f1f] hover:underline ml-1">
                                Crear una cuenta
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
