// Verifica la conexión con Supabase usando las mismas variables que la app.
// Uso:  node --env-file=.env.local scripts/check-supabase.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ok = (m) => console.log(`✅ ${m}`);
const fail = (m, ayuda) => { console.log(`❌ ${m}${ayuda ? `\n   → ${ayuda}` : ''}`); process.exitCode = 1; };

if (!url || !key) {
  fail('Faltan variables de entorno.', 'Revisá que .env.local tenga NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url) && !/^https:\/\/[^/]+$/.test(url)) {
  fail(`La URL no tiene el formato esperado: ${url}`, 'Debe ser https://<ref>.supabase.co, sin barra final ni rutas, y NO la dirección del dashboard.');
  process.exit(1);
}
if (/service_role|sb_secret_/.test(key)) {
  fail('Esa clave parece ser secreta (service_role / sb_secret).', 'Usá la publishable key (sb_publishable_...) o la anon key. Nunca una clave secreta en NEXT_PUBLIC_*.');
  process.exit(1);
}
ok(`Variables presentes (URL: ${url}, clave: ${key.slice(0, 15)}…)`);

const supabase = createClient(url, key);

function explicar(error) {
  const m = `${error.message || ''} ${error.code || ''}`;
  if (/fetch failed|ENOTFOUND|Failed to fetch/i.test(m)) return 'No se pudo llegar al servidor: revisá la URL (¿project ref correcto?) y tu conexión.';
  if (/Invalid API key|JWT|apikey/i.test(m)) return 'La clave es inválida o está cortada: copiala de nuevo desde Connect.';
  if (/PGRST205|42P01|does not exist|schema cache/i.test(m)) return 'Falta una tabla o vista: ejecutá dnd_dm_database_limpio.sql en el SQL Editor de Supabase.';
  if (/42501|permission denied|row-level security/i.test(m)) return 'Permisos/RLS: volvé a ejecutar el script SQL completo (crea las políticas y los permisos).';
  return 'Error no reconocido: revisá el mensaje completo.';
}

async function contar(tabla, esperado) {
  const { count, error } = await supabase.from(tabla).select('*', { count: 'exact', head: true });
  if (error) return fail(`Lectura de "${tabla}" falló: ${error.message}`, explicar(error));
  if (esperado !== undefined && count !== esperado) return fail(`"${tabla}" tiene ${count} filas (se esperaban ${esperado}).`, 'Volvé a ejecutar el script SQL (carga los datos iniciales).');
  ok(`Lectura de "${tabla}" OK (${count} filas)`);
}

await contar('condiciones', 15);
await contar('plantillas_monstruo', 8);
await contar('v_catalogo', 23);

// Prueba de escritura completa (crear → leer → borrar → limpiar papelera)
const { data: creada, error: eIns } = await supabase
  .from('partidas')
  .insert([{ nombre_partida: 'zz-prueba-conexion', tipo: 'dm' }])
  .select('id')
  .single();
if (eIns) {
  fail(`No se pudo insertar en "partidas": ${eIns.message}`, explicar(eIns));
} else {
  ok('Escritura en "partidas" OK');
  const { error: eRpc } = await supabase.rpc('rpc_agregar_desde_plantilla', { p_partida: creada.id, p_plantilla: 'Goblin', p_cantidad: 2, p_tirar: true });
  if (eRpc) fail(`La función rpc_agregar_desde_plantilla falló: ${eRpc.message}`, explicar(eRpc));
  else {
    const { count } = await supabase.from('combatientes').select('*', { count: 'exact', head: true }).eq('partida_id', creada.id);
    count === 2 ? ok('Funciones RPC y triggers OK (2 goblins sincronizados en "combatientes")')
                : fail(`El trigger de sincronización no generó las filas esperadas (${count}).`, 'Volvé a ejecutar el script SQL completo.');
  }
  await supabase.from('partidas').delete().eq('id', creada.id);
  await supabase.from('partidas_papelera').delete().eq('id', creada.id);
  ok('Datos de prueba eliminados');
}

console.log(process.exitCode ? '\nHay problemas: revisá los ❌ de arriba.' : '\n🎉 Todo conectado correctamente.');

