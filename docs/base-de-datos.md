# Documentación de Base de Datos — Mesa Arcana (D&D 5e con IA)

Este documento detalla la arquitectura, el modelo relacional, las políticas de seguridad y la lógica programada (vistas, funciones RPC, procedimientos almacenados y triggers) implementada sobre **PostgreSQL en Supabase**.

---

## 1. Visión General del Modelo Relacional

El sistema está diseñado para dar soporte a partidas de rol online de **Dungeons & Dragons 5e** donde una IA (Gemini) actúa como Dungeon Master. Los usuarios interactúan en tiempo real mediante mensajería sincronizada, control de turnos y gestión de personajes.

### Entidades Principales:
1. **`auth.users` (Supabase Auth):** Registro y credenciales de usuario.
2. **`perfiles`:** Datos públicos del usuario (nombre de aventurero, avatar, biografía).
3. **`personajes`:** Fichas de aventureros creadas por los usuarios (atributos, raza, clase, PV, CA, inventario).
4. **`partidas`:** Estado vivo de una mesa de juego (historial de mensajes, array de jugadores en mesa, bandera de combate, índice de turno actual).
5. **`parties`:** Salas o lobbies de juego multijugador con código único de invitación (ej. `ARC4N4`).
6. **`party_miembros`:** Tabla asociativa que vincula usuarios y sus personajes elegidos dentro de una party.
7. **`dm_sessions` & `combat_monsters`:** Soporte secundario para seguimiento de combates y estadísticas de monstruos.

---

## 2. Diccionario de Tablas

### 2.1 `perfiles`
Extensión del perfil del usuario autenticado en `auth.users`.
- `id` (`UUID`, PK): Referencia a `auth.users(id)` con `ON DELETE CASCADE`.
- `nombre_usuario` (`TEXT`, UNIQUE, NOT NULL): Nombre de aventurero visible por el resto de la compañía.
- `avatar_url` (`TEXT`): URL opcional de imagen o blasón.
- `biografia` (`TEXT`): Descripción breve del jugador.
- `created_at` / `updated_at` (`TIMESTAMPTZ`): Auditoría temporal.

### 2.2 `personajes`
Almacena las fichas permanentes de D&D 5e de cada usuario.
- `id` (`BIGINT` / `UUID`, PK): Identificador único de la ficha.
- `usuario_id` (`UUID`, FK): Propietario de la ficha (`auth.users.id`).
- `nombre` (`TEXT`, NOT NULL): Nombre del personaje.
- `raza` (`TEXT`, NOT NULL): Humano, Elfo, Enano, etc.
- `clase` (`TEXT`, NOT NULL): Guerrero, Mago, Clérigo, etc.
- `nivel` (`INT`, Default 1): Nivel del héroe (1-20).
- `hp` / `hp_max` (`INT`): Puntos de vida actuales y máximos.
- `ca` (`INT`): Clase de Armadura (CA).
- `fuerza`, `destreza`, `constitucion`, `inteligencia`, `sabiduria`, `carisma` (`INT`): Atributos D&D (1-20).
- `inventario` (`JSONB`): Array de objetos, armas y raciones.
- `created_at` (`TIMESTAMPTZ`): Fecha de creación.

### 2.3 `partidas`
Representa el estado activo de una mesa de juego.
- `id` (`UUID`, PK): Identificador único de la partida.
- `nombre_partida` (`TEXT`): Título de la crónica.
- `historial` (`JSONB`, NOT NULL): Array de mensajes secuenciales intercambiados con el DM (`rol`, `texto`, `autor`, `personaje`, `timestamp`).
- `jugadores` (`JSONB`, NOT NULL): Snapshot de los personajes en la mesa (PV, inventario, CA, estado).
- `en_combate` (`BOOLEAN`, Default `false`): Bandera indicadora de modo combate activo.
- `turno_index` (`INT`, Default 0): Índice del personaje al que le corresponde actuar.
- `idioma` (`VARCHAR(5)`, Default `'es'`): Idioma de la narración (`'es'` o `'en'`).
- `creado_en` / `actualizado_en` (`TIMESTAMPTZ`): Marcas de tiempo sincronizadas con Realtime.

