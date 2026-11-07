"use client";
import { useState } from 'react';
import { UserPlus, Dices } from 'lucide-react';
import { PLANTILLAS, crearCombatiente, expandirGrupo } from '@/lib/combat';
import { useDmStore } from '@/store/useDmStore';

const campo = 'mt-1 w-full bg-slate-950/60 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-white outline-none focus:border-red-500 placeholder:text-slate-600';

export function AddCombatantForm() {
    const agregar = useDmStore((s) => s.agregar);
    const [f, setF] = useState({ nombre: '', cantidad: 1, hpMax: 10, ca: 12, iniMod: 0, iniciativa: '', esJugador: false });
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

    const enviar = (e) => {
        e?.preventDefault();
        if (!f.nombre.trim()) return;
        const base = {
            nombre: f.nombre.trim(), hpMax: f.hpMax, ca: f.ca, iniMod: f.iniMod, esJugador: f.esJugador,
            iniciativa: f.iniciativa === '' ? 0 : f.iniciativa,
        };
        // Sin iniciativa escrita: los monstruos la tiran solos; los PJ se quedan en 0 para que se la dictes.
        const tirar = f.iniciativa === '' && !f.esJugador;
        agregar(f.esJugador ? [crearCombatiente(base)] : expandirGrupo(base, f.cantidad, tirar));
        setF({ ...f, nombre: '', iniciativa: '' });
        document.getElementById('add-nombre')?.focus();
    };

    const plantilla = (p) => setF({ ...f, ...p, esJugador: false, cantidad: 1 });

    return (
        <form onSubmit={enviar} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300"><UserPlus size={16} /> Añadir al combate</h3>

            <div className="flex flex-wrap gap-1.5">
                {PLANTILLAS.map((p) => (
                    <button type="button" key={p.nombre} onClick={() => plantilla(p)}
                        className="text-[11px] px-2 py-0.5 rounded-full border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white">
                        {p.nombre}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-6 gap-2 text-xs text-slate-400">
                <label className="col-span-4">Nombre
                    <input id="add-nombre" value={f.nombre} onChange={set('nombre')} placeholder="Goblin, Thorin…" className={campo} />
                </label>
                <label className="col-span-2">Cantidad
                    <input type="number" min={1} max={20} value={f.cantidad} onChange={set('cantidad')} disabled={f.esJugador} className={`${campo} disabled:opacity-40`} />
                </label>
                <label className="col-span-2">PV máx.<input type="number" min={1} value={f.hpMax} onChange={set('hpMax')} className={campo} /></label>
                <label className="col-span-2">CA<input type="number" value={f.ca} onChange={set('ca')} className={campo} /></label>
                <label className="col-span-2">Mod. ini<input type="number" value={f.iniMod} onChange={set('iniMod')} className={campo} /></label>
                <label className="col-span-3">Iniciativa
                    <input type="number" value={f.iniciativa} onChange={set('iniciativa')} placeholder={f.esJugador ? 'la dicta el jugador' : 'vacío = tirar d20'} className={campo} />
                </label>
                <div className="col-span-3 flex items-end">
                    <div className="flex w-full rounded-md overflow-hidden border border-slate-700">
                        {[['Monstruo', false], ['PJ', true]].map(([t, v]) => (
                            <button type="button" key={t} onClick={() => setF({ ...f, esJugador: v })}
                                className={`flex-1 py-1.5 text-xs font-bold ${f.esJugador === v ? (v ? 'bg-sky-600 text-white' : 'bg-red-600 text-white') : 'bg-slate-900 text-slate-400 hover:text-white'}`}>
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <button type="submit" className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-100 text-slate-900 font-bold text-sm hover:bg-white active:scale-[0.98] transition">
                <Dices size={16} /> Añadir {f.cantidad > 1 && !f.esJugador ? `×${f.cantidad}` : ''}
            </button>
        </form>
    );
}
