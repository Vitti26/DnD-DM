import { create } from 'zustand';
import {
    reordenarConservandoTurno, siguienteTurno, turnoAnterior, aplicarDano, aplicarCuracion,
    aplicarHpTemp, parsearEntradaHp, tirarIniciativa, estaFuera,
} from '@/lib/combat';

const MAX_UNDO = 40;
const VACIO = {
    id: null, nombre: '', combatientes: [], enCombate: false, turnoIndex: 0, ronda: 1,
    encuentro: { nombre: '', notas: '' }, notasDm: '', registro: [],
};
const foto = (s) => ({ combatientes: s.combatientes, turnoIndex: s.turnoIndex, ronda: s.ronda, enCombate: s.enCombate });

// Estado del combate en memoria. La persistencia (Supabase/local) la hace la página con autosave:
// cada cambio incrementa `rev` y marca `sucio`.
export const useDmStore = create((set, get) => {
    const commit = (patch, { undo = true, log } = {}) =>
        set((s) => {
            const next = { ...patch };
            if (undo) next.undo = [...s.undo.slice(-(MAX_UNDO - 1)), foto(s)];
            if (log) next.registro = [...s.registro, { t: Date.now(), ronda: patch.ronda ?? s.ronda, texto: log }].slice(-200);
            return { ...next, sucio: true, rev: s.rev + 1 };
        });

    return {
        ...VACIO, undo: [], sucio: false, rev: 0, cargado: false,

        cargar: (datos) => set({ ...VACIO, ...datos, undo: [], sucio: false, rev: 0, cargado: true }),
        marcarGuardado: (rev) => { if (get().rev === rev) set({ sucio: false }); },
        instantanea: () => {
            const s = get();
            return {
                nombre: s.nombre, combatientes: s.combatientes, enCombate: s.enCombate, turnoIndex: s.turnoIndex,
                ronda: s.ronda, encuentro: s.encuentro, notasDm: s.notasDm, registro: s.registro,
            };
        },

        setNombre: (nombre) => commit({ nombre }, { undo: false }),
        setEncuentro: (p) => commit({ encuentro: { ...get().encuentro, ...p } }, { undo: false }),
        setNotasDm: (notasDm) => commit({ notasDm }, { undo: false }),

        agregar: (lista) => {
            const s = get();
            const r = reordenarConservandoTurno([...s.combatientes, ...lista], s.turnoIndex);
            const nombres = lista.map((c) => c.nombre).join(', ');
            commit(r, { log: `Añadido: ${nombres}` });
        },

        actualizar: (id, patch) => {
            const s = get();
            let lista = s.combatientes.map((c) => (c.id === id ? { ...c, ...patch } : c));
            let r = { combatientes: lista };
            if ('iniciativa' in patch || 'iniMod' in patch) r = reordenarConservandoTurno(lista, s.turnoIndex);
            commit(r);
        },

        quitar: (id) => {
            const s = get();
            const i = s.combatientes.findIndex((c) => c.id === id);
            if (i < 0) return;
            const lista = s.combatientes.filter((c) => c.id !== id);
            let turnoIndex = s.turnoIndex;
            if (i < turnoIndex) turnoIndex -= 1;
            if (turnoIndex >= lista.length) turnoIndex = 0;
            commit({ combatientes: lista, turnoIndex }, { log: `Eliminado: ${s.combatientes[i].nombre}` });
        },

        aplicarHp: (id, entrada) => {
            const s = get();
            const p = parsearEntradaHp(entrada);
            const c = s.combatientes.find((x) => x.id === id);
            if (!p || !c || p.cantidad === 0) return;
            const nuevo = p.tipo === 'dano' ? aplicarDano(c, p.cantidad) : p.tipo === 'cura' ? aplicarCuracion(c, p.cantidad) : aplicarHpTemp(c, p.cantidad);
            const verbo = p.tipo === 'dano' ? `recibe ${p.cantidad} de daño` : p.tipo === 'cura' ? `recupera ${p.cantidad} PV` : `gana ${p.cantidad} PV temporales`;
            const extra = p.tipo === 'dano' && nuevo.hp === 0 ? (c.esJugador ? ' — ¡cae inconsciente!' : ' — ¡derrotado!') : '';
            commit(
                { combatientes: s.combatientes.map((x) => (x.id === id ? nuevo : x)) },
                { log: `${c.nombre} ${verbo} (${nuevo.hp}/${nuevo.hpMax})${extra}` },
            );
        },

        toggleCondicion: (id, cond) => {
            const s = get();
            const c = s.combatientes.find((x) => x.id === id);
            if (!c) return;
            const tiene = c.condiciones.includes(cond);
            const condiciones = tiene ? c.condiciones.filter((x) => x !== cond) : [...c.condiciones, cond];
            commit(
                { combatientes: s.combatientes.map((x) => (x.id === id ? { ...x, condiciones } : x)) },
                { log: `${c.nombre} ${tiene ? 'ya no está' : 'queda'} ${cond.toLowerCase()}` },
            );
        },

        tirarUno: (id) => {
            const s = get();
            const lista = s.combatientes.map((c) => (c.id === id ? tirarIniciativa(c) : c));
            commit(reordenarConservandoTurno(lista, s.turnoIndex));
        },

        tirarMonstruos: () => {
            const s = get();
            const lista = s.combatientes.map((c) => (c.esJugador ? c : tirarIniciativa(c)));
            commit({ ...reordenarConservandoTurno(lista, s.turnoIndex) }, { log: 'Iniciativa de monstruos tirada' });
        },

        iniciarCombate: () => {
            const s = get();
            if (s.combatientes.length === 0) return;
            const r = reordenarConservandoTurno(s.combatientes, 0);
            const primero = r.combatientes.findIndex((c) => !estaFuera(c));
            commit({ ...r, turnoIndex: Math.max(0, primero), enCombate: true, ronda: 1 }, { log: '⚔️ Comienza el combate' });
        },

        terminarCombate: () => commit({ enCombate: false }, { log: `🏳️ Fin del combate (ronda ${get().ronda})` }),

        siguiente: () => {
            const s = get();
            if (!s.enCombate) return;
            const r = siguienteTurno(s);
            const c = s.combatientes[r.turnoIndex];
            commit(r, { log: r.ronda !== s.ronda ? `— Ronda ${r.ronda} —` : undefined, undo: true });
            return c;
        },

        anterior: () => {
            const s = get();
            if (!s.enCombate) return;
            commit(turnoAnterior(s));
        },

        limpiarDerrotados: () => {
            const s = get();
            const activoId = s.combatientes[s.turnoIndex]?.id;
            const lista = s.combatientes.filter((c) => !estaFuera(c));
            if (lista.length === s.combatientes.length) return;
            const idx = lista.findIndex((c) => c.id === activoId);
            commit({ combatientes: lista, turnoIndex: Math.max(0, idx) }, { log: 'Derrotados retirados de la lista' });
        },

        deshacer: () => {
            const s = get();
            const ultimo = s.undo[s.undo.length - 1];
            if (!ultimo) return;
            set({ ...ultimo, undo: s.undo.slice(0, -1), sucio: true, rev: s.rev + 1 });
        },
    };
});
