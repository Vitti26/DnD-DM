# AGENTS.md — DnD-DM ("Mesa Arcana")

Instrucciones permanentes para cualquier agente que trabaje en este repositorio. Leelas completas antes de modificar nada. El trabajo concreto está en `PLAN.md`.

## 1. Idioma y forma de trabajar

- Respondé siempre en **castellano rioplatense**, claro y sin jerga innecesaria. El usuario está aprendiendo: explicá brevemente qué hacés y por qué.
- Trabajá **una fase de `PLAN.md` a la vez**. Antes de modificar archivos, mostrá un plan corto y esperá la aprobación del usuario.
- Cambios chicos y revisables. Si algo es ambiguo, preguntá una sola cosa concreta; no adivines.
- Al terminar cada fase: resumí qué cambió, qué probaste y qué le toca hacer al usuario.

## 2. Visión del producto (leer bien)

Aplicación web donde **una IA hace de Dungeon Master** y narra una partida de D&D 5e para que **el usuario juegue online con sus amigos**, cada uno con su personaje (guerrero, mago, clérigo, etc.).

- El DM es la IA (Gemini). **No es** una herramienta para un DM humano.
- Objetivos de producto, en orden: (1) que el chat con la IA funcione bien, (2) login de usuarios, (3) parties online con invitación, (4) estética de pergamino fantástico.
- Interfaz en castellano.

## 3. Estado actual del código

**Stack:** Next.js 16 (App Router, archivos `.js`), React 19, Tailwind CSS v4, zustand 5, `@supabase/supabase-js` 2.x, `@google/generative-ai`, lucide-react.

| Ruta / archivo | Qué es |
|---|---|
| `app/page.js` | Home "Tu Compañía": crea hasta 5 personajes (nombre, raza, clase) y crea la partida en Supabase. |
| `app/juego/[id]/page.js` | Mesa de juego: chat con el DM de IA, tarjetas de personajes, modo combate con turnos, Realtime (presencia y cambios de `partidas`). |
| `app/api/chat/route.js` | Llama a Gemini. El prompt de sistema le pide a la IA un bloque `[UPDATE]{json}[/UPDATE]` cuando cambia el estado (vida, inventario, combate). |
| `app/components/*` | `PlayerCard`, `MessageBubble`, `ChatInput`, `LoadingDM`, `Icons`. |
| `store/useGameStore.js` | Estado del juego (zustand). |
| `lib/supabase.js` | Cliente de Supabase. Exporta `isSupabaseConfigured`. |
| `app/dm/*`, `lib/dmSessions.js`, `lib/combat.js`, `store/useDmStore.js` | **Panel secundario** (tracker de combate para un DM humano). No es parte de la visión actual: **no lo borres**; está relacionado con objetos de la base de datos que el usuario necesita. Podés ocultarlo del flujo principal. |
| `dnd_dm_database_limpio.sql` | Script completo de la base de datos (ver reglas de la sección 4). |

