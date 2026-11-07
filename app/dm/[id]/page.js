"use client";
import { use, useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Swords, SkipForward, SkipBack, Undo2, Download, Dices, Eraser, Flag,
    Check, Loader2, CloudOff, Cloud, HardDrive, Keyboard,
} from 'lucide-react';
import { useDmStore } from '@/store/useDmStore';
import { cargarSesion, guardarSesion, exportarJson, hayNube } from '@/lib/dmSessions';
import { CombatantRow } from '../components/CombatantRow';
import { AddCombatantForm } from '../components/AddCombatantForm';
import { EncounterPanel, NotasPanel, RegistroPanel } from '../components/SidePanels';

const btn = 'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none';

export default function PanelDM({ params }) {
    const { id } = use(params);
    const router = useRouter();

    const cargado = useDmStore((s) => s.cargado);
    const nombre = useDmStore((s) => s.nombre);
    const combatientes = useDmStore((s) => s.combatientes);
    const enCombate = useDmStore((s) => s.enCombate);
    const turnoIndex = useDmStore((s) => s.turnoIndex);
    const ronda = useDmStore((s) => s.ronda);
    const puedeDeshacer = useDmStore((s) => s.undo.length > 0);
    const acc = useDmStore.getState; // acciones estables, se leen al usarlas

    const [error, setError] = useState(null);
    const [estado, setEstado] = useState('guardado'); // guardado | pendiente | guardando | error
    const [aviso, setAviso] = useState(null);
    const guardando = useRef(false);
    const timer = useRef(null);

    // ---------- Carga ----------
    useEffect(() => {
        let vivo = true;
        cargarSesion(id)
            .then((d) => {
                if (!vivo) return;
                useDmStore.getState().cargar({ ...d, id });
                if (d.desdeRespaldo) setAviso('No se pudo leer de Supabase: se cargó la última copia local de este navegador.');
            })
            .catch((e) => vivo && setError(e.message || 'No se pudo cargar la sesión'));
        return () => { vivo = false; };
    }, [id]);

    // ---------- Autosave con debounce ----------
    const guardar = useCallback(async () => {
        const s = useDmStore.getState();
        if (!s.cargado || !s.sucio || guardando.current) return;
        guardando.current = true;
        const rev = s.rev;
        setEstado('guardando');
        try {
            await guardarSesion(id, s.instantanea());
            s.marcarGuardado(rev);
            setEstado(useDmStore.getState().sucio ? 'pendiente' : 'guardado');
        } catch (e) {
            console.error('Error guardando', e);
            setEstado('error');
        } finally {
            guardando.current = false;
            // Si hubo cambios mientras guardábamos, volvemos a programar.
            if (useDmStore.getState().sucio) timer.current = setTimeout(guardar, 800);
        }
    }, [id]);

    useEffect(() => {
        const unsub = useDmStore.subscribe((s, prev) => {
            if (!s.cargado || s.rev === prev.rev) return;
            setEstado('pendiente');
            clearTimeout(timer.current);
            timer.current = setTimeout(guardar, 800);
        });
        const alSalir = (e) => { if (useDmStore.getState().sucio) { guardar(); e.preventDefault(); } };
        window.addEventListener('beforeunload', alSalir);
        return () => {
            unsub();
            clearTimeout(timer.current);
            window.removeEventListener('beforeunload', alSalir);
            if (useDmStore.getState().sucio) guardar(); // al salir de la página, guarda lo pendiente
        };
    }, [guardar]);

    // ---------- Atajos de teclado ----------
    useEffect(() => {
        const onKey = (e) => {
            const tag = e.target.tagName;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable) return;
            const s = useDmStore.getState();
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); s.deshacer(); return; }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === ' ' || e.key.toLowerCase() === 'n' || e.key === 'ArrowRight') { e.preventDefault(); s.siguiente(); }
            else if (e.key.toLowerCase() === 'p' || e.key === 'ArrowLeft') { e.preventDefault(); s.anterior(); }
            else if (e.key.toLowerCase() === 'a') { e.preventDefault(); document.getElementById('add-nombre')?.focus(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    if (error) return (
        <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4">
            <p className="text-red-300">{error}</p>
            <Link href="/dm" className="underline">Volver a mis sesiones</Link>
        </main>
    );
    if (!cargado) return (
        <main className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center gap-2"><Loader2 className="animate-spin" /> Cargando sesión…</main>
    );

    const activo = combatientes[turnoIndex];
    const hayMonstruos = combatientes.some((c) => !c.esJugador);

    return (
        <main className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden">
            {/* ---------- Barra superior ---------- */}
            <header className="flex items-center gap-4 px-5 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
                <button onClick={() => router.push('/dm')} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" title="Mis sesiones"><ArrowLeft size={18} /></button>
                <input
                    value={nombre}
                    onChange={(e) => acc().setNombre(e.target.value)}
                    className="bg-transparent text-xl font-bold outline-none border-b border-transparent focus:border-slate-600 min-w-0 flex-1 max-w-md"
                    aria-label="Nombre de la sesión"
                />
                <EstadoGuardado estado={estado} />
                <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => acc().deshacer()} disabled={!puedeDeshacer} className={`${btn} bg-slate-800 hover:bg-slate-700`} title="Deshacer (Ctrl+Z)"><Undo2 size={16} /> Deshacer</button>
                    <button onClick={() => exportarJson(acc().instantanea())} className={`${btn} bg-slate-800 hover:bg-slate-700`} title="Descargar copia .json"><Download size={16} /> Exportar</button>
                </div>
            </header>

            {aviso && <div className="bg-amber-500/15 text-amber-200 text-sm px-5 py-2 border-b border-amber-500/30">{aviso}</div>}

            <div className="flex-1 grid grid-cols-[minmax(0,1fr)_380px] min-h-0">
                {/* ---------- Tracker ---------- */}
                <section className="flex flex-col min-h-0 border-r border-slate-800">
                    <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-900/40">
                        <div className="flex items-center gap-4 mr-2">
                            <div className="text-center">
                                <div className="text-[10px] uppercase tracking-widest text-slate-500">Ronda</div>
                                <div className="text-4xl font-black font-mono leading-none">{enCombate ? ronda : '—'}</div>
                            </div>
                            <div className="min-w-40">
                                <div className="text-[10px] uppercase tracking-widest text-slate-500">{enCombate ? 'Turno de' : 'Estado'}</div>
                                <div className="text-xl font-bold truncate max-w-64">{enCombate ? (activo?.nombre ?? '—') : 'Sin combate'}</div>
                            </div>
                        </div>

                        {enCombate ? (
                            <>
                                <button onClick={() => acc().anterior()} className={`${btn} bg-slate-800 hover:bg-slate-700`} title="Turno anterior (P / ←)"><SkipBack size={16} /></button>
                                <button onClick={() => acc().siguiente()} className={`${btn} px-5 bg-gradient-to-r from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 shadow-lg shadow-red-900/40`} title="Siguiente turno (Espacio / N / →)">
                                    Siguiente turno <SkipForward size={16} />
                                </button>
                                <button onClick={() => acc().terminarCombate()} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200`}><Flag size={16} /> Terminar</button>
                            </>
                        ) : (
                            <button onClick={() => acc().iniciarCombate()} disabled={combatientes.length === 0} className={`${btn} px-5 bg-gradient-to-r from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 shadow-lg shadow-red-900/40`}>
                                <Swords size={16} /> Iniciar combate
                            </button>
                        )}

                        <div className="ml-auto flex items-center gap-2">
                            <button onClick={() => acc().tirarMonstruos()} disabled={!hayMonstruos} className={`${btn} bg-slate-800 hover:bg-slate-700`} title="Tira d20 + mod para todos los monstruos"><Dices size={16} /> Tirar monstruos</button>
                            <button onClick={() => acc().limpiarDerrotados()} className={`${btn} bg-slate-800 hover:bg-slate-700`} title="Quitar monstruos a 0 PV"><Eraser size={16} /> Limpiar derrotados</button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
                        {combatientes.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 gap-2">
                                <Swords size={40} className="opacity-40" />
                                <p className="font-semibold text-slate-300">Aún no hay nadie en el combate</p>
                                <p className="text-sm">Añade a tus PJs y monstruos desde el panel derecho (o pulsa <Kbd>A</Kbd>).</p>
                            </div>
                        ) : combatientes.map((c, i) => (
                            <CombatantRow key={c.id} c={c} activo={i === turnoIndex} enCombate={enCombate} />
                        ))}
                    </div>

                    <footer className="px-5 py-2 border-t border-slate-800 text-[11px] text-slate-500 flex items-center gap-4">
                        <Keyboard size={13} />
                        <span><Kbd>Espacio</Kbd> siguiente</span>
                        <span><Kbd>P</Kbd> anterior</span>
                        <span><Kbd>A</Kbd> añadir</span>
                        <span><Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> deshacer</span>
                        <span className="ml-auto">En PV: <Kbd>7</Kbd> daño · <Kbd>+7</Kbd> cura · <Kbd>t5</Kbd> temporales · <Kbd>⇧ Enter</Kbd> curar</span>
                    </footer>
                </section>

                {/* ---------- Panel lateral ---------- */}
                <aside className="overflow-y-auto p-4 space-y-4 bg-slate-900/30">
                    <AddCombatantForm />
                    <EncounterPanel />
                    <RegistroPanel />
                    <NotasPanel />
                </aside>
            </div>
        </main>
    );
}

const Kbd = ({ children }) => <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">{children}</kbd>;

function EstadoGuardado({ estado }) {
    const base = 'flex items-center gap-1.5 text-xs font-semibold';
    if (estado === 'guardando') return <span className={`${base} text-slate-400`}><Loader2 size={14} className="animate-spin" /> Guardando…</span>;
    if (estado === 'pendiente') return <span className={`${base} text-slate-400`}><Cloud size={14} /> Cambios sin guardar…</span>;
    if (estado === 'error') return <span className={`${base} text-red-400`} title="Se reintentará al hacer el siguiente cambio. Hay copia local en este navegador."><CloudOff size={14} /> Error al guardar</span>;
    return (
        <span className={`${base} text-emerald-400`}>
            <Check size={14} /> Guardado {hayNube ? <><Cloud size={13} className="opacity-60" /> Supabase</> : <><HardDrive size={13} className="opacity-60" /> local</>}
        </span>
    );
}
