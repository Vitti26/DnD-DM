begin;

-- Tablas
create table if not exists public.partidas (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default timezone('utc', now()),
  nombre_partida text,
  jugadores      jsonb default '[]'::jsonb,
  historial      jsonb default '[]'::jsonb,
  idioma         text  default 'es'
);

alter table public.partidas
  add column if not exists en_combate     boolean     default false,
  add column if not exists turno_index    integer     default 0,
  add column if not exists tipo           text        default 'ia',
  add column if not exists combatientes   jsonb       default '[]'::jsonb,
  add column if not exists ronda          integer     default 1,
  add column if not exists encuentro      jsonb       default '{"nombre":"","notas":""}'::jsonb,
  add column if not exists notas_dm       text        default '',
  add column if not exists registro       jsonb       default '[]'::jsonb,
  add column if not exists actualizado_en timestamptz default now();

update public.partidas set tipo        = 'ia'  where tipo        is null;
update public.partidas set en_combate  = false where en_combate  is null;
update public.partidas set turno_index = 0     where turno_index is null or turno_index < 0;
update public.partidas set ronda       = 1     where ronda       is null or ronda < 1;
update public.partidas set actualizado_en = coalesce(actualizado_en, created_at, now()) where actualizado_en is null;

alter table public.partidas
  alter column tipo           set not null,
  alter column en_combate     set not null,
  alter column turno_index    set not null,
  alter column ronda          set not null,
  alter column actualizado_en set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_partidas_tipo') then
    alter table public.partidas add constraint chk_partidas_tipo check (tipo in ('ia', 'dm')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_partidas_ronda') then
    alter table public.partidas add constraint chk_partidas_ronda check (ronda >= 1) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_partidas_turno') then
    alter table public.partidas add constraint chk_partidas_turno check (turno_index >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_partidas_jsonb_arrays') then
    alter table public.partidas add constraint chk_partidas_jsonb_arrays check (
      jsonb_typeof(jugadores)    = 'array' and jsonb_typeof(historial) = 'array' and
      jsonb_typeof(combatientes) = 'array' and jsonb_typeof(registro)  = 'array'
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_partidas_encuentro_objeto') then
    alter table public.partidas add constraint chk_partidas_encuentro_objeto
      check (jsonb_typeof(encuentro) = 'object') not valid;
  end if;
end $$;

create index if not exists partidas_tipo_actualizado_idx on public.partidas (tipo, actualizado_en desc);
create index if not exists partidas_en_combate_idx       on public.partidas (en_combate) where en_combate;

alter table public.partidas enable row level security;
drop policy if exists "Allow public access" on public.partidas;
create policy "Allow public access" on public.partidas for all using (true) with check (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'partidas') then
    alter publication supabase_realtime add table public.partidas;
  end if;
end $$;

create table if not exists public.condiciones (
  nombre      text primary key,
  descripcion text not null,
  orden       integer not null default 0
);

create table if not exists public.plantillas_monstruo (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  hp_max     integer not null check (hp_max >= 1),
  ca         integer not null default 10,
  ini_mod    integer not null default 0,
  notas      text default '',
  created_at timestamptz not null default now()
);
create unique index if not exists plantillas_monstruo_nombre_uidx on public.plantillas_monstruo (lower(nombre));

create table if not exists public.combatientes (
  partida_id uuid    not null references public.partidas (id) on delete cascade,
  id         text    not null,
  posicion   integer not null,
  nombre     text    not null,
  es_jugador boolean not null default false,
  iniciativa integer not null default 0,
  ini_mod    integer not null default 0,
  ca         integer not null default 10,
  hp_max     integer not null check (hp_max >= 1),
  hp         integer not null check (hp >= 0),
  hp_temp    integer not null default 0 check (hp_temp >= 0),
  notas      text    not null default '',
  primary key (partida_id, id),
  constraint chk_combatientes_hp check (hp <= hp_max)
);
create index if not exists combatientes_partida_pos_idx on public.combatientes (partida_id, posicion);

create table if not exists public.combatiente_condiciones (
  partida_id     uuid not null,
  combatiente_id text not null,
  condicion      text not null,
  primary key (partida_id, combatiente_id, condicion),
  foreign key (partida_id, combatiente_id)
    references public.combatientes (partida_id, id) on delete cascade
);

create table if not exists public.partidas_papelera (
  id            uuid primary key,
  eliminado_en  timestamptz not null default now(),
  datos         jsonb not null
);
create index if not exists partidas_papelera_eliminado_idx on public.partidas_papelera (eliminado_en desc);

alter table public.condiciones              enable row level security;
alter table public.plantillas_monstruo      enable row level security;
alter table public.combatientes             enable row level security;
alter table public.combatiente_condiciones  enable row level security;
alter table public.partidas_papelera        enable row level security;

drop policy if exists "condiciones lectura"       on public.condiciones;
drop policy if exists "plantillas acceso"         on public.plantillas_monstruo;
drop policy if exists "combatientes lectura"      on public.combatientes;
drop policy if exists "comb_condiciones lectura"  on public.combatiente_condiciones;
drop policy if exists "papelera acceso"           on public.partidas_papelera;

create policy "condiciones lectura"      on public.condiciones             for select using (true);
create policy "plantillas acceso"        on public.plantillas_monstruo     for all    using (true) with check (true);
create policy "combatientes lectura"     on public.combatientes            for select using (true);
create policy "comb_condiciones lectura" on public.combatiente_condiciones for select using (true);
create policy "papelera acceso"          on public.partidas_papelera       for all    using (true) with check (true);

-- Funciones auxiliares
create or replace function public.fn_to_int(p text, p_default integer default 0)
returns integer language plpgsql immutable as $$
begin
  if p is null then return p_default; end if;
  return trunc(btrim(p)::numeric)::integer;
exception when others then
  return p_default;
end $$;

create or replace function public.fn_d20()
returns integer language sql volatile as $$ select floor(random() * 20)::integer + 1 $$;

create or replace function public.fn_parsear_entrada_hp(p_texto text)
returns table (tipo text, cantidad integer)
language sql immutable as $$
  select case m[1] when '+' then 'cura' when 't' then 'temp' else 'dano' end,
         m[2]::integer
  from (select regexp_match(lower(btrim(coalesce(p_texto, ''))), '^([-+t]?)\s*([0-9]{1,6})$') as m) x
  where m is not null;
$$;

create or replace function public.fn_porcentaje_vida(p_hp integer, p_hp_max integer)
returns integer language sql immutable as $$
  select case when coalesce(p_hp_max, 0) <= 0 then 0
              else least(100, greatest(0, round(100.0 * p_hp / p_hp_max)::integer)) end
$$;

create or replace function public.fn_estado_vida(p_hp integer, p_hp_max integer, p_es_jugador boolean)
returns text language sql immutable as $$
  select case
    when p_hp <= 0 and not p_es_jugador then 'derrotado'
    when p_hp <= 0                      then 'inconsciente'
    when p_hp * 4 <= p_hp_max           then 'critico'
    when p_hp < p_hp_max                then 'herido'
    else 'sano' end
$$;

create or replace function public.fn_esta_fuera(p_elem jsonb)
returns boolean language sql immutable as $$
  select coalesce(p_elem ->> 'esJugador', 'false') <> 'true'
     and public.fn_to_int(p_elem ->> 'hp', 1) <= 0
$$;

create or replace function public.fn_ordenar_combatientes(p_lista jsonb)
returns jsonb language sql stable as $$
  select coalesce(
    jsonb_agg(t.e order by public.fn_to_int(t.e ->> 'iniciativa') desc,
                           public.fn_to_int(t.e ->> 'iniMod') desc,
                           t.o),
    '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_lista) = 'array' then p_lista else '[]'::jsonb end)
       with ordinality as t(e, o)
$$;

create or replace function public.fn_indice_de_id(p_lista jsonb, p_id text)
returns integer language sql immutable as $$
  select coalesce(
    (select (t.o - 1)::integer
       from jsonb_array_elements(case when jsonb_typeof(p_lista) = 'array' then p_lista else '[]'::jsonb end)
            with ordinality as t(e, o)
      where t.e ->> 'id' = p_id
      limit 1), 0)
$$;

create or replace function public.fn_agregar_registro(p_registro jsonb, p_ronda integer, p_texto text)
returns jsonb language sql volatile as $$
  with nuevo as (
    select coalesce(case when jsonb_typeof(p_registro) = 'array' then p_registro end, '[]'::jsonb)
           || case when p_texto is null then '[]'::jsonb
                   else jsonb_build_array(jsonb_build_object(
                          't', (extract(epoch from clock_timestamp()) * 1000)::bigint,
                          'ronda', p_ronda, 'texto', p_texto)) end as arr
  )
  select coalesce(jsonb_agg(t.e order by t.o), '[]'::jsonb)
  from nuevo, jsonb_array_elements(nuevo.arr) with ordinality as t(e, o)
  where t.o > jsonb_array_length(nuevo.arr) - 200
$$;

create or replace function public.fn_extraer_combatientes(p_comb jsonb)
returns table (
  c_id text, c_posicion integer, c_nombre text, c_es_jugador boolean, c_iniciativa integer,
  c_ini_mod integer, c_ca integer, c_hp_max integer, c_hp integer, c_hp_temp integer,
  c_notas text, c_condiciones text[]
)
language sql stable as $$
  with src as (
    select coalesce(nullif(t.e ->> 'id', ''), 'idx-' || t.o) as id, (t.o - 1)::integer as pos, t.e as e
    from jsonb_array_elements(case when jsonb_typeof(p_comb) = 'array' then p_comb else '[]'::jsonb end)
         with ordinality as t(e, o)
    where jsonb_typeof(t.e) = 'object'
  ),
  uniq as (select distinct on (id) id, pos, e from src order by id, pos),
  n as (select id, pos, e, greatest(1, public.fn_to_int(e ->> 'hpMax', 10)) as hpmax from uniq)
  select n.id,
         n.pos,
         left(coalesce(nullif(btrim(n.e ->> 'nombre'), ''), 'Sin nombre'), 120),
         coalesce(n.e ->> 'esJugador', 'false') = 'true',
         public.fn_to_int(n.e ->> 'iniciativa', 0),
         public.fn_to_int(n.e ->> 'iniMod', 0),
         public.fn_to_int(n.e ->> 'ca', 10),
         n.hpmax,
         least(n.hpmax, greatest(0, public.fn_to_int(n.e ->> 'hp', n.hpmax))),
         greatest(0, public.fn_to_int(n.e ->> 'hpTemp', 0)),
         coalesce(n.e ->> 'notas', ''),
         array(select distinct k.v
                 from jsonb_array_elements_text(
                        case when jsonb_typeof(n.e -> 'condiciones') = 'array' then n.e -> 'condiciones' else '[]'::jsonb end
                      ) as k(v)
                where k.v is not null and btrim(k.v) <> '')
  from n
  order by n.pos
$$;

-- Triggers
create or replace function public.trg_fn_partidas_validar()
returns trigger language plpgsql as $$
declare
  v_n integer;
begin
  new.nombre_partida := left(coalesce(nullif(btrim(new.nombre_partida), ''), 'Sesión sin nombre'), 120);
  new.ronda          := greatest(1, coalesce(new.ronda, 1));
  new.turno_index    := greatest(0, coalesce(new.turno_index, 0));
  new.actualizado_en := now();

  if new.tipo = 'dm' then
    v_n := case when jsonb_typeof(new.combatientes) = 'array' then jsonb_array_length(new.combatientes) else 0 end;
    if new.turno_index >= v_n then new.turno_index := 0; end if;
  end if;
  return new;
end $$;

drop trigger if exists partidas_set_actualizado_en on public.partidas;
drop function if exists public.set_actualizado_en();
drop trigger if exists trg_01_partidas_validar on public.partidas;
create trigger trg_01_partidas_validar
  before insert or update on public.partidas
  for each row execute function public.trg_fn_partidas_validar();

create or replace function public.fn_sync_combatientes(p_partida uuid, p_comb jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.combatientes where partida_id = p_partida;

  insert into public.combatientes
    (partida_id, id, posicion, nombre, es_jugador, iniciativa, ini_mod, ca, hp_max, hp, hp_temp, notas)
  select p_partida, c_id, c_posicion, c_nombre, c_es_jugador, c_iniciativa, c_ini_mod, c_ca, c_hp_max, c_hp, c_hp_temp, c_notas
  from public.fn_extraer_combatientes(p_comb);

  insert into public.combatiente_condiciones (partida_id, combatiente_id, condicion)
  select p_partida, f.c_id, k
  from public.fn_extraer_combatientes(p_comb) f, unnest(f.c_condiciones) as k;
end $$;

create or replace function public.trg_fn_partidas_sync_combatientes()
returns trigger language plpgsql as $$
begin
  perform public.fn_sync_combatientes(new.id, new.combatientes);
  return null;
end $$;

drop trigger if exists trg_partidas_sync_ins on public.partidas;
create trigger trg_partidas_sync_ins
  after insert on public.partidas
  for each row when (new.tipo = 'dm')
  execute function public.trg_fn_partidas_sync_combatientes();

drop trigger if exists trg_partidas_sync_upd on public.partidas;
create trigger trg_partidas_sync_upd
  after update of combatientes, tipo on public.partidas
  for each row when (new.tipo = 'dm' and (old.combatientes is distinct from new.combatientes or old.tipo is distinct from new.tipo))
  execute function public.trg_fn_partidas_sync_combatientes();

create or replace function public.trg_fn_partidas_papelera()
returns trigger language plpgsql as $$
begin
  insert into public.partidas_papelera (id, datos)
  values (old.id, to_jsonb(old))
  on conflict (id) do update set datos = excluded.datos, eliminado_en = now();
  return old;
end $$;

drop trigger if exists trg_partidas_papelera on public.partidas;
create trigger trg_partidas_papelera
  before delete on public.partidas
  for each row execute function public.trg_fn_partidas_papelera();

-- Vistas
drop view if exists public.v_sesiones_dm;
create view public.v_sesiones_dm with (security_invoker = true) as
select p.id,
       p.nombre_partida                                                        as nombre,
       p.en_combate,
       p.ronda,
       p.turno_index,
       p.encuentro ->> 'nombre'                                                as encuentro,
       p.created_at,
       p.actualizado_en,
       count(c.id)                                                             as total_combatientes,
       count(c.id) filter (where c.es_jugador)                                 as jugadores,
       count(c.id) filter (where not c.es_jugador)                             as monstruos,
       count(c.id) filter (where not c.es_jugador and c.hp > 0)                as monstruos_en_pie,
       coalesce(sum(c.hp) filter (where not c.es_jugador and c.hp > 0), 0)     as pv_enemigos_restantes,
       (select a.nombre from public.combatientes a
         where a.partida_id = p.id and a.posicion = p.turno_index)              as turno_de
from public.partidas p
left join public.combatientes c on c.partida_id = p.id
where p.tipo = 'dm'
group by p.id;

drop view if exists public.v_combatientes_detalle;
create view public.v_combatientes_detalle with (security_invoker = true) as
select c.partida_id,
       p.nombre_partida                                         as sesion,
       c.posicion,
       c.id,
       c.nombre,
       c.es_jugador,
       c.iniciativa,
       c.ini_mod,
       c.ca,
       c.hp,
       c.hp_max,
       c.hp_temp,
       public.fn_porcentaje_vida(c.hp, c.hp_max)                as pct_vida,
       public.fn_estado_vida(c.hp, c.hp_max, c.es_jugador)      as estado,
       (p.en_combate and c.posicion = p.turno_index)            as turno_activo,
       coalesce(k.condiciones, '{}'::text[])                    as condiciones,
       c.notas
from public.combatientes c
join public.partidas p on p.id = c.partida_id
left join lateral (
  select array_agg(cc.condicion order by cc.condicion) as condiciones
  from public.combatiente_condiciones cc
  where cc.partida_id = c.partida_id and cc.combatiente_id = c.id
) k on true;

drop view if exists public.v_registro_combate;
create view public.v_registro_combate with (security_invoker = true) as
select p.id                                                         as partida_id,
       p.nombre_partida                                             as sesion,
       (r.o - 1)::integer                                           as orden,
       case when r.e ->> 't' ~ '^[0-9]{10,}$'
            then to_timestamp((r.e ->> 't')::bigint / 1000.0) end   as ocurrio_en,
       public.fn_to_int(r.e ->> 'ronda', 1)                         as ronda,
       r.e ->> 'texto'                                              as texto
from public.partidas p
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.registro) = 'array' then p.registro else '[]'::jsonb end
) with ordinality as r(e, o)
where p.tipo = 'dm';

drop view if exists public.v_papelera;
create view public.v_papelera with (security_invoker = true) as
select id,
       datos ->> 'nombre_partida'  as nombre,
       datos ->> 'tipo'            as tipo,
       jsonb_array_length(coalesce(datos -> 'combatientes', '[]'::jsonb)) as combatientes,
       eliminado_en
from public.partidas_papelera
order by eliminado_en desc;

drop view if exists public.v_catalogo;
create view public.v_catalogo with (security_invoker = true) as
select 'condicion'::text as tipo, nombre, descripcion, null::integer as hp_max, null::integer as ca, null::integer as ini_mod, orden
from public.condiciones
union all
select 'monstruo', nombre, notas, hp_max, ca, ini_mod, 100
from public.plantillas_monstruo;

-- Funciones RPC
create or replace function public.rpc_iniciar_combate(p_partida uuid)
returns jsonb language plpgsql as $$
declare
  v public.partidas%rowtype;
  v_orden jsonb; v_idx integer := 0; i integer;
begin
  select * into v from public.partidas where id = p_partida and tipo = 'dm' for update;
  if not found then raise exception 'Sesión % no encontrada', p_partida using errcode = 'P0002'; end if;
  if jsonb_array_length(v.combatientes) = 0 then raise exception 'No hay combatientes en la sesión'; end if;

  v_orden := public.fn_ordenar_combatientes(v.combatientes);
  for i in 0 .. jsonb_array_length(v_orden) - 1 loop
    if not public.fn_esta_fuera(v_orden -> i) then v_idx := i; exit; end if;
  end loop;

  update public.partidas
     set combatientes = v_orden, en_combate = true, ronda = 1, turno_index = v_idx,
         registro = public.fn_agregar_registro(registro, 1, '⚔️ Comienza el combate')
   where id = p_partida;

  return jsonb_build_object('turno_index', v_idx, 'ronda', 1, 'turno_de', v_orden -> v_idx ->> 'nombre');
end $$;

create or replace function public.rpc_terminar_combate(p_partida uuid)
returns jsonb language plpgsql as $$
declare v public.partidas%rowtype;
begin
  select * into v from public.partidas where id = p_partida and tipo = 'dm' for update;
  if not found then raise exception 'Sesión % no encontrada', p_partida using errcode = 'P0002'; end if;

  update public.partidas
     set en_combate = false,
         registro = public.fn_agregar_registro(registro, v.ronda, '🏳️ Fin del combate (ronda ' || v.ronda || ')')
   where id = p_partida;
  return jsonb_build_object('en_combate', false, 'ronda', v.ronda);
end $$;

create or replace function public.rpc_siguiente_turno(p_partida uuid)
returns jsonb language plpgsql as $$
declare
  v public.partidas%rowtype;
  n integer; idx integer; r integer; paso integer;
begin
  select * into v from public.partidas where id = p_partida and tipo = 'dm' for update;
  if not found then raise exception 'Sesión % no encontrada', p_partida using errcode = 'P0002'; end if;
  if not v.en_combate then raise exception 'La sesión no está en combate'; end if;

  n := jsonb_array_length(v.combatientes);
  idx := v.turno_index; r := v.ronda;

  for paso in 1 .. n loop
    idx := idx + 1;
    if idx >= n then idx := 0; r := r + 1; end if;
    if not public.fn_esta_fuera(v.combatientes -> idx) then
      update public.partidas
         set turno_index = idx, ronda = r,
             registro = public.fn_agregar_registro(registro, r, case when r <> v.ronda then '— Ronda ' || r || ' —' end)
       where id = p_partida;
      return jsonb_build_object('turno_index', idx, 'ronda', r, 'turno_de', v.combatientes -> idx ->> 'nombre');
    end if;
  end loop;

  return jsonb_build_object('turno_index', v.turno_index, 'ronda', v.ronda,
                            'turno_de', v.combatientes -> v.turno_index ->> 'nombre');
end $$;

create or replace function public.rpc_turno_anterior(p_partida uuid)
returns jsonb language plpgsql as $$
declare
  v public.partidas%rowtype;
  n integer; idx integer; r integer; paso integer;
begin
  select * into v from public.partidas where id = p_partida and tipo = 'dm' for update;
  if not found then raise exception 'Sesión % no encontrada', p_partida using errcode = 'P0002'; end if;
  if not v.en_combate then raise exception 'La sesión no está en combate'; end if;

  n := jsonb_array_length(v.combatientes);
  idx := v.turno_index; r := v.ronda;

  for paso in 1 .. n loop
    idx := idx - 1;
    if idx < 0 then idx := n - 1; r := greatest(1, r - 1); end if;
    if not public.fn_esta_fuera(v.combatientes -> idx) then
      update public.partidas set turno_index = idx, ronda = r where id = p_partida;
      return jsonb_build_object('turno_index', idx, 'ronda', r, 'turno_de', v.combatientes -> idx ->> 'nombre');
    end if;
  end loop;

  return jsonb_build_object('turno_index', v.turno_index, 'ronda', v.ronda);
end $$;

create or replace function public.rpc_aplicar_hp(p_partida uuid, p_combatiente text, p_entrada text)
returns jsonb language plpgsql as $$
declare
  v public.partidas%rowtype;
  p record;
  v_pos integer; c jsonb; nuevo jsonb;
  v_hp integer; v_max integer; v_temp integer; v_abs integer;
  v_verbo text; v_extra text := '';
begin
  select * into v from public.partidas where id = p_partida and tipo = 'dm' for update;
  if not found then raise exception 'Sesión % no encontrada', p_partida using errcode = 'P0002'; end if;

  select * into p from public.fn_parsear_entrada_hp(p_entrada);
  if not found then raise exception 'Entrada de PV no válida: "%" (usa 7, +7 o t5)', p_entrada; end if;

  select (t.o - 1)::integer into v_pos
    from jsonb_array_elements(v.combatientes) with ordinality as t(e, o)
   where t.e ->> 'id' = p_combatiente limit 1;
  if v_pos is null then raise exception 'Combatiente "%" no encontrado en la sesión', p_combatiente using errcode = 'P0002'; end if;

  c      := v.combatientes -> v_pos;
  v_max  := greatest(1, public.fn_to_int(c ->> 'hpMax', 1));
  v_hp   := least(v_max, greatest(0, public.fn_to_int(c ->> 'hp', v_max)));
  v_temp := greatest(0, public.fn_to_int(c ->> 'hpTemp', 0));
  if p.cantidad = 0 then return c; end if;

  if p.tipo = 'dano' then
    v_abs  := least(v_temp, p.cantidad);
    v_temp := v_temp - v_abs;
    v_hp   := greatest(0, v_hp - (p.cantidad - v_abs));
    v_verbo := format('recibe %s de daño', p.cantidad);
    if v_hp = 0 then
      v_extra := case when coalesce(c ->> 'esJugador', 'false') = 'true' then ' — ¡cae inconsciente!' else ' — ¡derrotado!' end;
    end if;
  elsif p.tipo = 'cura' then
    v_hp := least(v_max, v_hp + p.cantidad);
    v_verbo := format('recupera %s PV', p.cantidad);
  else
    v_temp := greatest(v_temp, p.cantidad);
    v_verbo := format('gana %s PV temporales', p.cantidad);
  end if;

  nuevo := c || jsonb_build_object('hp', v_hp, 'hpTemp', v_temp);
  update public.partidas
     set combatientes = jsonb_set(combatientes, array[v_pos::text], nuevo),
         registro = public.fn_agregar_registro(registro, ronda,
                      format('%s %s (%s/%s)%s', c ->> 'nombre', v_verbo, v_hp, v_max, v_extra))
   where id = p_partida;
  return nuevo;
end $$;

create or replace function public.rpc_tirar_iniciativa_monstruos(p_partida uuid)
returns jsonb language plpgsql as $$
declare
  v public.partidas%rowtype;
  v_activo text; v_nueva jsonb; v_orden jsonb;
begin
  select * into v from public.partidas where id = p_partida and tipo = 'dm' for update;
  if not found then raise exception 'Sesión % no encontrada', p_partida using errcode = 'P0002'; end if;

  v_activo := (v.combatientes -> v.turno_index) ->> 'id';
  select coalesce(jsonb_agg(
           case when coalesce(t.e ->> 'esJugador', 'false') = 'true' then t.e
                else jsonb_set(t.e, '{iniciativa}', to_jsonb(public.fn_d20() + public.fn_to_int(t.e ->> 'iniMod', 0))) end
           order by t.o), '[]'::jsonb)
    into v_nueva
    from jsonb_array_elements(v.combatientes) with ordinality as t(e, o);

  v_orden := public.fn_ordenar_combatientes(v_nueva);
  update public.partidas
     set combatientes = v_orden,
         turno_index = public.fn_indice_de_id(v_orden, v_activo),
         registro = public.fn_agregar_registro(registro, ronda, 'Iniciativa de monstruos tirada')
   where id = p_partida;
  return v_orden;
end $$;

create or replace function public.rpc_agregar_desde_plantilla(
  p_partida uuid, p_plantilla text, p_cantidad integer default 1, p_tirar boolean default true)
returns jsonb language plpgsql as $$
declare
  v public.partidas%rowtype;
  t public.plantillas_monstruo%rowtype;
  n integer; i integer; v_nuevos jsonb := '[]'::jsonb; v_activo text; v_orden jsonb;
begin
  select * into v from public.partidas where id = p_partida and tipo = 'dm' for update;
  if not found then raise exception 'Sesión % no encontrada', p_partida using errcode = 'P0002'; end if;
  select * into t from public.plantillas_monstruo where lower(nombre) = lower(btrim(p_plantilla));
  if not found then raise exception 'Plantilla "%" no existe en el bestiario', p_plantilla using errcode = 'P0002'; end if;

  n := least(20, greatest(1, coalesce(p_cantidad, 1)));
  for i in 1 .. n loop
    v_nuevos := v_nuevos || jsonb_build_object(
      'id', 'db-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
      'nombre', case when n > 1 then t.nombre || ' ' || i else t.nombre end,
      'esJugador', false,
      'iniciativa', case when p_tirar then public.fn_d20() + t.ini_mod else 0 end,
      'iniMod', t.ini_mod, 'ca', t.ca, 'hpMax', t.hp_max, 'hp', t.hp_max, 'hpTemp', 0,
      'condiciones', '[]'::jsonb, 'notas', coalesce(t.notas, ''));
  end loop;

  v_activo := (v.combatientes -> v.turno_index) ->> 'id';
  v_orden  := public.fn_ordenar_combatientes(v.combatientes || v_nuevos);
  update public.partidas
     set combatientes = v_orden,
         turno_index = public.fn_indice_de_id(v_orden, v_activo),
         registro = public.fn_agregar_registro(registro, ronda, 'Añadido: ' || t.nombre || case when n > 1 then ' ×' || n else '' end)
   where id = p_partida;
  return v_nuevos;
end $$;

create or replace function public.rpc_limpiar_derrotados(p_partida uuid)
returns integer language plpgsql as $$
declare
  v public.partidas%rowtype;
  v_activo text; v_nueva jsonb; v_quitados integer;
begin
  select * into v from public.partidas where id = p_partida and tipo = 'dm' for update;
  if not found then raise exception 'Sesión % no encontrada', p_partida using errcode = 'P0002'; end if;

  v_activo := (v.combatientes -> v.turno_index) ->> 'id';
  select coalesce(jsonb_agg(t.e order by t.o), '[]'::jsonb) into v_nueva
    from jsonb_array_elements(v.combatientes) with ordinality as t(e, o)
   where not public.fn_esta_fuera(t.e);
  v_quitados := jsonb_array_length(v.combatientes) - jsonb_array_length(v_nueva);
  if v_quitados = 0 then return 0; end if;

  update public.partidas
     set combatientes = v_nueva,
         turno_index = public.fn_indice_de_id(v_nueva, v_activo),
         registro = public.fn_agregar_registro(registro, ronda, 'Derrotados retirados de la lista')
   where id = p_partida;
  return v_quitados;
end $$;

create or replace function public.rpc_duplicar_sesion(p_origen uuid, p_nombre text default null)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.partidas (nombre_partida, jugadores, historial, idioma, tipo, combatientes, en_combate,
                               turno_index, ronda, encuentro, notas_dm, registro)
  select coalesce(nullif(btrim(p_nombre), ''), o.nombre_partida || ' (copia)'),
         o.jugadores, o.historial, o.idioma, o.tipo, o.combatientes, o.en_combate,
         o.turno_index, o.ronda, o.encuentro, o.notas_dm, o.registro
    from public.partidas o
   where o.id = p_origen
  returning id into v_id;
  if v_id is null then raise exception 'Sesión % no encontrada', p_origen using errcode = 'P0002'; end if;
  return v_id;
end $$;

create or replace function public.rpc_restaurar_sesion(p_id uuid)
returns uuid language plpgsql as $$
declare v_datos jsonb;
begin
  select datos into v_datos from public.partidas_papelera where id = p_id;
  if v_datos is null then raise exception 'No hay ninguna sesión % en la papelera', p_id using errcode = 'P0002'; end if;

  insert into public.partidas select * from jsonb_populate_record(null::public.partidas, v_datos);
  delete from public.partidas_papelera where id = p_id;
  return p_id;
end $$;

create or replace function public.fn_resumen_sesion(p_partida uuid)
returns jsonb language sql stable as $$
  select to_jsonb(s) from public.v_sesiones_dm s where s.id = p_partida
$$;

create or replace function public.update_player_hp(p_partida_id uuid, p_player_id integer, p_delta integer)
returns void language plpgsql as $$
begin
  update public.partidas
     set jugadores = coalesce((
           select jsonb_agg(
                    case when public.fn_to_int(elem ->> 'id', -1) = p_player_id
                         then jsonb_set(elem, '{hp}', to_jsonb(greatest(0, public.fn_to_int(elem ->> 'hp', 0) + p_delta)))
                         else elem end
                    order by ord)
             from jsonb_array_elements(jugadores) with ordinality as t(elem, ord)
         ), '[]'::jsonb)
   where id = p_partida_id and jsonb_typeof(jugadores) = 'array';
end $$;

-- Procedimientos almacenados
create or replace procedure public.sp_resincronizar_combatientes()
language plpgsql as $$
declare r record; v_n integer := 0;
begin
  for r in select id, combatientes from public.partidas where tipo = 'dm' loop
    perform public.fn_sync_combatientes(r.id, r.combatientes);
    v_n := v_n + 1;
  end loop;
  delete from public.combatientes c where not exists (select 1 from public.partidas p where p.id = c.partida_id and p.tipo = 'dm');
  raise notice 'Resincronizadas % sesiones', v_n;
end $$;

create or replace procedure public.sp_purgar_papelera(p_dias integer default 30)
language plpgsql as $$
declare v_n integer;
begin
  delete from public.partidas_papelera where eliminado_en < now() - make_interval(days => p_dias);
  get diagnostics v_n = row_count;
  raise notice 'Papelera: % sesiones eliminadas definitivamente', v_n;
end $$;

create or replace procedure public.sp_archivar_sesiones_inactivas(p_dias integer default 180)
language plpgsql as $$
declare v_n integer;
begin
  delete from public.partidas
   where tipo = 'dm' and not en_combate and actualizado_en < now() - make_interval(days => p_dias);
  get diagnostics v_n = row_count;
  raise notice 'Sesiones inactivas enviadas a la papelera: %', v_n;
end $$;

create or replace procedure public.sp_mantenimiento(p_dias_inactividad integer default 180, p_dias_papelera integer default 30)
language plpgsql as $$
begin
  call public.sp_archivar_sesiones_inactivas(p_dias_inactividad);
  call public.sp_purgar_papelera(p_dias_papelera);
  call public.sp_resincronizar_combatientes();
end $$;

-- Permisos
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant usage on schema public to %I', r);
      execute format('grant select, insert, update, delete on public.partidas, public.partidas_papelera, public.plantillas_monstruo to %I', r);
      execute format('grant select on public.condiciones, public.combatientes, public.combatiente_condiciones to %I', r);
      execute format('grant select on public.v_sesiones_dm, public.v_combatientes_detalle, public.v_registro_combate, public.v_papelera, public.v_catalogo to %I', r);
      execute format('grant execute on all functions in schema public to %I', r);
    end if;
  end loop;
end $$;

revoke execute on all procedures in schema public from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on all procedures in schema public from %I', r);
    end if;
  end loop;
end $$;

-- Datos iniciales
insert into public.condiciones (nombre, descripcion, orden) values
  ('Concentración', 'Mantiene un conjuro; un golpe o efecto puede romperla (salvación de CON).', 1),
  ('Cegado',        'No ve; falla pruebas que requieran vista. Ataques contra él con ventaja, los suyos con desventaja.', 2),
  ('Hechizado',     'No puede atacar a quien lo hechizó. Quien lo hechizó tiene ventaja en pruebas sociales contra él.', 3),
  ('Ensordecido',   'No oye; falla pruebas que requieran oído.', 4),
  ('Asustado',      'Desventaja en pruebas y ataques mientras vea la fuente de su miedo; no puede acercarse a ella.', 5),
  ('Agarrado',      'Velocidad 0. Termina si el agarrador queda incapacitado o lo separan.', 6),
  ('Incapacitado',  'No puede realizar acciones ni reacciones.', 7),
  ('Invisible',     'No se le ve sin magia o sentidos especiales. Ataques contra él con desventaja, los suyos con ventaja.', 8),
  ('Paralizado',    'Incapacitado, no se mueve ni habla. Falla salvaciones de FUE y DES. Críticos cuerpo a cuerpo contra él.', 9),
  ('Petrificado',   'Transformado en sustancia sólida. Incapacitado, resistente a todo el daño, inmune a veneno y enfermedad.', 10),
  ('Envenenado',    'Desventaja en tiradas de ataque y pruebas de característica.', 11),
  ('Derribado',     'Solo puede arrastrarse. Desventaja en sus ataques; ataques cuerpo a cuerpo contra él con ventaja.', 12),
  ('Apresado',      'Velocidad 0. Desventaja en sus ataques y salvaciones de DES; ataques contra él con ventaja.', 13),
  ('Aturdido',      'Incapacitado, no se mueve y habla con dificultad. Falla salvaciones de FUE y DES.', 14),
  ('Inconsciente',  'Incapacitado, suelta lo que lleva y cae derribado. Críticos cuerpo a cuerpo contra él.', 15)
on conflict (nombre) do update set descripcion = excluded.descripcion, orden = excluded.orden;

insert into public.plantillas_monstruo (nombre, hp_max, ca, ini_mod, notas) values
  ('Goblin',        7, 15,  2, ''),
  ('Orco',         15, 13,  1, ''),
  ('Esqueleto',    13, 13,  2, ''),
  ('Zombi',        22,  8, -2, ''),
  ('Lobo',         11, 13,  2, ''),
  ('Bandido',      11, 12,  1, ''),
  ('Araña gigante', 26, 14,  3, ''),
  ('Ogro',         59, 11, -1, '')
on conflict (lower(nombre)) do nothing;

do $$
declare r record;
begin
  for r in select id, combatientes from public.partidas where tipo = 'dm' loop
    perform public.fn_sync_combatientes(r.id, r.combatientes);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;