### 2.4 `parties`
Lobbies multijugador con invitación para jugar en compañía.
- `id` (`UUID`, PK): Identificador de la party.
- `codigo_invitacion` (`VARCHAR(6)`, UNIQUE, NOT NULL): Código de 6 caracteres alfanuméricos en mayúsculas (ej. `K9X2B7`).
- `nombre` (`TEXT`, NOT NULL): Nombre del grupo de aventureros.
- `owner_id` (`UUID`, FK): Dueño o anfitrión de la party (`auth.users.id`).
- `partida_id` (`UUID`, FK): Referencia a `partidas(id)`.
- `max_jugadores` (`INT`, Default 5): Límite máximo de aventureros permitidos.
- `estado` (`VARCHAR(20)`, Default `'lobby'`): Estados posibles: `'lobby'`, `'en_juego'`, `'finalizada'`.
- `created_at` / `updated_at` (`TIMESTAMPTZ`).

### 2.5 `party_miembros`
Relación N:M entre usuarios y parties, con asignación de rol y ficha de personaje.
- `id` (`UUID`, PK): Identificador de la membresía.
- `party_id` (`UUID`, FK): Referencia a `parties(id)` con `ON DELETE CASCADE`.
- `usuario_id` (`UUID`, FK): Referencia a `auth.users(id)` con `ON DELETE CASCADE`.
- `rol` (`VARCHAR(20)`, Default `'jugador'`): Rol en la sala (`'owner'` o `'jugador'`).
- `personaje_id` (`BIGINT`, FK, Opcional): Referencia a `personajes(id)`.
- `unido_en` (`TIMESTAMPTZ`, Default `now()`).
- Restricción: `UNIQUE(party_id, usuario_id)` (un jugador solo puede estar una vez en la misma party).

---

## 3. Vistas (`VIEWS`)

Las vistas abstraen consultas complejas y facilitan la lectura con seguridad RLS:

### 3.1 `v_parties_usuario`
Muestra todas las parties en las que el usuario actual es miembro o dueño, incluyendo la cantidad de jugadores conectados y el rol.
```sql
create or replace view public.v_parties_usuario as
select 
    p.id,
    p.codigo_invitacion,
    p.nombre,
    p.owner_id,
    p.partida_id,
    p.max_jugadores,
    p.estado,
    p.created_at,
    pm.rol as mi_rol,
    pm.personaje_id as mi_personaje_id,
    count(todos_pm.id)::int as total_miembros
from public.parties p
inner join public.party_miembros pm on pm.party_id = p.id and pm.usuario_id = auth.uid()
left join public.party_miembros todos_pm on todos_pm.party_id = p.id
group by p.id, pm.rol, pm.personaje_id;
```

### 3.2 `v_miembros_party`
Devuelve el listado detallado de miembros de una party para el lobby en tiempo real, cruzando datos de perfil y la ficha de personaje elegida.
```sql
create or replace view public.v_miembros_party as
select 
    pm.id as miembro_id,
    pm.party_id,
    pm.usuario_id,
    pm.rol,
    pm.unido_en,
    perf.nombre_usuario,
    perf.avatar_url,
    pj.id as personaje_id,
    pj.nombre as personaje_nombre,
    pj.clase as personaje_clase,
    pj.raza as personaje_raza,
    pj.nivel as personaje_nivel,
    pj.hp as personaje_hp,
    pj.hp_max as personaje_hp_max,
    pj.ca as personaje_ca
from public.party_miembros pm
left join public.perfiles perf on perf.id = pm.usuario_id
left join public.personajes pj on pj.id = pm.personaje_id;
```

---

## 4. Funciones Almacenadas (`RPC / FUNCTIONS`)

Las funciones almacenadas garantizan atomicidad, validaciones del lado del servidor y son invocables desde el cliente mediante `supabase.rpc(...)`:

### 4.1 `generar_codigo_party()`
Genera un código aleatorio de 6 caracteres no ambiguos (excluye `I`, `O`, `0`, `1`) y verifica que no colisione con códigos existentes en la tabla `parties`.
- **Tipo:** `RETURNS TEXT`
- **Seguridad:** `SECURITY DEFINER`

### 4.2 `rpc_crear_party(p_nombre TEXT, p_max_jugadores INT)`
Operación transaccional completa:
1. Crea una nueva `partida` vacía asociada.
2. Genera un código de invitación único.
3. Inserta el registro en `parties`.
4. Devuelve la party creada (el trigger automático inscribe al creador como miembro `owner`).
- **Seguridad:** `SECURITY DEFINER` con verificación de sesión (`auth.uid() IS NOT NULL`).

