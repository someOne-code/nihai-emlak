-- Listing image optimization contract.
--
-- Keep image_url as the required legacy/original fallback while allowing
-- generated card/detail variants and their metadata to be stored on the same
-- image record. Application and read-model layers can opt into these nullable
-- optimized URLs without losing the existing image_url behavior.

alter table public.listing_images
  add column if not exists card_image_url text,
  add column if not exists detail_image_url text,
  add column if not exists variant_metadata jsonb not null default '{}'::jsonb;

alter table public.listing_images
  drop constraint if exists listing_images_image_url_http_check,
  add constraint listing_images_image_url_http_check
    check (btrim(image_url) ~* '^https?://[^[:space:]]+$'),
  drop constraint if exists listing_images_card_image_url_http_check,
  add constraint listing_images_card_image_url_http_check
    check (card_image_url is null or btrim(card_image_url) ~* '^https?://[^[:space:]]+$'),
  drop constraint if exists listing_images_detail_image_url_http_check,
  add constraint listing_images_detail_image_url_http_check
    check (detail_image_url is null or btrim(detail_image_url) ~* '^https?://[^[:space:]]+$'),
  drop constraint if exists listing_images_variant_metadata_object_check,
  add constraint listing_images_variant_metadata_object_check
    check (jsonb_typeof(variant_metadata) = 'object');

create or replace function public.admin_add_listing_image(
  p_listing_id uuid,
  p_image_url text,
  p_alt_text text default null,
  p_is_primary boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  v_listing_exists boolean;
  v_next_sort_order integer;
  v_image_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authenticated admin is required'
      using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required'
      using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'invalid listing id'
      using errcode = '22023';
  end if;

  if p_image_url is null
     or btrim(p_image_url) = ''
     or btrim(p_image_url) !~* '^https?://[^[:space:]]+$' then
    raise exception 'invalid image url'
      using errcode = '22023';
  end if;

  select exists (
    select 1 from public.listings where id = p_listing_id
  ) into v_listing_exists;

  if not v_listing_exists then
    raise exception 'listing not found'
      using errcode = 'P0002';
  end if;

  if p_is_primary then
    update public.listing_images
    set is_primary = false
    where listing_id = p_listing_id
      and is_primary = true;
  end if;

  select coalesce(max(sort_order), -1) + 1
  into v_next_sort_order
  from public.listing_images
  where listing_id = p_listing_id;

  insert into public.listing_images (
    listing_id, image_url, alt_text, sort_order, is_primary
  )
  values (
    p_listing_id,
    btrim(p_image_url),
    nullif(btrim(p_alt_text), ''),
    v_next_sort_order,
    p_is_primary
  )
  returning id into v_image_id;

  select jsonb_build_object(
    'id', i.id,
    'image_url', i.image_url,
    'card_image_url', i.card_image_url,
    'detail_image_url', i.detail_image_url,
    'variant_metadata', i.variant_metadata,
    'alt_text', i.alt_text,
    'sort_order', i.sort_order,
    'is_primary', i.is_primary,
    'created_at', i.created_at
  )
  into v_result
  from public.listing_images i
  where i.id = v_image_id;

  return v_result;
end;
$$;

grant execute on function public.admin_add_listing_image(uuid, text, text, boolean) to authenticated;

comment on column public.listing_images.image_url is
  'Required original or fallback image URL. Existing public/admin consumers may continue using this field.';

comment on column public.listing_images.card_image_url is
  'Optional optimized listing-card image URL. Consumers must fall back to image_url when null.';

comment on column public.listing_images.detail_image_url is
  'Optional optimized listing-detail image URL. Consumers must fall back to image_url when null.';

comment on column public.listing_images.variant_metadata is
  'Optional object metadata for optimized variants, e.g. card/detail dimensions, format, size, and generation source.';
