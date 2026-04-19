-- Checkout init contract: Isbank hosted payment OID is always payments.id.
-- The callback route can therefore resolve callback oid directly to payment_id.

create or replace function public.set_isbank_payment_provider_ref()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.provider = 'isbank' then
    new.provider_ref := new.id::text;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_isbank_payment_provider_ref on public.payments;
create trigger trg_set_isbank_payment_provider_ref
before insert or update of provider, provider_ref on public.payments
for each row
execute function public.set_isbank_payment_provider_ref();

update public.payments
set provider_ref = id::text
where provider = 'isbank'
  and provider_ref is distinct from id::text;
