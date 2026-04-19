-- Phase 1 / Task 8 hardening:
-- Restrict callback receipt RPC to server-only role.

revoke all on function public.register_payment_callback_receipt(text, text, text, text)
from public;

revoke execute on function public.register_payment_callback_receipt(text, text, text, text)
from anon, authenticated;

grant execute on function public.register_payment_callback_receipt(text, text, text, text)
to service_role;
