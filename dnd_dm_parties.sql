-- ============================================================================
-- dnd_dm_parties.sql — Ampliación para Parties Online y Multijugador (Fase 3)
-- Propósito: Salas multijugador con código de invitación, selección de personajes y sincronización.
-- Idempotente: seguro de ejecutar varias veces sin borrar datos ni alterar objetos existentes.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Tabla: parties
-- Propósito: Representa la sala/lobby multijugador creada por un anfitrión (owner).
-- ----------------------------------------------------------------------------
create table if not exists public.parties (
  id                uuid primary key default gen_random_uuid(),
  codigo_invitacion text not null,
  nombre            text not null,
  dueno_id          uuid not null references public.perfiles (id) on delete cascade,
  partida_id        uuid references public.partidas (id) on delete set null,
  max_jugadores     integer not null default 5 check (max_jugadores between 2 and 8),
  estado            text not null default 'abierta' check (estado in ('abierta', 'en_juego', 'cerrada')),
  created_at        timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  constraint chk_parties_codigo check (char_length(codigo_invitacion) between 4 and 8)
);

create unique index if not exists parties_codigo_uidx on public.parties (upper(codigo_invitacion));
create index if not exists parties_dueno_idx on public.parties (dueno_id);
create index if not exists parties_partida_idx on public.parties (partida_id);

-- ----------------------------------------------------------------------------
-- 2. Tabla: party_miembros
-- Propósito: Registra a los aventureros que se unieron a una party y qué personaje seleccionaron.
-- ----------------------------------------------------------------------------
create table if not exists public.party_miembros (
  party_id      uuid not null references public.parties (id) on delete cascade,
  usuario_id    uuid not null references public.perfiles (id) on delete cascade,
  rol           text not null default 'jugador' check (rol in ('owner', 'jugador')),
  personaje_id  uuid references public.personajes (id) on delete set null,
  ingreso_en    timestamptz not null default now(),
  primary key (party_id, usuario_id)
);

create index if not exists party_miembros_usuario_idx on public.party_miembros (usuario_id);
create index if not exists party_miembros_party_idx on public.party_miembros (party_id);

-- ----------------------------------------------------------------------------
-- 3. Funciones auxiliares y Triggers
-- ----------------------------------------------------------------------------

-- Generador de códigos aleatorios de 6 caracteres (mayúsculas y números legibles)
create or replace function public.fn_generar_codigo_party()
returns text
language plpgsql
as $$
declare
  caracteres text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  resultado text := '';
  i integer;
begin
  for i in 1..6 loop
    resultado := resultado || substr(caracteres, floor(random() * length(caracteres) + 1)::integer, 1);
  end loop;
  return resultado;
end;
$$;

-- Trigger: valida el límite de jugadores antes de insertar un nuevo miembro
create or replace function public.trg_fn_validar_cupo_party()
returns trigger
language plpgsql
as $$
declare
  v_max integer;
  v_actuales integer;
  v_estado text;
begin
  select max_jugadores, estado into v_max, v_estado from public.parties where id = new.party_id;

  if v_estado = 'cerrada' then
    raise exception 'La party se encuentra cerrada para nuevos miembros.' using errcode = 'P0001';
  end if;

  select count(*) into v_actuales from public.party_miembros where party_id = new.party_id;

  if v_actuales >= v_max then
    raise exception 'La party ya alcanzó el número máximo de aventureros (% max).', v_max using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_01_party_validar_cupo on public.party_miembros;
create trigger trg_01_party_validar_cupo
  before insert on public.party_miembros
  for each row execute function public.trg_fn_validar_cupo_party();

-- Trigger: al crear una party, asigna automáticamente al dueño como miembro 'owner'
create or replace function public.trg_fn_party_auto_owner()
returns trigger
language plpgsql
as $$
begin
  insert into public.party_miembros (party_id, usuario_id, rol)
  values (new.id, new.dueno_id, 'owner')
  on conflict (party_id, usuario_id) do update set rol = 'owner';
  return new;
end;
$$;

drop trigger if exists trg_02_party_auto_owner on public.parties;
create trigger trg_02_party_auto_owner
  after insert on public.parties
  for each row execute function public.trg_fn_party_auto_owner();

-- ----------------------------------------------------------------------------
-- 4. Vistas
-- ----------------------------------------------------------------------------

-- Vista: lista de parties en las que el usuario actual participa o es dueño
drop view if exists public.v_parties_usuario;
create view public.v_parties_usuario with (security_invoker = true) as
select p.id,
       p.codigo_invitacion,
       p.nombre,
       p.dueno_id,
       d.nombre_usuario as dueno_nombre,
       p.partida_id,
       p.max_jugadores,
       p.estado,
       p.created_at,
       p.actualizado_en,
       count(m.usuario_id) as total_miembros,
       bool_or(m.usuario_id = auth.uid() and m.rol = 'owner') as es_dueno