**Variables de entorno** (`.env.local`, ignorado por git):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key sb_publishable_...>   # el nombre de la variable NO se cambia
GEMINI_API_KEY=<clave de Google AI Studio>
GEMINI_MODEL=<nombre del modelo; ver PLAN.md, Fase 1>
```

## 4. Reglas de oro

### Base de datos (el usuario la usa para un parcial)
- 🔒 **No elimines ni simplifiques** ninguna vista, función, procedimiento almacenado ni trigger existente en `dnd_dm_database_limpio.sql`. Se evalúan en un parcial de base de datos.
- Toda ampliación de la base es **aditiva e idempotente** (`create ... if not exists`, `create or replace`, `drop ... if exists` solo de objetos propios). Debe poder ejecutarse más de una vez sin romper ni borrar datos.
- Cada objeto nuevo importante (vista, función, procedimiento, trigger) lleva un **comentario breve** explicando su propósito, escrito de forma neutra.
- Los procedimientos (`CREATE PROCEDURE`) se ejecutan con `CALL`; la app solo puede llamar **funciones** con `supabase.rpc`.
- Un archivo SQL por ampliación, en la raíz o en `db/`. No pegues SQL dentro de archivos de la app.
- No ejecutes SQL contra la base real: lo ejecuta el usuario en el SQL Editor de Supabase. Entregá el script y las instrucciones.

### Seguridad
- ❌ Nunca hagas commit de `.env*`, claves o contraseñas. Nunca imprimas el valor de una clave en logs, en el chat ni en archivos.
- ❌ Nunca uses la clave `service_role` / `sb_secret_*` ni la contraseña de la base de datos en el código de la app.
- La clave `GEMINI_API_KEY` solo se usa **en el servidor** (rutas `app/api/*`), jamás en componentes del navegador ni con prefijo `NEXT_PUBLIC_`.
- Al agregar login, las políticas RLS deben pasar de "acceso público" a acceso por usuario/miembro. No dejes tablas con datos de usuarios abiertas.

### Calidad y git
- Antes de dar una fase por terminada: `npm run lint` y `npm run build` sin errores.
- No instales dependencias nuevas sin explicar para qué y pedir confirmación.
- No hagas `git push`, `git reset --hard` ni borres archivos sin preguntar. Sugerí un commit por fase, con mensaje claro en castellano.
- No subas archivos de debug (logs, `models.txt`, etc.) al repo; ver limpieza en `PLAN.md`.

## 5. Problemas ya diagnosticados (no los redescubras)

El chat con la IA **no responde** al empezar la partida. Hallazgos del análisis del código:

1. **La respuesta del DM solo se muestra por Realtime.** En `enviarMensaje` (`app/juego/[id]/page.js`) la respuesta de la IA se guarda en la base con `update`, pero nunca se agrega al estado local. Solo aparece cuando llega el evento `postgres_changes`. Si Realtime no está activo para `partidas`, o falla la suscripción, el usuario ve el spinner terminar y **no aparece nada**.
2. **Errores silenciosos.** No se chequea `response.ok`; si la API devuelve error o HTML, el `catch` solo hace `console.error` y la UI no muestra nada.
3. **Modelo de Gemini.** El código usa `gemini-flash-latest`, fijo en `route.js`. El repo ya registra un 404 anterior por usar `gemini-1.5-flash-latest`. Los modelos de Gemini cambian seguido (hay retiros programados y reportes de 404 en modelos 2.5): **no hardcodear**; usar `GEMINI_MODEL` y verificar con `ListModels`.
4. **Historial mal armado.** El cliente manda el historial *ya incluyendo* el mensaje nuevo, y el servidor lo vuelve a enviar con `sendMessage`: el mensaje del usuario llega **duplicado** y con dos turnos `user` seguidos. Además, Gemini exige que el historial **empiece con rol `user`** y alterne roles.
5. **Prompt de sistema embebido** en cada mensaje del usuario en vez de usar `systemInstruction`.
6. **Escritura que pisa datos.** Al final de `enviarMensaje` se actualiza `jugadores` completo, lo que pisa cambios de otros jugadores simultáneos (la función `update_player_hp` existe justamente para evitarlo).
7. Archivos de debug en la raíz (`api_error_log.txt`, `models.txt`, `models_list.txt`, `list_models.js`, `test_api_check.js`, `test_direct_api.js`, `repro_api.js`): no son parte de la app.

## 6. Comandos útiles

```bash
npm install          # dependencias
npm run dev          # servidor local en http://localhost:3000
npm run lint         # eslint
npm run build        # compilar (debe pasar antes de cerrar una fase)
node list_models.js  # lista los modelos de Gemini disponibles para la clave (usa .env.local)
```

Reiniciá `npm run dev` cada vez que cambien las variables de `.env.local`.

## 7. Cómo usar `PLAN.md`

`PLAN.md` define las fases (0 a 5) con criterios de aceptación. El usuario te indicará cuál ejecutar. Hacé solo esa fase, verificá los criterios y detenete para que el usuario revise.

