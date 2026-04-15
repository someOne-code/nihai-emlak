create table if not exists public.payment_callback_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null,
  event_key text not null,
  payload_hash text not null,
  content_type text not null,
  created_at timestamptz not null default now(),
  constraint payment_callback_receipts_provider_event_key_key unique (provider, event_key),
  constraint payment_callback_receipts_payload_hash_check check (
    payload_hash ~ '^[A-F0-9]{64}$'
  )
);

alter table public.payment_callback_receipts enable row level security;

create or replace function public.register_payment_callback_receipt(
  p_provider text,
  p_event_key text,
  p_payload_hash text,
  p_content_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if coalesce(length(trim(p_provider)), 0) = 0 then
    raise exception 'provider is required' using errcode = '22023';
  end if;

  if coalesce(length(trim(p_event_key)), 0) = 0 then
    raise exception 'event_key is required' using errcode = '22023';
  end if;

  if p_payload_hash is null or p_payload_hash !~ '^[A-F0-9]{64}$' then
    raise exception 'payload_hash must be a 64-char uppercase hex string'
      using errcode = '22023';
  end if;

  if coalesce(length(trim(p_content_type)), 0) = 0 then
    raise exception 'content_type is required' using errcode = '22023';
  end if;

  insert into public.payment_callback_receipts (
    provider,
    event_key,
    payload_hash,
    content_type
  )
  values (
    lower(trim(p_provider)),
    trim(p_event_key),
    upper(trim(p_payload_hash)),
    trim(p_content_type)
  )
  on conflict (provider, event_key) do nothing;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

grant execute on function public.register_payment_callback_receipt(text, text, text, text)
to anon, authenticated;
