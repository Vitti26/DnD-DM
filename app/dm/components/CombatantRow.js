"use client";
import { useState } from 'react';
import { Shield, Dices, Trash2, ChevronDown, Skull, Minus, Plus, Swords } from 'lucide-react';
import { CONDICIONES, estaFuera } from '@/lib/combat';
import { useDmStore } from '@/store/useDmStore';
import { NumInput } from './NumInput';

export function CombatantRow({ c, activo, enCombate }) {
    const actualizar = useDmStore((s) => s.actualizar);
    const quitar = useDmStore((s) => s.quitar);
    const aplicarHp = useDmStore((s) => s.aplicarHp);
    const toggleCondicion = useDmStore((s) => s.toggleCondicion);
    const tirarUno = useDmStore((s) => s.tirarUno);

    const [abierto, setAbierto] = useState(false);
    const [texto, setTexto] = useState('');

    const fuera = estaFuera(c);
    const pct = Math.max(0, Math.min(100, (c.hp / c.hpMax) * 100));
    const color = c.hp <= 0 ? 'bg-slate-600' : pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500';

    const aplicar = (modo) => {
        let t = texto.trim();
        if (!t) return;
        if (/^\d+$/.test(t)) t = modo === 'cura' ? `+${t}` : t;
        aplicarHp(c.id, t);
        setTexto('');
    };

    return (
        <div className={`rounded-xl border transition-all ${activo && enCombate
            ? 'border-red-500 bg-red-950/30 shadow-[0_0_24px_rgba(239,68,68,0.25)]'
            : 'border-slate-700/80 bg-slate-800/60'} ${fuera ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3 p-3">
                {/* Indicador de turno + iniciativa */}
                <div className="flex flex-col items-center w-14 shrink-0">
                    {activo && enCombate
                        ? <Swords size={14} className="text-red-400 mb-0.5" />
                        : <span className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5">Ini</span>}
                    <NumInput value={c.iniciativa} onCommit={(n) => actualizar(c.id, { iniciativa: n })} className="w-14 py-1 text-lg font-bold text-white" title="Iniciativa" />
                </div>

                {/* Nombre + condiciones */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        {fuera && <Skull size={14} className="text-slate-400 shrink-0" />}
                        <span className={`font-bold truncate ${fuera ? 'line-through text-slate-400' : 'text-white'}`}>{c.nombre}</span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${c.esJugador ? 'bg-sky-500/20 text-sky-300' : 'bg-red-500/20 text-red-300'}`}>
                            {c.esJugador ? 'PJ' : 'Monstruo'}
                        </span>
                    </div>
                    {c.condiciones.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {c.condiciones.map((k) => (
                                <button key={k} onClick={() => toggleCondicion(c.id, k)} title="Quitar condición"
                                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-200 border border-violet-500/30 hover:bg-violet-500/40">
                                    {k}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* CA */}
                <div className="flex flex-col items-center w-12 shrink-0" title="Clase de armadura">
                    <Shield size={14} className="text-slate-400" />
                    <span className="font-mono font-bold text-white">{c.ca}</span>
                </div>

                {/* PV */}
                <div className="w-64 shrink-0">
                    <div className="flex justify-between items-baseline text-xs mb-1">
                        <span className="font-mono font-bold text-white text-sm">
                            {c.hp}<span className="text-slate-500"> / {c.hpMax}</span>
                            {c.hpTemp > 0 && <span className="ml-1.5 text-cyan-300 text-xs">+{c.hpTemp} temp</span>}
                        </span>
                        <span className="text-[9px] uppercase tracking-widest text-slate-500">PV</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-900 border border-slate-700 overflow-hidden">
                        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center gap-1 mt-1.5">
                        <button onClick={() => aplicar('dano')} title="Aplicar daño" className="p-1.5 rounded-md bg-red-600/80 hover:bg-red-500 text-white"><Minus size={14} /></button>
                        <input
                            value={texto}
                            onChange={(e) => setTexto(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') aplicar(e.shiftKey ? 'cura' : 'dano'); }}
                            placeholder="daño · +cura · t5"
                            inputMode="text"
                            className="flex-1 min-w-0 bg-slate-950/60 border border-slate-700 rounded-md px-2 py-1 text-sm font-mono outline-none focus:border-red-500 placeholder:text-slate-600"
                        />
                        <button onClick={() => aplicar('cura')} title="Curar" className="p-1.5 rounded-md bg-emerald-600/80 hover:bg-emerald-500 text-white"><Plus size={14} /></button>
                    </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => tirarUno(c.id)} title="Tirar iniciativa (d20 + mod)" className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700"><Dices size={16} /></button>
                    <button onClick={() => setAbierto(!abierto)} title="Detalles" className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700">
                        <ChevronDown size={16} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {abierto && (
                <div className="border-t border-slate-700/80 p-3 space-y-3 bg-slate-900/40 rounded-b-xl">
                    <div className="grid grid-cols-6 gap-3 items-end text-xs text-slate-400">
                        <label className="col-span-2">Nombre
                            <input defaultValue={c.nombre} key={c.nombre} onBlur={(e) => e.target.value.trim() && e.target.value !== c.nombre && actualizar(c.id, { nombre: e.target.value.trim() })}
                                className="mt-1 w-full bg-slate-950/60 border border-slate-700 rounded-md px-2 py-1 text-white outline-none focus:border-red-500" />
                        </label>
                        <label>PV actuales<NumInput value={c.hp} min={0} max={c.hpMax} onCommit={(n) => actualizar(c.id, { hp: n })} className="mt-1 w-full py-1 text-white" /></label>
                        <label>PV máx.<NumInput value={c.hpMax} min={1} onCommit={(n) => actualizar(c.id, { hpMax: n, hp: Math.min(c.hp, n) })} className="mt-1 w-full py-1 text-white" /></label>
                        <label>CA<NumInput value={c.ca} onCommit={(n) => actualizar(c.id, { ca: n })} className="mt-1 w-full py-1 text-white" /></label>
                        <label>Mod. ini<NumInput value={c.iniMod} onCommit={(n) => actualizar(c.id, { iniMod: n })} className="mt-1 w-full py-1 text-white" /></label>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 mb-1.5">Condiciones</p>
                        <div className="flex flex-wrap gap-1.5">
                            {CONDICIONES.map((k) => {
                                const on = c.condiciones.includes(k);
                                return (
                                    <button key={k} onClick={() => toggleCondicion(c.id, k)}
                                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${on ? 'bg-violet-500/30 border-violet-400/60 text-violet-100' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}>
                                        {k}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex gap-3 items-end">
                        <label className="flex-1 text-xs text-slate-400">Notas
                            <input defaultValue={c.notas} key={c.notas} onBlur={(e) => e.target.value !== c.notas && actualizar(c.id, { notas: e.target.value })}
                                placeholder="Resistencias, rasgos, botín…"
                                className="mt-1 w-full bg-slate-950/60 border border-slate-700 rounded-md px-2 py-1 text-white outline-none focus:border-red-500 placeholder:text-slate-600" />
                        </label>
                        <button onClick={() => actualizar(c.id, { esJugador: !c.esJugador })} className="text-xs px-2.5 py-1.5 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-700">
                            Marcar como {c.esJugador ? 'monstruo' : 'PJ'}
                        </button>
                        <button onClick={() => quitar(c.id)} className="text-xs px-2.5 py-1.5 rounded-md bg-red-900/40 text-red-300 hover:bg-red-700 hover:text-white flex items-center gap-1">
                            <Trash2 size={13} /> Quitar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
