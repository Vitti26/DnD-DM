-- Agregar columnas faltantes para el sistema de combate
alter table public.partidas 
add column if not exists en_combate boolean default false;

alter table public.partidas 
add column if not exists turno_index int default 0;

-- Asegurarse de que el Realtime escuche estas columnas
alter publication supabase_realtime set table public.partidas;
