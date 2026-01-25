-- Create the table
create table public.partidas (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  nombre_partida text,
  jugadores jsonb default '[]'::jsonb,
  historial jsonb default '[]'::jsonb,
  idioma text default 'es'
);

-- Enable Row Level Security (RLS)
alter table public.partidas enable row level security;

-- Create a policy to allow anyone to read/write (for this demo)
-- WARNING: In a production app, you'd want stricter policies!
create policy "Allow public access"
  on public.partidas
  for all
  using (true)
  with check (true);

-- Enable Realtime
alter publication supabase_realtime add table public.partidas;
