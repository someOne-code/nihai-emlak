-- Phase 3 / Task 3 hardening: align service catalog codes with checkout parser/RPC.

alter table public.service_catalog
  add constraint service_catalog_code_normalized check (
    code = lower(btrim(code))
    and code <> ''
    and char_length(code) <= 64
    and code ~ '^[a-z0-9][a-z0-9_-]*$'
  );

create unique index if not exists service_catalog_normalized_code_key
  on public.service_catalog ((lower(btrim(code))));
