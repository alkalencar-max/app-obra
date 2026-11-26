-- App Obra: instalação completa do banco. Cole tudo no SQL Editor do Supabase e clique em Run.
-- Gerado a partir de supabase/migrations (mesmo conteúdo, na ordem).

-- ===== supabase/migrations/20261126000001_base.sql =====
-- App Obra: base do sistema (empresas, obras, etapas, grupos, fornecedores, medições, lançamentos)
-- Cada tabela carrega empresa_id; as políticas de RLS só deixam o usuário ver as empresas de que é membro.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Empresas e membros
-- ---------------------------------------------------------------------------

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  created_at timestamptz not null default now()
);

create table public.membros (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  papel text not null default 'admin' check (papel in ('admin', 'engenheiro', 'comprador', 'campo')),
  created_at timestamptz not null default now(),
  primary key (empresa_id, user_id)
);

create index membros_user_idx on public.membros (user_id);

-- Empresas do usuário logado. security definer evita recursão de RLS em membros.
create function public.minhas_empresas()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select empresa_id from public.membros where user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Cadastros
-- ---------------------------------------------------------------------------

create table public.obras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  endereco text,
  cliente text,
  area_m2 numeric(12, 2),
  inicio_planejado date,
  fim_planejado date,
  fim_atualizado date,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluida', 'pausada')),
  created_at timestamptz not null default now(),
  unique (id, empresa_id)
);

create index obras_empresa_idx on public.obras (empresa_id);

create table public.etapas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  nome text not null,
  ordem int not null default 0,
  quantidade numeric(14, 2),
  unidade text,
  valor_orcado numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  foreign key (obra_id, empresa_id) references public.obras (id, empresa_id) on delete cascade,
  unique (obra_id, nome),
  unique (id, obra_id)
);

create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  unique (empresa_id, nome),
  unique (id, empresa_id)
);

create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  categoria text,
  cnpj text,
  contato text,
  telefone text,
  chave_pix text,
  created_at timestamptz not null default now(),
  unique (empresa_id, nome),
  unique (id, empresa_id)
);

-- Apropriação: a "conta" usada no dia a dia (Canteiro, Projetos, Chapisco e Reboco...).
-- Cada uma pertence a uma etapa do orçamento, o que monta o orçado x realizado sem conta manual.
create table public.apropriacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  nome text not null,
  etapa_id uuid,
  ordem int not null default 0,
  foreign key (obra_id, empresa_id) references public.obras (id, empresa_id) on delete cascade,
  foreign key (etapa_id, obra_id) references public.etapas (id, obra_id) on delete set null (etapa_id),
  unique (obra_id, nome),
  unique (id, obra_id)
);

-- Cronograma físico-financeiro: percentual do valor orçado da etapa em cada mês.
create table public.cronograma (
  empresa_id uuid not null,
  obra_id uuid not null,
  etapa_id uuid not null,
  mes date not null check (extract(day from mes) = 1),
  percentual numeric(12, 10) not null check (percentual >= 0 and percentual <= 1),
  primary key (etapa_id, mes),
  foreign key (obra_id, empresa_id) references public.obras (id, empresa_id) on delete cascade,
  foreign key (etapa_id, obra_id) references public.etapas (id, obra_id) on delete cascade
);

-- Boletim de medição (BM01, BM02...): o período mensal em que os lançamentos são fechados.
create table public.medicoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  numero int not null check (numero > 0),
  periodo date,
  data date,
  foreign key (obra_id, empresa_id) references public.obras (id, empresa_id) on delete cascade,
  unique (obra_id, numero),
  unique (id, obra_id)
);

create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  data date not null,
  valor numeric(14, 2) not null check (valor <> 0),
  fornecedor_id uuid,
  descricao text not null,
  apropriacao_id uuid not null,
  grupo_id uuid,
  medicao_id uuid,
  obs text,
  status text not null default 'pago' check (status in ('pago', 'a_pagar')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (obra_id, empresa_id) references public.obras (id, empresa_id) on delete cascade,
  foreign key (apropriacao_id, obra_id) references public.apropriacoes (id, obra_id),
  foreign key (medicao_id, obra_id) references public.medicoes (id, obra_id),
  foreign key (grupo_id, empresa_id) references public.grupos (id, empresa_id),
  foreign key (fornecedor_id, empresa_id) references public.fornecedores (id, empresa_id)
);

create index lancamentos_obra_data_idx on public.lancamentos (obra_id, data);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.empresas enable row level security;
alter table public.membros enable row level security;
alter table public.obras enable row level security;
alter table public.etapas enable row level security;
alter table public.grupos enable row level security;
alter table public.fornecedores enable row level security;
alter table public.apropriacoes enable row level security;
alter table public.cronograma enable row level security;
alter table public.medicoes enable row level security;
alter table public.lancamentos enable row level security;

create policy empresas_select on public.empresas
  for select to authenticated using (id in (select public.minhas_empresas()));
create policy empresas_update on public.empresas
  for update to authenticated using (id in (select public.minhas_empresas()));

create policy membros_select on public.membros
  for select to authenticated using (empresa_id in (select public.minhas_empresas()));

create policy obras_all on public.obras
  for all to authenticated
  using (empresa_id in (select public.minhas_empresas()))
  with check (empresa_id in (select public.minhas_empresas()));
