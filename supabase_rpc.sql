-- RPC para actualizar HP sin sobreescribir todo el array
create or replace function update_player_hp(
  p_partida_id uuid,
  p_player_id int, -- o text, según como guardes el ID (usamos int en el JSON actual)
  p_delta int
)
returns void as $$
begin
  update public.partidas
  set jugadores = (
    select jsonb_agg(
      case
        when (elem->>'id')::int = p_player_id then
            jsonb_set(
                elem,
                '{hp}',
                to_jsonb(greatest(0, (elem->>'hp')::int + p_delta))
            )
        else elem
      end
    )
    from jsonb_array_elements(jugadores) as elem
  )
  where id = p_partida_id;
end;
$$ language plpgsql;

-- Antes de correr esto, asegúrate de que 'jugadores' sea un array en esa fila.
