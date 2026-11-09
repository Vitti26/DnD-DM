"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserNav } from '../components/UserNav';
import {
    Users, Plus, LogIn, ArrowLeft, Shield, Sparkles, Copy, Check, AlertCircle, ArrowRight
} from 'lucide-react';

export default function PartiesPage() {
    const router = useRouter();
    const [cargandoAuth, setCargandoAuth] = useState(true);
    const [parties, setParties] = useState([]);
    const [cargandoLista, setCargandoLista] = useState(true);
    const [error, setError] = useState(null);

    // Modal Crear Party
    const [modalCrear, setModalCrear] = useState(false);
    const [nombreParty, setNombreParty] = useState('');
    const [maxJugadores, setMaxJugadores] = useState(5);
    const [creando, setCreando] = useState(false);

    // Unirse con código
    const [codigoInput, setCodigoInput] = useState('');
    const [uniendo, setUniendo] = useState(false);
    const [copiadoId, setCopiadoId] = useState(null);

    useEffect(() => {
        let mounted = true;

        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!mounted) return;

            if (!session?.user) {
                router.push('/login');
                return;
            }

            setCargandoAuth(false);
            cargarParties();
        };

        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session?.user) {
                router.push('/login');
            } else {
                cargarParties();
            }
        });

        return () => {
            mounted = false;
            subscription?.unsubscribe();
        };
    }, [router]);

    const cargarParties = async () => {
        setCargandoLista(true);
        try {
            const { data, error: errFetch } = await supabase
                .from('v_parties_usuario')
                .select('*')
                .order('actualizado_en', { ascending: false });

            if (errFetch) throw errFetch;
            setParties(data || []);
        } catch (err) {
            console.error('Error al cargar parties:', err);
            setError('No pudimos cargar tus expediciones.');
        } finally {
            setCargandoLista(false);
        }
    };

    const handleCrearParty = async (e) => {
        e.preventDefault();
        if (!nombreParty.trim()) return;

        setCreando(true);
        setError(null);

        try {
            const { data, error: errRpc } = await supabase.rpc('rpc_crear_party', {
                p_nombre: nombreParty.trim(),
                p_max_jugadores: Number(maxJugadores) || 5
            });

            if (errRpc) throw errRpc;

            if (data?.codigo) {
                router.push(`/party/${data.codigo}`);
            } else {
                cargarParties();
                setModalCrear(false);
            }
        } catch (err) {
            console.error('Error al crear party:', err);
            setError(err.message || 'Error al crear la party.');
        } finally {
            setCreando(false);
        }
    };

    const handleUnirsePorCodigo = async (e) => {
        e.preventDefault();
        const cod = codigoInput.trim().toUpperCase();
        if (!cod) return;

        setUniendo(true);
        setError(null);

        try {
            const { data, error: errRpc } = await supabase.rpc('rpc_unirse_party', {
                p_codigo: cod
            });

            if (errRpc) throw errRpc;

            if (data?.codigo) {
                router.push(`/party/${data.codigo}`);
            }
        } catch (err) {
            console.error('Error al unirse a la party:', err);
            setError(err.message || 'Código de invitación no válido o sala llena.');
        } finally {
            setUniendo(false);
        }
    };

    const copiarCodigo = (codigo, e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(codigo);
        setCopiadoId(codigo);
        setTimeout(() => setCopiadoId(null), 2000);
    };

    if (cargandoAuth) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
                Conectando con el salón de expediciones...
            </div>
        );
    }

    return (
        <main className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 md:p-8 font-sans relative overflow-x-hidden">
            {/* Cabecera */}
            <header className="max-w-5xl mx-auto flex justify-between items-center pb-6 border-b border-slate-800/80 mb-8">
                <div className="flex items-center gap-3">
                    <Link
                        href="/"
                        className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition-colors"
                        title="Volver a la Home"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div className="flex items-center gap-2">
                        <Users className="text-amber-500 w-6 h-6" />
                        <h1 className="text-xl md:text-2xl font-bold font-serif text-white tracking-wide">
                            Parties Online
                        </h1>
                    </div>
                </div>

                <UserNav />
            </header>

            <div className="max-w-5xl mx-auto space-y-8">
                {/* Banner de Acciones: Unirse con código + Crear nueva */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tarjeta Unirse */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-amber-400 mb-2 font-serif font-bold text-base">
                                <LogIn size={18} />
                                <span>Unirse con Código</span>
                            </div>
                            <p className="text-xs text-slate-400 mb-4">
                                ¿Te invitaron tus amigos? Ingresá el código de 6 caracteres para entrar a su sala.
                            </p>
                        </div>

                        <form onSubmit={handleUnirsePorCodigo} className="flex gap-2">
                            <input
                                type="text"
                                maxLength={8}
                                value={codigoInput}
                                onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
                                placeholder="Ej: ARC4NA"
                                className="flex-1 bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest text-center text-amber-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 uppercase"
                            />
                            <button
                                type="submit"
                                disabled={uniendo || !codigoInput.trim()}
                                className="px-5 py-2.5 bg-amber-800 hover:bg-amber-700 disabled:opacity-50 text-amber-50 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                                {uniendo ? 'Entrando...' : 'Unirse'}
                            </button>
                        </form>
                    </div>

                    {/* Tarjeta Crear Nueva */}
                    <div className="bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 border border-amber-900/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-amber-300 mb-2 font-serif font-bold text-base">
                                <Sparkles size={18} />
                                <span>Crear una Nueva Party</span>
                            </div>
                            <p className="text-xs text-slate-400 mb-4">
                                Abrí una sala multijugador, elegí cuántos aventureros pueden sumarse y compartí el enlace con tu grupo.
                            </p>
                        </div>

                        <button
                            onClick={() => setModalCrear(true)}
                            className="w-full py-2.5 bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <Plus size={16} /> Abrir Nueva Sala
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2">
                        <AlertCircle size={16} className="text-red-400 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Listado de Parties del Usuario */}
                <div>
                    <h2 className="text-base font-bold font-serif text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Shield size={16} className="text-amber-500" />
                        Tus Expediciones Activas
                    </h2>

                    {cargandoLista ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-36 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : parties.length === 0 ? (
                        <div className="text-center py-12 px-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                            <Users size={40} className="mx-auto text-slate-600 mb-3" />
                            <h3 className="text-base font-bold text-slate-300 font-serif mb-1">
                                No participás en ninguna party todavía
                            </h3>
                            <p className="text-xs text-slate-500 max-w-sm mx-auto">
                                Creá una sala o pedile a un amigo que te pase su código de 6 caracteres.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {parties.map((p) => (
                                <div
                                    key={p.id}
                                    onClick={() => router.push(`/party/${p.codigo_invitacion}`)}
                                    className="bg-slate-900/90 border border-slate-800 hover:border-amber-700/60 rounded-2xl p-5 shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-base text-white font-serif group-hover:text-amber-200 transition-colors">
                                                {p.nombre}
                                            </h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                                p.estado === 'en_juego'
                                                    ? 'bg-red-950 text-red-300 border border-red-800/50 animate-pulse'
                                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                                            }`}>
                                                {p.estado === 'en_juego' ? '⚔️ En Juego' : 'Lobby'}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-400 mb-3">
                                            Anfitrión: <span className="text-slate-200 font-semibold">{p.dueno_nombre}</span>
                                            {p.es_dueno && <span className="ml-1.5 text-[10px] text-amber-400 font-bold">(Vos)</span>}
                                        </p>

                                        <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                                            <span>👥 {p.total_miembros || 1} / {p.max_jugadores} aventureros</span>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-slate-800/70 flex justify-between items-center text-xs">
                                        <button
                                            onClick={(e) => copiarCodigo(p.codigo_invitacion, e)}
                                            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/70 border border-slate-700/60 rounded-lg text-amber-300 font-mono text-[11px] hover:border-amber-500/50 transition-colors"
                                            title="Copiar código"
                                        >
                                            {copiadoId === p.codigo_invitacion ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                            <span>{p.codigo_invitacion}</span>
                                        </button>

                                        <span className="text-amber-400/90 font-semibold flex items-center gap-1 text-[11px] group-hover:translate-x-1 transition-transform">
                                            Entrar <ArrowRight size={13} />
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL CREAR PARTY */}
            {modalCrear && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative">
                        <h3 className="text-lg font-bold text-white font-serif mb-1 flex items-center gap-2">
                            <Sparkles className="text-amber-400 w-5 h-5" />
                            Abrir Nueva Sala de Party
                        </h3>
                        <p className="text-xs text-slate-400 mb-6">
                            Configurá la expedición para que tus amigos se unan con sus personajes.
                        </p>

                        <form onSubmit={handleCrearParty} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Nombre de la Campaña / Misión
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={nombreParty}
                                    onChange={(e) => setNombreParty(e.target.value)}
                                    placeholder="Ej: Las Minas de Phandelver"
                                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Máximo de Jugadores
                                </label>
                                <select
                                    value={maxJugadores}
                                    onChange={(e) => setMaxJugadores(e.target.value)}
                                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                >
                                    {[2, 3, 4, 5, 6, 7, 8].map(n => (
                                        <option key={n} value={n}>{n} aventureros</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setModalCrear(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creando}
                                    className="px-5 py-2.5 bg-amber-800 hover:bg-amber-700 text-amber-50 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {creando ? 'Creando sala...' : 'Crear Sala'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}

