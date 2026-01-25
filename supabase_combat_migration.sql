-- Add combat columns to existing partidas table
alter table public.partidas 
add column if not exists en_combate boolean default false,
add column if not exists turno_index integer default 0;
