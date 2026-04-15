\set ON_ERROR_STOP on

set role anon;

do $$
declare
  v_first boolean;
  v_second boolean;
begin
  select public.register_payment_callback_receipt(
    'isbank',
    'OID-123:HOSTREF-999:OK',
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'application/x-www-form-urlencoded'
  )
  into v_first;

  if v_first is not true then
    raise exception 'Expected first callback receipt insert to succeed';
  end if;

  select public.register_payment_callback_receipt(
    'isbank',
    'OID-123:HOSTREF-999:OK',
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'application/x-www-form-urlencoded'
  )
  into v_second;

  if v_second is not false then
    raise exception 'Expected duplicate callback receipt insert to be ignored';
  end if;
end;
$$;

reset role;

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.payment_callback_receipts
  where provider = 'isbank'
    and event_key = 'OID-123:HOSTREF-999:OK';

  if v_count <> 1 then
    raise exception 'Expected exactly one callback receipt row, got %', v_count;
  end if;
end;
$$;

select 'payment_callback_receipts_ok' as result;
