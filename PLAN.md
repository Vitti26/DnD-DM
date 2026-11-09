# PLAN.md — Hoja de ruta de DnD-DM

Se ejecuta **una fase por vez**, en orden. Cada fase tiene criterios de aceptación; no pases a la siguiente hasta que el usuario los confirme. Reglas generales en `AGENTS.md`.

| Fase | Objetivo |
|---|---|
| 0 | Diagnóstico de por qué la IA no responde (sin tocar código) |
| 1 | Arreglar el chat con la IA |
| 2 | Login de usuarios (Supabase Auth) |
| 3 | Parties online con invitación |
| 4 | Estética de pergamino (hoja de personaje de D&D) |
| 5 | Limpieza, documentación y publicación |

---

## Fase 0 · Diagnóstico (no modifiques código)

Objetivo: saber cuál es la causa real antes de arreglar.

1. Verificá que `.env.local` tenga `GEMINI_API_KEY` (solo comprobá que existe; **no muestres su valor**).
2. Ejecutá `node list_models.js` y anotá qué modelos soporta `generateContent` con esa clave.
3. Pedile al usuario que abra la app, empiece una partida, envíe un mensaje y te cuente:
   - qué dice la pestaña **Network** del navegador en la llamada a `/api/chat` (código de estado y respuesta);
   - qué imprime la terminal donde corre `npm run dev` (el servidor loguea `DETALLE DEL ERROR:`);
   - si en la consola del navegador aparece `Error sending message:`.
4. Confirmá en Supabase (Database → Replication / Publications) que `partidas` está en la publicación `supabase_realtime`.
5. Informá un diagnóstico con la causa probable, usando la sección 5 de `AGENTS.md` como guía.

**Criterio de aceptación:** el usuario recibe un diagnóstico claro, con la causa confirmada o las causas posibles ordenadas por probabilidad.

---

## Fase 1 · Arreglar el chat con la IA

