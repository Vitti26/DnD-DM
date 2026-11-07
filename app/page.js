"use client";
import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    UserPlus,
    Heart,
    Dices,
    RefreshCw,
    Menu,
    X,
    Sword,
    ScrollText
} from 'lucide-react';

// Importamos componentes compartidos
import { PlayerCard } from './components/PlayerCard';
import { MessageBubble } from './components/MessageBubble';
import { LoadingDM } from './components/LoadingDM';
import { ChatInput } from './components/ChatInput';

export default function Home() {
    // Traemos todo del Store (nuestro caché)
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

    // Router para navegación
    const router = useRouter();

    // Estados para el nuevo formulario
    const [nombreTmp, setNombreTmp] = useState("");
    const [razaTmp, setRazaTmp] = useState("Humano");
    const [claseTmp, setClaseTmp] = useState("Guerrero");

    // Estado del chat
    const [inputUsuario, setInputUsuario] = useState("");
    const [cargando, setCargando] = useState(false);

    // Ref para el scroll automático
    const messagesEndRef = useRef(null);

    // Listas de 5ta Edición
    const razas = ["Humano", "Elfo", "Enano", "Mediano", "Dracónido", "Gnomo", "Semielfo", "Semiorco", "Tiefling"];
    const clases = ["Guerrero", "Mago", "Clérigo", "Pícaro", "Bárbaro", "Bardo", "Druida", "Monje", "Paladín", "Explorador", "Hechicero", "Brujo"];

    useEffect(() => {
        setIsClient(true);
        if (historial?.length > 0) setJuegoIniciado(true);
    }, [historial]);

    // Scroll al fondo cuando cambia el historial
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [historial, cargando]);

    // Función para iniciar nueva partida en Supabase
    const iniciarNuevaPartida = async () => {
        try {
            // 1. Creamos la partida en Supabase con los jugadores que añadiste
            const { data, error } = await supabase
                .from('partidas')
                .insert([
                    {
                        nombre_partida: `Aventura de ${jugadores[0]?.nombre || 'Héroes'}`,
                        jugadores: jugadores, // Aquí van raza, clase, subclase, etc.
                        historial: [],
                        idioma: idioma
                    }
                ])
                .select();

            if (error) throw error;

            // 2. Si se creó, obtenemos el ID y mandamos al usuario a esa URL única
            const partidaId = data[0].id;
            router.push(`/juego/${partidaId}`);

        } catch (error) {
            console.error("Error al crear la mesa:", error.message);
            alert("No se pudo crear la partida en la nube. Verifica tu conexión o claves de Supabase.");
        }
    };

    // Función para agregar jugador (Máximo 5)
    const agregarJugador = () => {
        if (jugadores.length < 5 && nombreTmp !== "") {
            const nuevo = {
                id: Date.now(),
                nombre: nombreTmp,
                raza: razaTmp,
                clase: claseTmp,
                hp: claseTmp === "Bárbaro" ? 12 : 10,
                nivel: 1,
                inventario: ["Raciones (5 días)", "Odre de agua"]
            };
            setJugadores([...jugadores, nuevo]);
            setNombreTmp("");
        }
    };

    // Función: Enviar mensaje al DM
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

            // 1. Detectar si hay un bloque [UPDATE]
            const regex = /\[UPDATE\]([\s\S]*?)\[\/UPDATE\]/;
            const match = textoFinal.match(regex);

            if (match) {
                try {
                    const jsonUpdate = JSON.parse(match[1].trim());

                    // 2. Actualizar los jugadores en el Store
                    if (jsonUpdate.jugadores) {
                        const nuevosJugadores = jugadores.map(jugadorOriginal => {
                            const cambios = jsonUpdate.jugadores.find(j => j.id === jugadorOriginal.id || j.nombre === jugadorOriginal.nombre);
                            return cambios ? { ...jugadorOriginal, ...cambios } : jugadorOriginal;
                        });
                        setJugadores(nuevosJugadores);
                    }

                    // 3. Limpiar el texto para que el usuario no vea el JSON crudo
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

            {/* COLUMNA IZQUIERDA (Sidebar) */}
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

                    {/* --- ESTO ES LO NUEVO: EL INTERRUPTOR DE COMBATE --- */}
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

                <div className="space-y-4 flex-1 overflow-y-auto">
                    {jugadores.length === 0 && <p className="text-slate-600 text-sm italic">No hay héroes en la mesa aún...</p>}
                    {jugadores.map((j, index) => (
                        <div key={j.id} className="relative">
                            {/* Flecha de turno activo */}
                            {enCombate && turnoIndex === index && (
                                <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-red-500 animate-bounce">
                                    <Sword size={16} />
                                </div>
                            )}
                            <PlayerCard jugador={j} />
                        </div>
                    ))}
                </div>

                {/* Botón rápido de Inventario o Acciones (Visual) */}
                <div className="mt-8 pt-8 border-t border-slate-700 space-y-2">
                    {/* Botón Iniciar Aventura (Movido aquí) */}
                    {jugadores.length > 0 && !juegoIniciado && (
                        <button
                            onClick={iniciarNuevaPartida}
                            className="w-full bg-green-600 text-white p-3 rounded-lg font-bold text-sm hover:bg-green-700 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 mb-4"
                        >
                            <Sword size={16} /> Iniciar Aventura
                        </button>
                    )}

                    <Link href="/dm" className="flex items-center gap-2 text-red-300 hover:text-white transition-colors text-sm w-full font-semibold">
                        <Sword size={16} /> Panel del DM
                    </Link>

                    <button className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm w-full text-left">
                        <ScrollText size={16} /> Ver Log de Misión
                    </button>
                    <button
                        onClick={() => { resetGame(); setJuegoIniciado(false); setMenuAbierto(false); }}
                        className="flex items-center gap-2 text-red-900/50 hover:text-red-500 transition-colors text-xs w-full text-left uppercase font-bold"
                    >
                        Reiniciar Partida
                    </button>
                </div>
            </aside>

            {/* OVERLAY para cerrar el menú al tocar fuera (Móvil) */}
            {menuAbierto && (
                <div
                    className="fixed inset-0 bg-black/50 z-[55] md:hidden backdrop-blur-sm"
                    onClick={() => setMenuAbierto(false)}
                />
            )}

            {/* COLUMNA DERECHA: Área de Juego (Chat) */}
            <section className="flex-1 flex flex-col h-full bg-pergamino relative">

                {/* Cabecera Móvil (Solo visible en pantallas chicas) */}
                <header className="md:hidden p-4 bg-slate-800 text-white flex justify-between items-center z-20 shadow-md">
                    <button
                        onClick={() => setMenuAbierto(true)}
                        className="text-white hover:text-slate-300 transition-colors"
                    >
                        <Menu size={24} />
                    </button>
                    <h1 className="font-bold flex items-center gap-2 text-lg"><Dices className="w-5 h-5" /> D&D AI</h1>
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded-full font-mono">{jugadores.length} PJ</span>
                </header>

                {/* CONTENIDO PRINCIPAL: O Formulario de Creación O Chat */}
                {!juegoIniciado ? (
                    <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
                        <div className="w-full max-w-lg bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-2xl border border-slate-200">
                            <h2 className="text-2xl font-bold mb-6 text-center text-slate-800 border-b pb-2">Reunir a la Party</h2>

                            {/* Selector de Idioma */}
                            <div className="mb-4">
                                <label className="text-sm font-medium text-slate-500">Idioma del DM</label>
                                <select
                                    value={idioma}
                                    onChange={(e) => setIdioma(e.target.value)}
                                    className="w-full p-2 border rounded-md bg-slate-50 mt-1"
                                >
                                    <option value="es">Español</option>
                                    <option value="en">English</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 gap-4 mb-6">
                                <div>
                                    <label className="text-sm font-medium text-slate-500">Nombre del Héroe</label>
                                    <input
                                        value={nombreTmp}
                                        onChange={(e) => setNombreTmp(e.target.value)}
                                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
                                        placeholder="Ej: Thorin"
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-sm font-medium text-slate-500">Raza</label>
                                        <select value={razaTmp} onChange={(e) => setRazaTmp(e.target.value)} className="w-full p-2 border rounded-md bg-slate-50">
                                            {razas.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-sm font-medium text-slate-500">Clase</label>
                                        <select value={claseTmp} onChange={(e) => setClaseTmp(e.target.value)} className="w-full p-2 border rounded-md bg-slate-50">
                                            {clases.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    onClick={agregarJugador}
                                    className="bg-slate-800 text-white p-3 rounded-md hover:bg-slate-700 transition-all font-semibold flex items-center justify-center gap-2 mt-2"
                                >
                                    <UserPlus className="w-4 h-4" /> Añadir a la Mesa
                                </button>
                            </div>

                            {jugadores.length > 0 && (
                                <div className="mt-8 border-t pt-6">
                                    <p className="text-center text-sm text-slate-500 mb-4">¡Listos para la aventura!</p>
                                    <p className="text-center text-xs text-slate-400">("Iniciar Aventura" ahora está en el menú lateral)</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Cabecera de la Partida (Visible Desktop y Mobile) */}
                        <div className="flex justify-between items-center px-4 py-2 bg-white/40 backdrop-blur-sm border-b border-stone-300">
                            <h2 className="font-bold text-lg text-stone-800 flex items-center gap-2">
                                <ScrollText className="w-4 h-4" /> Crónicas
                            </h2>
                            <button
                                onClick={() => { resetGame(); setJuegoIniciado(false); }}
                                className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1 bg-white/50 px-2 py-1 rounded hover:bg-white transition-colors"
                            >
                                <RefreshCw className="w-3 h-3" /> Reiniciar todo
                            </button>
                        </div>

                        {/* Área de Chat con Fade Edges */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 fade-edges font-adventure">
                            {historial.map((m, i) => (
                                <MessageBubble key={i} message={m} />
                            ))}
                            {cargando && <LoadingDM />}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input fijo abajo */}
                        <div className="p-4 bg-white/10 backdrop-blur-md border-t border-black/10 z-10">
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