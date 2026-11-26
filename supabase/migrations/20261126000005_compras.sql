-- Compras: cotação (COT86) com até N fornecedores -> pedido de compra (PED86) -> parcelas a pagar no financeiro.
-- O número é por empresa e é o mesmo na cotação e no pedido.

create table public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  numero int not null check (numero > 0),
  titulo text not null,
  data date not null default current_date,
  apropriacao_id uuid,
  grupo_id uuid,
  status text not null default 'aberta' check (status in ('aberta', 'pedido', 'cancelada')),
  obs text,
  created_at timestamptz not null default now(),
  foreign key (obra_id, empresa_id) references public.obras (id, empresa_id) on delete cascade,
  foreign key (apropriacao_id, obra_id) references public.apropriacoes (id, obra_id),
  foreign key (grupo_id, empresa_id) references public.grupos (id, empresa_id),
  unique (empresa_id, numero),
  unique (id, empresa_id)
);

create index cotacoes_obra_idx on public.cotacoes (obra_id);

create table public.cotacao_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  cotacao_id uuid not null,
  ordem int not null default 0,
  descricao text not null,
  quantidade numeric(14, 4) not null check (quantidade > 0),
  unidade text,
  foreign key (cotacao_id, empresa_id) references public.cotacoes (id, empresa_id) on delete cascade,
  unique (id, cotacao_id)
);

-- Proposta de cada fornecedor na cotação (uma coluna do mapa de cotações).
create table public.cotacao_propostas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  cotacao_id uuid not null,
  fornecedor_id uuid not null,
  ordem int not null default 0,
  frete numeric(14, 2) not null default 0,
  desconto numeric(14, 2) not null default 0,
  condicao_pagamento text,
  prazo_entrega text,
  obs text,
  foreign key (cotacao_id, empresa_id) references public.cotacoes (id, empresa_id) on delete cascade,
  foreign key (fornecedor_id, empresa_id) references public.fornecedores (id, empresa_id),
  unique (cotacao_id, fornecedor_id),
  unique (id, cotacao_id)
);

create table public.cotacao_precos (
  empresa_id uuid not null,
  cotacao_id uuid not null,
  proposta_id uuid not null,
  item_id uuid not null,
  valor_unitario numeric(14, 4) not null check (valor_unitario >= 0),
  primary key (proposta_id, item_id),
  foreign key (proposta_id, cotacao_id) references public.cotacao_propostas (id, cotacao_id) on delete cascade,
  foreign key (item_id, cotacao_id) references public.cotacao_itens (id, cotacao_id) on delete cascade
);

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  cotacao_id uuid not null unique,
  proposta_id uuid not null,
  numero int not null,
  data date not null default current_date,
  fornecedor_id uuid not null,
  total numeric(14, 2) not null,
  condicao_pagamento text,
  status text not null default 'emitido' check (status in ('emitido', 'recebido', 'cancelado')),
  recebido_em date,
  nota_fiscal text,
  created_at timestamptz not null default now(),
  foreign key (obra_id, empresa_id) references public.obras (id, empresa_id) on delete cascade,
  foreign key (cotacao_id, empresa_id) references public.cotacoes (id, empresa_id) on delete cascade,
  foreign key (proposta_id, cotacao_id) references public.cotacao_propostas (id, cotacao_id),
  foreign key (fornecedor_id, empresa_id) references public.fornecedores (id, empresa_id),
  unique (empresa_id, numero),
  unique (id, obra_id)
);

-- Parcelas do pedido entram no financeiro como lançamentos "a pagar" com vencimento.
alter table public.lancamentos add column pedido_id uuid;
alter table public.lancamentos add column vencimento date;
alter table public.lancamentos
  add constraint lancamentos_pedido_fk foreign key (pedido_id, obra_id) references public.pedidos (id, obra_id) on delete cascade;
create index lancamentos_pedido_idx on public.lancamentos (pedido_id);

alter table public.cotacoes enable row level security;
alter table public.cotacao_itens enable row level security;
alter table public.cotacao_propostas enable row level security;
alter table public.cotacao_precos enable row level security;
alter table public.pedidos enable row level security;

create policy cotacoes_all on public.cotacoes for all to authenticated
  using (empresa_id in (select public.minhas_empresas())) with check (empresa_id in (select public.minhas_empresas()));
create policy cotacao_itens_all on public.cotacao_itens for all to authenticated
  using (empresa_id in (select public.minhas_empresas())) with check (empresa_id in (select public.minhas_empresas()));
create policy cotacao_propostas_all on public.cotacao_propostas for all to authenticated
  using (empresa_id in (select public.minhas_empresas())) with check (empresa_id in (select public.minhas_empresas()));
create policy cotacao_precos_all on public.cotacao_precos for all to authenticated
  using (empresa_id in (select public.minhas_empresas())) with check (empresa_id in (select public.minhas_empresas()));
