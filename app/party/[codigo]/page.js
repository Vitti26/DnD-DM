"use client";
import { useEffect, useState, useRef, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserNav } from '../../components/UserNav';
import {
    Users, Shield, Copy, Check, Sword, Crown, ArrowLeft,
    AlertCircle, Sparkles, UserCheck, Heart, ShieldAlert
} from 'lucide-react';

export default function PartyLobbyPage({ params }) {
    const { codigo } = use(params);
    const router = useRouter();

    const [sesion, setSesion] = useState(null);
    const [cargandoAuth, setCargandoAuth] = useState(true);
    const [party, setParty] = useState(null);
    const [miembros, setMiembros] = useState([]);
    const [misPersonajes, setMisPersonajes] = useState([]);
    const [personajeSeleccionado, setPersonajeSeleccionado] = useState(null);
    const [presenciaOnline, setPresenciaOnline] = useState({});
    const [error, setError] = useState(null);
    const [iniciando, setIniciando] = useState(false);
    const [copiado, setCopiado] = useState(false);

    const channelRef = useRef(null);

    // 1. Autenticación y carga de personajes propios
    useEffect(() => {
        let mounted = true;

        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!mounted) return;

            if (!session?.user) {
                router.push(`/login?redirect=/party/${codigo}`);
                return;
            }

            setSesion(session);
            setCargandoAuth(false);

            // Cargar personajes propios
            const { data: misPjs } = await supabase
                .from('personajes')
                .select('*')
                .eq('usuario_id', session.user.id)
                .order('created_at', { ascending: false });

            if (mounted) setMisPersonajes(misPjs || []);
        };

        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session?.user) {
                router.push(`/login?redirect=/party/${codigo}`);
            } else {
                setSesion(session);
            }
        });

        return () => {
            mounted = false;
            subscription?.unsubscribe();
        };
    }, [codigo, router]);

    // 2. Cargar datos de la party y miembros
    useEffect(() => {
        if (!sesion?.user?.id) return;
        let cancelado = false;

        const cargarDatos = async () => {
            // Asegurarse de estar unido a la party
            const { data: partyData, error: errParty } = await supabase
                .from('parties')
                .select('*')
                .eq('codigo_invitacion', codigo.toUpperCase())
                .single();

            if (errParty || !partyData) {
                if (!cancelado) setError('Party no encontrada o código incorrecto.');
                return;
            }

            if (!cancelado) setParty(partyData);

            // Si la party ya está en juego, redirigir a la mesa directamente
            if (partyData.estado === 'en_juego' && partyData.partida_id) {
                router.push(`/juego/${partyData.partida_id}`);
                return;
            }

            // Unirse a la party si no es miembro
            await supabase.rpc('rpc_unirse_party', { p_codigo: codigo.toUpperCase() });

            // Cargar miembros
            const { data: miembrosData } = await supabase
                .from('v_miembros_party')
                .select('*')
                .eq('party_id', partyData.id);

            if (!cancelado) {
                setMiembros(miembrosData || []);
                const yo = miembrosData?.find(m => m.usuario_id === sesion.user.id);
                if (yo?.personaje_id) setPersonajeSeleccionado(yo.personaje_id);
            }
        };

        cargarDatos();

        return () => { cancelado = true; };
    }, [codigo, sesion, router]);

    // 3. Suscripción Realtime (Presencia + Cambios en Miembros y Party)
    useEffect(() => {
        if (!party?.id || !sesion?.user?.id) return;

        const channel = supabase.channel(`party-lobby-${party.id}`, {
            config: {
                presence: {
                    key: sesion.user.id,
                },
            },
        });

        channelRef.current = channel;

        // Escuchar cambios en miembros de la party
        channel
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'party_miembros',
                filter: `party_id=eq.${party.id}`
            }, async () => {
                const { data } = await supabase
                    .from('v_miembros_party')
                    .select('*')
                    .eq('party_id', party.id);
                if (data) setMiembros(data);
            })
            // Escuchar cambios en la party (cuando el owner inicia la partida)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'parties',
                filter: `id=eq.${party.id}`
            }, (payload) => {
                if (payload.new.estado === 'en_juego' && payload.new.partida_id) {
                    router.push(`/juego/${payload.new.partida_id}`);
                }
            })
            // Presencia en vivo
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                setPresenciaOnline(state);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        usuario_id: sesion.user.id,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [party?.id, sesion, router]);

    const handleSeleccionarPersonaje = async (personajeId) => {
        setPersonajeSeleccionado(personajeId);
        try {
            await supabase.rpc('rpc_seleccionar_personaje_party', {
                p_party_id: party.id,
                p_personaje_id: personajeId
            });

            // Refrescar lista local
            const { data } = await supabase
                .from('v_miembros_party')
                .select('*')
                .eq('party_id', party.id);
            if (data) setMiembros(data);
        } catch (err) {
            console.error('Error al seleccionar personaje:', err);
        }
    };

    const handleIniciarCampana = async () => {
        if (!party?.id) return;
        setIniciando(true);
        setError(null);

        try {
            const { data, error: errRpc } = await supabase.rpc('rpc_iniciar_campana_party', {
                p_party_id: party.id
            });

            if (errRpc) throw errRpc;

            if (data?.partida_id) {
                router.push(`/juego/${data.partida_id}`);
            }
        } catch (err) {
            console.error('Error al iniciar campaña:', err);
            setError(err.message || 'No se pudo iniciar la campaña.');
            setIniciando(false);
        }
    };

    const copiarEnlace = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
    };

    const esDueno = party?.dueno_id === sesion?.user?.id;

    if (cargandoAuth || !party) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                <Sparkles className="animate-spin text-amber-500 w-6 h-6" />
                <span>Entrando al lobby de la party...</span>
            </div>
        );
    }

    return (
        <main className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 md:p-8 font-sans relative overflow-x-hidden">
            {/* Header */}
            <header className="max-w-5xl mx-auto flex justify-between items-center pb-6 border-b border-slate-800/80 mb-8">
                <div className="flex items-center gap-3">
                    <Link
                        href="/parties"
                        className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition-colors"
                        title="Volver a Parties"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-bold font-serif text-white tracking-wide">
                                {party.nombre}
                            </h1>
                            {esDueno && (
                                <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800/60 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Crown size={12} /> Anfitrión
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-400">
                            Lobby de espera · {miembros.length} de {party.max_jugadores} aventureros listos
                        </p>
                    </div>
                </div>

                <UserNav />
            </header>

            <div className="max-w-5xl mx-auto space-y-8">
                {/* Banner de Invitación con Código Copiable */}
                <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-900/40 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-1">
                            <Sparkles size={14} /> Código de Invitación
                        </span>
                        <p className="text-xs text-slate-300">
                            Compartí este código o el link con tus amigos para que se sumen a la mesa.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="px-4 py-2 bg-slate-950 border border-amber-600/40 rounded-xl font-mono text-xl font-bold text-amber-300 tracking-widest">
                            {party.codigo_invitacion}
                        </div>
                        <button
                            onClick={copiarEnlace}
                            className="px-4 py-2 bg-amber-800 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            {copiado ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                            <span>{copiado ? '¡Copiado!' : 'Copiar Link'}</span>
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2">
                        <AlertCircle size={16} className="text-red-400 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Selección del personaje propio para la partida */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold font-serif text-white uppercase tracking-wider flex items-center gap-2">
                            <Shield size={16} className="text-amber-500" />
                            Tu Personaje para esta Expedición
                        </h2>
                        <Link href="/personajes" className="text-xs text-amber-400 hover:underline">
                            + Crear nuevo personaje
                        </Link>
                    </div>

                    {misPersonajes.length === 0 ? (
                        <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-center">
                            <p className="text-xs text-slate-400 mb-2">
                                Todavía no creaste ningún personaje en tu salón.
                            </p>
                            <Link
                                href="/personajes"
                                className="inline-flex items-center gap-1 px-4 py-1.5 bg-amber-800 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                            >
                                <Sparkles size={12} /> Forjar un Personaje
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {misPersonajes.map(pj => {
                                const seleccionado = pj.id === personajeSeleccionado;
                                return (
                                    <div
                                        key={pj.id}
                                        onClick={() => handleSeleccionarPersonaje(pj.id)}
                                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                                            seleccionado
                                                ? 'bg-amber-950/60 border-amber-500/80 shadow-md ring-1 ring-amber-500/50'
                                                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                                        }`}
                                    >
                                        <div>
                                            <div className="font-bold text-sm text-white font-serif">{pj.nombre}</div>
                                            <div className="text-[11px] text-amber-400/90 font-medium">
                                                {pj.raza} {pj.clase} · Nivel {pj.nivel}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">
                                                {pj.hp_max} PV · {pj.ca} CA
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                                            seleccionado
                                                ? 'bg-amber-500 border-amber-400 text-black font-bold'
                                                : 'border-slate-700'
                                        }`}>
                                            {seleccionado && <Check size={12} />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Lista de Aventureros en la Party (en vivo) */}
                <div>
                    <h2 className="text-sm font-bold font-serif text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Users size={16} className="text-amber-500" />
                        Compañía Reunida ({miembros.length} / {party.max_jugadores})
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {miembros.map((m) => {
                            const isOnline = Boolean(presenciaOnline[m.usuario_id]);
                            return (
                                <div
                                    key={m.usuario_id}
                                    className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-start gap-4 relative"
                                >
                                    <div className="w-12 h-12 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center text-amber-400 shrink-0 font-serif font-bold text-lg">
                                        {m.nombre_usuario?.charAt(0)?.toUpperCase() || 'A'}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-white text-sm truncate">
                                                {m.nombre_usuario}
                                            </span>
                                            {m.rol === 'owner' && (
                                                <Crown size={14} className="text-amber-400 shrink-0" title="Anfitrión" />
                                            )}
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                                                isOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-600'
                                            }`} title={isOnline ? 'Conectado en vivo' : 'Desconectado'} />
                                        </div>

                                        {m.personaje_nombre ? (
                                            <div className="mt-2 p-2 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                                                <div className="flex items-center justify-between text-xs font-semibold text-amber-200">
                                                    <span>{m.personaje_nombre}</span>
                                                    <span className="text-[10px] text-amber-400">Nvl {m.personaje_nivel}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-400">
                                                    {m.personaje_raza} {m.personaje_clase}
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                                                    <span className="flex items-center gap-1 text-red-400 font-bold">
                                                        <Heart size={11} /> {m.personaje_hp_max} PV
                                                    </span>
                                                    <span className="flex items-center gap-1 text-blue-400 font-bold">
                                                        <ShieldAlert size={11} /> {m.personaje_ca} CA
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-amber-400/80 italic mt-2 flex items-center gap-1">
                                                <Sparkles size={12} /> Eligiendo personaje...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Botón de Inicio (Solo para el Anfitrión) */}
                {esDueno && (
                    <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-xs text-slate-400 text-center sm:text-left">
                            Como anfitrión, cuando todos hayan elegido su personaje podés abrir la mesa.
                        </div>

                        <button
                            onClick={handleIniciarCampana}
                            disabled={iniciando || miembros.length === 0}
                            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-xl transition-all hover:scale-105 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <Sword size={18} />
                            <span>{iniciando ? 'Invocando al Dungeon Master...' : '⚔️ Comenzar Campaña en Grupo'}</span>
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
