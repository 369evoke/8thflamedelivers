-- Atomic promo redemption counter (service role only)
create or replace function public.increment_promo(p_code text) returns void
language sql security definer set search_path = public as $$
  update public.promo_codes set times_redeemed = times_redeemed + 1 where code = upper(p_code);
$$;
revoke all on function public.increment_promo(text) from public, anon, authenticated;

-- Daily shipment volume + revenue for reports (staff only through server)
create or replace function public.report_daily(p_from date, p_to date)
returns table (day date, shipments bigint, delivered bigint, revenue_cents bigint)
language sql stable security definer set search_path = public as $$
  select d::date as day,
         count(s.id) as shipments,
         count(s.id) filter (where s.status = 'delivered') as delivered,
         coalesce(sum(s.total_cents) filter (where s.payment_status in ('paid','invoiced')), 0) as revenue_cents
  from generate_series(p_from, p_to, interval '1 day') d
  left join public.shipments s on s.created_at::date = d::date and s.status <> 'cancelled'
  group by d order by d;
$$;
revoke all on function public.report_daily(date, date) from public, anon, authenticated;
