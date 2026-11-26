-- Importa uma obra inteira de uma vez (gerada pelo importador da planilha "Centro de Custos").
-- Roda numa transação só: ou entra tudo, ou nada. security invoker: vale o RLS de quem chama.
--
-- payload:
-- {
--   "obra": {"nome", "endereco", "area_m2"},
--   "etapas": [{"nome", "ordem", "valor_orcado", "cronograma": [{"mes": "2026-01-01", "percentual": 0.25}]}],
--   "apropriacoes": [{"nome", "etapa": "<nome da etapa> | null"}],
--   "grupos": ["MATERIAIS", ...],
--   "fornecedores": [{"nome", "categoria"}],
--   "lancamentos": [{"data", "valor", "fornecedor", "descricao", "apropriacao", "grupo", "obs", "medicao": 9}]
-- }

create function public.importar_obra(p_empresa_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_obra uuid;
begin
  if p_empresa_id not in (select public.minhas_empresas()) then
    raise exception 'empresa não encontrada';
  end if;

  insert into public.obras (empresa_id, nome, endereco, area_m2)
  values (
    p_empresa_id,
    p_payload -> 'obra' ->> 'nome',
    p_payload -> 'obra' ->> 'endereco',
    (p_payload -> 'obra' ->> 'area_m2')::numeric
  )
  returning id into v_obra;

  insert into public.etapas (empresa_id, obra_id, nome, ordem, valor_orcado)
  select p_empresa_id, v_obra, e ->> 'nome', (e ->> 'ordem')::int, coalesce((e ->> 'valor_orcado')::numeric, 0)
  from jsonb_array_elements(coalesce(p_payload -> 'etapas', '[]')) e;

  insert into public.cronograma (empresa_id, obra_id, etapa_id, mes, percentual)
  select p_empresa_id, v_obra, et.id, (c ->> 'mes')::date, (c ->> 'percentual')::numeric
  from jsonb_array_elements(coalesce(p_payload -> 'etapas', '[]')) e
  cross join jsonb_array_elements(coalesce(e -> 'cronograma', '[]')) c
  join public.etapas et on et.obra_id = v_obra and et.nome = e ->> 'nome'
  where (c ->> 'percentual')::numeric > 0;

  insert into public.apropriacoes (empresa_id, obra_id, nome, etapa_id, ordem)
  select p_empresa_id, v_obra, a.value ->> 'nome', et.id, a.ordinality::int
  from jsonb_array_elements(coalesce(p_payload -> 'apropriacoes', '[]')) with ordinality a
  left join public.etapas et on et.obra_id = v_obra and et.nome = a.value ->> 'etapa';

  insert into public.grupos (empresa_id, nome)
  select p_empresa_id, g
  from jsonb_array_elements_text(coalesce(p_payload -> 'grupos', '[]')) g
  on conflict (empresa_id, nome) do nothing;

  insert into public.fornecedores (empresa_id, nome, categoria)
  select p_empresa_id, f ->> 'nome', f ->> 'categoria'
  from jsonb_array_elements(coalesce(p_payload -> 'fornecedores', '[]')) f
  on conflict (empresa_id, nome) do nothing;

  insert into public.medicoes (empresa_id, obra_id, numero)
  select distinct p_empresa_id, v_obra, (l ->> 'medicao')::int
  from jsonb_array_elements(coalesce(p_payload -> 'lancamentos', '[]')) l
  where l ->> 'medicao' is not null;

  insert into public.lancamentos (
    empresa_id, obra_id, data, valor, fornecedor_id, descricao, apropriacao_id, grupo_id, medicao_id, obs, status
  )
  select
    p_empresa_id,
    v_obra,
    (l ->> 'data')::date,
    (l ->> 'valor')::numeric,
    f.id,
    coalesce(l ->> 'descricao', ''),
    a.id,
    g.id,
    m.id,
    l ->> 'obs',
    'pago'
  from jsonb_array_elements(coalesce(p_payload -> 'lancamentos', '[]')) l
  join public.apropriacoes a on a.obra_id = v_obra and a.nome = l ->> 'apropriacao'
  left join public.fornecedores f on f.empresa_id = p_empresa_id and f.nome = l ->> 'fornecedor'
  left join public.grupos g on g.empresa_id = p_empresa_id and g.nome = l ->> 'grupo'
  left join public.medicoes m on m.obra_id = v_obra and m.numero = (l ->> 'medicao')::int;

  -- Nenhum lançamento pode ficar para trás por falta de apropriação.
  if (select count(*) from public.lancamentos where obra_id = v_obra)
     <> jsonb_array_length(coalesce(p_payload -> 'lancamentos', '[]')) then
    raise exception 'há lançamentos com apropriação que não está na lista de apropriações';
  end if;

  return v_obra;
end;
$$;

revoke execute on function public.importar_obra(uuid, jsonb) from public, anon;
grant execute on function public.importar_obra(uuid, jsonb) to authenticated;
