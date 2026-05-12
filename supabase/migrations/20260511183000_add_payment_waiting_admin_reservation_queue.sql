-- Split unpaid checkout attempts out of the admin payment issues queue.
--
-- "Payment waiting" is a normal transient state: the customer has started the
-- payment flow, but the bank has not returned a successful or failed result.
-- These records must not appear under payment_issues unless the order/payment
-- is no longer pending and an explicit issue state exists.

create or replace function public.list_admin_reservations(
  p_status public.reservation_status,
  p_queue text,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_items jsonb;
  v_queue text;
begin
  if auth.uid() is null then
    raise exception 'authenticated admin is required'
      using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required'
      using errcode = '42501';
  end if;

  if p_limit is null or p_offset is null or p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid pagination'
      using errcode = '22023';
  end if;

  v_queue := coalesce(nullif(btrim(p_queue), ''), 'all');
  if v_queue not in ('all', 'payment_waiting', 'document_waiting', 'refund_requests', 'manual_refunds', 'payment_issues', 'completed') then
    raise exception 'invalid reservation queue'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'listing_id', r.listing_id,
        'user_id', r.user_id,
        'move_in_date', r.move_in_date,
        'stay_months', r.stay_months,
        'guest_count', r.guest_count,
        'note', r.note,
        'status', r.status,
        'listing', jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'status', l.status,
          'city', l.city,
          'district', l.district
        ),
        'contact', jsonb_build_object(
          'fullName', i.contact_full_name,
          'phone', i.contact_phone,
          'email', i.contact_email,
          'preferredContactMethod', i.preferred_contact_method,
          'preferredContactTime', i.preferred_contact_time,
          'occupantFullName', i.occupant_full_name,
          'documentReadiness', i.document_readiness,
          'note', i.note
        ),
        'document_tracking', case
          when dt.reservation_id is null then null
          else jsonb_build_object(
            'status', dt.status,
            'updated_at', dt.updated_at
          )
        end,
        'finance_ops', case
          when fo.id is null then null
          else jsonb_build_object(
            'status', fo.status,
            'updated_at', fo.updated_at
          )
        end,
        'created_at', r.created_at,
        'updated_at', r.updated_at
      )
      order by r.created_at desc, r.id
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      r.*,
      dt.status as document_status,
      fo.status as finance_status,
      exists (
        select 1
        from public.orders o_wait
        left join public.payments p_wait on p_wait.order_id = o_wait.id
        where o_wait.reservation_id = r.id
          and (
            o_wait.status = 'pending'::public.order_status
            or p_wait.status = 'pending'::public.payment_status
          )
          and not exists (
            select 1
            from public.payments p_success
            where p_success.order_id = o_wait.id
              and p_success.status = 'succeeded'::public.payment_status
          )
      ) as is_payment_waiting
    from public.reservations as r
    left join public.reservation_document_tracking as dt on dt.reservation_id = r.id
    left join lateral (
      select *
      from public.payment_finance_ops candidate
      where candidate.reservation_id = r.id
      order by candidate.updated_at desc, candidate.created_at desc
      limit 1
    ) as fo on true
    where (p_status is null or r.status = p_status)
      and exists (
        select 1 from public.orders o2 where o2.reservation_id = r.id
      )
      and (
        v_queue = 'all'
        or (v_queue = 'payment_waiting' and exists (
          select 1
          from public.orders o_wait
          left join public.payments p_wait on p_wait.order_id = o_wait.id
          where o_wait.reservation_id = r.id
            and (
              o_wait.status = 'pending'::public.order_status
              or p_wait.status = 'pending'::public.payment_status
            )
            and not exists (
              select 1
              from public.payments p_success
              where p_success.order_id = o_wait.id
                and p_success.status = 'succeeded'::public.payment_status
            )
        ))
        or (v_queue = 'document_waiting' and dt.status in ('requested'::public.document_tracking_status, 'waiting'::public.document_tracking_status))
        or (v_queue = 'refund_requests' and fo.status = 'refund_required'::public.finance_ops_status)
        or (v_queue = 'manual_refunds' and fo.status = 'refund_requested'::public.finance_ops_status)
        or (
          v_queue = 'payment_issues'
          and fo.status in ('manual_resolution_required'::public.finance_ops_status, 'conflict_payment'::public.finance_ops_status)
          and not exists (
            select 1
            from public.orders o_wait
            left join public.payments p_wait on p_wait.order_id = o_wait.id
            where o_wait.reservation_id = r.id
              and (
                o_wait.status = 'pending'::public.order_status
                or p_wait.status = 'pending'::public.payment_status
              )
              and not exists (
                select 1
                from public.payments p_success
                where p_success.order_id = o_wait.id
                  and p_success.status = 'succeeded'::public.payment_status
              )
          )
        )
        or (v_queue = 'completed' and (dt.status = 'completed'::public.document_tracking_status or r.status = 'confirmed'::public.reservation_status))
      )
    order by r.created_at desc, r.id
    limit p_limit
    offset p_offset
  ) as r
  join public.listings as l on l.id = r.listing_id
  left join public.reservation_intake as i on i.reservation_id = r.id
  left join public.reservation_document_tracking as dt on dt.reservation_id = r.id
  left join lateral (
    select *
    from public.payment_finance_ops candidate
    where candidate.reservation_id = r.id
    order by candidate.updated_at desc, candidate.created_at desc
    limit 1
  ) as fo on true;

  return jsonb_build_object(
    'items', v_items,
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

revoke all on function public.list_admin_reservations(public.reservation_status, text, integer, integer)
from public;
revoke execute on function public.list_admin_reservations(public.reservation_status, text, integer, integer)
from anon;
grant execute on function public.list_admin_reservations(public.reservation_status, text, integer, integer)
to authenticated;
