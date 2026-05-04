-- Phase 9A content admin media upload policies.
--
-- The custom admin UI uploads blog cover images through a thin Next route
-- after the normal Supabase Auth + profiles.role admin guard. Storage still
-- needs its own RLS policies because the route uses the authenticated user's
-- Supabase context rather than a client-side service role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-media',
  'content-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "content_media_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'content-media'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create policy "content_media_admin_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'content-media'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create policy "content_media_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'content-media'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  bucket_id = 'content-media'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
