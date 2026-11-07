"use client";
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Swords, Plus, Trash2, Copy, Download, Upload, Loader2, Cloud, HardDrive, ArrowLeft, FolderOpen } from 'lucide-react';
import {
    listarSesiones, crearSesion, eliminarSesion, duplicarSesion, cargarSesion,
    exportarJson, importarJson, hayNube,
} from '@/lib/dmSessions';

const fecha = (iso) => iso ? new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : '';

export default function SesionesDM() {
    const router = useRouter();
    const [sesiones, setSesiones] = useState(null);
    const [error, setError] = useState(null);
    const [nombre, setNombre] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const archivo = useRef(null);

    const refrescar = () => listarSesiones().then(setSesiones).catch((e) => { setError(e.message); setSesiones([]); });
    useEffect(() => { refrescar(); }, []);

    const accion = async (fn) => {
        setOcupado(true); setError(null);
        try { await fn(); } catch (e) { setError(e.message || 'Algo salió mal'); } finally { setOcupado(false); }
    };

    const crear = (e) => {
        e.preventDefault();
        accion(async () => {
            const id = await crearSesion(nombre.trim() || `Sesión ${new Date().toLocaleDateString('es')}`);
            router.push(`/dm/${id}`);
        });
    };

    const importar = (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) accion(async () => router.push(`/dm/${await importarJson(f)}`));
    };

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
                <header className="space-y-2">
                    <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"><ArrowLeft size={14} /> Chat con IA</Link>
                    <h1 className="text-3xl font-black flex items-center gap-3"><Swords className="text-red-500" /> Panel del DM</h1>
                    <p className="text-slate-400">Combate, iniciativa, vida y notas en un solo lugar. Todo se guarda solo.</p>
                    <p className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${hayNube ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                        {hayNube ? <><Cloud size={13} /> Guardando en Supabase</> : <><HardDrive size={13} /> Modo local: faltan NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY (se guarda en este navegador)</>}
                    </p>
                </header>

                <form onSubmit={crear} className="flex gap-2">
                    <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la nueva sesión (opcional)"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-red-500 placeholder:text-slate-600" />
                    <button disabled={ocupado} className="flex items-center gap-2 px-5 rounded-lg bg-red-600 hover:bg-red-500 font-bold disabled:opacity-50"><Plus size={18} /> Nueva sesión</button>
                    <button type="button" onClick={() => archivo.current?.click()} disabled={ocupado} className="flex items-center gap-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 font-semibold disabled:opacity-50" title="Importar un .json exportado"><Upload size={16} /> Importar</button>
                    <input ref={archivo} type="file" accept="application/json,.json" onChange={importar} className="hidden" />
                </form>

                {error && (
                    <div className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 text-sm px-4 py-3">
                        {error}
                        {hayNube && <p className="text-red-300/80 mt-1">¿Ejecutaste <code className="font-mono">supabase_dm_dashboard.sql</code> en el SQL Editor de Supabase?</p>}
                    </div>
                )}

                <section className="space-y-3">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2"><FolderOpen size={15} /> Sesiones guardadas</h2>
                    {sesiones === null ? (
                        <p className="text-slate-500 flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Cargando…</p>
                    ) : sesiones.length === 0 ? (
                        <p className="text-slate-500 italic">Todavía no tienes sesiones. Crea la primera arriba.</p>
                    ) : sesiones.map((s) => (
                        <div key={s.id} className="group flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 hover:border-slate-600 p-4 transition">
                            <Link href={`/dm/${s.id}`} className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg truncate">{s.nombre}</span>
                                    {s.enCombate && <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-red-600 text-white animate-pulse">En combate · R{s.ronda}</span>}
                                </div>
                                <div className="text-xs text-slate-500">{s.combatientes?.length ?? 0} combatientes · {fecha(s.actualizadoEn)}</div>
                            </Link>
                            <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition">
                                <Icono title="Exportar .json" onClick={() => accion(async () => exportarJson(await cargarSesion(s.id)))}><Download size={16} /></Icono>
                                <Icono title="Duplicar" onClick={() => accion(async () => { await duplicarSesion(s.id); await refrescar(); })}><Copy size={16} /></Icono>
                                <Icono title="Eliminar" peligro onClick={() => { if (confirm(`¿Eliminar "${s.nombre}"? No se puede deshacer.`)) accion(async () => { await eliminarSesion(s.id); await refrescar(); }); }}><Trash2 size={16} /></Icono>
                            </div>
                        </div>
                    ))}
                </section>
            </div>
        </main>
    );
}

const Icono = ({ children, onClick, title, peligro }) => (
    <button onClick={onClick} title={title} className={`p-2 rounded-lg ${peligro ? 'text-red-400 hover:bg-red-600 hover:text-white' : 'text-slate-300 hover:bg-slate-700'}`}>{children}</button>
);
