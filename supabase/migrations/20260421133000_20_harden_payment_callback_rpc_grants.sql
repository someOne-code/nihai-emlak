-- Payment callback RPC wrappers must remain service-role only.
-- Explicit role revokes close grant regressions across migration chains.

revoke all on function internal.register_payment_callback_receipt(text, text, text, text)
from public;
revoke execute on function internal.register_payment_callback_receipt(text, text, text, text)
from anon, authenticated;
grant execute on function internal.register_payment_callback_receipt(text, text, text, text)
to service_role;

revoke all on function internal.process_payment_checkout(uuid, text, text, jsonb)
from public;
revoke execute on function internal.process_payment_checkout(uuid, text, text, jsonb)
from anon, authenticated;
grant execute on function internal.process_payment_checkout(uuid, text, text, jsonb)
to service_role;

revoke all on function public.register_payment_callback_receipt(text, text, text, text)
from public;
revoke execute on function public.register_payment_callback_receipt(text, text, text, text)
from anon, authenticated;
grant execute on function public.register_payment_callback_receipt(text, text, text, text)
to service_role;

revoke all on function public.process_payment_checkout(uuid, text, text, jsonb)
from public;
revoke execute on function public.process_payment_checkout(uuid, text, text, jsonb)
from anon, authenticated;
grant execute on function public.process_payment_checkout(uuid, text, text, jsonb)
to service_role;
