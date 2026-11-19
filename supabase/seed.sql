-- 8th Flame Delivery — starting configuration.
-- Every price below is a PLACEHOLDER for you to review in Admin → Pricing before launch.
-- Service areas are seeded INACTIVE: nothing is advertised until an admin activates it.

insert into public.shipping_services (code, name, description, base_price_cents, per_km_cents, per_kg_cents, included_kg, min_charge_cents, surcharge_cents, max_distance_km, transit_days, same_day, business_only, sort_order) values
  ('same_day',  'Same-Day Courier',   'Picked up and delivered the same business day within a local zone.', 1800, 120, 60, 5, 2500, 800, 80, 0, true, false, 1),
  ('scheduled', 'Scheduled Delivery', 'Choose your pickup date and time window; delivered on a planned route.', 1200, 80, 50, 5, 1500, 0, 250, 1, false, false, 2),
  ('standard',  'Standard Delivery',  'Economical parcel delivery, typically 1–3 business days.', 900, 45, 40, 5, 1100, 0, 600, 2, false, false, 3),
  ('business',  'Business Shipping',  'Volume shipping for approved business accounts with negotiated rates.', 800, 40, 35, 5, 950, 0, 600, 2, false, true, 4)
on conflict (code) do nothing;

insert into public.pricing_rules (rule_type, key, label, percent, amount_cents, numeric_value) values
  ('dim_divisor', 'default', 'Dimensional weight divisor (cm³/kg)', null, null, 5000),
  ('handling_fee', 'fragile', 'Fragile handling', null, 500, null),
  ('handling_fee', 'signature_required', 'Signature required', null, 300, null),
  ('handling_fee', 'oversized', 'Oversized item handling', null, 1500, null),
  ('handling_fee', 'keep_upright', 'Keep upright', null, 200, null),
  ('tax', 'ON', 'HST (ON)', 13.000, null, null),
  ('tax', 'NB', 'HST (NB)', 15.000, null, null),
  ('tax', 'NL', 'HST (NL)', 15.000, null, null),
  ('tax', 'NS', 'HST (NS)', 14.000, null, null),
  ('tax', 'PE', 'HST (PE)', 15.000, null, null),
  ('tax', 'QC', 'GST + QST (QC)', 14.975, null, null),
  ('tax', 'BC', 'GST (BC)', 5.000, null, null),
  ('tax', 'AB', 'GST (AB)', 5.000, null, null),
  ('tax', 'SK', 'GST (SK)', 5.000, null, null),
  ('tax', 'MB', 'GST (MB)', 5.000, null, null),
  ('tax', 'YT', 'GST (YT)', 5.000, null, null),
  ('tax', 'NT', 'GST (NT)', 5.000, null, null),
  ('tax', 'NU', 'GST (NU)', 5.000, null, null)
on conflict do nothing;

insert into public.platform_settings (key, value, description) values
  ('package_limits', '{"max_weight_kg": 30, "max_length_cm": 150, "max_girth_cm": 300, "max_packages": 25}', 'Per-package and per-shipment limits'),
  ('restricted_items', '{"keywords": ["firearm","ammunition","explosive","fireworks","gasoline","propane","lithium battery (loose)","cannabis","alcohol","cash","currency","live animal","human remains","hazardous","corrosive","flammable","poison","narcotic"]}', 'Descriptions containing these words are blocked at booking'),
  ('pickup_windows', '["08:00-10:00","10:00-12:00","12:00-14:00","14:00-16:00","16:00-18:00"]', 'Pickup time windows offered to customers'),
  ('cancellation_policy', '{"cancellable_statuses": ["shipment_created","awaiting_confirmation","confirmed","pickup_scheduled"]}', 'Customers may self-cancel only in these statuses'),
  ('company', '{"name": "8th Flame Delivery", "support_email": "support@example.com", "phone": "", "address": ""}', 'Public company contact details — edit before launch')
on conflict (key) do nothing;

-- Example Greater Toronto areas — INACTIVE until reviewed. Coordinates are area centroids used
-- for distance estimates when no maps API key is configured.
insert into public.service_areas (name, city, province, postal_prefixes, zone, center_lat, center_lng, service_codes, is_active, sort_order) values
  ('Downtown Toronto', 'Toronto', 'ON', '{M5A,M5B,M5C,M5E,M5G,M5H,M5J,M5K,M5L,M5S,M5T,M5V,M5X,M4Y,M6J,M6K}', 'local', 43.6510, -79.3830, '{same_day,scheduled,standard,business}', false, 1),
  ('Mississauga', 'Mississauga', 'ON', '{L4T,L4V,L4W,L4X,L4Y,L4Z,L5A,L5B,L5C,L5E,L5G,L5H,L5J,L5K,L5L,L5M,L5N,L5R,L5V,L5W}', 'local', 43.5890, -79.6441, '{same_day,scheduled,standard,business}', false, 2),
  ('Hamilton', 'Hamilton', 'ON', '{L8E,L8G,L8H,L8J,L8K,L8L,L8M,L8N,L8P,L8R,L8S,L8T,L8V,L8W,L9A,L9B,L9C,L9G,L9H,L9K}', 'regional', 43.2557, -79.8711, '{scheduled,standard,business}', false, 3)
on conflict do nothing;
