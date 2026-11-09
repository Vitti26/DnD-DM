"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, LogOut, Shield, UserPlus, LogIn, Users } from 'lucide-react';

export function UserNav() {
    const [usuario, setUsuario] = useState(null);
    const [cargando, setCargando] = useState(true);
    const router = useRouter();

    useEffect(() => {
        let mounted = true;

        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!mounted) return;

            if (session?.user) {
                // Consultamos el nombre del perfil
                const { data: perfil } = await supabase
                    .from('perfiles')
                    .select('nombre_usuario')
                    .eq('id', session.user.id)
                    .single();

                const nombre = perfil?.nombre_usuario ||
                    session.user.user_metadata?.nombre_usuario ||
                    session.user.email?.split('@')[0] ||
                    'Aventurero';

                setUsuario({ ...session.user, nombre_usuario: nombre });
            } else {
                setUsuario(null);
            }
            setCargando(false);
        };

        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                const { data: perfil } = await supabase
                    .from('perfiles')
                    .select('nombre_usuario')
                    .eq('id', session.user.id)
                    .single();

                const nombre = perfil?.nombre_usuario ||
                    session.user.user_metadata?.nombre_usuario ||
                    session.user.email?.split('@')[0] ||
                    'Aventurero';

                setUsuario({ ...session.user, nombre_usuario: nombre });
            } else {
                setUsuario(null);
            }
            setCargando(false);
        });

        return () => {
            mounted = false;
            subscription?.unsubscribe();
        };
    }, []);

    const handleCerrarSesion = async () => {
        await supabase.auth.signOut();
        setUsuario(null);
        router.push('/login');
        router.refresh();
    };

    if (cargando) {
        return <div className="h-8 w-24 bg-slate-800/50 animate-pulse rounded-lg" />;
    }

    if (!usuario) {
        return (
            <div className="flex items-center gap-2">
                <Link
                    href="/login"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors"
                >
                    <LogIn size={14} /> Entrar
                </Link>
                <Link
                    href="/registro"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:text-amber-100 bg-amber-900/60 hover:bg-amber-800/80 border border-amber-700/50 rounded-lg transition-colors"
                >
                    <UserPlus size={14} /> Registrarse
                </Link>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 sm:gap-3">
            <Link
                href="/parties"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:text-amber-100 bg-amber-950/60 hover:bg-amber-900/70 border border-amber-800/50 rounded-lg transition-all"
                title="Salas multijugador online"
            >
                <Users size={14} className="text-amber-400" />
                <span className="hidden sm:inline">Parties</span>
            </Link>

            <Link
                href="/personajes"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:text-amber-100 bg-stone-900/80 hover:bg-stone-800 border border-amber-900/40 rounded-lg transition-all"
                title="Ver y crear tus personajes"
            >
                <Shield size={14} className="text-amber-400" />
                <span className="hidden sm:inline">Mis Personajes</span>
            </Link>

            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-800/80 border border-slate-700/70 rounded-lg text-xs">
                <User size={14} className="text-slate-400" />
                <span className="font-semibold text-slate-200 max-w-[120px] truncate">
                    {usuario.nombre_usuario}
                </span>
            </div>

            <button
                onClick={handleCerrarSesion}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors"
                title="Cerrar sesión"
            >
                <LogOut size={16} />
            </button>
        </div>
    );
}

