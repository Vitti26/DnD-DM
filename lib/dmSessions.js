// Persistencia de sesiones del panel del DM.
// - Con Supabase configurado: tabla `partidas` (tipo = 'dm').
// - Sin Supabase: localStorage (modo local, funciona offline).
// Además, cada guardado deja una copia de respaldo en localStorage.
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { uid } from '@/lib/combat';

export const hayNube = isSupabaseConfigured;

const LOCAL_KEY = 'dm-sessions-v1';
const BACKUP_KEY = (id) => `dm-backup-${id}`;

const leerLocal = () => {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { return {}; }
};
const escribirLocal = (obj) => localStorage.setItem(LOCAL_KEY, JSON.stringify(obj));

const VACIA = () => ({
    combatientes: [], enCombate: false, turnoIndex: 0, ronda: 1,
    encuentro: { nombre: '', notas: '' }, notasDm: '', registro: [],
});

const aFila = (d) => ({
    combatientes: d.combatientes,
    en_combate: d.enCombate,
    turno_index: d.turnoIndex,
    ronda: d.ronda,
    encuentro: d.encuentro,
    notas_dm: d.notasDm,
    registro: d.registro,
    actualizado_en: new Date().toISOString(),
});

const deFila = (f) => ({
    id: f.id,
    nombre: f.nombre_partida || 'Sesión sin nombre',
    combatientes: f.combatientes || [],
    enCombate: Boolean(f.en_combate),
    turnoIndex: f.turno_index || 0,
    ronda: f.ronda || 1,
    encuentro: f.encuentro || { nombre: '', notas: '' },
    notasDm: f.notas_dm || '',
    registro: f.registro || [],
    actualizadoEn: f.actualizado_en || f.created_at,
});

export async function listarSesiones() {
    if (!hayNube) {
        return Object.values(leerLocal())
            .map((s) => ({ ...s }))
            .sort((a, b) => (b.actualizadoEn || '').localeCompare(a.actualizadoEn || ''));
    }
    const { data, error } = await supabase
        .from('partidas')
        .select('id, nombre_partida, created_at, actualizado_en, en_combate, ronda, combatientes')
        .eq('tipo', 'dm')
        .order('actualizado_en', { ascending: false });
    if (error) throw error;
    return data.map(deFila);
}

export async function crearSesion(nombre, datos = {}) {
    const base = { ...VACIA(), ...datos };
    if (!hayNube) {
        const id = `local-${uid()}`;
        const todas = leerLocal();
        // id y nombre van al final para que una copia/importación nunca pise los del original.
        todas[id] = { ...base, id, nombre, actualizadoEn: new Date().toISOString() };
        escribirLocal(todas);
        return id;
    }
    const { data, error } = await supabase
        .from('partidas')
        .insert([{ nombre_partida: nombre, tipo: 'dm', ...aFila(base) }])
        .select('id')
        .single();
    if (error) throw error;
    return data.id;
}

export async function cargarSesion(id) {
    if (!hayNube) {
        const s = leerLocal()[id];
        if (!s) throw new Error('Sesión no encontrada');
        return { ...VACIA(), ...s };
    }
    const { data, error } = await supabase.from('partidas').select('*').eq('id', id).single();
    if (error || !data) {
        // Si la nube falla, intentamos recuperar la última copia local.
        try {
            const b = localStorage.getItem(BACKUP_KEY(id));
            if (b) return { ...VACIA(), ...JSON.parse(b), desdeRespaldo: true };
        } catch { /* sin respaldo */ }
        throw error || new Error('Sesión no encontrada');
    }
    return deFila(data);
}

export async function guardarSesion(id, datos) {
    try { localStorage.setItem(BACKUP_KEY(id), JSON.stringify(datos)); } catch { /* cuota llena */ }
    if (!hayNube) {
        const todas = leerLocal();
        if (!todas[id]) throw new Error('Sesión no encontrada');
        todas[id] = { ...todas[id], ...datos, nombre: datos.nombre ?? todas[id].nombre, actualizadoEn: new Date().toISOString() };
        escribirLocal(todas);
        return;
    }
    const { error } = await supabase
        .from('partidas')
        .update({ nombre_partida: datos.nombre, ...aFila(datos) })
        .eq('id', id);
    if (error) throw error;
}

export async function eliminarSesion(id) {
    try { localStorage.removeItem(BACKUP_KEY(id)); } catch { /* noop */ }
    if (!hayNube) {
        const todas = leerLocal();
        delete todas[id];
        escribirLocal(todas);
        return;
    }
    const { error } = await supabase.from('partidas').delete().eq('id', id);
    if (error) throw error;
}

export async function duplicarSesion(id) {
    const s = await cargarSesion(id);
    return crearSesion(`${s.nombre} (copia)`, s);
}

// ---------- Exportar / importar (copia de seguridad en archivo) ----------
export function exportarJson(datos) {
    const blob = new Blob([JSON.stringify({ app: 'dnd-dm', version: 1, ...datos }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(datos.nombre || 'sesion').replace(/[^\w\-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export async function importarJson(archivo) {
    const d = JSON.parse(await archivo.text());
    if (!Array.isArray(d.combatientes)) throw new Error('El archivo no parece una sesión del panel del DM.');
    return crearSesion(d.nombre || 'Sesión importada', d);
}
