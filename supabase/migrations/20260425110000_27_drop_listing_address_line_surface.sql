-- Phase 5 security hardening:
-- exact address must not be exposed by direct table surfaces.
alter table public.listings
  drop column if exists address_line;