create policy etapas_all on public.etapas
  for all to authenticated
  using (empresa_id in (select public.minhas_empresas()))
  with check (empresa_id in (select public.minhas_empresas()));
create policy grupos_all on public.grupos
  for all to authenticated
  using (empresa_id in (select public.minhas_empresas()))
  with check (empresa_id in (select public.minhas_empresas()));
create policy fornecedores_all on public.fornecedores
  for all to authenticated
  using (empresa_id in (select public.minhas_empresas()))
  with check (empresa_id in (select public.minhas_empresas()));
create policy apropriacoes_all on public.apropriacoes
  for all to authenticated
  using (empresa_id in (select public.minhas_empresas()))
  with check (empresa_id in (select public.minhas_empresas()));
create policy cronograma_all on public.cronograma
  for all to authenticated
  using (empresa_id in (select public.minhas_empresas()))
  with check (empresa_id in (select public.minhas_empresas()));
create policy medicoes_all on public.medicoes
  for all to authenticated
  using (empresa_id in (select public.minhas_empresas()))
  with check (empresa_id in (select public.minhas_empresas()));
create policy lancamentos_all on public.lancamentos
  for all to authenticated
  using (empresa_id in (select public.minhas_empresas()))
  with check (empresa_id in (select public.minhas_empresas()));

-- ---------------------------------------------------------------------------
-- Primeiro acesso: cria a empresa, torna o usuário admin e cadastra os grupos padrão.
-- ---------------------------------------------------------------------------

create function public.criar_empresa(p_nome text, p_cnpj text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;

  insert into public.empresas (nome, cnpj) values (p_nome, p_cnpj) returning id into v_id;
  insert into public.membros (empresa_id, user_id, papel) values (v_id, auth.uid(), 'admin');

  insert into public.grupos (empresa_id, nome, ordem)
  select v_id, g.nome, g.ordem
  from (values
    ('MATERIAIS', 1),
    ('SERVIÇOS EMPREITEIRO', 2),
    ('SERVIÇOS TERCEIROS', 3),
    ('SERVIÇOS + MATERIAIS TERCEIROS', 4),
    ('EQUIPAMENTOS', 5),
    ('PROJETOS', 6),
    ('SERVIÇOS ADM', 7),
    ('TAXAS', 8),
    ('IMPOSTOS DE CONSTRUÇÃO', 9),
    ('SERVIÇOS FINAIS', 10)
  ) as g (nome, ordem);

  return v_id;
end;
$$;

revoke execute on function public.criar_empresa(text, text) from public, anon;
grant execute on function public.criar_empresa(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Visões do dashboard (security_invoker: respeitam o RLS de quem consulta)
-- ---------------------------------------------------------------------------

create view public.v_apropriacao_resumo with (security_invoker = true) as
select
  a.obra_id,
  a.id as apropriacao_id,
  a.nome,
  a.etapa_id,
  coalesce(sum(l.valor) filter (where l.status = 'pago'), 0)::numeric(14, 2) as pago,
  coalesce(sum(l.valor) filter (where l.status = 'a_pagar'), 0)::numeric(14, 2) as a_pagar
from public.apropriacoes a
left join public.lancamentos l on l.apropriacao_id = a.id
group by a.id;

-- Lançamentos de apropriações ainda sem etapa aparecem numa linha "SEM ETAPA" (etapa_id nulo).
create view public.v_etapa_resumo with (security_invoker = true) as
select
  e.obra_id,
  e.id as etapa_id,
  e.nome,
  e.ordem,
  e.valor_orcado as orcado,
  coalesce(sum(r.pago), 0)::numeric(14, 2) as pago,
  coalesce(sum(r.a_pagar), 0)::numeric(14, 2) as a_pagar
from public.etapas e
left join public.v_apropriacao_resumo r on r.etapa_id = e.id
group by e.id
union all
select
  r.obra_id,
  null,
  'SEM ETAPA',
  2147483647,
  0,
  sum(r.pago)::numeric(14, 2),
  sum(r.a_pagar)::numeric(14, 2)
from public.v_apropriacao_resumo r
where r.etapa_id is null
group by r.obra_id
having sum(r.pago) <> 0 or sum(r.a_pagar) <> 0;

create view public.v_grupo_resumo with (security_invoker = true) as
select
  l.obra_id,
  coalesce(g.nome, 'SEM GRUPO') as grupo,
  sum(l.valor)::numeric(14, 2) as pago
from public.lancamentos l
left join public.grupos g on g.id = l.grupo_id
where l.status = 'pago'
group by l.obra_id, coalesce(g.nome, 'SEM GRUPO');

create view public.v_medicao_resumo with (security_invoker = true) as
select
  m.obra_id,
  m.id as medicao_id,
  m.numero,
  m.periodo,
  coalesce(sum(l.valor) filter (where l.status = 'pago'), 0)::numeric(14, 2) as pago
from public.medicoes m
left join public.lancamentos l on l.medicao_id = m.id
group by m.id;

-- Desembolso previsto por mês (cronograma x orçado).
create view public.v_cronograma_mensal with (security_invoker = true) as
select
  c.obra_id,
  c.mes,
  sum(c.percentual * e.valor_orcado)::numeric(14, 2) as previsto
from public.cronograma c
join public.etapas e on e.id = c.etapa_id
group by c.obra_id, c.mes;

-- ===== supabase/migrations/20261126000002_importar_obra.sql =====
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
