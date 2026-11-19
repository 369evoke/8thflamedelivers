-- 8th Flame Delivery — core schema
-- Run with: supabase db push   (or paste into the Supabase SQL editor in order)

-- gen_random_uuid() is built into PostgreSQL 13+ (Supabase runs 15+)

-- ───────────────────────── Enums ─────────────────────────
create type public.user_role as enum (
  'customer', 'driver', 'super_admin', 'operations_manager', 'dispatcher', 'support', 'finance'
);

create type public.shipment_status as enum (
  'shipment_created', 'awaiting_confirmation', 'confirmed', 'pickup_scheduled', 'driver_assigned',
  'driver_en_route_pickup', 'picked_up', 'at_processing_facility', 'in_transit',
  'at_destination_facility', 'out_for_delivery', 'delivered', 'delivery_attempted',
  'delayed', 'exception', 'returned_to_sender', 'cancelled'
);

create type public.payment_status as enum (
  'unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'invoiced'
);

create type public.application_status as enum ('submitted', 'under_review', 'approved', 'rejected', 'suspended');
create type public.ticket_status as enum ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed');
create type public.invoice_status as enum ('draft', 'issued', 'paid', 'overdue', 'void');
create type public.route_status as enum ('planned', 'active', 'completed', 'cancelled');
create type public.billing_method as enum ('card', 'invoice');

-- ───────────────────────── Helpers ─────────────────────────
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────────────────── Identity ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete cascade,
  marketing_opt_in boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  title text,
  department text,
  hired_on date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.driver_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null check (length(full_name) between 2 and 120),
  email text not null,
  phone text not null,
  address text not null,
  city text not null,
  province char(2) not null,
  vehicle_type text not null,
  vehicle_info text,
  experience_years int check (experience_years between 0 and 60),
  availability text,
  qualifications text,
  document_paths text[] not null default '{}',
  status public.application_status not null default 'submitted',
  reviewer_id uuid references public.profiles(id),
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  application_id uuid references public.driver_applications(id),
  status public.application_status not null default 'approved',
  vehicle_type text,
  vehicle_info text,
  home_area_id uuid,
  is_available boolean not null default false,
  availability_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  contact_name text not null,
  phone text not null,
  address text not null,
  city text not null,
  province char(2) not null,
  business_type text,
  estimated_monthly_volume int check (estimated_monthly_volume >= 0),
  status public.application_status not null default 'submitted',
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 90),
  invoicing_enabled boolean not null default false,
  payment_terms_days int not null default 30 check (payment_terms_days between 0 and 120),
  owner_profile_id uuid references public.profiles(id),
  external_integrations jsonb not null default '{}'::jsonb, -- future: Shopify etc.
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, profile_id)
);

-- ───────────────────────── Network configuration ─────────────────────────
create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  province char(2) not null,
  postal_prefixes text[] not null default '{}',  -- FSAs e.g. {M5V,M4C}
  zone text not null default 'local',
  center_lat double precision,
  center_lng double precision,
  service_codes text[] not null default '{}',     -- services offered within this area
  price_multiplier numeric(5,3) not null default 1.000 check (price_multiplier between 0.5 and 5),
  is_active boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.drivers add constraint drivers_home_area_fk foreign key (home_area_id) references public.service_areas(id) on delete set null;

-- Intercity lanes between two areas
create table public.area_routes (
  id uuid primary key default gen_random_uuid(),
  origin_area_id uuid not null references public.service_areas(id) on delete cascade,
  destination_area_id uuid not null references public.service_areas(id) on delete cascade,
  service_codes text[] not null default '{}',
  surcharge_cents int not null default 0 check (surcharge_cents >= 0),
  transit_days int not null default 1 check (transit_days between 0 and 30),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (origin_area_id, destination_area_id)
);

create table public.shipping_services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z_]+$'),
  name text not null,
  description text,
  base_price_cents int not null check (base_price_cents >= 0),
  per_km_cents int not null default 0 check (per_km_cents >= 0),
  per_kg_cents int not null default 0 check (per_kg_cents >= 0),
  included_kg numeric(8,2) not null default 0,
  min_charge_cents int not null default 0 check (min_charge_cents >= 0),
  surcharge_cents int not null default 0 check (surcharge_cents >= 0),
  max_distance_km int check (max_distance_km > 0),
  transit_days int not null default 1,
  same_day boolean not null default false,
  business_only boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Generic, admin-configurable rules: taxes, handling fees, dimensional weight, area overrides
