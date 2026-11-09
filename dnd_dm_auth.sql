-- ============================================================================
-- dnd_dm_auth.sql — Ampliación del esquema para Autenticación y Personajes (Fase 2)
-- Propósito: Gestión de usuarios registrados (auth.users -> perfiles) y sus personajes de D&D.
-- Idempotente: seguro de ejecutar varias veces sin borrar datos ni alterar objetos existentes.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Tabla: perfiles
-- Propósito: Almacena información pública y de juego vinculada a la cuenta auth.users.
-- ----------------------------------------------------------------------------
create table if not exists public.perfiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  nombre_usuario text not null,
  avatar_url     text default '',
  created_at     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint chk_perfiles_nombre check (char_length(btrim(nombre_usuario)) >= 2)
);

create index if not exists perfiles_nombre_idx on public.perfiles (lower(nombre_usuario));

-- ----------------------------------------------------------------------------
-- 2. Tabla: personajes
-- Propósito: Fichas de personaje pertenecientes a cada aventurero registrado.
-- ----------------------------------------------------------------------------
create table if not exists public.personajes (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.perfiles (id) on delete cascade,
  nombre         text not null,
  raza           text not null,
  clase          text not null,
  nivel          integer not null default 1 check (nivel between 1 and 20),
  hp_max         integer not null check (hp_max >= 1),
  hp             integer not null check (hp >= 0),
  ca             integer not null default 10 check (ca >= 0),
  atributos      jsonb not null default '{"fue": 10, "des": 10, "con": 10, "int": 10, "sab": 10, "car": 10}'::jsonb,
  inventario     jsonb not null default '[]'::jsonb,
  notas          text not null default '',
  created_at     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint chk_personajes_hp check (hp <= hp_max),
  constraint chk_personajes_nombre check (char_length(btrim(nombre)) >= 1)
);

create index if not exists personajes_usuario_idx on public.personajes (usuario_id);

-- ----------------------------------------------------------------------------
-- 3. Trigger: on_auth_user_created
-- Propósito: Crea automáticamente la fila de perfil cuando un usuario se registra en auth.users.
-- ----------------------------------------------------------------------------
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nombre text;
begin
  -- Toma el nombre enviado en metadata o la primera parte del email
  v_nombre := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'nombre_usuario'), ''),
    nullif(btrim(split_part(new.email, '@', 1)), ''),
    'Aventurero'
  );

  insert into public.perfiles (id, nombre_usuario, avatar_url)
  values (new.id, left(v_nombre, 60), coalesce(new.raw_user_meta_data ->> 'avatar_url', ''))
  on conflict (id) do update
    set nombre_usuario = coalesce(nullif(excluded.nombre_usuario, ''), perfiles.nombre_usuario),
        actualizado_en = now();

  return new;
end;
$$;

-- Vincular trigger al esquema auth (idempotente)
drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- Trigger para mantener actualizado_en en perfiles y personajes
create or replace function public.fn_set_timestamp_actualizado()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists trg_perfiles_actualizado on public.perfiles;
create trigger trg_perfiles_actualizado
  before update on public.perfiles
  for each row execute function public.fn_set_timestamp_actualizado();

drop trigger if exists trg_personajes_actualizado on public.personajes;
create trigger trg_personajes_actualizado
  before update on public.personajes
  for each row execute function public.fn_set_timestamp_actualizado();

-- ----------------------------------------------------------------------------
-- 4. Vista: v_personajes_usuario
-- Propósito: Consulta enriquecida de personajes con datos del aventurero dueño.
-- ----------------------------------------------------------------------------
drop view if exists public.v_personajes_usuario;
create view public.v_personajes_usuario with (security_invoker = true) as
select p.id,
       p.usuario_id,
       u.nombre_usuario as dueno,
       p.nombre,
       p.raza,
       p.clase,
       p.nivel,
       p.hp,
       p.hp_max,
       p.ca,
       p.atributos,
       p.inventario,
       p.notas,
       p.created_at,
       p.actualizado_en
from public.personajes p
join public.perfiles u on u.id = p.usuario_id;

-- ----------------------------------------------------------------------------
-- 5. Seguridad de Nivel de Fila (RLS)
-- Propósito: Garantiza que cada aventurero solo administre sus propios datos.
-- ----------------------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.personajes enable row level security;

-- Perfiles: cualquier usuario autenticado puede leer nombres (para ver la party), pero solo el dueño edita
drop policy if exists "perfiles lectura publica" on public.perfiles;
drop policy if exists "perfiles edicion propia"   on public.perfiles;
create policy "perfiles lectura publica" on public.perfiles for select using (true);
create policy "perfiles edicion propia"   on public.perfiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Personajes: aislamiento estricto por usuario
drop policy if exists "personajes lectura propia"    on public.personajes;
drop policy if exists "personajes insercion propia"  on public.personajes;
drop policy if exists "personajes actualizacion propia" on public.personajes;
drop policy if exists "personajes borrado propio"    on public.personajes;

create policy "personajes lectura propia"
  on public.personajes for select
  using (auth.uid() = usuario_id);

create policy "personajes insercion propia"
  on public.personajes for insert
  with check (auth.uid() = usuario_id);

create policy "personajes actualizacion propia"
  on public.personajes for update
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

create policy "personajes borrado propio"
  on public.personajes for delete
  using (auth.uid() = usuario_id);

-- ----------------------------------------------------------------------------
-- 6. Permisos de roles Supabase
-- ----------------------------------------------------------------------------
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant usage on schema public to %I', r);
      execute format('grant select, update on public.perfiles to %I', r);
      execute format('grant select, insert, update, delete on public.personajes to %I', r);
      execute format('grant select on public.v_personajes_usuario to %I', r);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Poblado de perfiles para usuarios auth que ya existían previamente
-- ----------------------------------------------------------------------------
insert into public.perfiles (id, nombre_usuario)
select u.id, coalesce(nullif(btrim(split_part(u.email, '@', 1)), ''), 'Aventurero')
from auth.users u
where not exists (select 1 from public.perfiles p where p.id = u.id)
on conflict (id) do nothing;

notify pgrst, 'reload schema';

commit;

