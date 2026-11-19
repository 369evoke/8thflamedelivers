-- Private storage buckets. Files are never public; the app serves them through signed URLs
-- after checking permissions server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('driver-documents', 'driver-documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('proof-of-delivery', 'proof-of-delivery', false, 8388608, array['image/jpeg','image/png','image/webp']),
  ('labels', 'labels', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

-- Staff may read every object in these buckets; uploads go through the server (service role).
create policy "staff read private buckets" on storage.objects for select
  using (bucket_id in ('driver-documents','proof-of-delivery','labels') and public.is_staff());
