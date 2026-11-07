// Lógica pura del combate (sin React ni Supabase) para poder testearla fácilmente.

export const CONDICIONES = [
    'Concentración', 'Cegado', 'Hechizado', 'Ensordecido', 'Asustado', 'Agarrado',
    'Incapacitado', 'Invisible', 'Paralizado', 'Petrificado', 'Envenenado',
    'Derribado', 'Apresado', 'Aturdido', 'Inconsciente',
];

export const PLANTILLAS = [
    { nombre: 'Goblin', hpMax: 7, ca: 15, iniMod: 2 },
    { nombre: 'Orco', hpMax: 15, ca: 13, iniMod: 1 },
    { nombre: 'Esqueleto', hpMax: 13, ca: 13, iniMod: 2 },
    { nombre: 'Zombi', hpMax: 22, ca: 8, iniMod: -2 },
    { nombre: 'Lobo', hpMax: 11, ca: 13, iniMod: 2 },
    { nombre: 'Bandido', hpMax: 11, ca: 12, iniMod: 1 },
    { nombre: 'Araña gigante', hpMax: 26, ca: 14, iniMod: 3 },
    { nombre: 'Ogro', hpMax: 59, ca: 11, iniMod: -1 },
];

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const d20 = () => Math.floor(Math.random() * 20) + 1;

const toInt = (v, fallback = 0) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
};

export function crearCombatiente(datos = {}) {
    const hpMax = Math.max(1, toInt(datos.hpMax, 10));
    return {
        id: datos.id || uid(),
        nombre: String(datos.nombre || 'Sin nombre').trim() || 'Sin nombre',
        esJugador: Boolean(datos.esJugador),
        iniciativa: toInt(datos.iniciativa, 0),
        iniMod: toInt(datos.iniMod, 0),
        ca: toInt(datos.ca, 10),
        hpMax,
        hp: Math.min(hpMax, Math.max(0, toInt(datos.hp, hpMax))),
        hpTemp: Math.max(0, toInt(datos.hpTemp, 0)),
        condiciones: Array.isArray(datos.condiciones) ? datos.condiciones : [],
        notas: datos.notas || '',
    };
}

// Orden estable: iniciativa desc, luego modificador desc, luego orden de inserción.
export function ordenar(lista) {
    return lista
        .map((c, i) => ({ c, i }))
        .sort((a, b) => b.c.iniciativa - a.c.iniciativa || b.c.iniMod - a.c.iniMod || a.i - b.i)
        .map((x) => x.c);
}

// Reordena sin perder de vista a quién le toca.
export function reordenarConservandoTurno(lista, turnoIndex) {
    const activoId = lista[turnoIndex]?.id;
    const nueva = ordenar(lista);
    const idx = activoId ? nueva.findIndex((c) => c.id === activoId) : 0;
    return { combatientes: nueva, turnoIndex: Math.max(0, idx) };
}

// Un monstruo a 0 PV está derrotado; un PJ a 0 PV sigue en la lista (tiradas de salvación de muerte).
export const estaFuera = (c) => c.hp <= 0 && !c.esJugador;

export function aplicarDano(c, cantidad) {
    const n = Math.max(0, toInt(cantidad, 0));
    const absorbido = Math.min(c.hpTemp, n); // los PV temporales se gastan primero
    return { ...c, hpTemp: c.hpTemp - absorbido, hp: Math.max(0, c.hp - (n - absorbido)) };
}

export function aplicarCuracion(c, cantidad) {
    return { ...c, hp: Math.min(c.hpMax, c.hp + Math.max(0, toInt(cantidad, 0))) };
}

// Los PV temporales no se acumulan: se queda el valor mayor.
export function aplicarHpTemp(c, cantidad) {
    return { ...c, hpTemp: Math.max(c.hpTemp, Math.max(0, toInt(cantidad, 0))) };
}

// "5" o "-5" => daño, "+5" => curación, "t5" => PV temporales.
export function parsearEntradaHp(texto) {
    const m = String(texto).trim().toLowerCase().match(/^([+\-t]?)\s*(\d+)$/);
    if (!m) return null;
    const cantidad = parseInt(m[2], 10);
    const tipo = m[1] === '+' ? 'cura' : m[1] === 't' ? 'temp' : 'dano';
    return { tipo, cantidad };
}

export function siguienteTurno({ combatientes, turnoIndex, ronda }) {
    const n = combatientes.length;
    let idx = turnoIndex;
    let r = ronda;
    for (let paso = 0; paso < n; paso++) {
        idx += 1;
        if (idx >= n) { idx = 0; r += 1; }
        if (!estaFuera(combatientes[idx])) return { turnoIndex: idx, ronda: r };
    }
    return { turnoIndex, ronda };
}

export function turnoAnterior({ combatientes, turnoIndex, ronda }) {
    const n = combatientes.length;
    let idx = turnoIndex;
    let r = ronda;
    for (let paso = 0; paso < n; paso++) {
        idx -= 1;
        if (idx < 0) { idx = n - 1; r = Math.max(1, r - 1); }
        if (!estaFuera(combatientes[idx])) return { turnoIndex: idx, ronda: r };
    }
    return { turnoIndex, ronda };
}

export function tirarIniciativa(c) {
    return { ...c, iniciativa: d20() + c.iniMod };
}

// "Goblin" x3 => "Goblin 1", "Goblin 2", "Goblin 3"
export function expandirGrupo(base, cantidad, tirar) {
    const n = Math.min(20, Math.max(1, toInt(cantidad, 1)));
    return Array.from({ length: n }, (_, i) => {
        const c = crearCombatiente({ ...base, nombre: n > 1 ? `${base.nombre} ${i + 1}` : base.nombre });
        return tirar ? tirarIniciativa(c) : c;
    });
}
