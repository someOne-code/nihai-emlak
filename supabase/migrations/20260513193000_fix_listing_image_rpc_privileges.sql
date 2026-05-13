-- Phase 8 admin RPC privilege repair.
--
-- Direct table DML on listings/config tables is intentionally revoked from
-- authenticated users. The admin RPCs are therefore the authoritative write
-- boundary and must execute with the function owner's table privileges after
-- their own auth.uid() + public.is_admin() checks pass.

alter function public.admin_create_listing(jsonb)
  security definer;

alter function public.admin_update_listing(uuid, jsonb)
  security definer;

alter function public.admin_set_listing_status(uuid, public.listing_status)
  security definer;

alter function public.admin_add_listing_image(uuid, text, text, boolean)
  security definer;

alter function public.admin_reorder_listing_images(uuid, jsonb)
  security definer;

alter function public.admin_delete_listing_image(uuid, uuid)
  security definer;

alter function public.admin_configure_listing_main_item(uuid, text, jsonb)
  security definer;

alter function public.admin_configure_listing_service(uuid, text, jsonb)
  security definer;
