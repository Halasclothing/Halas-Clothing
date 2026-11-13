-- 08 — event automation: transactional email triggers, low-stock alerts and
-- the atomic email-worker queue API.

-- ---------------------------------------------------------------------------
-- Order lifecycle emails
-- ---------------------------------------------------------------------------

create or replace function public.tg_order_created_emails()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb := public.order_email_payload(new);
  v_number text := coalesce(new.order_number::text, left(new.id::text, 8));
begin
  perform public.enqueue_email(
    'new_order', 'admin', null, 'admin_new_order',
    'New COD order #' || v_number || ' — ' || new.customer_name,
    v_payload, new.id, 'new_order:' || new.id::text
  );

  if btrim(new.email) <> '' then
    perform public.enqueue_email(
      'order_confirmation', 'customer', new.email, 'customer_order_confirmation',
      'We received your order #' || v_number || ' — HALA.S',
      v_payload, new.id, 'order_confirmation:' || new.id::text
    );
  end if;

  return new;
end;
$$;

-- Deferred so the payload includes order_items, which are written just after
-- the order row inside the same transaction.
drop trigger if exists orders_created_emails on public.orders;
create constraint trigger orders_created_emails
after insert on public.orders
deferrable initially deferred
for each row execute function public.tg_order_created_emails();

create or replace function public.tg_order_updated_emails()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb := public.order_email_payload(new);
  v_number text := coalesce(new.order_number::text, left(new.id::text, 8));
  v_stamp text := extract(epoch from coalesce(new.updated_at, now()))::bigint::text;
  v_key_payment text := new.payment_status || ':' || v_stamp;
begin
  if new.order_status is distinct from old.order_status then
    if new.order_status = 'cancelled' then
      perform public.enqueue_email(
        'order_cancelled', 'admin', null, 'admin_order_cancelled',
        'Order #' || v_number || ' cancelled — ' || new.customer_name,
        v_payload, new.id,
        'order_cancelled:' || new.id::text || ':' || v_stamp
      );
    elsif new.order_status = 'returned' then
      perform public.enqueue_email(
        'order_returned', 'admin', null, 'admin_order_returned',
        'Order #' || v_number || ' returned — ' || new.customer_name,
        v_payload, new.id,
        'order_returned:' || new.id::text || ':' || v_stamp
      );
    elsif new.order_status = 'delivered' then
      if btrim(new.email) <> '' then
        perform public.enqueue_email(
          'delivery_confirmation', 'customer', new.email, 'customer_delivery_confirmation',
          'Order #' || v_number || ' delivered — HALA.S',
          v_payload, new.id, 'delivery_confirmation:' || new.id::text
        );
      end if;
    elsif new.order_status in ('shipped', 'out_for_delivery') then
      if btrim(new.email) <> '' then
        perform public.enqueue_email(
          'shipment_notification', 'customer', new.email, 'customer_shipment_notification',
          'Order #' || v_number || ' is on its way — HALA.S',
          v_payload, new.id,
          'shipment_notification:' || new.id::text || ':' || new.order_status
        );
      end if;
    elsif new.order_status <> 'new' then
      if btrim(new.email) <> '' then
        perform public.enqueue_email(
          'order_status_update', 'customer', new.email, 'customer_order_status',
          'Order #' || v_number || ' update — ' || replace(new.order_status, '_', ' '),
          v_payload, new.id,
          'order_status_update:' || new.id::text || ':' || new.order_status || ':' || v_stamp
        );
      end if;
    end if;
  end if;

  if new.payment_status is distinct from old.payment_status then
    perform public.enqueue_email(
      'payment_status_change', 'admin', null, 'admin_payment_status',
      'Payment ' || new.payment_status || ' for order #' || v_number,
      v_payload, new.id,
      'payment_status_change:' || new.id::text || ':' || v_key_payment
    );
  end if;

  return new;
end;
$$;

drop trigger if exists orders_updated_emails on public.orders;
create trigger orders_updated_emails
after update on public.orders
for each row execute function public.tg_order_updated_emails();

-- ---------------------------------------------------------------------------
-- Delivery emails
-- ---------------------------------------------------------------------------

create or replace function public.tg_delivery_updated_emails()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb := public.delivery_email_payload(new);
  v_order public.orders;
  v_number text;
