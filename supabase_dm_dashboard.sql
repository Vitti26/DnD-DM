-- Panel del DM: columnas extra sobre la tabla existente `partidas`.
-- Ejecutar una vez en el SQL Editor de Supabase. Es seguro repetirlo (if not exists).
-- No toca las columnas que usa el chat con IA (jugadores, historial, idioma, en_combate, turno_index).

alter table public.partidas
  add column if not exists tipo text default 'ia',                       -- 'ia' (chat) | 'dm' (panel)
  add column if not exists combatientes jsonb default '[]'::jsonb,      -- iniciativa, PV, CA, condiciones...
  add column if not exists ronda int default 1,
  add column if not exists encuentro jsonb default '{"nombre":"","notas":""}'::jsonb,
  add column if not exists notas_dm text default '',
  add column if not exists registro jsonb default '[]'::jsonb,           -- log de combate
  add column if not exists actualizado_en timestamptz default now();

-- Asegura las columnas de combate (por si no se ejecutó supabase_columns.sql)
alter table public.partidas
  add column if not exists en_combate boolean default false,
  add column if not exists turno_index int default 0;

create index if not exists partidas_tipo_actualizado_idx
  on public.partidas (tipo, actualizado_en desc);

-- Mantiene actualizado_en automáticamente en cada UPDATE.
create or replace function public.set_actualizado_en()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists partidas_set_actualizado_en on public.partidas;
create trigger partidas_set_actualizado_en
  before update on public.partidas
  for each row execute function public.set_actualizado_en();

-- NOTA DE SEGURIDAD: la política actual ("Allow public access") deja leer/escribir a cualquiera
-- que tenga la anon key. Para uso personal está bien; si lo publicas, añade Supabase Auth y
-- restringe por usuario (columna owner_id + política `using (owner_id = auth.uid())`).
