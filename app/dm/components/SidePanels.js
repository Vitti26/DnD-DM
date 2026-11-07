"use client";
import { ScrollText, Swords, Skull, Users, NotebookPen } from 'lucide-react';
import { useDmStore } from '@/store/useDmStore';
import { estaFuera } from '@/lib/combat';

const area = 'w-full bg-slate-950/60 border border-slate-700 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-red-500 placeholder:text-slate-600 resize-none';

export function EncounterPanel() {
    const encuentro = useDmStore((s) => s.encuentro);
    const setEncuentro = useDmStore((s) => s.setEncuentro);
    const lista = useDmStore((s) => s.combatientes);

    const monstruos = lista.filter((c) => !c.esJugador);
    const enPie = monstruos.filter((c) => !estaFuera(c));
    const pvEnemigos = enPie.reduce((a, c) => a + c.hp, 0);
    const pjs = lista.filter((c) => c.esJugador);

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300"><Swords size={16} /> Encuentro</h3>
            <input value={encuentro.nombre} onChange={(e) => setEncuentro({ nombre: e.target.value })} placeholder="Nombre del encuentro (Emboscada en el camino…)" className={area} />
            <textarea value={encuentro.notas} onChange={(e) => setEncuentro({ notas: e.target.value })} rows={3} placeholder="Terreno, objetivos, tácticas, botín…" className={area} />
            <div className="grid grid-cols-3 gap-2 text-center">
                <Stat icon={<Users size={14} />} label="PJs" valor={pjs.length} />
                <Stat icon={<Skull size={14} />} label="Enemigos" valor={`${enPie.length}/${monstruos.length}`} />
                <Stat icon={<Swords size={14} />} label="PV enemigos" valor={pvEnemigos} />
            </div>
        </div>
    );
}

const Stat = ({ icon, label, valor }) => (
    <div className="rounded-lg bg-slate-900/60 border border-slate-700 py-2">
        <div className="flex justify-center text-slate-400">{icon}</div>
        <div className="font-mono font-bold text-white text-lg leading-tight">{valor}</div>
        <div className="text-[9px] uppercase tracking-widest text-slate-500">{label}</div>
    </div>
);

export function NotasPanel() {
    const notasDm = useDmStore((s) => s.notasDm);
    const setNotasDm = useDmStore((s) => s.setNotasDm);
    return (
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300"><NotebookPen size={16} /> Notas del DM</h3>
            <textarea value={notasDm} onChange={(e) => setNotasDm(e.target.value)} rows={5} placeholder="Apuntes de la sesión, PNJs, ganchos…" className={area} />
        </div>
    );
}

export function RegistroPanel() {
    const registro = useDmStore((s) => s.registro);
    const recientes = [...registro].reverse().slice(0, 40);
    return (
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300"><ScrollText size={16} /> Registro</h3>
            {recientes.length === 0
                ? <p className="text-xs text-slate-500 italic">Aquí aparecerá cada golpe, curación y cambio de turno.</p>
                : <ul className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    {recientes.map((r, i) => (
                        <li key={`${r.t}-${i}`} className="text-xs text-slate-300 leading-snug">
                            <span className="text-slate-500 font-mono mr-1.5">R{r.ronda}</span>{r.texto}
                        </li>
                    ))}
                </ul>}
        </div>
    );
}