### 1.1 Servidor (`app/api/chat/route.js`)
- Modelo configurable: `process.env.GEMINI_MODEL`. Si no está definido, usar un valor por defecto vigente (verificarlo con el resultado de `list_models.js` y con https://ai.google.dev/gemini-api/docs/models y `/deprecations`).
- Pasar el prompt de sistema con **`systemInstruction`** en `getGenerativeModel`, no embebido en cada mensaje.
- Armar el historial correctamente: recibir `historial` **sin** el mensaje actual; mapear `dm → model`, `usuario → user`; descartar mensajes vacíos; **fusionar turnos consecutivos del mismo rol**; si el primer turno es `model`, anteponer un turno `user` sintético (por ejemplo "Comencemos la aventura.") porque Gemini exige empezar con `user`.
- Enviar el mensaje actual con `chat.sendMessage(mensaje)` **una sola vez**.
- Errores con códigos HTTP correctos y JSON consistente: `{ ok: true, texto }` o `{ ok: false, error }` (400 datos inválidos, 401/403 clave, 404 modelo, 429 cuota, 500 otros). No devolver un error como si fuera texto del DM. No incluir claves ni datos sensibles en el mensaje.
- Validar el cuerpo (que `mensaje` sea texto no vacío y con largo máximo razonable).

### 1.2 Cliente (`app/juego/[id]/page.js` y componentes)
- Chequear `response.ok`. Si falla, **mostrar un aviso visible** en la interfaz (burbuja o toast de error, con botón "Reintentar"), que **no** se guarde en el `historial` de la base.
- Mostrar la respuesta del DM **inmediatamente** en el estado local, sin depender de Realtime; después guardarla en la base. Realtime queda para sincronizar a los otros jugadores (y no debe duplicar mensajes).
- Mandar al servidor el historial **sin** el mensaje nuevo (`historial`, no `historialActualizado`).
- `procesando` siempre vuelve a `false` (ya hay un `finally`; verificá que no se rompa con los cambios) y agregar un tiempo máximo de espera (por ejemplo 60 s) con mensaje claro.
- No pisar `jugadores` completo al final: si solo cambió la vida, usar el RPC `update_player_hp`; actualizar `jugadores` completo solo si cambiaron otros campos (inventario, etc.).
- Agregar un botón **"Comenzar aventura"** (visible cuando el historial está vacío) que le pida a la IA abrir la escena inicial automáticamente, así la primera interacción no depende de que el usuario sepa qué escribir.

### 1.3 Opcional (solo con aprobación del usuario)
- El paquete `@google/generative-ai` es el SDK anterior de Google; la documentación oficial recomienda `@google/genai`. Antes de migrar, **leé la documentación actual** y proponé el cambio en un plan aparte.

### Criterios de aceptación
- [ ] `curl`/fetch a `/api/chat` devuelve `{ ok: true, texto }` con una clave válida.
- [ ] En la app, al enviar un mensaje, la respuesta del DM aparece en pantalla en pocos segundos, **incluso si Realtime está desactivado**.
- [ ] Con una clave inválida o un modelo inexistente, la interfaz muestra un error comprensible (no queda en silencio ni con el spinner infinito).
- [ ] El primer mensaje de una partida nueva funciona (historial vacío o que empieza con el DM).
- [ ] `npm run lint` y `npm run build` pasan.

---

## Fase 2 · Login de usuarios (Supabase Auth)

### 2.1 Base de datos (ampliación aditiva, ver reglas de `AGENTS.md`)
Archivo nuevo, por ejemplo `dnd_dm_auth_parties.sql`. Debe incluir, como mínimo:

| Tipo | Objetos sugeridos |
|---|---|
| Tablas | `perfiles` (id = `auth.users.id`, nombre de usuario, avatar), `personajes` (dueño, nombre, raza, clase, nivel, hp, hp_max, atributos y inventario en `jsonb`) |
| Trigger | Al crearse un usuario en `auth.users`, crear su fila en `perfiles` (función `security definer` con `search_path` fijo) |
| Funciones | Helpers para RLS, por ejemplo `fn_es_miembro(party_id)` |
| Vistas | `v_personajes_usuario` |
| RLS | Cada usuario solo ve y edita sus perfiles y personajes |

> Nota: este SQL es parte del material del parcial, así que conviene **probarlo contra un PostgreSQL real** antes de usarlo en Supabase. Si lo escribe el agente, que lo entregue sin ejecutarlo y explique cómo probarlo.

### 2.2 Aplicación
- Registro, inicio y cierre de sesión con **email y contraseña** (Google OAuth es opcional y se pide aparte).
- Páginas `/login` y `/registro`, con el mismo estilo del proyecto y mensajes de error claros en castellano.
- Escuchar la sesión con `supabase.auth.onAuthStateChange`; redirigir a `/login` si se intenta entrar a `/juego/*` sin sesión.
- Menú de usuario (nombre, cerrar sesión).
- Pantalla "Mis personajes": crear, editar y borrar personajes propios (reemplaza la creación temporal de `app/page.js`).
- Una vez que el login funcione, reemplazar la política pública de `partidas` por políticas por usuario/miembro (esto se coordina con la Fase 3).

### Criterios de aceptación
- [ ] Se puede registrar, iniciar y cerrar sesión.
- [ ] Al registrarse se crea el perfil automáticamente (trigger).
- [ ] Un usuario no puede ver los personajes de otro (probado con dos cuentas).
- [ ] Sin sesión, `/juego/*` redirige a `/login`.
- [ ] `npm run lint` y `npm run build` pasan; no hay claves en el código.

---

## Fase 3 · Parties online

### 3.1 Base de datos (misma ampliación o una nueva, aditiva)

| Tipo | Objetos sugeridos |
|---|---|
| Tablas | `parties` (nombre, `codigo_invitacion` único de 6 caracteres, dueño, `partida_id`, máximo de jugadores, estado), `party_miembros` (party, usuario, rol `owner`/`jugador`, personaje elegido, fecha de ingreso) |
| Triggers | Al crear una party, agregar al dueño como miembro; antes de insertar un miembro, validar el máximo de jugadores y que no esté repetido |
| Funciones RPC | `rpc_crear_party(nombre)`, `rpc_unirse_party(codigo)`, `rpc_salir_party(party_id)`, generador de códigos únicos |
| Vistas | `v_parties_usuario`, `v_miembros_party` |
| Procedimiento | `sp_limpiar_parties_inactivas(dias)` (se ejecuta con `CALL`) |
| RLS | Solo los miembros ven una party y su `partida` (chat e historial); solo el dueño la modifica o la elimina |

### 3.2 Aplicación
- Crear party → se genera un **código de invitación** (y un link) para compartir.
- Unirse con el código; lobby con la lista de miembros conectados (Realtime Presence con **nombres reales**, no números al azar).
- Cada miembro elige **uno de sus personajes** para esa party.
- El historial del chat guarda el **autor** de cada mensaje (usuario y personaje) y se muestra quién habló.
- Control de turnos en combate: solo el jugador al que le toca puede enviar su acción (el dueño puede saltar turnos).
- Realtime: todos los miembros ven los mensajes y los cambios de vida/turno al instante, sin duplicados.

### Criterios de aceptación
- [ ] Con dos cuentas en dos navegadores distintos: una crea la party, la otra se une con el código, y ambas ven el mismo chat en vivo.
- [ ] Un usuario que no es miembro no puede leer la party ni su historial (probado).
- [ ] Se respeta el máximo de jugadores.
- [ ] `npm run lint` y `npm run build` pasan.

---

## Fase 4 · Estética de pergamino (hoja de personaje de D&D)

**Referencia:** el usuario colocó la imagen en `docs/referencia-estetica.jpg`. Es una hoja de personaje de D&D ilustrada. **Usala solo como inspiración visual**: no la incluyas como recurso de la app (tiene derechos de autor). Recreá el estilo con CSS, SVG y fuentes libres.

### 4.1 Lenguaje visual que se observa en la referencia
- **Pergamino envejecido** de fondo, con manchas y bordes oscurecidos (viñeta).
- **Marcos ornamentados** oscuros con cadenas en el borde; **dragones** burdeos en las esquinas superiores.
- **Vitral central** con un dragón en violeta y burdeos, con una luna/sol dorado.
- **Banners en forma de pergamino enrollado** para los títulos de sección ("Saving Throws", "Skills", "Hit points"...).
- **Medallones circulares** para estadísticas (atributos, CA, iniciativa, velocidad).
- Casillas **circulares** tipo viñeta para habilidades y salvaciones.
- Tinta marrón oscuro sobre pergamino, con acentos burdeos, bronce y dorado.

### 4.2 Tokens de diseño (valores aproximados, ajustá a ojo contra la referencia)

```css
:root {
  --pergamino:        #e3d0ab;
  --pergamino-oscuro: #c9ae80;
  --pergamino-borde:  #8a6a3e;
  --tinta:            #3a2416;
  --tinta-suave:      #5b3d28;
  --cuero:            #241510;
  --borgona:          #7b1f1f;
  --borgona-oscuro:   #4a1212;
  --bronce:           #9c7a3c;
  --oro:              #c8a45a;
  --vitral-violeta:   #4b2a5e;
}
```

**Tipografías** (Google Fonts mediante `next/font/google`): títulos y banners con **Cinzel** (o Cinzel Decorative); texto de lectura del chat con **EB Garamond** o **IM Fell English**; opcional una fuente manuscrita para las notas de los jugadores.

### 4.3 Qué construir
- **Fondo y texturas sin imágenes externas:** pergamino con gradientes + ruido (filtro SVG `feTurbulence` en un data-URI) y viñeta oscura en los bordes.
- **Componentes reutilizables:** `Marco` (borde ornamentado con esquinas en SVG), `Banner` (título en cinta), `Medallon` (círculo con valor y etiqueta), `BotonCuero` (botón en relieve, bronce/burdeos), `CasillaCircular`, `EsquinaDragon` (SVG).
- **`PlayerCard` convertida en mini hoja de personaje:** nombre y nivel, medallones de **CA** y **PV**, barra de vida estilo tinta, clase/raza, condiciones como casillas circulares.
- **Mesa de juego en 3 zonas (escritorio):** izquierda la compañía (tarjetas), centro el chat como página de pergamino (mensajes del DM con letra capitular y tinta oscura; mensajes de jugadores como notas), derecha estado del combate/turnos. En móvil las zonas laterales se colapsan.
- **Vitral del DM:** cabecera o panel central con un vitral SVG (polígonos de color con un brillo suave) que sirve de "retrato" del DM IA, con una animación sutil mientras la IA piensa (reemplaza el `LoadingDM` actual).
- Aplicar el mismo estilo a **`/login`, `/registro`, lobby y party**. El panel `/dm` es opcional y va al final.

### 4.4 Calidad
- Contraste de texto **AA (≥ 4.5:1)**; el pergamino no debe volver ilegible el chat.
- Respetar `prefers-reduced-motion` (sin animaciones si el usuario lo pide) y mostrar foco visible (`:focus-visible`) en botones e inputs.
- Optimizar: no usar imágenes pesadas; SVG inline o CSS siempre que se pueda.

### Criterios de aceptación
- [ ] La mesa, el login y el lobby comparten un estilo coherente y reconocible respecto de la referencia.
- [ ] Textos legibles (contraste AA) en pergamino y en los marcos.
- [ ] Se ve bien en escritorio y en celular.
- [ ] No se incluyó la imagen de referencia en el build ni en `public/`.
- [ ] `npm run lint` y `npm run build` pasan.

---

## Fase 5 · Limpieza, documentación y publicación

- Mover o borrar los archivos de debug de la raíz (`api_error_log.txt`, `models.txt`, `models_list.txt`, `list_models.js`, `test_api_check.js`, `test_direct_api.js`, `repro_api.js`) y agregarlos al `.gitignore` si el usuario los quiere conservar localmente.
- Actualizar `README.md`: qué es el proyecto, cómo instalarlo, variables de entorno (sin valores), cómo ejecutar los scripts SQL, cómo probar el login y las parties.
- Documentar la base de datos en un archivo `docs/base-de-datos.md`: tablas, relaciones, vistas, funciones, procedimientos y triggers, con una breve explicación de cada uno (útil para el parcial).
- Publicación (por ejemplo en Vercel): cargar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY` y `GEMINI_MODEL` como variables de entorno del hosting y hacer redeploy.
- En Supabase: configurar en Authentication → URL Configuration las URLs del sitio publicado.

### Criterio de aceptación
- [ ] Un usuario nuevo puede clonar el repo, seguir el README y tener la app funcionando.

