"use client";
import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserNav } from './components/UserNav';
import {
    UserPlus,
    Dices,
    Menu,
    Sword,
    ScrollText,
    Sparkles,
    Shield
} from 'lucide-react';

import { PlayerCard } from './components/PlayerCard';
import { MessageBubble } from './components/MessageBubble';
import { LoadingDM } from './components/LoadingDM';
import { ChatInput } from './components/ChatInput';

export default function Home() {
    const {
        jugadores, setJugadores,
        idioma, setIdioma,
        historial, addMensaje,
        resetGame,
        enCombate, setEnCombate,
        turnoIndex, setTurnoIndex
    } = useGameStore();

    const [isClient, setIsClient] = useState(false);
    const [juegoIniciado, setJuegoIniciado] = useState(false);
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [misPersonajes, setMisPersonajes] = useState([]);

    const router = useRouter();

    const [nombreTmp, setNombreTmp] = useState("");
    const [razaTmp, setRazaTmp] = useState("Humano");
    const [claseTmp, setClaseTmp] = useState("Guerrero");

    const [inputUsuario, setInputUsuario] = useState("");
    const [cargando, setCargando] = useState(false);
    const messagesEndRef = useRef(null);

    const razas = ["Humano", "Elfo", "Enano", "Mediano", "Dracónido", "Gnomo", "Semielfo", "Semiorco", "Tiefling"];
    const clases = ["Guerrero", "Mago", "Clérigo", "Pícaro", "Bárbaro", "Bardo", "Druida", "Monje", "Paladín", "Explorador", "Hechicero", "Brujo"];

    useEffect(() => {
        setIsClient(true);
        if (historial?.length > 0) setJuegoIniciado(true);

        // Cargar personajes propios si hay sesión
        const cargarPersonajesGuardados = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data } = await supabase
                    .from('personajes')
                    .select('*')
                    .eq('usuario_id', session.user.id)
                    .order('created_at', { ascending: false });
                setMisPersonajes(data || []);
            }
        };

        cargarPersonajesGuardados();
    }, [historial]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [historial, cargando]);

    const iniciarNuevaPartida = async () => {
        try {
            const { data, error } = await supabase
                .from('partidas')
                .insert([
                    {
                        nombre_partida: `Aventura de ${jugadores[0]?.nombre || 'Héroes'}`,
                        jugadores: jugadores,
                        historial: [],
                        idioma: idioma
                    }
                ])
                .select();

            if (error) throw error;

            const partidaId = data[0].id;
            router.push(`/juego/${partidaId}`);

        } catch (error) {
            console.error("Error al crear la mesa:", error.message);
            alert("No se pudo crear la partida en la nube. Verifica tu conexión o claves de Supabase.");
        }
    };

    const agregarJugador = () => {
        if (jugadores.length < 5 && nombreTmp.trim() !== "") {
            const nuevo = {
                id: Date.now(),
                nombre: nombreTmp.trim(),
                raza: razaTmp,
                clase: claseTmp,
                hp: claseTmp === "Bárbaro" ? 14 : claseTmp === "Guerrero" ? 12 : 10,
                nivel: 1,
                inventario: ["Raciones (5 días)", "Odre de agua"]
            };
            setJugadores([...jugadores, nuevo]);
            setNombreTmp("");
        }
    };

    const agregarPersonajeGuardado = (pj) => {
        if (jugadores.length >= 5) return;
        if (jugadores.some(j => j.nombre === pj.nombre)) return;

        const nuevo = {
            id: Date.now(),
            nombre: pj.nombre,
            raza: pj.raza,
            clase: pj.clase,
            hp: pj.hp,
            hp_max: pj.hp_max,
            ca: pj.ca,
            nivel: pj.nivel,
            inventario: pj.inventario || ["Raciones (5 días)"]
        };
        setJugadores([...jugadores, nuevo]);
    };

    const enviarMensaje = async () => {
        if (!inputUsuario.trim() || cargando) return;

        const mensajeUser = { rol: "usuario", texto: inputUsuario };
        addMensaje(mensajeUser);
        setInputUsuario("");
        setCargando(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mensaje: inputUsuario,
                    jugadores: jugadores,
                    idioma: idioma,
                    historial: historial
                }),
            });

            const data = await response.json();
            let textoFinal = data.texto;

            const regex = /\[UPDATE\]([\s\S]*?)\[\/UPDATE\]/;
            const match = textoFinal.match(regex);

            if (match) {
                try {
                    const jsonUpdate = JSON.parse(match[1].trim());
                    if (jsonUpdate.jugadores) {
                        const nuevosJugadores = jugadores.map(jugadorOriginal => {
                            const cambios = jsonUpdate.jugadores.find(j => j.id === jugadorOriginal.id || j.nombre === jugadorOriginal.nombre);
                            return cambios ? { ...jugadorOriginal, ...cambios } : jugadorOriginal;
                        });
                        setJugadores(nuevosJugadores);
                    }
                    textoFinal = textoFinal.replace(regex, "").trim();
                } catch (e) {
                    console.error("Error parseando el update del DM", e);
                }
            }

            addMensaje({ rol: "dm", texto: textoFinal });

        } catch (error) {
            console.error("Error:", error);
            addMensaje({ rol: "dm", texto: "Hubo un error de conexión con el reino arcano." });
        } finally {
            setCargando(false);
        }
    };

    const toggleCombate = () => {
        setEnCombate(!enCombate);
        if (!enCombate) setTurnoIndex(0);
    };

    if (!isClient) return null;

    return (
        <main className="flex h-screen w-full bg-slate-900 overflow-hidden relative">

            {/* SIDEBAR (Compañía) */}
            <aside className={`
                fixed inset-y-0 left-0 z-[60] w-80 bg-slate-900 border-r border-slate-700 p-4 transform transition-transform duration-300 ease-in-out
                md:relative md:translate-x-0 
                ${menuAbierto ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2 text-slate-400">
                        <UserPlus size={20} />
                        <h2 className="font-bold uppercase tracking-widest text-sm text-white">Tu Compañía</h2>
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
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto h-[calc(100vh-280px)] md:h-auto">
                    {jugadores.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs italic">
                            No hay aventureros en la mesa todavía. Creá uno o elegilo de tu salón.
                        </div>
                    ) : (
                        jugadores.map((j, index) => (
                            <div key={j.id} className="relative">
                                {enCombate && turnoIndex === index && (
                                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-red-500 animate-bounce">
                                        <Sword size={16} />
                                    </div>
                                )}
                                <PlayerCard jugador={j} />
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-700 space-y-2">
                    {jugadores.length > 0 && !juegoIniciado && (
                        <button
                            onClick={iniciarNuevaPartida}
                            className="w-full bg-emerald-700 hover:bg-emerald-600 text-white p-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 mb-3 cursor-pointer"
                        >
                            <Sword size={16} /> Iniciar Aventura
                        </button>
                    )}

                    <Link href="/dm" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs w-full py-1.5">
                        <Sword size={14} /> Panel del DM
                    </Link>

                    <button
                        onClick={() => { resetGame(); setJuegoIniciado(false); setMenuAbierto(false); }}
                        className="flex items-center gap-2 text-red-400/70 hover:text-red-400 transition-colors text-xs w-full text-left font-semibold py-1.5"
                    >
                        Vaciar Mesa
                    </button>
                </div>
            </aside>

            {menuAbierto && (
                <div
                    className="fixed inset-0 bg-black/50 z-[55] md:hidden backdrop-blur-sm"
                    onClick={() => setMenuAbierto(false)}
                />
            )}

            {/* SECCIÓN PRINCIPAL */}
            <section className="flex-1 flex flex-col h-full bg-pergamino relative overflow-hidden">
                {/* Cabecera común con UserNav */}
                <header className="p-3 md:px-6 bg-slate-900/90 text-white flex justify-between items-center z-20 border-b border-slate-800 shadow-sm backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setMenuAbierto(true)}
                            className="md:hidden text-slate-300 hover:text-white"
                        >
                            <Menu size={22} />
                        </button>
                        <div className="flex items-center gap-2 font-bold text-base font-serif text-amber-200">
                            <Dices className="w-5 h-5 text-amber-400" />
                            <span>Mesa Arcana</span>
                        </div>
                    </div>

                    <UserNav />
                </header>

                {!juegoIniciado ? (
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center">
                        <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm p-6 md:p-8 rounded-2xl shadow-2xl border border-stone-300">
                            <h2 className="text-xl md:text-2xl font-bold mb-4 text-center text-stone-900 font-serif border-b border-stone-200 pb-3">
                                Reunir a la Compañía
                            </h2>

                            {/* Selector rápido si tiene personajes guardados */}
                            {misPersonajes.length > 0 && (
                                <div className="mb-6 p-4 bg-amber-50/80 border border-amber-200 rounded-xl">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <Shield size={14} /> Tus Héroes Guardados
                                        </span>
                                        <Link href="/personajes" className="text-[11px] text-amber-700 hover:underline">
                                            Administrar
                                        </Link>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {misPersonajes.map(pj => {
                                            const yaEnMesa = jugadores.some(j => j.nombre === pj.nombre);
                                            return (
                                                <button
                                                    key={pj.id}
                                                    disabled={yaEnMesa || jugadores.length >= 5}
                                                    onClick={() => agregarPersonajeGuardado(pj)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                                        yaEnMesa
                                                            ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                                                            : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 active:scale-95'
                                                    }`}
                                                >
                                                    <span>{pj.nombre}</span>
                                                    <span className="text-[10px] text-amber-700">({pj.clase})</span>
                                                    {yaEnMesa ? '✓' : '+'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Idioma */}
                            <div className="mb-4">
                                <label className="text-xs font-bold text-stone-600 uppercase tracking-wider">Idioma de la Narración</label>
                                <select
                                    value={idioma}
                                    onChange={(e) => setIdioma(e.target.value)}
                                    className="w-full p-2.5 border border-stone-300 rounded-xl bg-stone-50 mt-1 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                >
                                    <option value="es">Español (Castellano)</option>
                                    <option value="en">English</option>
                                </select>
                            </div>

                            {/* Formulario nuevo héroe */}
                            <div className="grid grid-cols-1 gap-3 mb-6">
                                <div>
                                    <label className="text-xs font-bold text-stone-600 uppercase tracking-wider">Nombre del Héroe</label>
                                    <input
                                        value={nombreTmp}
                                        onChange={(e) => setNombreTmp(e.target.value)}
                                        className="w-full p-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500/40 outline-none text-sm text-stone-900 mt-1"
                                        placeholder="Ej: Thorin Escudo de Roble"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-stone-600 uppercase tracking-wider">Raza</label>
                                        <select
                                            value={razaTmp}
                                            onChange={(e) => setRazaTmp(e.target.value)}
                                            className="w-full p-2.5 border border-stone-300 rounded-xl bg-stone-50 text-sm text-stone-800 mt-1"
                                        >
                                            {razas.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-stone-600 uppercase tracking-wider">Clase</label>
                                        <select
                                            value={claseTmp}
                                            onChange={(e) => setClaseTmp(e.target.value)}
                                            className="w-full p-2.5 border border-stone-300 rounded-xl bg-stone-50 text-sm text-stone-800 mt-1"
                                        >
                                            {clases.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    onClick={agregarJugador}
                                    disabled={!nombreTmp.trim() || jugadores.length >= 5}
                                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white p-3 rounded-xl transition-all font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 mt-2 cursor-pointer shadow-md"
                                >
                                    <UserPlus className="w-4 h-4" /> Añadir a la Mesa ({jugadores.length}/5)
                                </button>
                            </div>

                            {jugadores.length > 0 && (
                                <div className="pt-4 border-t border-stone-200 text-center">
                                    <button
                                        onClick={iniciarNuevaPartida}
                                        className="w-full py-3 bg-amber-800 hover:bg-amber-700 text-amber-50 font-bold rounded-xl text-sm uppercase tracking-wider shadow-lg transition-transform hover:scale-102 flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <Sparkles size={16} /> ¡Comenzar la Campaña! ({jugadores.length} PJ)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center px-4 py-2 bg-white/40 backdrop-blur-sm border-b border-stone-300">
                            <h2 className="font-bold text-lg text-stone-800 flex items-center gap-2">
                                <ScrollText className="w-4 h-4" /> Crónicas
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {historial.map((m, i) => (
                                <MessageBubble key={i} message={m} />
                            ))}
                            {cargando && <LoadingDM />}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 bg-white/40 backdrop-blur-md border-t border-black/10">
                            <ChatInput
                                input={inputUsuario}
                                setInput={setInputUsuario}
                                onSend={enviarMensaje}
                                loading={cargando}
                            />
                        </div>
                    </>
                )}
            </section>
        </main>
    );
}
