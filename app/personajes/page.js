"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserNav } from '../components/UserNav';
import {
    Shield, Plus, Trash2, Heart, ShieldAlert, Sparkles, ArrowLeft,
    Dices, AlertCircle, X, Check
} from 'lucide-react';

const RAZAS_POPULARES = ['Humano', 'Elfo', 'Enano', 'Mediano', 'Tiefling', 'Dracónido', 'Gnomo', 'Semielfo', 'Semiorco'];
const CLASES_POPULARES = [
    { nombre: 'Guerrero', hpBase: 12, caBase: 14 },
    { nombre: 'Mago', hpBase: 8, caBase: 11 },
    { nombre: 'Pícaro', hpBase: 10, caBase: 13 },
    { nombre: 'Clérigo', hpBase: 11, caBase: 14 },
    { nombre: 'Bárbaro', hpBase: 14, caBase: 13 },
    { nombre: 'Bardo', hpBase: 10, caBase: 12 },
    { nombre: 'Paladín', hpBase: 12, caBase: 15 },
    { nombre: 'Druida', hpBase: 10, caBase: 12 },
    { nombre: 'Explorador', hpBase: 11, caBase: 13 },
    { nombre: 'Brujo', hpBase: 10, caBase: 12 },
];

export default function MisPersonajesPage() {
    const router = useRouter();
    const [sesion, setSesion] = useState(null);
    const [cargandoAuth, setCargandoAuth] = useState(true);
    const [personajes, setPersonajes] = useState([]);
    const [cargandoLista, setCargandoLista] = useState(true);
    const [modalCrear, setModalCrear] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);

    // Formulario de nuevo personaje
    const [nuevoNombre, setNuevoNombre] = useState('');
    const [nuevaRaza, setNuevaRaza] = useState('Humano');
    const [nuevaClase, setNuevaClase] = useState('Guerrero');
    const [nuevoNivel, setNuevoNivel] = useState(1);
    const [nuevoHp, setNuevoHp] = useState(12);
    const [nuevaCa, setNuevaCa] = useState(14);

    useEffect(() => {
        let mounted = true;

        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!mounted) return;

            if (!session?.user) {
                router.push('/login');
                return;
            }

            setSesion(session);
            setCargandoAuth(false);
            cargarPersonajes(session.user.id);
        };

        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session?.user) {
                router.push('/login');
            } else {
                setSesion(session);
                cargarPersonajes(session.user.id);
            }
        });

        return () => {
            mounted = false;
            subscription?.unsubscribe();
        };
    }, [router]);

    const cargarPersonajes = async (userId) => {
        setCargandoLista(true);
        try {
            const { data, error: errFetch } = await supabase
                .from('personajes')
                .select('*')
                .eq('usuario_id', userId)
                .order('created_at', { ascending: false });

            if (errFetch) throw errFetch;
            setPersonajes(data || []);
        } catch (err) {
            console.error('Error al cargar personajes:', err);
            setError('No pudimos cargar tus personajes.');
        } finally {
            setCargandoLista(false);
        }
    };

    const handleClaseChange = (claseNombre) => {
        setNuevaClase(claseNombre);
        const preset = CLASES_POPULARES.find(c => c.nombre === claseNombre);
        if (preset) {
            setNuevoHp(preset.hpBase);
            setNuevaCa(preset.caBase);
        }
    };

    const handleCrearPersonaje = async (e) => {
        e.preventDefault();
        if (!nuevoNombre.trim() || !sesion?.user?.id) return;

        setGuardando(true);
        setError(null);

        try {
            const nuevo = {
                usuario_id: sesion.user.id,
                nombre: nuevoNombre.trim(),
                raza: nuevaRaza,
                clase: nuevaClase,
                nivel: Number(nuevoNivel) || 1,
                hp_max: Number(nuevoHp) || 10,
                hp: Number(nuevoHp) || 10,
                ca: Number(nuevaCa) || 10,
                atributos: { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
                inventario: [],
                notas: ''
            };

            const { data, error: errInsert } = await supabase
                .from('personajes')
                .insert([nuevo])
                .select()
                .single();

            if (errInsert) throw errInsert;

            setPersonajes([data, ...personajes]);
            setModalCrear(false);
            setNuevoNombre('');
            setNuevoNivel(1);
        } catch (err) {
            console.error('Error al guardar personaje:', err);
            setError(err.message || 'Error al guardar el personaje.');
        } finally {
            setGuardando(false);
        }
    };

    const handleEliminarPersonaje = async (idPersonaje, nombre) => {
        if (!confirm(`¿Estás seguro de que querés eliminar a ${nombre}?`)) return;

        try {
            const { error: errDel } = await supabase
                .from('personajes')
                .delete()
                .eq('id', idPersonaje);

            if (errDel) throw errDel;
            setPersonajes(personajes.filter(p => p.id !== idPersonaje));
        } catch (err) {
            console.error('Error al eliminar personaje:', err);
            alert('No se pudo eliminar el personaje.');
        }
    };

    if (cargandoAuth) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
                Cargando tu salón de héroes...
            </div>
        );
    }

    return (
        <main className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 md:p-8 font-sans relative overflow-x-hidden">
            {/* Cabecera de navegación */}
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
                        <Shield className="text-amber-500 w-6 h-6" />
                        <h1 className="text-xl md:text-2xl font-bold font-serif text-white tracking-wide">
                            Mis Personajes
                        </h1>
                    </div>
                </div>

                <UserNav />
            </header>

            <div className="max-w-5xl mx-auto">
                {/* Banner de acción superior */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-900/30 rounded-2xl p-6 mb-8 shadow-xl">
                    <div>
                        <h2 className="text-lg font-bold text-white font-serif mb-1">
                            Tu Compañía Personal de Aventureros
                        </h2>
                        <p className="text-xs text-slate-400 max-w-xl">
                            Crea y mantén las fichas de tus personajes. Cuando comiences una nueva partida en la Mesa Arcana, vas a poder sumarlos directamente con un solo clic.
                        </p>
                    </div>
                    <button
                        onClick={() => setModalCrear(true)}
                        className="px-5 py-2.5 bg-amber-800 hover:bg-amber-700 active:bg-amber-900 text-amber-50 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                    >
                        <Plus size={16} /> Crear Personaje
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2">
                        <AlertCircle size={16} className="text-red-400 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Listado de personajes */}
                {cargandoLista ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-44 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : personajes.length === 0 ? (
                    <div className="text-center py-16 px-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                        <Dices size={48} className="mx-auto text-slate-600 mb-4" />
                        <h3 className="text-lg font-bold text-slate-300 font-serif mb-2">
                            Aún no creaste ningún personaje
                        </h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
                            Tu hoja de aventurero está en blanco. Creá a tu primer héroe (guerrero, mago, clérigo...) para llevarlo a explorar mazmorras.
                        </p>
                        <button
                            onClick={() => setModalCrear(true)}
                            className="px-6 py-2.5 bg-amber-800 hover:bg-amber-700 text-amber-50 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all inline-flex items-center gap-2 cursor-pointer"
                        >
                            <Sparkles size={14} /> Crear mi primer héroe
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {personajes.map((pj) => (
                            <div
                                key={pj.id}
                                className="bg-slate-900/90 border border-slate-800 hover:border-amber-900/50 rounded-2xl p-5 shadow-lg transition-all flex flex-col justify-between group"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-bold text-base text-white font-serif group-hover:text-amber-200 transition-colors">
                                                {pj.nombre}
                                            </h3>
                                            <span className="text-xs font-semibold text-amber-400/90">
                                                {pj.raza} {pj.clase} · Nivel {pj.nivel}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleEliminarPersonaje(pj.id, pj.nombre)}
                                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                            title="Eliminar personaje"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Stats destacadas */}
                                    <div className="grid grid-cols-2 gap-2 my-4 pt-3 border-t border-slate-800/80">
                                        <div className="flex items-center gap-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
                                            <Heart size={16} className="text-red-400" />
                                            <div>
                                                <div className="text-[10px] text-slate-400 uppercase font-semibold">Puntos de Vida</div>
                                                <div className="text-xs font-bold text-white">{pj.hp} / {pj.hp_max} PV</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
                                            <ShieldAlert size={16} className="text-blue-400" />
                                            <div>
                                                <div className="text-[10px] text-slate-400 uppercase font-semibold">Clase Armadura</div>
                                                <div className="text-xs font-bold text-white">{pj.ca} CA</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/50 flex justify-between items-center">
                                    <span>Creado el {new Date(pj.created_at).toLocaleDateString()}</span>
                                    <span className="text-emerald-400/80 font-semibold">● Disponible</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* MODAL CREAR PERSONAJE */}
            {modalCrear && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2">
                                <Sparkles className="text-amber-400 w-5 h-5" />
                                <h3 className="text-lg font-bold text-white font-serif">
                                    Crear Nuevo Aventurero
                                </h3>
                            </div>
                            <button
                                onClick={() => setModalCrear(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCrearPersonaje} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Nombre del Personaje
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={nuevoNombre}
                                    onChange={(e) => setNuevoNombre(e.target.value)}
                                    placeholder="Ej: Bruenor Battlehammer"
                                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Raza
                                    </label>
                                    <select
                                        value={nuevaRaza}
                                        onChange={(e) => setNuevaRaza(e.target.value)}
                                        className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                    >
                                        {RAZAS_POPULARES.map(r => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Clase (D&D 5e)
                                    </label>
                                    <select
                                        value={nuevaClase}
                                        onChange={(e) => handleClaseChange(e.target.value)}
                                        className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                    >
                                        {CLASES_POPULARES.map(c => (
                                            <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Nivel
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={nuevoNivel}
                                        onChange={(e) => setNuevoNivel(e.target.value)}
                                        className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                        PV Máximos
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={nuevoHp}
                                        onChange={(e) => setNuevoHp(e.target.value)}
                                        className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Armadura (CA)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={nuevaCa}
                                        onChange={(e) => setNuevaCa(e.target.value)}
                                        className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                    />
                                </div>
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
                                    disabled={guardando}
                                    className="px-5 py-2.5 bg-amber-800 hover:bg-amber-700 text-amber-50 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {guardando ? 'Forjando...' : (
                                        <>
                                            <Check size={14} /> Guardar Héroe
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}

