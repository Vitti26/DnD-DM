"use client";
import { useEffect, useState, useRef, use, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useGameStore } from '@/store/useGameStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Shared Components
import { MessageBubble } from '../../components/MessageBubble';
import { ChatInput } from '../../components/ChatInput';
import { LoadingDM } from '../../components/LoadingDM';
import { PlayerCard } from '../../components/PlayerCard';
import { UserNav } from '../../components/UserNav';
import { VitralDM } from '../../components/ui/VitralDM';

import {
    ScrollText, UserPlus, Menu, X, ArrowLeft, AlertTriangle, RotateCcw, Users, Shield
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

    const miPersonajeEnMesa = jugadores.find(j => j.usuario_id === usuarioActual?.id);
    const personajeTurnoActivo = jugadores[turnoIndex];
    const esMiTurno = !enCombate || !personajeTurnoActivo?.usuario_id || (personajeTurnoActivo?.usuario_id === usuarioActual?.id);

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

        addMensaje(nuevoMensajeUsuario);
        setInputUsuario("");
        setProcesando(true);

        const historialParaIA = [...historial];
        const historialConUsuario = [...historial, nuevoMensajeUsuario];

        const textoParaGemini = personajeNombre
            ? `${personajeNombre} (${autorNombre}) dice o realiza: ${textoLimpio}`
            : `${autorNombre} dice: ${textoLimpio}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        try {
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

            const nuevoMensajeDM = { rol: "dm", texto: aiText };
            addMensaje(nuevoMensajeDM);

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
                ? 'El Dungeon Master tardó demasiado en responder. Por favor reintentá.'
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
        <div className="h-screen w-full bg-[#18110c] flex flex-col items-center justify-center text-amber-100 gap-4">
            <VitralDM pensando={true} />
            <p className="font-cinzel text-sm tracking-widest uppercase text-[#c8a45a] animate-pulse">
                Cargando Mesa...
            </p>
        </div>
    );

    return (
        <main className="flex h-screen w-full bg-[#18110c] overflow-hidden relative">

            {/* HEADER MOBILE */}
            <header className="md:hidden absolute top-0 left-0 right-0 p-3 bg-[#1f140e]/95 text-amber-100 flex justify-between items-center z-50 border-b border-[#3d2716] shadow-md backdrop-blur-sm">
                <button onClick={() => setMenuAbierto(true)} className="p-1 hover:text-[#c8a45a]">
                    <Menu size={22} />
                </button>
                <div className="font-cinzel font-bold text-sm text-[#fef08a] tracking-wider">
                    Mesa Arcana
                </div>
                <span className="text-[10px] font-cinzel bg-[#3d2716] text-[#c8a45a] px-2 py-0.5 rounded-full border border-[#8a6a3e]/40">
                    {jugadores.length} PJ
                </span>
            </header>

            {/* SIDEBAR (Jugadores / Compañía) */}
            <aside className={`
                fixed inset-y-0 left-0 z-[60] w-80 bg-[#140c08] border-r-2 border-[#3d2716] p-4 transform transition-transform duration-300 ease-in-out flex flex-col
                md:relative md:translate-x-0 pt-16 md:pt-4 shadow-2xl
                ${menuAbierto ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#3d2716]">
                    <div className="flex items-center gap-2 text-[#c8a45a]">
                        <UserPlus size={18} />
                        <h2 className="font-cinzel font-bold uppercase tracking-wider text-xs text-amber-100">
                            Compañía <span className="text-[10px] text-emerald-400 ml-1">● {compañeros}</span>
                        </h2>
                    </div>

                    <button
                        onClick={() => toggleCombate()}
                        className={`text-[10px] font-cinzel px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all border ${enCombate
                            ? 'bg-[#7b1f1f] text-[#fef08a] border-[#c8a45a] shadow-[0_0_12px_rgba(123,31,31,0.8)]'
                            : 'bg-[#241510] text-[#c8a45a] border-[#3d2716] hover:bg-[#3d2716] hover:text-amber-100'
                            }`}
                    >
                        {enCombate ? 'Combate Activo' : 'Modo Combate'}
                    </button>

                    <button onClick={() => setMenuAbierto(false)} className="md:hidden text-[#c8a45a]">
                        <X size={20} />
                    </button>
                </div>

                {/* Lista de Fichas de Personajes */}
                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                    {jugadores.map((j, index) => {
                        const esMiPersonaje = j.usuario_id === usuarioActual?.id;
                        const esTurnoDeEste = enCombate && turnoIndex === index;
                        return (
                            <div key={j.id} className={`relative rounded-2xl transition-all ${esTurnoDeEste ? 'ring-2 ring-[#c8a45a] shadow-lg' : ''}`}>
                                {esMiPersonaje && (
                                    <span className="absolute right-3 top-2 z-20 text-[9px] font-cinzel font-bold bg-[#7b1f1f] text-[#fef08a] border border-[#c8a45a] px-2 py-0.5 rounded shadow">
                                        Tu Héroe
                                    </span>
                                )}
                                <PlayerCard jugador={j} />
                            </div>
                        );
                    })}
                </div>

                {/* Controles del Sidebar */}
                <div className="mt-4 pt-4 border-t-2 border-[#3d2716] space-y-2 shrink-0">
                    {enCombate && (
                        <button
                            onClick={() => avanzarTurno()}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#7b1f1f] via-[#991b1b] to-[#7b1f1f] border border-[#c8a45a] hover:brightness-110 text-[#fef08a] w-full py-2.5 rounded-lg font-cinzel font-bold tracking-widest uppercase text-[10px] shadow-lg transition-all mb-2 cursor-pointer"
                        >
                            Finalizar Turno
                        </button>
                    )}

                    <Link
                        href="/parties"
                        className="flex items-center gap-2 text-xs font-cinzel font-semibold text-[#c8a45a] hover:text-[#fef08a] transition-colors w-full py-1"
                    >
                        <Users size={14} /> Salón de Parties
                    </Link>

                    <Link
                        href="/personajes"
                        className="flex items-center gap-2 text-xs font-cinzel text-stone-400 hover:text-amber-100 transition-colors w-full py-1"
                    >
                        <Shield size={14} /> Mis Personajes
                    </Link>

                    <button
                        onClick={() => resetGame()}
                        className="flex items-center gap-2 text-[11px] font-cinzel uppercase text-red-400/60 hover:text-red-400 transition-colors w-full text-left py-1"
                    >
                        Reiniciar Partida
                    </button>

                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 text-xs font-cinzel text-stone-400 hover:text-white transition-colors w-full py-1.5 justify-center md:justify-start"
                    >
                        <ArrowLeft size={14} /> Salir al Salón
                    </button>
                </div>
            </aside>

            {/* OVERLAY MOBILE */}
            {menuAbierto && (
                <div
                    className="fixed inset-0 bg-black/70 z-[55] md:hidden backdrop-blur-sm"
                    onClick={() => setMenuAbierto(false)}
                />
            )}

            {/* CHAT AREA */}
            <section className="flex-1 flex flex-col h-full bg-[#18110c] relative pt-14 md:pt-0">
                {/* Cabecera superior sobria */}
                <div className="hidden md:flex justify-between items-center px-6 py-2.5 bg-[#140c08] text-amber-100 border-b-2 border-[#3d2716] shadow-md">
                    <div className="flex items-center gap-3">
                        <VitralDM pensando={procesando} className="scale-75 -my-2" />
                        <div>
                            <h2 className="font-cinzel font-bold text-sm text-[#fef08a] flex items-center gap-2">
                                <ScrollText className="w-4 h-4 text-[#c8a45a]" /> Crónicas de la Mesa Arcana
                            </h2>
                            <p className="text-[10px] font-garamond text-[#c8a45a]/80">
                                Partida #{id.slice(0, 8)}
                            </p>
                        </div>
                    </div>
                    <UserNav />
                </div>

                {/* Tablero de pergamino */}
                <div className="flex-1 relative overflow-hidden p-2 md:p-4 bg-[#18110c] flex flex-col">
                    <div className="flex-1 relative rounded-xl border-2 border-[#8a6a3e] bg-pergamino-real shadow-[inset_0_0_30px_rgba(61,39,22,0.4)] flex flex-col overflow-hidden">
                        {/* Mensajes del chat */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 fade-edges">
                            {/* Mensaje sutil si el chat está recién iniciado */}
                            {historial.length === 0 && !procesando && (
                                <div className="flex flex-col items-center justify-center min-h-[240px] text-center p-6 space-y-3">
                                    <p className="font-garamond italic text-[#5c3a21] text-base max-w-md">
                                        El pergamino está en blanco. Escribí tu primera acción o pregunta abajo para que el Dungeon Master comience la narración.
                                    </p>
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
                            <div className="mx-4 mb-2 p-3 bg-[#4a1212] border-2 border-red-500 rounded-xl text-red-100 text-xs flex justify-between items-center shadow-lg animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
                                    <span className="font-garamond">{errorAviso}</span>
                                </div>
                                {ultimoMensajeRef.current && (
                                    <button
                                        onClick={() => enviarMensajeTexto(ultimoMensajeRef.current)}
                                        className="ml-3 px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded-lg font-cinzel font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                                    >
                                        <RotateCcw size={12} /> Reintentar
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Banner de combate por turnos */}
                        {enCombate && personajeTurnoActivo && (
                            <div className="mx-4 mb-2 p-2.5 bg-[#241510] border-2 border-[#8a6a3e] rounded-xl text-xs flex justify-between items-center text-[#fef08a] shadow-md">
                                <span className="font-cinzel font-bold">
                                    Turno de acción: <span className="text-white underline decoration-[#c8a45a] underline-offset-2">{personajeTurnoActivo.nombre}</span>
                                    {personajeTurnoActivo.usuario_id === usuarioActual?.id ? ' (Es tu turno)' : ''}
                                </span>
                                {!esMiTurno && (
                                    <span className="text-[11px] font-garamond text-[#c8a45a] italic">
                                        Esperando su acción...
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Input de Chat */}
                        <div className="p-3 md:p-4 bg-[#e3d0ab]/40 border-t-2 border-[#8a6a3e]/60 flex flex-col gap-2 z-10">
                            {alguienIn && (
                                <p className="text-xs font-garamond italic text-[#7b1f1f] font-bold ml-2">
                                    Un compañero está escribiendo...
                                </p>
                            )}
                            <ChatInput
                                input={inputUsuario}
                                setInput={setInputUsuario}
                                onSend={enviarMensaje}
                                loading={procesando}
                                onTyping={handleTyping}
                            />
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