create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type text not null check (rule_type in ('tax', 'handling_fee', 'dim_divisor', 'area_override', 'fuel_surcharge_pct')),
  key text not null,                 -- e.g. province code 'ON', handling code 'fragile', service code
  label text not null,
  amount_cents int,                  -- flat amounts
  percent numeric(6,3),              -- percentages (tax, surcharges)
  numeric_value numeric(10,3),       -- e.g. dim divisor 5000
  service_code text,
  area_id uuid references public.service_areas(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_type, key, service_code)
);

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  description text,
  percent_off numeric(5,2) check (percent_off between 0 and 100),
  amount_off_cents int check (amount_off_cents >= 0),
  max_redemptions int,
  times_redeemed int not null default 0,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (percent_off is not null or amount_off_cents is not null)
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Addresses ─────────────────────────
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  label text,
  contact_name text not null,
  phone text,
  email text,
  street text not null,
  unit text,
  city text not null,
  province char(2) not null,
  postal_code text not null check (postal_code ~ '^[A-Z][0-9][A-Z] ?[0-9][A-Z][0-9]$'),
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (profile_id is not null or business_id is not null)
);

-- ───────────────────────── Shipments ─────────────────────────
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  tracking_number text not null unique,
  customer_profile_id uuid references public.profiles(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  guest_email text,
  guest_access_token text,             -- hashed token for guest receipt/label access
  service_code text not null references public.shipping_services(code),
  status public.shipment_status not null default 'shipment_created',
  payment_status public.payment_status not null default 'unpaid',
  billing_method public.billing_method not null default 'card',

  sender_name text not null, sender_phone text not null, sender_email text not null,
  pickup_street text not null, pickup_unit text, pickup_city text not null, pickup_province char(2) not null,
  pickup_postal text not null, pickup_instructions text, pickup_lat double precision, pickup_lng double precision,
  pickup_date date not null, pickup_window text not null,
  pickup_area_id uuid references public.service_areas(id),

  recipient_name text not null, recipient_phone text not null, recipient_email text,
  delivery_street text not null, delivery_unit text, delivery_city text not null, delivery_province char(2) not null,
  delivery_postal text not null, delivery_instructions text, delivery_lat double precision, delivery_lng double precision,
  delivery_area_id uuid references public.service_areas(id),

  distance_km numeric(8,2) not null,
  distance_source text not null default 'estimate' check (distance_source in ('google', 'mapbox', 'estimate')),
  package_count int not null check (package_count between 1 and 500),
  total_weight_kg numeric(10,2) not null check (total_weight_kg > 0),
  billable_weight_kg numeric(10,2) not null,
  price_breakdown jsonb not null,
  subtotal_cents int not null check (subtotal_cents >= 0),
  discount_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int not null check (total_cents >= 0),
  currency char(3) not null default 'CAD',
  promo_code text,
  invoice_id uuid,
  estimated_delivery_date date,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  internal_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shipments_customer_idx on public.shipments(customer_profile_id, created_at desc);
create index shipments_business_idx on public.shipments(business_id, created_at desc);
create index shipments_status_idx on public.shipments(status);
create index shipments_created_idx on public.shipments(created_at desc);
create index shipments_pickup_date_idx on public.shipments(pickup_date);

create table public.shipment_packages (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  package_type text not null,
  description text not null,
  quantity int not null default 1 check (quantity between 1 and 100),
  weight_kg numeric(8,2) not null check (weight_kg > 0),
  length_cm numeric(8,1) not null check (length_cm > 0),
  width_cm numeric(8,1) not null check (width_cm > 0),
  height_cm numeric(8,1) not null check (height_cm > 0),
  special_handling text[] not null default '{}',
  declared_value_cents int check (declared_value_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipment_packages_shipment_idx on public.shipment_packages(shipment_id);

create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status public.shipment_status not null,
  location text,
  notes text,                       -- shown publicly only when is_public
  internal_notes text,              -- staff only
  is_public boolean not null default true,
  actor_profile_id uuid references public.profiles(id),
  actor_label text not null default 'system',
  pod_recipient_name text,
  pod_photo_path text,
  pod_signature_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipment_events_shipment_idx on public.shipment_events(shipment_id, created_at);

create table public.delivery_routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  route_date date not null,
  driver_id uuid references public.drivers(id) on delete set null,
  area_id uuid references public.service_areas(id),
  status public.route_status not null default 'planned',
  notes text,
  optimization_meta jsonb,          -- reserved for future route optimization
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index delivery_routes_driver_idx on public.delivery_routes(driver_id, route_date);

create table public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.delivery_routes(id) on delete cascade,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  stop_type text not null check (stop_type in ('pickup', 'delivery')),
  sequence int not null check (sequence >= 1),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, shipment_id, stop_type)
);

create table public.shipment_assignments (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  route_id uuid references public.delivery_routes(id) on delete set null,
  assignment_type text not null default 'full' check (assignment_type in ('pickup', 'delivery', 'full')),
  is_active boolean not null default true,
  assigned_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipment_assignments_driver_idx on public.shipment_assignments(driver_id) where is_active;
create unique index shipment_assignments_one_active on public.shipment_assignments(shipment_id, assignment_type) where is_active;

create table public.pickup_schedules (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null unique references public.shipments(id) on delete cascade,
  scheduled_date date not null,
  window_start time not null,
  window_end time not null check (window_end > window_start),
  scheduled_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Money ─────────────────────────
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  business_id uuid not null references public.businesses(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  subtotal_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int not null default 0,
  status public.invoice_status not null default 'draft',
  due_date date,
  paid_at timestamptz,
  paid_marked_by uuid references public.profiles(id),
  payment_reference text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shipments add constraint shipments_invoice_fk foreign key (invoice_id) references public.invoices(id) on delete set null;
create index invoices_business_idx on public.invoices(business_id, created_at desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid references public.shipments(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  provider text not null default 'stripe' check (provider in ('stripe', 'offline')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  amount_cents int not null check (amount_cents >= 0),
  currency char(3) not null default 'CAD',
  status public.payment_status not null default 'pending',
  failure_reason text,
  receipt_number text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_shipment_idx on public.payments(shipment_id);
create index payments_profile_idx on public.payments(profile_id, created_at desc);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  amount_cents int not null check (amount_cents > 0),
  reason text not null,
  stripe_refund_id text unique,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  processed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipping_labels (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  format text not null check (format in ('4x6', 'letter')),
  storage_path text,
  generated_by uuid references public.profiles(id),
  download_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipping_labels_shipment_idx on public.shipping_labels(shipment_id);

-- ───────────────────────── Comms ─────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  audience text not null default 'customer' check (audience in ('customer', 'driver', 'staff', 'business')),
  recipient_email text,
  channel text not null default 'email' check (channel in ('email', 'in_app', 'sms')),
  template text not null,
  subject text not null,
  body text not null,
  shipment_id uuid references public.shipments(id) on delete cascade,
  delivery_status text not null default 'queued' check (delivery_status in ('queued', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_profile_idx on public.notifications(profile_id, created_at desc);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  profile_id uuid references public.profiles(id) on delete set null,
  contact_email text not null,
  contact_name text,
  shipment_id uuid references public.shipments(id) on delete set null,
  category text not null check (category in ('missing_shipment', 'delayed_shipment', 'billing', 'damage', 'general', 'business', 'driver')),
  subject text not null check (length(subject) between 3 and 200),
  status public.ticket_status not null default 'open',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references public.profiles(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_profile_idx on public.support_tickets(profile_id);
create index support_tickets_status_idx on public.support_tickets(status);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_profile_id uuid references public.profiles(id) on delete set null,
  author_label text not null,
  body text not null check (length(body) between 1 and 5000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages(ticket_id, created_at);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

-- ───────────────────────── updated_at triggers ─────────────────────────
do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','customers','employees','driver_applications','drivers','businesses','business_members',
    'service_areas','area_routes','shipping_services','pricing_rules','promo_codes','platform_settings',
    'addresses','shipments','shipment_packages','shipment_events','delivery_routes','route_stops',
    'shipment_assignments','pickup_schedules','invoices','payments','refunds','shipping_labels',
    'notifications','support_tickets','support_messages','audit_logs'])
  loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ───────────────────────── New-user bootstrap ─────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  insert into public.customers (profile_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent users from changing their own role / active flag (only service role may)
create or replace function public.guard_profile_privileges() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'Not permitted to change role or account status';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_privileges();
