"use client";
import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserNav } from './components/UserNav';
import { DragonCorner } from './components/ui/DragonCorner';
import { BannerTitulo } from './components/ui/BannerTitulo';
import { VitralDM } from './components/ui/VitralDM';
import {
    UserPlus,
    Dices,
    Menu,
    Sword,
    ScrollText,
    Sparkles,
    Shield,
    Users
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
                hp_max: claseTmp === "Bárbaro" ? 14 : claseTmp === "Guerrero" ? 12 : 10,
                ca: claseTmp === "Paladín" || claseTmp === "Guerrero" ? 16 : 12,
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
        <main className="flex h-screen w-full bg-[#18110c] overflow-hidden relative">

            {/* SIDEBAR (Compañía) */}
            <aside className={`
                fixed inset-y-0 left-0 z-[60] w-80 bg-[#140c08] border-r-2 border-[#3d2716] p-4 transform transition-transform duration-300 ease-in-out flex flex-col
                md:relative md:translate-x-0 
                ${menuAbierto ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#3d2716]">
                    <div className="flex items-center gap-2 text-[#c8a45a]">
                        <UserPlus size={18} />
                        <h2 className="font-cinzel font-bold uppercase tracking-wider text-xs text-amber-100">Tu Compañía</h2>
                    </div>

                    <button
                        onClick={() => toggleCombate()}
                        className={`text-[10px] font-cinzel px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all border ${enCombate
                            ? 'bg-[#7b1f1f] text-[#fef08a] border-[#c8a45a] animate-pulse shadow-[0_0_12px_rgba(123,31,31,0.8)]'
                            : 'bg-[#241510] text-[#c8a45a] border-[#3d2716] hover:bg-[#3d2716]'
                            }`}
                    >
                        {enCombate ? '⚔️ Combate' : '⚔️ Iniciar'}
                    </button>
                </div>

                <div className="space-y-3.5 flex-1 overflow-y-auto pr-1">
                    {jugadores.length === 0 ? (
                        <div className="text-center py-8 font-garamond italic text-[#8a6a3e] text-sm">
                            No hay aventureros en la mesa todavía. Creá uno o elegilo de tu salón de héroes.
                        </div>
                    ) : (
                        jugadores.map((j, index) => (
                            <div key={j.id} className="relative">
                                {enCombate && turnoIndex === index && (
                                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-[#fef08a] animate-bounce z-20">
                                        <Sword size={18} />
                                    </div>
                                )}
                                <PlayerCard jugador={j} />
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-4 pt-4 border-t-2 border-[#3d2716] space-y-2 shrink-0">
                    {jugadores.length > 0 && !juegoIniciado && (
                        <button
                            onClick={iniciarNuevaPartida}
                            className="w-full bg-gradient-to-r from-[#7b1f1f] via-[#991b1b] to-[#7b1f1f] hover:brightness-110 text-[#fef08a] p-3 rounded-xl font-cinzel font-bold text-xs uppercase tracking-widest shadow-lg border border-[#c8a45a] transition-all active:scale-95 flex items-center justify-center gap-2 mb-2 cursor-pointer"
                        >
                            <Sword size={15} /> Iniciar Aventura ({jugadores.length} PJ)
                        </button>
                    )}

                    <Link
                        href="/parties"
                        className="flex items-center gap-2 text-xs font-cinzel font-semibold text-[#c8a45a] hover:text-[#fef08a] transition-colors w-full py-1"
                    >
                        <Users size={14} /> Salón de Parties Online
                    </Link>

                    <Link
                        href="/personajes"
                        className="flex items-center gap-2 text-xs font-cinzel text-stone-400 hover:text-amber-100 transition-colors w-full py-1"
                    >
                        <Shield size={14} /> Administrar Fichas
                    </Link>

                    <button
                        onClick={() => { resetGame(); setJuegoIniciado(false); setMenuAbierto(false); }}
                        className="flex items-center gap-2 text-[11px] font-cinzel uppercase text-red-400/60 hover:text-red-400 transition-colors w-full text-left py-1"
                    >
                        Vaciar Mesa
                    </button>
                </div>
            </aside>

            {menuAbierto && (
                <div
                    className="fixed inset-0 bg-black/70 z-[55] md:hidden backdrop-blur-sm"
                    onClick={() => setMenuAbierto(false)}
                />
            )}

            {/* SECCIÓN PRINCIPAL */}
            <section className="flex-1 flex flex-col h-full bg-[#18110c] relative overflow-hidden">
                {/* Cabecera común con UserNav */}
                <header className="p-3 md:px-6 bg-[#140c08] text-amber-100 flex justify-between items-center z-20 border-b-2 border-[#3d2716] shadow-sm">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setMenuAbierto(true)}
                            className="md:hidden text-[#c8a45a] hover:text-white"
                        >
                            <Menu size={22} />
                        </button>
                        <div className="flex items-center gap-2 font-cinzel font-bold text-base text-[#fef08a]">
                            <Dices className="w-5 h-5 text-[#c8a45a]" />
                            <span>Mesa Arcana</span>
                        </div>
                    </div>

                    <UserNav />
                </header>

                {!juegoIniciado ? (
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center">
                        <div className="w-full max-w-xl relative rounded-2xl border-2 border-[#8a6a3e] bg-pergamino-real p-6 md:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
                            <DragonCorner position="top-left" size={32} />
                            <DragonCorner position="top-right" size={32} />
                            <DragonCorner position="bottom-left" size={32} />
                            <DragonCorner position="bottom-right" size={32} />

                            <div className="text-center mb-6">
                                <div className="flex justify-center mb-2">
                                    <VitralDM pensando={false} className="scale-90" />
                                </div>
                                <BannerTitulo>
                                    Reunir a la Compañía
                                </BannerTitulo>
                                <p className="font-garamond italic text-[#5c3a21] text-sm mt-1">
                                    Alista a tus aventureros para sumergirte en las crónicas de D&D 5e narradas por la IA
                                </p>
                            </div>

                            {/* Selector rápido si tiene personajes guardados */}
                            {misPersonajes.length > 0 && (
                                <div className="mb-5 p-4 bg-[#e3d0ab]/50 border border-[#8a6a3e]/50 rounded-xl">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-cinzel font-bold text-[#7b1f1f] uppercase tracking-wider flex items-center gap-1.5">
                                            <Shield size={14} className="text-[#c8a45a]" /> Tus Héroes del Salón
                                        </span>
                                        <Link href="/personajes" className="text-[11px] font-cinzel text-[#8a6a3e] hover:text-[#7b1f1f] underline">
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
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold flex items-center gap-1.5 transition-all ${
                                                        yaEnMesa
                                                            ? 'bg-[#d8c5a2] text-[#8a6a3e] border border-[#8a6a3e]/30 cursor-not-allowed opacity-60'
                                                            : 'bg-[#fbf6ec] hover:bg-[#fff9ed] text-[#3d2716] border border-[#8a6a3e] shadow-xs active:scale-95 cursor-pointer'
                                                    }`}
                                                >
                                                    <span>{pj.nombre}</span>
                                                    <span className="text-[10px] text-[#7b1f1f]">({pj.clase})</span>
                                                    {yaEnMesa ? '✓' : '+'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Idioma */}
                            <div className="mb-4">
                                <label className="text-xs font-cinzel font-bold text-[#3d2716] uppercase tracking-wider block mb-1">
                                    Idioma de la Narración
                                </label>
                                <select
                                    value={idioma}
                                    onChange={(e) => setIdioma(e.target.value)}
                                    className="w-full p-2.5 border-2 border-[#8a6a3e] rounded-xl bg-[#fbf6ec] text-sm font-garamond text-[#241510] focus:outline-none focus:border-[#7b1f1f] shadow-inner"
                                >
                                    <option value="es">Español (Castellano)</option>
                                    <option value="en">English (Inglés)</option>
                                </select>
                            </div>

                            {/* Formulario nuevo héroe */}
                            <div className="grid grid-cols-1 gap-3 mb-6 bg-[#e3d0ab]/30 p-4 rounded-xl border border-[#8a6a3e]/30">
                                <div>
                                    <label className="text-xs font-cinzel font-bold text-[#3d2716] uppercase tracking-wider block mb-1">
                                        Nombre del Héroe
                                    </label>
                                    <input
                                        value={nombreTmp}
                                        onChange={(e) => setNombreTmp(e.target.value)}
                                        className="w-full p-2.5 border-2 border-[#8a6a3e] rounded-xl bg-[#fbf6ec] font-garamond text-base text-[#241510] focus:outline-none focus:border-[#7b1f1f] shadow-inner"
                                        placeholder="Ej: Thorin Escudo de Roble"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-cinzel font-bold text-[#3d2716] uppercase tracking-wider block mb-1">
                                            Raza
                                        </label>
                                        <select
                                            value={razaTmp}
                                            onChange={(e) => setRazaTmp(e.target.value)}
                                            className="w-full p-2.5 border-2 border-[#8a6a3e] rounded-xl bg-[#fbf6ec] text-sm font-garamond text-[#241510] focus:outline-none"
                                        >
                                            {razas.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-cinzel font-bold text-[#3d2716] uppercase tracking-wider block mb-1">
                                            Clase
                                        </label>
                                        <select
                                            value={claseTmp}
                                            onChange={(e) => setClaseTmp(e.target.value)}
                                            className="w-full p-2.5 border-2 border-[#8a6a3e] rounded-xl bg-[#fbf6ec] text-sm font-garamond text-[#241510] focus:outline-none"
                                        >
                                            {clases.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    onClick={agregarJugador}
                                    disabled={!nombreTmp.trim() || jugadores.length >= 5}
                                    className="bg-[#241510] hover:bg-[#3d2716] disabled:opacity-40 text-[#fef08a] p-3 rounded-xl transition-all font-cinzel font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 mt-2 cursor-pointer shadow-md border border-[#8a6a3e]"
                                >
                                    <UserPlus className="w-4 h-4 text-[#c8a45a]" /> Añadir a la Mesa ({jugadores.length}/5)
                                </button>
                            </div>

                            {jugadores.length > 0 && (
                                <div className="pt-2 text-center">
                                    <button
                                        onClick={iniciarNuevaPartida}
                                        className="w-full py-3.5 bg-gradient-to-r from-[#7b1f1f] via-[#991b1b] to-[#7b1f1f] hover:brightness-110 text-[#fef08a] font-cinzel font-bold rounded-xl text-sm uppercase tracking-widest shadow-xl border-2 border-[#c8a45a] transition-transform hover:scale-102 flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <Sparkles size={16} /> ¡Comenzar la Campaña! ({jugadores.length} PJ)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center px-6 py-2.5 bg-[#140c08] border-b-2 border-[#3d2716]">
                            <h2 className="font-cinzel font-bold text-sm text-[#fef08a] flex items-center gap-2">
                                <ScrollText className="w-4 h-4 text-[#c8a45a]" /> Crónicas de la Mesa Arcana
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-pergamino-real">
                            {historial.map((m, i) => (
                                <MessageBubble key={i} message={m} />
                            ))}
                            {cargando && <LoadingDM />}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 bg-[#e3d0ab]/40 border-t-2 border-[#8a6a3e]/60">
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
