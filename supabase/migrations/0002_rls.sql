-- 8th Flame Delivery — Row Level Security
-- Model: browser/user sessions read through RLS. Privileged writes (status changes, assignments,
-- pricing, approvals) run in server code that first checks permissions, then uses the service role.

-- ───────────────────────── Role helpers (security definer, stable) ─────────────────────────
create or replace function public.current_user_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() in ('super_admin','operations_manager','dispatcher','support','finance'), false)
$$;

create or replace function public.is_ops() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() in ('super_admin','operations_manager','dispatcher'), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() in ('super_admin','operations_manager'), false)
$$;

create or replace function public.is_finance() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() in ('super_admin','finance'), false)
$$;

create or replace function public.current_driver_id() returns uuid
language sql stable security definer set search_path = public as $$
  select d.id from public.drivers d
  join public.profiles p on p.id = d.profile_id
  where d.profile_id = auth.uid() and d.status = 'approved' and p.is_active
$$;

create or replace function public.is_business_member(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members m join public.businesses bz on bz.id = m.business_id
    where m.business_id = b and m.profile_id = auth.uid() and bz.status = 'approved')
$$;

create or replace function public.is_business_admin(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.business_members
    where business_id = b and profile_id = auth.uid() and member_role in ('owner','admin'))
$$;

create or replace function public.driver_assigned_to(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shipment_assignments
    where shipment_id = s and is_active and driver_id = public.current_driver_id())
$$;

create or replace function public.can_view_shipment(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shipments sh where sh.id = s and (
      sh.customer_profile_id = auth.uid()
      or (sh.business_id is not null and public.is_business_member(sh.business_id))
      or public.driver_assigned_to(sh.id)
      or public.is_staff()))
$$;

-- ───────────────────────── Enable RLS everywhere ─────────────────────────
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles
create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- customers
create policy customers_read on public.customers for select using (profile_id = auth.uid() or public.is_staff());

-- employees
create policy employees_read on public.employees for select using (public.is_staff());

-- drivers
create policy drivers_read on public.drivers for select using (profile_id = auth.uid() or public.is_staff());
create policy drivers_self_availability on public.drivers for update
  using (profile_id = auth.uid() and status = 'approved') with check (profile_id = auth.uid() and status = 'approved');

-- driver applications (inserts go through the API with rate limiting)
create policy driver_apps_read on public.driver_applications for select using (profile_id = auth.uid() or public.is_admin());

-- businesses
create policy businesses_read on public.businesses for select
  using (owner_profile_id = auth.uid() or public.is_business_member(id) or public.is_staff());
create policy business_members_read on public.business_members for select
  using (profile_id = auth.uid() or public.is_business_member(business_id) or public.is_staff());

-- configuration: public can read ACTIVE items only (used to show service areas & services)
create policy service_areas_public on public.service_areas for select using (is_active or public.is_staff());
create policy area_routes_public on public.area_routes for select using (is_active or public.is_staff());
create policy services_public on public.shipping_services for select using (is_active or public.is_staff());
create policy pricing_rules_staff on public.pricing_rules for select using (public.is_staff());
create policy promo_codes_staff on public.promo_codes for select using (public.is_staff());
create policy settings_staff on public.platform_settings for select using (public.is_staff());

-- addresses
create policy addresses_owner on public.addresses for all
  using (profile_id = auth.uid() or (business_id is not null and public.is_business_member(business_id)))
  with check (profile_id = auth.uid() or (business_id is not null and public.is_business_member(business_id)));
create policy addresses_staff_read on public.addresses for select using (public.is_staff());

-- shipments & children (reads only; writes go through server)
create policy shipments_read on public.shipments for select using (public.can_view_shipment(id));
create policy packages_read on public.shipment_packages for select using (public.can_view_shipment(shipment_id));
create policy events_read on public.shipment_events for select
  using (public.can_view_shipment(shipment_id) and (is_public or public.is_staff() or public.driver_assigned_to(shipment_id)));
create policy assignments_read on public.shipment_assignments for select
  using (public.is_staff() or driver_id = public.current_driver_id());
create policy pickup_read on public.pickup_schedules for select using (public.can_view_shipment(shipment_id));
create policy routes_read on public.delivery_routes for select using (public.is_staff() or driver_id = public.current_driver_id());
create policy stops_read on public.route_stops for select using (
  public.is_staff() or exists (select 1 from public.delivery_routes r where r.id = route_id and r.driver_id = public.current_driver_id()));
create policy labels_read on public.shipping_labels for select using (public.can_view_shipment(shipment_id));

-- money
create policy payments_read on public.payments for select using (profile_id = auth.uid() or public.is_finance() or public.is_admin()
  or (shipment_id is not null and exists (select 1 from public.shipments s where s.id = shipment_id and s.business_id is not null and public.is_business_admin(s.business_id))));
create policy refunds_read on public.refunds for select using (public.is_finance() or public.is_admin());
create policy invoices_read on public.invoices for select using (public.is_business_admin(business_id) or public.is_finance() or public.is_admin());

-- notifications
create policy notifications_read on public.notifications for select using (profile_id = auth.uid() or public.is_admin());
create policy notifications_mark_read on public.notifications for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- support
create policy tickets_read on public.support_tickets for select using (profile_id = auth.uid() or public.is_staff());
create policy messages_read on public.support_messages for select using (
  public.is_staff() or (not is_internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.profile_id = auth.uid())));

-- audit
create policy audit_read on public.audit_logs for select using (public.is_admin());
