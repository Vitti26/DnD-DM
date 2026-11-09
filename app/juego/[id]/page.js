"use client";
import { useEffect, useState, useRef, use, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useGameStore } from '@/store/useGameStore';
import { useRouter } from 'next/navigation';

// Shared Components
import { MessageBubble } from '../../components/MessageBubble';
import { ChatInput } from '../../components/ChatInput';
import { LoadingDM } from '../../components/LoadingDM';
import { PlayerCard } from '../../components/PlayerCard';
import { UserNav } from '../../components/UserNav';

import {
    Dices, ScrollText, UserPlus, Menu, X, ArrowLeft, Sword, AlertTriangle, RotateCcw, Sparkles
} from 'lucide-react';

export default function PartidaEnVivo({ params }) {
    const { id } = use(params);

    const router = useRouter();
    const [cargando, setCargando] = useState(true);
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [inputUsuario, setInputUsuario] = useState("");
    const [procesando, setProcesando] = useState(false);
    const [errorAviso, setErrorAviso] = useState(null);
    const [usuarioActual, setUsuarioActual] = useState(null);
    const ultimoMensajeRef = useRef("");
    const messagesEndRef = useRef(null);

    // Store Actions
    const {
        setJugadores,
        setHistorial,
        setIdioma,
        setEnCombate,
        setTurnoIndex,
        jugadores,
        historial,
        idioma,
        enCombate,
        turnoIndex,
        addMensaje,
        resetGame
    } = useGameStore();

    // Presence & Typing States
    const [compañeros, setCompañeros] = useState(1);
    const [alguienIn, setAlguienIn] = useState(false);
    const channelRef = useRef(null);

    // 1. Carga inicial y suscripción a Realtime
    useEffect(() => {
        let mounted = true;

        const cargarPartida = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                router.push(`/login?redirect=/juego/${id}`);
                return;
            }

            // Consultar datos de perfil del usuario logueado
            const { data: perfil } = await supabase
                .from('perfiles')
                .select('nombre_usuario')
                .eq('id', session.user.id)
                .single();

            const nombreU = perfil?.nombre_usuario ||
                session.user.user_metadata?.nombre_usuario ||
                session.user.email?.split('@')[0] ||
                'Aventurero';

            if (mounted) {
                setUsuarioActual({ id: session.user.id, nombre_usuario: nombreU });
            }

            const { data, error } = await supabase
                .from('partidas')
                .select('*')
                .eq('id', id)
                .single();

            if (data && mounted) {
                setJugadores(data.jugadores || []);
                setHistorial(data.historial || []);
                setIdioma(data.idioma || 'es');
                setEnCombate(Boolean(data.en_combate));
                setTurnoIndex(Number(data.turno_index) || 0);
                setCargando(false);
            } else if (!data) {
                console.error("Partida no encontrada:", error);
                alert("No se encontró la partida o hubo un error de conexión.");
                router.push('/');
            }
        };

        cargarPartida();

        const channel = supabase.channel(`partida-${id}`, {
            config: {
                presence: {
                    key: 'user-' + Math.floor(Math.random() * 1000),
                },
            },
        });

        channelRef.current = channel;

        channel
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'partidas',
                filter: `id=eq.${id}`
            }, (payload) => {
                if (payload.new.jugadores) setJugadores(payload.new.jugadores);
                if (payload.new.historial) setHistorial(payload.new.historial);
                if (payload.new.en_combate !== undefined) setEnCombate(payload.new.en_combate);
                if (payload.new.turno_index !== undefined) setTurnoIndex(payload.new.turno_index);
            })
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                setCompañeros(Object.keys(newState).length);
            })
            .on('broadcast', { event: 'typing' }, () => {
                setAlguienIn(true);
                setTimeout(() => setAlguienIn(false), 3000);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED' && mounted) {
                    await channel.track({
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, [id, setJugadores, setHistorial, setIdioma, setEnCombate, setTurnoIndex, router]);

    // Auto-scroll al final del chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [historial, procesando]);

    const handleTyping = () => {
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'typing',
                payload: {},
            });
        }
    };

    // Identificar el personaje del usuario actual en esta mesa
    const miPersonajeEnMesa = jugadores.find(j => j.usuario_id === usuarioActual?.id);
    const personajeTurnoActivo = jugadores[turnoIndex];
    const esMiTurno = !enCombate || !personajeTurnoActivo?.usuario_id || (personajeTurnoActivo?.usuario_id === usuarioActual?.id);

    // Envío de mensaje centralizado
    const enviarMensajeTexto = useCallback(async (textoAEnviar) => {
        const textoLimpio = (textoAEnviar || "").trim();
        if (!textoLimpio || procesando) return;

        setErrorAviso(null);
        ultimoMensajeRef.current = textoLimpio;

        const autorNombre = usuarioActual?.nombre_usuario || "Aventurero";
        const personajeNombre = miPersonajeEnMesa ? miPersonajeEnMesa.nombre : null;

        const nuevoMensajeUsuario = {
            rol: "usuario",
            texto: textoLimpio,
            autor: autorNombre,
            personaje: personajeNombre
        };

        // 1. Actualización optimista local
        addMensaje(nuevoMensajeUsuario);
        setInputUsuario("");
        setProcesando(true);

        const historialParaIA = [...historial];
        const historialConUsuario = [...historial, nuevoMensajeUsuario];

        // Texto contextualizado para que la IA sepa qué aventurero habla
        const textoParaGemini = personajeNombre
            ? `${personajeNombre} (${autorNombre}) dice o realiza: ${textoLimpio}`
            : `${autorNombre} dice: ${textoLimpio}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        try {
            // 2. Llamada a la API de Gemini
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    mensaje: textoParaGemini,
                    jugadores,
                    idioma,
                    historial: historialParaIA
                }),
            });

            clearTimeout(timeoutId);

            const data = await response.json().catch(() => null);

            if (!response.ok || !data?.ok) {
                const mensajeError = data?.error || `Error del servidor (${response.status})`;
                throw new Error(mensajeError);
            }

            let aiText = data.texto || "";
            let updatedJugadores = [...jugadores];
            let newEnCombate = enCombate;
            let newTurnoIndex = turnoIndex;

            // 3. Procesar bloque [UPDATE]
            const regex = /\[UPDATE\]([\s\S]*?)\[\/UPDATE\]/;
            const match = aiText.match(regex);

            if (match) {
                try {
                    const jsonUpdate = JSON.parse(match[1].trim());

                    if (Array.isArray(jsonUpdate.jugadores)) {
                        for (const p of jsonUpdate.jugadores) {
                            const original = jugadores.find(j => j.id === p.id || j.nombre === p.nombre);
                            if (original && p.hp !== undefined) {
                                const delta = Number(p.hp) - Number(original.hp);
                                if (delta !== 0) {
                                    await supabase.rpc('update_player_hp', {
                                        p_partida_id: id,
                                        p_player_id: original.id,
                                        p_delta: delta
                                    }).catch(err => console.warn("Error en RPC update_player_hp:", err));
                                }
                            }
                        }

                        updatedJugadores = updatedJugadores.map(orig => {
                            const chg = jsonUpdate.jugadores.find(j => j.id === orig.id || j.nombre === orig.nombre);
                            return chg ? { ...orig, ...chg } : orig;
                        });
                        setJugadores(updatedJugadores);
                    }

                    if (jsonUpdate.en_combate !== undefined) {
                        newEnCombate = Boolean(jsonUpdate.en_combate);
                        setEnCombate(newEnCombate);
                    }

                    if (jsonUpdate.turno_index !== undefined) {
                        newTurnoIndex = Number(jsonUpdate.turno_index);
                        setTurnoIndex(newTurnoIndex);
                    }

                    aiText = aiText.replace(regex, "").trim();
                } catch (e) {
                    console.error("Error al parsear bloque [UPDATE]:", e);
                }
            }

            // 4. Mostrar respuesta del DM inmediatamente
            const nuevoMensajeDM = { rol: "dm", texto: aiText };
            addMensaje(nuevoMensajeDM);

            // 5. Persistir en Supabase
            const historialFinal = [...historialConUsuario, nuevoMensajeDM];
            const { error: errorDb } = await supabase
                .from('partidas')
                .update({
                    historial: historialFinal,
                    jugadores: updatedJugadores,
                    en_combate: newEnCombate,
                    turno_index: newTurnoIndex,
                    actualizado_en: new Date().toISOString()
                })
                .eq('id', id);

            if (errorDb) {
                console.error("Error al guardar en Supabase:", errorDb);
            }

        } catch (err) {
            clearTimeout(timeoutId);
            const errTexto = err.name === 'AbortError'
                ? 'El Dungeon Master tardó demasiado en responder (tiempo límite agotado). Por favor reintentá.'
                : err.message || "Error al enviar el mensaje.";

            console.error("Error en chat:", err);
            setErrorAviso(errTexto);
        } finally {
            setProcesando(false);
        }
    }, [id, jugadores, idioma, historial, enCombate, turnoIndex, procesando, addMensaje, setJugadores, setEnCombate, setTurnoIndex, usuarioActual, miPersonajeEnMesa]);

    const enviarMensaje = () => {
        enviarMensajeTexto(inputUsuario);
    };

    const avanzarTurno = async () => {
        if (!jugadores || jugadores.length === 0) return;

        const nuevoIndex = (turnoIndex + 1) % jugadores.length;
        setTurnoIndex(nuevoIndex);

        try {
            await supabase
                .from('partidas')
                .update({ turno_index: nuevoIndex })
                .eq('id', id);
        } catch (error) {
            console.error("Error advancing turn:", error);
        }
    };

    const toggleCombate = async () => {
        const nuevoEstado = !enCombate;
        setEnCombate(nuevoEstado);
        setTurnoIndex(0);

        const { error } = await supabase
            .from('partidas')
            .update({
                en_combate: nuevoEstado,
                turno_index: 0
            })
            .eq('id', id);

        if (error) {
            console.error("Error al cambiar modo de combate:", error.message);
        }
    };

    if (cargando) return (
        <div className="h-screen w-full bg-slate-900 flex items-center justify-center text-white">
            <LoadingDM />
        </div>
    );

    return (
        <main className="flex h-screen w-full bg-slate-900 overflow-hidden relative">

            {/* HEADER MOBILE */}
            <header className="md:hidden absolute top-0 left-0 right-0 p-4 bg-slate-800/90 text-white flex justify-between items-center z-50 shadow-md backdrop-blur-sm">
                <button onClick={() => setMenuAbierto(true)}>
                    <Menu size={24} />
                </button>
                <div className="flex items-center gap-2 font-bold font-serif text-amber-200">
                    <Dices className="w-5 h-5 text-amber-400" /> <span>Mesa Arcana</span>
                </div>
                <span className="text-xs bg-slate-700 px-2 py-1 rounded-full">{jugadores.length} PJ</span>
            </header>

            {/* SIDEBAR (Jugadores) */}
            <aside className={`
                fixed inset-y-0 left-0 z-[60] w-80 bg-slate-900 border-r border-slate-700 p-4 transform transition-transform duration-300 ease-in-out
                md:relative md:translate-x-0 pt-20 md:pt-4
                ${menuAbierto ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2 text-slate-400">
                        <UserPlus size={20} />
                        <h2 className="font-bold uppercase tracking-widest text-sm text-white">
                            Compañía <span className="text-xs text-green-400 ml-2">● {compañeros} Online</span>
                        </h2>
                    </div>

                    <button
                        onClick={() => toggleCombate()}
                        className={`text-[10px] px-2 py-1 rounded font-bold transition-all ${enCombate
                            ? 'bg-red-600 text-white animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        {enCombate ? '⚔️ EN COMBATE' : 'INICIAR COMBATE'}
                    </button>

                    <button onClick={() => setMenuAbierto(false)} className="md:hidden text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto h-[calc(100vh-160px)] md:h-auto">
                    {jugadores.map((j, index) => {
                        const esMiPersonaje = j.usuario_id === usuarioActual?.id;
                        return (
                            <div key={j.id} className="relative">
                                {enCombate && turnoIndex === index && (
                                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-red-500 animate-bounce">
                                        <Sword size={16} />
                                    </div>
                                )}
                                {esMiPersonaje && (
                                    <span className="absolute right-2 top-2 z-10 text-[9px] bg-amber-900/80 text-amber-200 border border-amber-600/40 font-bold px-1.5 py-0.5 rounded">
                                        Tu Héroe
                                    </span>
                                )}
                                <PlayerCard jugador={j} />
                            </div>
                        );
                    })}
                </div>

                <div className="mt-8 pt-8 border-t border-slate-700 space-y-2">
                    {enCombate && (
                        <button
                            onClick={() => avanzarTurno()}
                            className="group relative flex items-center justify-center gap-2 bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white w-full py-2 rounded-lg font-bold tracking-widest uppercase text-[10px] shadow-lg transition-all hover:scale-105 mb-4"
                        >
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white animate-pulse"></span>
                            Finalizar Turno
                            <Sword size={14} className="group-hover:rotate-45 transition-transform" />
                        </button>
                    )}

                    <Link href="/parties" className="flex items-center gap-2 text-amber-300 hover:text-white transition-colors text-xs w-full py-1 font-semibold">
                        <Users size={14} /> Salón de Parties
                    </Link>

                    <button className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm w-full text-left">
                        <ScrollText size={16} /> Ver Log de Misión
                    </button>
                    <button
                        onClick={() => resetGame()}
                        className="flex items-center gap-2 text-red-900/50 hover:text-red-500 transition-colors text-xs w-full text-left uppercase font-bold"
                    >
                        Reiniciar Partida
                    </button>
                    <button onClick={() => router.push('/')} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm w-full py-2 justify-center md:justify-start mt-2">
                        <ArrowLeft size={16} /> Volver al Lobby
                    </button>
                </div>
            </aside>

            {/* OVERLAY MOBILE */}
            {menuAbierto && (
                <div
                    className="fixed inset-0 bg-black/50 z-[55] md:hidden backdrop-blur-sm"
                    onClick={() => setMenuAbierto(false)}
                />
            )}

            {/* CHAT AREA */}
            <section className="flex-1 flex flex-col h-full bg-pergamino relative pt-16 md:pt-0">
                <div className="hidden md:flex justify-between items-center px-4 py-2 bg-slate-900/90 text-white backdrop-blur-sm border-b border-slate-800 shadow-sm">
                    <h2 className="font-bold text-sm text-amber-200 flex items-center gap-2 font-serif">
                        <ScrollText className="w-4 h-4 text-amber-400" /> Crónicas de la Partida {id.slice(0, 4)}...
                    </h2>
                    <UserNav />
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 fade-edges font-adventure">
                    {/* Botón para iniciar aventura cuando el chat está vacío */}
                    {historial.length === 0 && !procesando && (
                        <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-6 space-y-4">
                            <div className="bg-stone-900/10 backdrop-blur-sm p-6 rounded-2xl border border-stone-800/20 max-w-md shadow-sm">
                                <Sparkles className="w-8 h-8 text-amber-800 mx-auto mb-2 animate-bounce" />
                                <h3 className="font-bold text-lg text-stone-900 mb-1">¡Compañía reunida!</h3>
                                <p className="text-stone-700 text-xs mb-4">
                                    Tu compañía está lista. El Dungeon Master puede abrir la escena inicial cuando quieras.
                                </p>
                                <button
                                    onClick={() => enviarMensajeTexto("¡Comencemos la aventura! Describe la escena inicial de dónde nos encontramos y qué desafío tenemos enfrente.")}
                                    className="px-5 py-2.5 bg-amber-800 hover:bg-amber-700 text-amber-50 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all hover:scale-105 flex items-center gap-2 mx-auto cursor-pointer"
                                >
                                    <Sword size={14} /> Comenzar Aventura
                                </button>
                            </div>
                        </div>
                    )}

                    {historial.map((m, i) => (
                        <MessageBubble key={i} message={m} />
                    ))}
                    {procesando && <LoadingDM />}
                    <div ref={messagesEndRef} />
                </div>

                {/* Aviso visible de error */}
                {errorAviso && (
                    <div className="mx-4 mb-2 p-3 bg-red-950/90 border border-red-500/60 rounded-xl text-red-200 text-xs flex justify-between items-center shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                            <span>{errorAviso}</span>
                        </div>
                        {ultimoMensajeRef.current && (
                            <button
                                onClick={() => enviarMensajeTexto(ultimoMensajeRef.current)}
                                className="ml-3 px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shrink-0 transition-colors"
                            >
                                <RotateCcw size={12} /> Reintentar
                            </button>
                        )}
                    </div>
                )}

                {/* Control de combate por turnos: indicador de turno */}
                {enCombate && personajeTurnoActivo && (
                    <div className="mx-4 mb-2 p-2 bg-amber-950/80 border border-amber-600/40 rounded-xl text-xs flex justify-between items-center text-amber-200">
                        <span className="flex items-center gap-1.5 font-semibold">
                            <Sword size={14} className="text-red-400 animate-pulse" />
                            Turno de acción: <strong className="text-white">{personajeTurnoActivo.nombre}</strong>
                            {personajeTurnoActivo.usuario_id === usuarioActual?.id ? ' (¡Te toca!)' : ''}
                        </span>
                        {!esMiTurno && (
                            <span className="text-[11px] text-amber-400/80 italic">Esperando su tirada o acción...</span>
                        )}
                    </div>
                )}

                {/* Input de Chat */}
                <div className="p-4 bg-white/10 backdrop-blur-md border-t border-black/10 flex flex-col gap-3 z-10">
                    {alguienIn && (
                        <p className="text-xs text-slate-500 animate-pulse font-bold ml-2">Alguien está escribiendo...</p>
                    )}
                    <ChatInput
                        input={inputUsuario}
                        setInput={setInputUsuario}
                        onSend={enviarMensaje}
                        loading={procesando}
                        onTyping={handleTyping}
                    />
                </div>
            </section>
        </main>
    );
}
