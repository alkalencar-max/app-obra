-- Realizado (pago) por mês, para a curva previsto x realizado do dashboard.
create view public.v_realizado_mensal with (security_invoker = true) as
select
  l.obra_id,
  date_trunc('month', l.data)::date as mes,
  sum(l.valor)::numeric(14, 2) as pago
from public.lancamentos l
where l.status = 'pago'
group by l.obra_id, date_trunc('month', l.data);

grant select on public.v_realizado_mensal to authenticated;
