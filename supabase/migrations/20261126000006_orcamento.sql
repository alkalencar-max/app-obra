-- Orçamento (EAP) por item: cada etapa tem materiais, serviços e equipamentos.
-- O valor orçado da etapa passa a ser a soma dos itens (quando a etapa tem itens).

create table public.orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  etapa_id uuid not null,
  ordem int not null default 0,
  descricao text not null,
  tipo text not null default 'material' check (tipo in ('material', 'servico', 'equipamento')),
  quantidade numeric(14, 4) not null default 1,
  unidade text,
  custo_unitario numeric(14, 4) not null default 0,
  total numeric(14, 2) generated always as (round(quantidade * custo_unitario, 2)) stored,
  created_at timestamptz not null default now(),
  foreign key (obra_id, empresa_id) references public.obras (id, empresa_id) on delete cascade,
  foreign key (etapa_id, obra_id) references public.etapas (id, obra_id) on delete cascade
);

create index orcamento_itens_etapa_idx on public.orcamento_itens (etapa_id, ordem);

alter table public.orcamento_itens enable row level security;
create policy orcamento_itens_all on public.orcamento_itens for all to authenticated
  using (empresa_id in (select public.minhas_empresas())) with check (empresa_id in (select public.minhas_empresas()));
grant select, insert, update, delete on public.orcamento_itens to authenticated;

-- De qual item do orçamento veio cada item da cotação (opcional).
alter table public.cotacao_itens add column orcamento_item_id uuid references public.orcamento_itens (id) on delete set null;

-- Mantém etapas.valor_orcado = soma dos itens.
create function public.recalcular_orcado_etapa()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_etapa uuid;
begin
  for v_etapa in
    select distinct x from unnest(array[
      case when tg_op in ('INSERT', 'UPDATE') then new.etapa_id end,
      case when tg_op in ('UPDATE', 'DELETE') then old.etapa_id end
    ]) x where x is not null
  loop
    update public.etapas e
    set valor_orcado = coalesce((select sum(total) from public.orcamento_itens i where i.etapa_id = v_etapa), 0)
    where e.id = v_etapa;
  end loop;
  return null;
end;
$$;

create trigger orcamento_itens_recalcular
after insert or update or delete on public.orcamento_itens
for each row execute function public.recalcular_orcado_etapa();

-- Importa o orçamento de uma obra (planilha própria): substitui os itens das etapas enviadas.
-- p_etapas: [{"nome": "ESTRUTURA", "itens": [{"descricao", "tipo", "quantidade", "unidade", "custo_unitario"}]}]
create function public.importar_orcamento(p_obra_id uuid, p_etapas jsonb)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_empresa uuid;
  v_etapa jsonb;
  v_etapa_id uuid;
  v_ordem int := 0;
  v_qtd int := 0;
begin
  select empresa_id into v_empresa from public.obras where id = p_obra_id;
  if v_empresa is null then raise exception 'obra não encontrada'; end if;

  for v_etapa in select value from jsonb_array_elements(coalesce(p_etapas, '[]'))
  loop
    v_ordem := v_ordem + 1;
    select id into v_etapa_id from public.etapas
    where obra_id = p_obra_id and upper(nome) = upper(v_etapa ->> 'nome');
    if v_etapa_id is null then
      insert into public.etapas (empresa_id, obra_id, nome, ordem)
      values (v_empresa, p_obra_id, upper(v_etapa ->> 'nome'), v_ordem)
      returning id into v_etapa_id;
    end if;

    delete from public.orcamento_itens where etapa_id = v_etapa_id;
    insert into public.orcamento_itens (empresa_id, obra_id, etapa_id, ordem, descricao, tipo, quantidade, unidade, custo_unitario)
    select v_empresa, p_obra_id, v_etapa_id, i.ordinality::int, i.value ->> 'descricao',
           coalesce(i.value ->> 'tipo', 'material'), coalesce((i.value ->> 'quantidade')::numeric, 1),
           i.value ->> 'unidade', coalesce((i.value ->> 'custo_unitario')::numeric, 0)
    from jsonb_array_elements(coalesce(v_etapa -> 'itens', '[]')) with ordinality i;
    v_qtd := v_qtd + jsonb_array_length(coalesce(v_etapa -> 'itens', '[]'));
    v_etapa_id := null;
  end loop;
  return v_qtd;
end;
$$;

revoke execute on function public.importar_orcamento(uuid, jsonb) from public, anon;
grant execute on function public.importar_orcamento(uuid, jsonb) to authenticated;

-- Substitui o cronograma da obra de uma vez (grade etapas x meses).
-- p_linhas: [{"etapa_id": "...", "mes": "2026-01-01", "percentual": 0.25}]
create function public.salvar_cronograma(p_obra_id uuid, p_linhas jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  select empresa_id into v_empresa from public.obras where id = p_obra_id;
  if v_empresa is null then raise exception 'obra não encontrada'; end if;
  delete from public.cronograma where obra_id = p_obra_id;
  insert into public.cronograma (empresa_id, obra_id, etapa_id, mes, percentual)
  select v_empresa, p_obra_id, (l ->> 'etapa_id')::uuid, (l ->> 'mes')::date, (l ->> 'percentual')::numeric
  from jsonb_array_elements(coalesce(p_linhas, '[]')) l
  where (l ->> 'percentual')::numeric > 0;
end;
$$;

revoke execute on function public.salvar_cronograma(uuid, jsonb) from public, anon;
grant execute on function public.salvar_cronograma(uuid, jsonb) to authenticated;
