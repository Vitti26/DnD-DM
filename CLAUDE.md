# DnD-DM

Instrucciones y contexto del repositorio para trabajar con asistentes de IA.

## Idioma y forma de trabajar

- Respondé siempre en **castellano rioplatense**, claro y sin jerga innecesaria. Quien trabaja acá está aprendiendo: explicá brevemente qué hacés y por qué en cada paso.
- Hacé **un paso a la vez** y confirmá el resultado antes de seguir.
- Si algo es ambiguo, preguntá una sola cosa concreta; no adivines.

## Qué es este proyecto

Aplicación web para Dungeon Masters de D&D. Tiene dos partes:

1. **Chat con DM de IA** (`/` y `/juego/[id]`): usa Gemini (`@google/generative-ai`, variable `GEMINI_API_KEY` en `app/api/chat/route.js`).
2. **Panel del DM** (`/dm` y `/dm/[id]`): tracker de combate (iniciativa, PV, CA, condiciones, turnos y rondas, notas del encuentro, registro). Se guarda solo (autosave).

**Stack:** Next.js 16 (App Router, archivos `.js`), React 19, Tailwind CSS v4, zustand 5, `@supabase/supabase-js` 2.x, lucide-react. La interfaz está en castellano.

## Archivos importantes

| Archivo | Para qué sirve |
|---|---|
| `lib/supabase.js` | Crea el cliente de Supabase y exporta `isSupabaseConfigured`. Sin variables de entorno la app NO se rompe: el panel `/dm` pasa a "modo local" (localStorage). |
| `lib/dmSessions.js` | Guardar/cargar/duplicar/eliminar/exportar/importar sesiones del panel (Supabase o local). |
| `lib/combat.js` | Lógica pura del combate (orden por iniciativa, daño, curación, turnos). |
| `store/useDmStore.js` | Estado del panel del DM (zustand). |
| `app/dm/page.js`, `app/dm/[id]/page.js`, `app/dm/components/*` | Pantallas y componentes del panel del DM. |
| `dnd_dm_database_limpio.sql` | **Script completo de la base de datos** (tablas, vistas, funciones, procedimientos y triggers). Ubicado en la raíz del repo. |
| `scripts/check-supabase.mjs` | Script de verificación automática de conexión, tablas, vistas, triggers y RPC. |

## Base de datos (Supabase)

- La tabla `partidas` es la fuente de verdad: una fila por sesión, con columnas `jsonb` (`combatientes`, `registro`, `encuentro`, `jugadores`, `historial`). `tipo = 'ia'` es el chat con IA y `tipo = 'dm'` es el panel.
- El script crea además: `condiciones`, `plantillas_monstruo`, `combatientes` y `combatiente_condiciones` (copia relacional de solo lectura, se llena sola por trigger), `partidas_papelera` (sesiones borradas, restaurables), 5 vistas (`v_*`), funciones `rpc_*` y procedimientos `sp_*`.
- Los **procedimientos `sp_*` no se llaman desde la app**: se ejecutan con `CALL` en el SQL Editor.
- La seguridad actual es una política pública (cualquiera con la clave publishable puede leer y escribir). Es intencional para uso personal. **No la cambies sin que el usuario lo pida.**

## Variables de entorno

Archivo `.env.local` en la raíz (ignorado por git mediante `.gitignore`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
GEMINI_API_KEY=AIzaSy...
```

- **El nombre `NEXT_PUBLIC_SUPABASE_ANON_KEY` no se cambia**, aunque el valor sea una *publishable key*. El código busca ese nombre.
- La URL **no es la dirección del dashboard**. Es `https://<project-ref>.supabase.co`, sin barra final ni rutas.
- Next.js solo lee las variables al arrancar: hay que reiniciar el servidor tras modificarlas.

## Reglas de seguridad (siempre)

- ❌ Nunca hagas `git add` ni `commit` de `.env*`, y nunca pongas claves en archivos versionados, en el código ni en mensajes de commit.
- ❌ Nunca uses ni pidas la clave `service_role` / `sb_secret_*` ni la contraseña de la base de datos.
- ❌ No desactives RLS ni cambies políticas, permisos o el contenido del `.sql` sin pedirlo explícitamente.
- ❌ No cambies los nombres de las variables de entorno.
- ❌ No hagas `git push`, `git reset --hard`, ni borres archivos sin preguntar.
- ❌ No toques el chat con IA (`app/juego`, `app/api/chat`, `store/useGameStore.js`) salvo que el usuario lo pida.
- ✅ Si dudás, preguntá antes de actuar.

## Comandos frecuentes

```bash
# Servidor de desarrollo
npm run dev

# Verificar conexión con Supabase
node --env-file=.env.local scripts/check-supabase.mjs

# Linter y build
npm run lint
npm run build
```

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| El panel dice **"Modo local"** | Variables no leídas | Archivo debe llamarse `.env.local`, estar en la raíz, y reiniciar el servidor |
| `Invalid API key` | Clave mal copiada, con espacios o cortada | Volver a copiarla desde el panel de Supabase |
| `fetch failed` / `Failed to fetch` | URL incorrecta o sin conexión | Debe ser `https://<ref>.supabase.co` y no `.supabase.com` ni dashboard |
| `PGRST205`, `42P01`, `does not exist` | No se ejecutó el script SQL | Ejecutar `dnd_dm_database_limpio.sql` en Supabase SQL Editor |
| `42501`, `permission denied` | Faltan permisos o políticas | Volver a ejecutar el script SQL completo |