from public.parties p
join public.perfiles d on d.id = p.dueno_id
left join public.party_miembros m on m.party_id = p.id
group by p.id, d.nombre_usuario;

-- Vista: detalle de miembros de una party con sus personajes
drop view if exists public.v_miembros_party;
create view public.v_miembros_party with (security_invoker = true) as
select m.party_id,
       m.usuario_id,
       m.rol,
       m.ingreso_en,
       u.nombre_usuario,
       u.avatar_url,
       m.personaje_id,
       pj.nombre as personaje_nombre,
       pj.raza as personaje_raza,
       pj.clase as personaje_clase,
       pj.nivel as personaje_nivel,
       pj.hp as personaje_hp,
       pj.hp_max as personaje_hp_max,
       pj.ca as personaje_ca
from public.party_miembros m
join public.perfiles u on u.id = m.usuario_id
left join public.personajes pj on pj.id = m.personaje_id;

-- ----------------------------------------------------------------------------
-- 5. Funciones RPC (llamables desde la app mediante supabase.rpc)
-- ----------------------------------------------------------------------------

-- RPC: Crear una nueva party con su partida vinculada en 'partidas'
create or replace function public.rpc_crear_party(p_nombre text, p_max_jugadores integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_codigo text;
  v_partida_id uuid;
  v_party_id uuid;
  v_nom text := left(coalesce(nullif(btrim(p_nombre), ''), 'Expedición Arcana'), 100);
  v_max integer := least(8, greatest(2, coalesce(p_max_jugadores, 5)));
  v_intentos integer := 0;
begin
  if v_uid is null then
    raise exception 'Debes estar autenticado para crear una party.' using errcode = '42501';
  end if;

  -- Generar código único evitando colisiones
  loop
    v_codigo := public.fn_generar_codigo_party();
    exit when not exists (select 1 from public.parties where upper(codigo_invitacion) = upper(v_codigo));
    v_intentos := v_intentos + 1;
    if v_intentos > 15 then
      raise exception 'No se pudo generar un código único de party.';
    end if;
  end loop;

  -- 1. Crear la partida asociada en la tabla partidas
  insert into public.partidas (nombre_partida, jugadores, historial, tipo)
  values (v_nom, '[]'::jsonb, '[]'::jsonb, 'ia')
  returning id into v_partida_id;

  -- 2. Crear la party
  insert into public.parties (codigo_invitacion, nombre, dueno_id, partida_id, max_jugadores, estado)
  values (v_codigo, v_nom, v_uid, v_partida_id, v_max, 'abierta')
  returning id into v_party_id;

  return jsonb_build_object(
    'party_id', v_party_id,
    'codigo', v_codigo,
    'partida_id', v_partida_id,
    'nombre', v_nom
  );
end;
$$;

-- RPC: Unirse a una party existente usando el código de 6 caracteres
create or replace function public.rpc_unirse_party(p_codigo text, p_personaje_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_party record;
begin
  if v_uid is null then
    raise exception 'Debes estar autenticado para unirte a una party.' using errcode = '42501';
  end if;

  select * into v_party
  from public.parties
  where upper(codigo_invitacion) = upper(btrim(p_codigo));

  if not found then
    raise exception 'No se encontró ninguna party con el código "%".', upper(p_codigo) using errcode = 'P0002';
  end if;

  -- Si pasó un personaje, verificar que sea de su propiedad
  if p_personaje_id is not null then
    if not exists (select 1 from public.personajes where id = p_personaje_id and usuario_id = v_uid) then
      raise exception 'El personaje seleccionado no te pertenece.' using errcode = '42501';
    end if;
  end if;

  -- Insertar o actualizar personaje si ya estaba
  insert into public.party_miembros (party_id, usuario_id, rol, personaje_id)
  values (v_party.id, v_uid, 'jugador', p_personaje_id)
  on conflict (party_id, usuario_id) do update
    set personaje_id = coalesce(excluded.personaje_id, party_miembros.personaje_id);

  return jsonb_build_object(
    'party_id', v_party.id,
    'partida_id', v_party.partida_id,
    'codigo', v_party.codigo_invitacion,
    'nombre', v_party.nombre,
    'estado', v_party.estado
  );
end;
$$;

-- RPC: Seleccionar o cambiar el personaje activo dentro de la party
create or replace function public.rpc_seleccionar_personaje_party(p_party_id uuid, p_personaje_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Debes estar autenticado.' using errcode = '42501';
  end if;

  -- Verificar propiedad del personaje
  if p_personaje_id is not null and not exists (select 1 from public.personajes where id = p_personaje_id and usuario_id = v_uid) then
    raise exception 'El personaje no te pertenece.' using errcode = '42501';
  end if;

  update public.party_miembros
     set personaje_id = p_personaje_id
   where party_id = p_party_id and usuario_id = v_uid;
end;
$$;

-- RPC: Iniciar la campaña (anfitrión sincroniza los personajes elegidos en la tabla partidas)
create or replace function public.rpc_iniciar_campana_party(p_party_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_party public.parties%rowtype;
  v_jugadores jsonb;
begin
  select * into v_party from public.parties where id = p_party_id;
  if not found then raise exception 'Party no encontrada.' using errcode = 'P0002'; end if;

  if v_party.dueno_id <> v_uid then
    raise exception 'Solo el anfitrión puede iniciar la campaña.' using errcode = '42501';
  end if;

  -- Construir el JSON de jugadores con los personajes asignados
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.o,
           'usuario_id', m.usuario_id,
           'nombre', coalesce(pj.nombre, u.nombre_usuario),
           'raza', coalesce(pj.raza, 'Humano'),
           'clase', coalesce(pj.clase, 'Aventurero'),
           'hp', coalesce(pj.hp, 10),
           'hp_max', coalesce(pj.hp_max, 10),
           'ca', coalesce(pj.ca, 10),
           'nivel', coalesce(pj.nivel, 1),
           'inventario', coalesce(pj.inventario, '[]'::jsonb)
         ) order by m.ingreso_en), '[]'::jsonb)
    into v_jugadores
    from public.party_miembros m
    join public.perfiles u on u.id = m.usuario_id
    left join public.personajes pj on pj.id = m.personaje_id
   cross join lateral (select row_number() over (order by m.ingreso_en) as o) t
   where m.party_id = p_party_id;

  -- Actualizar la partida y la party
  update public.partidas
     set jugadores = v_jugadores,
         actualizado_en = now()
   where id = v_party.partida_id;

  update public.parties
     set estado = 'en_juego',
         actualizado_en = now()
   where id = p_party_id;

  return jsonb_build_object(
    'partida_id', v_party.partida_id,
    'total_jugadores', jsonb_array_length(v_jugadores)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Procedimiento almacenado (se ejecuta con CALL en SQL Editor)
-- ----------------------------------------------------------------------------
create or replace procedure public.sp_limpiar_parties_inactivas(p_dias integer default 60)
language plpgsql
as $$
declare
  v_n integer;
begin
  delete from public.parties
   where actualizado_en < now() - make_interval(days => p_dias);
  get diagnostics v_n = row_count;
  raise notice 'Parties inactivas eliminadas: %', v_n;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Seguridad RLS y Permisos
-- ----------------------------------------------------------------------------
alter table public.parties enable row level security;
alter table public.party_miembros enable row level security;

drop policy if exists "parties lectura miembros" on public.parties;
drop policy if exists "parties insercion auth"   on public.parties;
drop policy if exists "parties edicion dueno"    on public.parties;
drop policy if exists "parties borrado dueno"    on public.parties;

-- Cualquiera autenticado puede leer parties para unirse o ver sus lobbies
create policy "parties lectura miembros"
  on public.parties for select
  using (true);

create policy "parties insercion auth"
  on public.parties for insert
  with check (auth.uid() = dueno_id);

create policy "parties edicion dueno"
  on public.parties for update
  using (auth.uid() = dueno_id)
  with check (auth.uid() = dueno_id);

create policy "parties borrado dueno"
  on public.parties for delete
  using (auth.uid() = dueno_id);

-- Miembros de party
drop policy if exists "party_miembros lectura"   on public.party_miembros;
drop policy if exists "party_miembros insercion" on public.party_miembros;
drop policy if exists "party_miembros edicion"   on public.party_miembros;
drop policy if exists "party_miembros borrado"   on public.party_miembros;

create policy "party_miembros lectura"
  on public.party_miembros for select
  using (true);

create policy "party_miembros insercion"
  on public.party_miembros for insert
  with check (auth.uid() = usuario_id);

create policy "party_miembros edicion"
  on public.party_miembros for update
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

create policy "party_miembros borrado"
  on public.party_miembros for delete
  using (auth.uid() = usuario_id or exists (select 1 from public.parties p where p.id = party_miembros.party_id and p.dueno_id = auth.uid()));

-- Grants
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant usage on schema public to %I', r);
      execute format('grant select, insert, update, delete on public.parties, public.party_miembros to %I', r);
      execute format('grant select on public.v_parties_usuario, public.v_miembros_party to %I', r);
      execute format('grant execute on function public.rpc_crear_party, public.rpc_unirse_party, public.rpc_seleccionar_personaje_party, public.rpc_iniciar_campana_party to %I', r);
    end if;
  end loop;
end $$;

-- Agregar a Realtime para sincronización del lobby en vivo
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'parties') then
      alter publication supabase_realtime add table public.parties;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'party_miembros') then
      alter publication supabase_realtime add table public.party_miembros;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