begin
  if new.status is not distinct from old.status
     and new.tracking_number is not distinct from old.tracking_number then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  if not found then
    return new;
  end if;
  v_number := coalesce(v_order.order_number::text, left(v_order.id::text, 8));

  if new.status = 'failed_delivery' and new.status is distinct from old.status then
    perform public.enqueue_email(
      'delivery_failed', 'admin', null, 'admin_delivery_failed',
      'Delivery failed for order #' || v_number || ' — ' || v_order.customer_name,
      v_payload, new.order_id,
      'delivery_failed:' || new.order_id::text || ':' ||
        extract(epoch from coalesce(new.updated_at, now()))::bigint::text
    );
  end if;

  if new.status in ('shipped', 'out_for_delivery')
     and btrim(v_order.email) <> '' then
    perform public.enqueue_email(
      'shipment_notification', 'customer', v_order.email, 'customer_shipment_notification',
      'Order #' || v_number || ' is on its way — HALA.S',
      v_payload, new.order_id,
      'shipment_notification:' || new.order_id::text || ':' || new.status
    );
  end if;

  if new.status = 'delivered' and btrim(v_order.email) <> '' then
    perform public.enqueue_email(
      'delivery_confirmation', 'customer', v_order.email, 'customer_delivery_confirmation',
      'Order #' || v_number || ' delivered — HALA.S',
      v_payload, new.order_id, 'delivery_confirmation:' || new.order_id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists delivery_updated_emails on public.delivery_records;
create trigger delivery_updated_emails
after update on public.delivery_records
for each row execute function public.tg_delivery_updated_emails();

-- ---------------------------------------------------------------------------
-- Inventory alerts
-- ---------------------------------------------------------------------------

create or replace function public.tg_inventory_alerts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_available integer := old.quantity - old.reserved_quantity;
  v_new_available integer := new.quantity - new.reserved_quantity;
  v_threshold integer;
  v_product public.products;
  v_variant public.product_variants;
  v_label text;
  v_suffix text;
  v_payload jsonb;
  v_stamp text := to_char(now() at time zone 'utc', 'YYYY-MM-DD');
  v_store_url text;
begin
  if old.quantity = new.quantity and old.reserved_quantity = new.reserved_quantity then
    return new;
  end if;

  select * into v_variant from public.product_variants where id = new.variant_id;
  if not found then
    return new;
  end if;
  select * into v_product from public.products where id = v_variant.product_id;
  if not found or v_product.status <> 'published' then
    return new;
  end if;

  select coalesce(new.low_stock_threshold,
                  (select low_stock_threshold from public.store_settings where id = 1),
                  3)
    into v_threshold;

  v_suffix := nullif(concat_ws(' / ', nullif(v_variant.size, ''), nullif(v_variant.colour, '')), '');
  v_label := v_product.title || case when v_suffix is null then '' else ' — ' || v_suffix end;
  select nullif(rtrim(coalesce(store_url, ''), '/'), '') into v_store_url
    from public.store_settings where id = 1;

  v_payload := jsonb_build_object(
    'product_id', v_product.id,
    'product_title', v_product.title,
    'handle', v_product.handle,
    'variant_id', v_variant.id,
    'variant_label', v_label,
    'size', v_variant.size,
    'colour', v_variant.colour,
    'sku', coalesce(v_variant.sku, v_product.sku, ''),
    'available', v_new_available,
    'threshold', v_threshold,
    'product_url', case when v_store_url is null then '' else v_store_url || '/admin/products/' || v_product.id end
  );

  if v_new_available <= 0 and v_old_available > 0 then
    perform public.enqueue_email(
      'out_of_stock', 'admin', null, 'admin_out_of_stock',
      'Out of stock: ' || v_label,
      v_payload, null, 'out_of_stock:' || v_variant.id::text || ':' || v_stamp
    );
  elsif v_new_available > 0 and v_new_available <= v_threshold
        and v_old_available > v_threshold then
    perform public.enqueue_email(
      'low_stock', 'admin', null, 'admin_low_stock',
      'Low stock: ' || v_label || ' (' || v_new_available || ' left)',
      v_payload, null, 'low_stock:' || v_variant.id::text || ':' || v_stamp
    );
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_alerts on public.inventory_levels;
create trigger inventory_alerts
after update of quantity, reserved_quantity on public.inventory_levels
for each row execute function public.tg_inventory_alerts();

-- ---------------------------------------------------------------------------
-- Email worker queue API (service role only)
-- ---------------------------------------------------------------------------

create or replace function public.email_claim_batch(p_limit integer default 20)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  update public.email_outbox eo
     set status = 'sending',
         attempts = eo.attempts + 1,
         updated_at = now()
   where eo.id in (
     select q.id
       from public.email_outbox q
      where q.status = 'pending'
        and q.next_attempt_at <= now()
      order by q.created_at
      limit greatest(1, least(coalesce(p_limit, 20), 100))
      for update skip locked
   )
  returning eo.*;
end;
$$;

create or replace function public.email_mark_sent(p_id uuid, p_provider_message_id text default '')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.email_outbox
     set status = 'sent',
         sent_at = now(),
         provider_message_id = coalesce(p_provider_message_id, ''),
         last_error = '',
         updated_at = now()
   where id = p_id;
end;
$$;

create or replace function public.email_mark_failed(
  p_id uuid,
  p_error text,
  p_retry_seconds integer default 300
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempts integer;
  v_delay integer;
begin
  select attempts into v_attempts from public.email_outbox where id = p_id;
  v_delay := least(3600, greatest(30, coalesce(p_retry_seconds, 300)) *
                   (2 ^ greatest(0, coalesce(v_attempts, 1) - 1))::integer);
  update public.email_outbox
     set status = case when attempts >= 6 then 'failed' else 'pending' end,
         last_error = left(coalesce(p_error, 'Unknown error'), 2000),
         next_attempt_at = now() + make_interval(secs => v_delay),
         updated_at = now()
   where id = p_id;
end;
$$;

create or replace function public.email_cancel_stale()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.email_outbox
     set status = 'pending',
         last_error = coalesce(nullif(last_error, ''), 'Worker timed out; returned to queue.'),
         next_attempt_at = now()
   where status = 'sending'
     and updated_at < now() - interval '10 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Admin-facing email controls ------------------------------------------------

create or replace function public.admin_send_test_email(p_recipient text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recipient text := btrim(coalesce(p_recipient, ''));
  v_id uuid;
begin
  perform public.require_admin();
  if v_recipient = '' then
    select nullif(btrim(admin_notification_email), '') into v_recipient
      from public.store_settings where id = 1;
  end if;
  if v_recipient is null or v_recipient = '' then
    raise exception 'Set an administrator notification email first.';
  end if;
  if v_recipient !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.';
  end if;

  insert into public.email_outbox (
    event_type, audience, recipient, template, subject, payload, dedupe_key
  ) values (
    'system_error', 'admin', v_recipient, 'test_email',
    'HALA.S test email',
    jsonb_build_object(
      'message', 'This is a test notification from your HALA.S admin portal.',
      'store_name', (select store_name from public.store_settings where id = 1),
      'sent_at', now()
    ),
    'test_email:' || gen_random_uuid()::text
  )
  returning id into v_id;

  perform public.log_activity('email.test', 'email_outbox', v_id::text,
    jsonb_build_object('recipient', v_recipient));
  return v_id;
end;
$$;

create or replace function public.admin_retry_email(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();
  update public.email_outbox
     set status = 'pending',
         attempts = 0,
         last_error = '',
         next_attempt_at = now(),
         updated_at = now()
   where id = p_id;
  if not found then
    raise exception 'Email not found.';
  end if;
  perform public.log_activity('email.retry', 'email_outbox', p_id::text, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.email_claim_batch(integer) from public;
revoke all on function public.email_mark_sent(uuid, text) from public;
revoke all on function public.email_mark_failed(uuid, text, integer) from public;
revoke all on function public.email_cancel_stale() from public;
revoke all on function public.admin_send_test_email(text) from public;
revoke all on function public.admin_retry_email(uuid) from public;

grant execute on function public.email_claim_batch(integer) to service_role;
grant execute on function public.email_mark_sent(uuid, text) to service_role;
grant execute on function public.email_mark_failed(uuid, text, integer) to service_role;
grant execute on function public.email_cancel_stale() to service_role;
grant execute on function public.admin_send_test_email(text) to authenticated;
grant execute on function public.admin_retry_email(uuid) to authenticated;