create policy pedidos_all on public.pedidos for all to authenticated
  using (empresa_id in (select public.minhas_empresas())) with check (empresa_id in (select public.minhas_empresas()));

grant select, insert, update, delete on public.cotacoes, public.cotacao_itens, public.cotacao_propostas,
  public.cotacao_precos, public.pedidos to authenticated;

-- Total de cada proposta: soma dos itens + frete - desconto.
create view public.v_proposta_total with (security_invoker = true) as
select
  p.id as proposta_id,
  p.cotacao_id,
  p.fornecedor_id,
  coalesce(sum(round(i.quantidade * pr.valor_unitario, 2)), 0)::numeric(14, 2) as soma,
  count(pr.item_id)::int as itens_cotados,
  (coalesce(sum(round(i.quantidade * pr.valor_unitario, 2)), 0) + p.frete - p.desconto)::numeric(14, 2) as total
from public.cotacao_propostas p
left join public.cotacao_precos pr on pr.proposta_id = p.id
left join public.cotacao_itens i on i.id = pr.item_id
group by p.id;

grant select on public.v_proposta_total to authenticated;

-- Gera o pedido a partir da proposta escolhida e lança as parcelas a pagar.
-- p_parcelas: [{"vencimento": "2026-12-20", "valor": 1234.56}, ...] — a soma tem de bater com o total.
create function public.gerar_pedido(p_proposta_id uuid, p_parcelas jsonb, p_condicao text default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cot public.cotacoes;
  v_prop public.cotacao_propostas;
  v_total numeric(14, 2);
  v_pedido uuid;
  v_n int := jsonb_array_length(coalesce(p_parcelas, '[]'));
begin
  select * into v_prop from public.cotacao_propostas where id = p_proposta_id;
  if not found then raise exception 'proposta não encontrada'; end if;
  select * into v_cot from public.cotacoes where id = v_prop.cotacao_id for update;
  if v_cot.status <> 'aberta' then raise exception 'esta cotação já virou pedido ou foi cancelada'; end if;
  if v_cot.apropriacao_id is null then raise exception 'escolha a apropriação da cotação antes de gerar o pedido'; end if;

  select total into v_total from public.v_proposta_total where proposta_id = p_proposta_id;
  if v_total <= 0 then raise exception 'a proposta escolhida não tem preços'; end if;
  if v_n = 0 then raise exception 'informe ao menos uma parcela'; end if;
  if (select sum((x ->> 'valor')::numeric) from jsonb_array_elements(p_parcelas) x) <> v_total then
    raise exception 'a soma das parcelas (%) não bate com o total do pedido (%)',
      (select sum((x ->> 'valor')::numeric) from jsonb_array_elements(p_parcelas) x), v_total;
  end if;

  insert into public.pedidos (empresa_id, obra_id, cotacao_id, proposta_id, numero, fornecedor_id, total, condicao_pagamento)
  values (v_cot.empresa_id, v_cot.obra_id, v_cot.id, v_prop.id, v_cot.numero, v_prop.fornecedor_id, v_total,
          coalesce(p_condicao, v_prop.condicao_pagamento))
  returning id into v_pedido;

  insert into public.lancamentos (
    empresa_id, obra_id, data, vencimento, valor, fornecedor_id, descricao, apropriacao_id, grupo_id, status, pedido_id
  )
  select
    v_cot.empresa_id, v_cot.obra_id, (x.value ->> 'vencimento')::date, (x.value ->> 'vencimento')::date,
    (x.value ->> 'valor')::numeric, v_prop.fornecedor_id,
    'PED' || v_cot.numero || ' - ' || v_cot.titulo || case when v_n > 1 then ' (' || x.ordinality || '/' || v_n || ')' else '' end,
    v_cot.apropriacao_id, v_cot.grupo_id, 'a_pagar', v_pedido
  from jsonb_array_elements(p_parcelas) with ordinality x;

  update public.cotacoes set status = 'pedido' where id = v_cot.id;
  return v_pedido;
end;
$$;

revoke execute on function public.gerar_pedido(uuid, jsonb, text) from public, anon;
grant execute on function public.gerar_pedido(uuid, jsonb, text) to authenticated;

-- Pedido x pago por etapa, para o relatório orçado x pedido x pago.
create view public.v_etapa_pedido with (security_invoker = true) as
select
  ped.obra_id,
  a.etapa_id,
  sum(ped.total)::numeric(14, 2) as pedido
from public.pedidos ped
join public.cotacoes c on c.id = ped.cotacao_id
join public.apropriacoes a on a.id = c.apropriacao_id
where ped.status <> 'cancelado'
group by ped.obra_id, a.etapa_id;

grant select on public.v_etapa_pedido to authenticated;
