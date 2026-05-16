-- Harden known Supabase performance advisor RLS warnings.
-- - Wrap non-row-dependent auth/admin helper calls with SELECT initPlans.
-- - Collapse authenticated SELECT visibility to one permissive policy per table.

-- 0003_auth_rls_initplan

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and role = case
    when (select public.is_admin()) then 'admin'
    else 'user'
  end
);

drop policy if exists reservation_intake_select_own_or_admin on public.reservation_intake;
create policy reservation_intake_select_own_or_admin
on public.reservation_intake
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

drop policy if exists chatwoot_conversations_select_own_or_admin on public.chatwoot_conversations;
create policy chatwoot_conversations_select_own_or_admin
on public.chatwoot_conversations
for select
to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists sale_leads_select_own_or_admin on public.sale_leads;
create policy sale_leads_select_own_or_admin
on public.sale_leads
for select
to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists sale_leads_insert_own_sale_listing on public.sale_leads;
create policy sale_leads_insert_own_sale_listing
on public.sale_leads
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.listings as l
    where l.id = listing_id
      and l.type = 'sale'
      and l.status = 'active'
  )
);

drop policy if exists sale_lead_events_select_own_or_admin on public.sale_lead_events;
create policy sale_lead_events_select_own_or_admin
on public.sale_lead_events
for select
to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1
    from public.sale_leads as sl
    where sl.id = lead_id
      and sl.user_id = (select auth.uid())
  )
);

-- 0006_multiple_permissive_policies

drop policy if exists consultants_public_read_active on public.consultants;
drop policy if exists consultants_admin_manage on public.consultants;
drop policy if exists consultants_authenticated_read_visible_or_admin on public.consultants;
drop policy if exists consultants_admin_insert on public.consultants;
drop policy if exists consultants_admin_update on public.consultants;
drop policy if exists consultants_admin_delete on public.consultants;

create policy consultants_public_read_active
on public.consultants
for select
to anon
using (is_active = true);

create policy consultants_authenticated_read_visible_or_admin
on public.consultants
for select
to authenticated
using (is_active = true or (select public.is_admin()));

create policy consultants_admin_insert
on public.consultants
for insert
to authenticated
with check ((select public.is_admin()));

create policy consultants_admin_update
on public.consultants
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy consultants_admin_delete
on public.consultants
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists listings_public_read_active on public.listings;
drop policy if exists listings_admin_manage on public.listings;
drop policy if exists listings_authenticated_read_visible_or_admin on public.listings;
drop policy if exists listings_admin_insert on public.listings;
drop policy if exists listings_admin_update on public.listings;
drop policy if exists listings_admin_delete on public.listings;

create policy listings_public_read_active
on public.listings
for select
to anon
using (status = 'active');

create policy listings_authenticated_read_visible_or_admin
on public.listings
for select
to authenticated
using (status = 'active' or (select public.is_admin()));

create policy listings_admin_insert
on public.listings
for insert
to authenticated
with check ((select public.is_admin()));

create policy listings_admin_update
on public.listings
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy listings_admin_delete
on public.listings
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists listing_images_public_read_active_listings on public.listing_images;
drop policy if exists listing_images_admin_manage on public.listing_images;
drop policy if exists listing_images_authenticated_read_visible_or_admin on public.listing_images;
drop policy if exists listing_images_admin_insert on public.listing_images;
drop policy if exists listing_images_admin_update on public.listing_images;
drop policy if exists listing_images_admin_delete on public.listing_images;

create policy listing_images_public_read_active_listings
on public.listing_images
for select
to anon
using (
  exists (
    select 1
    from public.listings as l
    where l.id = listing_images.listing_id
      and l.status = 'active'
  )
);

create policy listing_images_authenticated_read_visible_or_admin
on public.listing_images
for select
to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1
    from public.listings as l
    where l.id = listing_images.listing_id
      and l.status = 'active'
  )
);

create policy listing_images_admin_insert
on public.listing_images
for insert
to authenticated
with check ((select public.is_admin()));

create policy listing_images_admin_update
on public.listing_images
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy listing_images_admin_delete
on public.listing_images
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists listing_service_options_public_read_active on public.listing_service_options;
drop policy if exists listing_service_options_admin_manage on public.listing_service_options;
drop policy if exists listing_service_options_authenticated_read_visible_or_admin on public.listing_service_options;
drop policy if exists listing_service_options_admin_insert on public.listing_service_options;
drop policy if exists listing_service_options_admin_update on public.listing_service_options;
drop policy if exists listing_service_options_admin_delete on public.listing_service_options;

create policy listing_service_options_public_read_active
on public.listing_service_options
for select
to anon
using (
  is_enabled = true
  and exists (
    select 1
    from public.listings as l
    where l.id = listing_service_options.listing_id
      and l.status = 'active'
  )
  and exists (
    select 1
    from public.service_catalog as s
    where s.id = listing_service_options.service_id
      and s.is_active = true
  )
);

create policy listing_service_options_authenticated_read_visible_or_admin
on public.listing_service_options
for select
to authenticated
using (
  (select public.is_admin())
  or (
    is_enabled = true
    and exists (
      select 1
      from public.listings as l
      where l.id = listing_service_options.listing_id
        and l.status = 'active'
    )
    and exists (
      select 1
      from public.service_catalog as s
      where s.id = listing_service_options.service_id
        and s.is_active = true
    )
  )
);

create policy listing_service_options_admin_insert
on public.listing_service_options
for insert
to authenticated
with check ((select public.is_admin()));

create policy listing_service_options_admin_update
on public.listing_service_options
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy listing_service_options_admin_delete
on public.listing_service_options
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists listing_main_item_options_public_read_active on public.listing_main_item_options;
drop policy if exists listing_main_item_options_admin_manage on public.listing_main_item_options;
drop policy if exists listing_main_item_options_authenticated_read_visible_or_admin on public.listing_main_item_options;
drop policy if exists listing_main_item_options_admin_insert on public.listing_main_item_options;
drop policy if exists listing_main_item_options_admin_update on public.listing_main_item_options;
drop policy if exists listing_main_item_options_admin_delete on public.listing_main_item_options;

create policy listing_main_item_options_public_read_active
on public.listing_main_item_options
for select
to anon
using (
  is_enabled = true
  and exists (
    select 1
    from public.listings as l
    where l.id = listing_main_item_options.listing_id
      and l.status = 'active'
  )
  and exists (
    select 1
    from public.main_item_catalog as mic
    where mic.id = listing_main_item_options.main_item_id
      and mic.is_active = true
  )
);

create policy listing_main_item_options_authenticated_read_visible_or_admin
on public.listing_main_item_options
for select
to authenticated
using (
  (select public.is_admin())
  or (
    is_enabled = true
    and exists (
      select 1
      from public.listings as l
      where l.id = listing_main_item_options.listing_id
        and l.status = 'active'
    )
    and exists (
      select 1
      from public.main_item_catalog as mic
      where mic.id = listing_main_item_options.main_item_id
        and mic.is_active = true
    )
  )
);

create policy listing_main_item_options_admin_insert
on public.listing_main_item_options
for insert
to authenticated
with check ((select public.is_admin()));

create policy listing_main_item_options_admin_update
on public.listing_main_item_options
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy listing_main_item_options_admin_delete
on public.listing_main_item_options
for delete
to authenticated
using ((select public.is_admin()));