### 4.3 `rpc_unirse_party(p_codigo TEXT, p_personaje_id BIGINT)`
Valida y procesa el ingreso de un jugador mediante código de invitación:
1. Localiza la party por código (en mayúsculas).
2. Valida que el estado sea `'lobby'` o `'en_juego'`.
3. Valida que la sala no haya alcanzado el límite `max_jugadores`.
4. Si el usuario ya era miembro, actualiza su personaje elegido; si no, inserta el nuevo miembro.
- **Seguridad:** `SECURITY DEFINER`.

### 4.4 `rpc_salir_party(p_party_id UUID)`
Permite a un miembro abandonar una party:
- Si el que sale es el dueño (`owner`) y no quedan más jugadores, se cancela o finaliza la party.
- Si quedan jugadores, transfiere la titularidad al miembro más antiguo.

### 4.5 `update_player_hp(p_partida_id UUID, p_player_id BIGINT, p_delta INT)`
Actualiza de forma atómica y concurrente los puntos de vida de un personaje dentro del array JSONB `jugadores` de una partida, evitando condiciones de carrera cuando varios jugadores reciben daño o curación simultánea.

---

## 5. Procedimientos Almacenados (`PROCEDURES`)

Los procedimientos almacenados se ejecutan con la sentencia SQL `CALL`:

### 5.1 `sp_limpiar_parties_inactivas(p_dias INT)`
Mantenimiento y purga de partidas huérfanas o sin actividad:
```sql
create or replace procedure public.sp_limpiar_parties_inactivas(p_dias int default 30)
language plpgsql
security definer
as $$
begin
    delete from public.parties
    where estado = 'finalizada'
       or (updated_at < (now() - (p_dias || ' days')::interval));
end;
$$;
```

---

## 6. Disparadores (`TRIGGERS`)

Los triggers garantizan la consistencia e integridad de las reglas de negocio directamente en el motor relacional:

1. **`trg_on_auth_user_created` (Tabla `auth.users`):**
   - Ejecuta `handle_new_user()` tras cada inserción en `auth.users`.
   - Crea automáticamente el registro correspondiente en `public.perfiles` con el `nombre_usuario` provisto en la metadata de registro.

2. **`trg_actualizar_perfil_fecha` (Tabla `public.perfiles`):**
   - Actualiza automáticamente la columna `updated_at` con `now()` ante cualquier modificación del perfil.

3. **`trg_party_creada_owner_miembro` (Tabla `public.parties`):**
   - Disparador `AFTER INSERT` sobre `parties`.
   - Añade automáticamente al creador (`owner_id`) como primer registro en `party_miembros` con el rol `'owner'`.

4. **`trg_validar_miembro_party` (Tabla `public.party_miembros`):**
   - Disparador `BEFORE INSERT` sobre `party_miembros`.
   - Verifica estrictamente que la cantidad actual de miembros no supere `parties.max_jugadores`. Si se supera, aborta la transacción con una excepción relacional.

---

## 7. Políticas de Seguridad de Nivel de Fila (`ROW LEVEL SECURITY - RLS`)

Todas las tablas críticas tienen RLS activado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) para garantizar aislamiento entre usuarios:

- **`perfiles`:** Lectura pública de perfiles (necesaria para ver quién juega en la mesa); modificación restringida exclusivamente al dueño (`auth.uid() = id`).
- **`personajes`:** Los usuarios solo pueden ver, crear, modificar o eliminar sus propias fichas (`auth.uid() = usuario_id`).
- **`parties`:**
  - Lectura permitida a los miembros de la party o al buscar por código para unirse.
  - Modificación y borrado restringido al dueño (`owner_id = auth.uid()`).
- **`party_miembros`:**
  - Los miembros pueden ver la lista de aventureros de su propia party.
  - Cada usuario solo puede modificar su propio registro de membresía (cambiar de personaje o salir).
- **`partidas`:**
  - Solo los miembros de la party vinculada (o creadores directos) tienen permiso de lectura y actualización sobre el historial del chat y el estado del combate.

---

## 8. Scripts de Implementación

Los scripts SQL están diseñados con enfoque **aditivo e idempotente** (`CREATE ... IF NOT EXISTS`, `CREATE OR REPLACE`), listos para ejecutarse en el SQL Editor de Supabase:

1. **`dnd_dm_database_limpio.sql`:** Tablas base de partidas, monstruos y sesiones originales del DM.
2. **`dnd_dm_auth.sql`:** Tablas `perfiles`, `personajes`, triggers de autenticación y políticas RLS.
3. **`dnd_dm_parties.sql`:** Sistema de parties online, código de 6 caracteres, vistas, funciones RPC y control de turnos.

