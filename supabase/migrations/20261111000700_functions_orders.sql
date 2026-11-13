-- 07 — order, inventory lifecycle, delivery, payment and analytics RPCs.

create or replace function public.apply_inventory_change(
  p_variant_id uuid,
  p_quantity_change integer,
  p_reserved_change integer,
  p_type text,
  p_order_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quantity integer;
  v_reserved integer;
  v_after integer;
  v_reserved_after integer;
begin
  if p_type not in ('reserve', 'release', 'deduct', 'restore', 'adjust', 'set', 'return') then
    raise exception 'Invalid inventory movement type.';
  end if;

  select quantity, reserved_quantity into v_quantity, v_reserved
    from public.inventory_levels
   where variant_id = p_variant_id
   for update;

  if not found then
    raise exception 'No inventory record exists for this variant.';
  end if;

  v_after := v_quantity + p_quantity_change;
  v_reserved_after := v_reserved + p_reserved_change;

  if v_after < 0 then
    raise exception 'Stock cannot become negative.';
  end if;
  if v_reserved_after < 0 then
    raise exception 'Reserved stock is out of sync for this order.';
  end if;
  if v_reserved_after > v_after then
    raise exception 'Only % unit(s) are available.', greatest(v_quantity - v_reserved, 0);
  end if;

  update public.inventory_levels
     set quantity = v_after,
         reserved_quantity = v_reserved_after
   where variant_id = p_variant_id;

  insert into public.inventory_movements (
    variant_id, order_id, type, quantity_change, reserved_change,
    quantity_after, reserved_after, reason, actor_id, actor_email
  ) values (
    p_variant_id, p_order_id, p_type, p_quantity_change, p_reserved_change,
    v_after, v_reserved_after, coalesce(p_reason, ''),
    auth.uid(), coalesce(auth.jwt() ->> 'email', '')
  );
end;
$$;

create or replace function public.reserve_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_order_number bigint;
begin
  select order_number into v_order_number from public.orders where id = p_order_id;
  for v_item in
    select variant_id, sum(quantity)::integer quantity
      from public.order_items
     where order_id = p_order_id and variant_id is not null
     group by variant_id
     order by variant_id
  loop
    perform public.apply_inventory_change(
      v_item.variant_id, 0, v_item.quantity, 'reserve', p_order_id, 'Reserved for order #' || v_order_number
    );
  end loop;
end;
$$;

create or replace function public.deduct_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_order_number bigint;
begin
  select order_number into v_order_number from public.orders where id = p_order_id;
  for v_item in
    select variant_id, sum(quantity)::integer quantity
      from public.order_items
     where order_id = p_order_id and variant_id is not null
     group by variant_id
     order by variant_id
  loop
    perform public.apply_inventory_change(
      v_item.variant_id, -v_item.quantity, -v_item.quantity, 'deduct', p_order_id, 'Deducted for order #' || v_order_number
    );
  end loop;
end;
$$;

create or replace function public.release_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_order_number bigint;
begin
  select order_number into v_order_number from public.orders where id = p_order_id;
  for v_item in
    select variant_id, sum(quantity)::integer quantity
      from public.order_items
     where order_id = p_order_id and variant_id is not null
     group by variant_id
     order by variant_id
  loop
    perform public.apply_inventory_change(
      v_item.variant_id, 0, -v_item.quantity, 'release', p_order_id, 'Reservation released for order #' || v_order_number
    );
  end loop;
end;
$$;

create or replace function public.restore_order_stock(p_order_id uuid, p_type text default 'restore')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_order_number bigint;
begin
  select order_number into v_order_number from public.orders where id = p_order_id;
  for v_item in
    select variant_id, sum(quantity)::integer quantity
      from public.order_items
     where order_id = p_order_id and variant_id is not null
     group by variant_id
     order by variant_id
  loop
    perform public.apply_inventory_change(
      v_item.variant_id, v_item.quantity, 0, p_type, p_order_id,
      'Stock restored for order #' || v_order_number
    );
  end loop;
end;
$$;

create or replace function public.order_email_payload(p_order public.orders)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'order_id', p_order.id,
    'order_number', p_order.order_number,
    'customer_name', p_order.customer_name,
    'email', p_order.email,
    'phone', p_order.phone,
    'address', p_order.address,
    'city', p_order.city,
    'postal_code', p_order.postal_code,
    'country', p_order.country,
    'customer_notes', p_order.customer_notes,
    'subtotal', p_order.subtotal,
    'shipping_fee', p_order.shipping_fee,
    'tax_total', p_order.tax_total,
    'total', p_order.total,
    'currency', p_order.currency,
    'payment_method', p_order.payment_method,
    'payment_status', p_order.payment_status,
    'order_status', p_order.order_status,
    'placed_at', p_order.placed_at,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'title', oi.title,
          'variant', oi.variant_title,
          'size', oi.size,
          'colour', oi.colour,
          'sku', oi.sku,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'line_total', oi.line_total,
          'image_url', oi.image_url
        ) order by oi.created_at
      )
      from public.order_items oi
      where oi.order_id = p_order.id
    ), '[]'::jsonb),
    'admin_url', case
      when btrim(coalesce((select ss.store_url from public.store_settings ss where ss.id = 1), '')) = '' then ''
      else rtrim((select ss.store_url from public.store_settings ss where ss.id = 1), '/') || '/admin/orders/' || p_order.id
    end,
    'store_name', (select ss.store_name from public.store_settings ss where ss.id = 1),
    'support_email', (select ss.support_email from public.store_settings ss where ss.id = 1)
  );
$$;

create or replace function public.delivery_email_payload(p_delivery public.delivery_records)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.order_email_payload(o) || jsonb_build_object(
    'courier_name', p_delivery.courier_name,
    'tracking_number', p_delivery.tracking_number,
    'tracking_url', p_delivery.tracking_url,
    'dispatch_date', p_delivery.dispatch_date,
    'expected_delivery_date', p_delivery.expected_delivery_date,
    'delivery_status', p_delivery.status,
    'delivery_notes', p_delivery.notes
  )
  from public.orders o
  where o.id = p_delivery.order_id;
$$;

create or replace function public.submit_cod_order(
  p_customer_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_city text,
  p_postal_code text,
  p_notes text,
  p_items jsonb,
  p_idempotency_key uuid default null
)
returns table (order_id uuid, order_number bigint, total numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_email text := btrim(coalesce(p_email, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_address text := btrim(coalesce(p_address, ''));
  v_city text := btrim(coalesce(p_city, ''));
  v_postal text := btrim(coalesce(p_postal_code, ''));
  v_notes text := btrim(coalesce(p_notes, ''));
  v_item jsonb;
  v_variant record;
  v_variant_id uuid;
  v_size text;
  v_colour text;
  v_quantity integer;
  v_line record;
  v_subtotal numeric(12, 2) := 0;
  v_shipping numeric(12, 2) := 0;
  v_tax numeric(12, 2) := 0;
  v_total numeric(12, 2) := 0;
  v_settings public.store_settings%rowtype;
  v_customer_id uuid;
  v_order public.orders%rowtype;
  v_existing public.orders%rowtype;
  v_available integer;
  v_image text;
  v_item_count integer := 0;
  v_unit_price numeric(12, 2);
begin
  if length(v_name) < 2 or length(v_name) > 100 then
    raise exception 'Please enter your full name.';
  end if;
  if regexp_replace(v_phone, '[^0-9]', '', 'g') !~ '^[0-9]{7,15}$' then
    raise exception 'Please enter a valid phone number, including your country code if applicable.';
  end if;
  if v_email <> '' and (length(v_email) > 254 or position('@' in v_email) < 2) then
    raise exception 'Please enter a valid email address, or leave it blank.';
  end if;
  if length(v_address) < 8 or length(v_address) > 500 then
    raise exception 'Please enter a complete delivery address.';
  end if;
  if length(v_city) < 2 or length(v_city) > 100 then
    raise exception 'Please enter your city.';
  end if;
  if length(v_postal) > 20 or length(v_notes) > 1000 then
    raise exception 'One or more checkout fields are too long.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'Your bag is empty or contains too many separate items.';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
    if found then
      return query select v_existing.id, v_existing.order_number, v_existing.total;
      return;
    end if;
  end if;

  select * into v_settings from public.store_settings where id = 1;

  create temp table if not exists _halas_cart (
    variant_id uuid primary key,
    product_id uuid not null,
    quantity integer not null,
    title text not null,
    variant_title text not null,
    size text not null,
    colour text not null,
    sku text not null,
    image_url text not null,
    unit_price numeric(12, 2) not null,
    line_total numeric(12, 2) not null default 0
  ) on commit drop;
  truncate _halas_cart;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+$' then
      raise exception 'An item in your bag has an invalid quantity.';
    end if;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity < 1 or v_quantity > 12 then
      raise exception 'Each item quantity must be between 1 and 12.';
    end if;

    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    if v_variant_id is not null then
      select
        pv.id, pv.product_id, pv.title as variant_title, pv.size, pv.colour, pv.sku,
        coalesce(pv.price, p.price) as unit_price, p.title, p.id as product_id_check,
        p.status
      into v_variant
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where pv.id = v_variant_id and pv.is_active
      for update of pv;
      if not found or v_variant.status <> 'published' then
        raise exception 'An item in your bag is no longer available. Please refresh your bag.';
      end if;
    else
      v_size := btrim(coalesce(v_item ->> 'size', ''));
      v_colour := btrim(coalesce(v_item ->> 'colour', ''));
      if v_size = '' or nullif(btrim(coalesce(v_item ->> 'handle', '')), '') is null then
        raise exception 'An item in your bag is invalid. Please refresh your bag.';
      end if;

      select
        pv.id, pv.product_id, pv.title as variant_title, pv.size, pv.colour, pv.sku,
        coalesce(pv.price, p.price) as unit_price, p.title, p.id as product_id_check,
        p.status
      into v_variant
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      join public.inventory_levels il on il.variant_id = pv.id
      where p.handle = btrim(v_item ->> 'handle')
        and p.status = 'published'
        and pv.is_active
        and lower(pv.size) = lower(v_size)
        and (v_colour = '' or lower(pv.colour) = lower(v_colour))
        and il.quantity - il.reserved_quantity >= v_quantity
      order by pv.position
      limit 1
      for update of pv, il;
      if not found then
        raise exception 'An item or size in your bag is no longer available. Please refresh your bag.';
      end if;
    end if;

    select pi.url into v_image
      from public.product_images pi
     where pi.product_id = v_variant.product_id
     order by pi.is_primary desc, pi.position
     limit 1;

    insert into _halas_cart (
      variant_id, product_id, quantity, title, variant_title, size, colour, sku, image_url, unit_price
    ) values (
      v_variant.id, v_variant.product_id, v_quantity, v_variant.title,
      coalesce(v_variant.variant_title, concat_ws(' / ', v_variant.size, v_variant.colour)),
      coalesce(v_variant.size, ''), coalesce(v_variant.colour, ''),
      coalesce(v_variant.sku, ''), coalesce(v_image, ''), v_variant.unit_price
    )
    on conflict (variant_id) do update
      set quantity = _halas_cart.quantity + excluded.quantity;
  end loop;

  select count(*) into v_item_count from _halas_cart;
  if v_item_count = 0 then
    raise exception 'Your bag is empty.';
  end if;

  for v_line in select * from _halas_cart order by variant_id
  loop
    select quantity - reserved_quantity into v_available
      from public.inventory_levels
     where variant_id = v_line.variant_id
     for update;
    if not found or v_available < v_line.quantity then
      raise exception 'Only % unit(s) of % remain in stock.', greatest(coalesce(v_available, 0), 0), v_line.title;
    end if;
    v_subtotal := v_subtotal + (v_line.unit_price * v_line.quantity);
  end loop;

  v_subtotal := public.money_round(v_subtotal);
  v_shipping := case
    when v_settings.free_shipping_threshold > 0 and v_subtotal >= v_settings.free_shipping_threshold then 0
    else coalesce(v_settings.shipping_fee, 0)
  end;

  if v_settings.prices_include_tax then
    v_tax := public.money_round(v_subtotal - (v_subtotal / (1 + (v_settings.tax_rate / 100))));
    v_total := public.money_round(v_subtotal + v_shipping);
  else
    v_tax := public.money_round(v_subtotal * (v_settings.tax_rate / 100));
    v_total := public.money_round(v_subtotal + v_tax + v_shipping);
  end if;

  insert into public.customers (name, email, phone)
  values (v_name, v_email, v_phone)
  on conflict (phone_normalized) do update
    set name = excluded.name,
        email = case when excluded.email <> '' then excluded.email else public.customers.email end,
        updated_at = now()
  returning id into v_customer_id;

  if not exists (
    select 1 from public.customer_addresses
     where customer_id = v_customer_id
       and lower(address) = lower(v_address)
       and lower(city) = lower(v_city)
  ) then
    update public.customer_addresses set is_default = false where customer_id = v_customer_id;
    insert into public.customer_addresses (customer_id, address, city, postal_code, is_default)
    values (v_customer_id, v_address, v_city, v_postal, true);
  end if;

  insert into public.orders (
    customer_id, customer_name, email, phone, address, city, postal_code,
    customer_notes, subtotal, shipping_fee, tax_total, total, currency,
    payment_method, payment_status, order_status, stock_reserved, idempotency_key
  ) values (
    v_customer_id, v_name, v_email, v_phone, v_address, v_city, v_postal,
    v_notes, v_subtotal, v_shipping, v_tax, v_total, coalesce(v_settings.currency, 'PKR'),
    'cod', 'pending', 'new', true, p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning * into v_order;

  if v_order.id is null then
    select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
    if found then
      return query select v_existing.id, v_existing.order_number, v_existing.total;
      return;
    end if;
    raise exception 'The order could not be created. Please try again.';
  end if;

  insert into public.order_items (
    order_id, product_id, variant_id, title, variant_title, size, colour, sku,
    image_url, unit_price, quantity, line_total
  )
  select
    v_order.id, product_id, variant_id, title, variant_title, size, colour, sku,
    image_url, unit_price, quantity, public.money_round(unit_price * quantity)
  from _halas_cart;

  perform public.reserve_order_stock(v_order.id);

  insert into public.payment_records (order_id, method, amount, status, note)
  values (v_order.id, 'cod', v_order.total, 'pending', 'Cash on Delivery');

  insert into public.delivery_records (order_id, status, delivery_charges)
  values (v_order.id, 'pending', v_order.shipping_fee);

  insert into public.order_status_history (order_id, field, from_value, to_value, note)
  values (v_order.id, 'order_status', null, 'new', 'Order placed through the storefront COD checkout');

  perform public.log_activity('order.placed', 'order', v_order.id::text,
    jsonb_build_object('order_number', v_order.order_number, 'total', v_order.total));

  return query select v_order.id, v_order.order_number, v_order.total;
end;
$$;

create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status text,
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_settings public.store_settings%rowtype;
  v_old text;
  v_new text := lower(btrim(coalesce(p_status, '')));
  v_allowed boolean := false;
  v_stock_reserved boolean;
  v_stock_deducted boolean;
  v_delivery public.delivery_records%rowtype;
  v_delivery_status text;
  v_new_payment_status text;
begin
  perform public.require_admin();

  if v_new not in ('new', 'pending_confirmation', 'confirmed', 'processing', 'packed',
                   'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned') then
    raise exception 'Invalid order status.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;
  select * into v_settings from public.store_settings where id = 1;

  v_old := v_order.order_status;
  v_stock_reserved := v_order.stock_reserved;
  v_stock_deducted := v_order.stock_deducted;
  v_new_payment_status := v_order.payment_status;

  if v_old = v_new then
    if btrim(coalesce(p_note, '')) <> '' then
      insert into public.order_status_history (order_id, field, from_value, to_value, note, actor_id, actor_email)
      values (p_order_id, 'note', v_old, v_new, p_note, auth.uid(), coalesce(auth.jwt() ->> 'email', ''));
    end if;
    return;
  end if;

  v_allowed := case v_old
    when 'new' then v_new in ('pending_confirmation', 'confirmed', 'processing', 'packed', 'shipped', 'cancelled')
    when 'pending_confirmation' then v_new in ('confirmed', 'processing', 'packed', 'shipped', 'cancelled')
    when 'confirmed' then v_new in ('processing', 'packed', 'shipped', 'out_for_delivery', 'cancelled')
    when 'processing' then v_new in ('packed', 'shipped', 'out_for_delivery', 'cancelled')
    when 'packed' then v_new in ('shipped', 'out_for_delivery', 'cancelled')
    when 'shipped' then v_new in ('out_for_delivery', 'delivered', 'cancelled', 'returned')
    when 'out_for_delivery' then v_new in ('delivered', 'cancelled', 'returned')
    when 'delivered' then v_new in ('returned')
    when 'cancelled' then v_new in ('new', 'pending_confirmation', 'confirmed', 'processing')
    when 'returned' then false
    else false
  end;

  if not v_allowed then
    raise exception 'An order cannot move from % to %.', v_old, v_new;
  end if;

  if v_new = 'cancelled' then
    if v_stock_deducted then
      if v_settings.restock_cancelled then
        perform public.restore_order_stock(p_order_id, 'restore');
      end if;
      v_stock_deducted := false;
    elsif v_stock_reserved then
      perform public.release_order_stock(p_order_id);
    end if;
    v_stock_reserved := false;
  elsif v_new = 'returned' then
    if v_stock_deducted then
      if v_settings.restock_returned then
        perform public.restore_order_stock(p_order_id, 'return');
      end if;
      v_stock_deducted := false;
    elsif v_stock_reserved then
      perform public.release_order_stock(p_order_id);
    end if;
    v_stock_reserved := false;
  else
    -- Reactivating a cancelled order reserves stock again before it can move on.
    if v_old in ('cancelled') and not v_stock_reserved and not v_stock_deducted then
      perform public.reserve_order_stock(p_order_id);
      v_stock_reserved := true;
    end if;

    if v_new in ('confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered')
       and not v_stock_deducted then
      perform public.deduct_order_stock(p_order_id);
      v_stock_deducted := true;
      v_stock_reserved := false;
    end if;
  end if;

  if v_new = 'delivered' and v_new_payment_status = 'pending' then
    v_new_payment_status := 'paid';
  end if;

  update public.orders set
    order_status = v_new,
    stock_reserved = v_stock_reserved,
    stock_deducted = v_stock_deducted,
    payment_status = v_new_payment_status,
    confirmed_at = case when v_new = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
    packed_at = case when v_new = 'packed' then coalesce(packed_at, now()) else packed_at end,
    shipped_at = case when v_new = 'shipped' then coalesce(shipped_at, now()) else shipped_at end,
    delivered_at = case when v_new = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
    cancelled_at = case when v_new = 'cancelled' then coalesce(cancelled_at, now()) else cancelled_at end,
    returned_at = case when v_new = 'returned' then coalesce(returned_at, now()) else returned_at end
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (order_id, field, from_value, to_value, note, actor_id, actor_email)
  values (p_order_id, 'order_status', v_old, v_new, coalesce(p_note, ''), auth.uid(), coalesce(auth.jwt() ->> 'email', ''));

  if v_new_payment_status is distinct from v_order.payment_status then
    null;
  end if;

  select * into v_delivery from public.delivery_records where order_id = p_order_id for update;
  if found then
    v_delivery_status := case v_new
      when 'packed' then 'ready_to_dispatch'
      when 'shipped' then 'shipped'
      when 'out_for_delivery' then 'out_for_delivery'
      when 'delivered' then 'delivered'
      when 'cancelled' then 'cancelled'
      when 'returned' then 'returned'
      else 'pending'
    end;

    if v_delivery.status is distinct from v_delivery_status then
      update public.delivery_records set
        status = v_delivery_status,
        dispatch_date = case
          when v_delivery_status = 'shipped' then coalesce(dispatch_date, current_date)
          else dispatch_date
        end,
        delivered_at = case
          when v_delivery_status = 'delivered' then coalesce(delivered_at, now())
          else delivered_at
        end
      where id = v_delivery.id;

      insert into public.delivery_events (delivery_id, status, note, actor_id, actor_email)
      values (v_delivery.id, v_delivery_status, coalesce(p_note, ''), auth.uid(), coalesce(auth.jwt() ->> 'email', ''));

      insert into public.order_status_history (order_id, field, from_value, to_value, note, actor_id, actor_email)
      values (p_order_id, 'delivery_status', v_delivery.status, v_delivery_status, coalesce(p_note, ''),
              auth.uid(), coalesce(auth.jwt() ->> 'email', ''));
    end if;
  end if;

  if v_new_payment_status = 'paid' and v_order.payment_status = 'paid' then
    update public.payment_records
       set status = 'paid', note = 'Collected on delivery', updated_at = now()
     where order_id = p_order_id
       and id = (select id from public.payment_records where order_id = p_order_id order by created_at desc limit 1);
  end if;

  perform public.log_activity('order.status', 'order', p_order_id::text,
    jsonb_build_object('from', v_old, 'to', v_new, 'note', p_note));
end;
$$;

create or replace function public.admin_update_delivery(
  p_order_id uuid,
  p_courier_name text default null,
  p_tracking_number text default null,
  p_tracking_url text default null,
  p_dispatch_date date default null,
  p_expected_delivery_date date default null,
  p_delivery_charges numeric default null,
  p_status text default null,
  p_notes text default null,
  p_event_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delivery public.delivery_records%rowtype;
  v_order public.orders%rowtype;
  v_new_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
  v_mapped_order_status text;
  v_status_changed boolean := false;
begin
  perform public.require_admin();

  if v_new_status is not null and v_new_status not in (
    'pending', 'ready_to_dispatch', 'shipped', 'out_for_delivery',
    'delivered', 'failed_delivery', 'returned', 'cancelled'
  ) then
    raise exception 'Invalid delivery status.';
  end if;
  if p_delivery_charges is not null and p_delivery_charges < 0 then
    raise exception 'Delivery charges cannot be negative.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;

  select * into v_delivery from public.delivery_records where order_id = p_order_id for update;
  if not found then
    insert into public.delivery_records (order_id, status) values (p_order_id, 'pending')
    returning * into v_delivery;
  end if;

  v_status_changed := v_new_status is not null and v_new_status is distinct from v_delivery.status;

  update public.delivery_records set
    courier_name = coalesce(p_courier_name, courier_name),
    tracking_number = coalesce(p_tracking_number, tracking_number),
    tracking_url = coalesce(p_tracking_url, tracking_url),
    dispatch_date = coalesce(p_dispatch_date, dispatch_date),
    expected_delivery_date = coalesce(p_expected_delivery_date, expected_delivery_date),
    delivery_charges = coalesce(p_delivery_charges, delivery_charges),
    status = coalesce(v_new_status, status),
    notes = coalesce(p_notes, notes),
    delivered_at = case when coalesce(v_new_status, status) = 'delivered' then coalesce(delivered_at, now()) else delivered_at end
  where id = v_delivery.id
  returning * into v_delivery;

  if v_status_changed then
    v_mapped_order_status := case v_new_status
      when 'ready_to_dispatch' then 'packed'
      when 'shipped' then 'shipped'
      when 'out_for_delivery' then 'out_for_delivery'
      when 'delivered' then 'delivered'
      when 'returned' then 'returned'
      when 'cancelled' then 'cancelled'
      else null
    end;

    if v_mapped_order_status is not null and v_mapped_order_status <> v_order.order_status then
      perform public.admin_update_order_status(p_order_id, v_mapped_order_status, coalesce(p_event_note, ''));
    else
      insert into public.delivery_events (delivery_id, status, note, actor_id, actor_email)
      values (v_delivery.id, v_new_status, coalesce(p_event_note, ''), auth.uid(), coalesce(auth.jwt() ->> 'email', ''));

      insert into public.order_status_history (order_id, field, from_value, to_value, note, actor_id, actor_email)
      values (p_order_id, 'delivery_status', v_delivery.status, v_new_status, coalesce(p_event_note, ''),
              auth.uid(), coalesce(auth.jwt() ->> 'email', ''));
    end if;
  elsif btrim(coalesce(p_event_note, '')) <> '' then
    insert into public.delivery_events (delivery_id, status, note, actor_id, actor_email)
    values (v_delivery.id, v_delivery.status, p_event_note, auth.uid(), coalesce(auth.jwt() ->> 'email', ''));
  end if;

  perform public.log_activity('delivery.updated', 'order', p_order_id::text,
    jsonb_build_object('status', v_delivery.status, 'courier', v_delivery.courier_name,
                       'tracking', v_delivery.tracking_number));
end;
$$;

create or replace function public.admin_update_payment(
  p_order_id uuid,
  p_status text,
  p_reference text default '',
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_payment_id uuid;
begin
  perform public.require_admin();

  if v_status not in ('pending', 'paid', 'failed', 'refunded') then
    raise exception 'Invalid payment status.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;

  select id into v_payment_id
    from public.payment_records
   where order_id = p_order_id
   order by created_at desc
   limit 1;

  if v_payment_id is null then
    insert into public.payment_records (order_id, method, amount, status, reference, note)
    values (p_order_id, 'cod', v_order.total, v_status, coalesce(p_reference, ''), coalesce(p_note, ''));
  else
    update public.payment_records
       set status = v_status,
           reference = coalesce(p_reference, reference),
           note = coalesce(p_note, note)
     where id = v_payment_id;
  end if;

  update public.orders set payment_status = v_status where id = p_order_id;

  insert into public.order_status_history (order_id, field, from_value, to_value, note, actor_id, actor_email)
  values (p_order_id, 'payment_status', v_order.payment_status, v_status, coalesce(p_note, ''),
          auth.uid(), coalesce(auth.jwt() ->> 'email', ''));

  perform public.log_activity('payment.updated', 'order', p_order_id::text,
    jsonb_build_object('from', v_order.payment_status, 'to', v_status, 'reference', p_reference));
end;
$$;

create or replace function public.admin_update_order_notes(
  p_order_id uuid,
  p_internal_notes text default null,
  p_customer_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_internal text;
  v_old_customer text;
begin
  perform public.require_admin();
  select internal_notes, customer_notes into v_old_internal, v_old_customer
    from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;

  update public.orders set
    internal_notes = coalesce(p_internal_notes, internal_notes),
    customer_notes = coalesce(p_customer_notes, customer_notes)
  where id = p_order_id;

  if p_internal_notes is not null and p_internal_notes is distinct from v_old_internal then
    insert into public.order_status_history (order_id, field, from_value, to_value, note, actor_id, actor_email)
    values (p_order_id, 'note', v_old_internal, p_internal_notes, 'Internal note updated',
            auth.uid(), coalesce(auth.jwt() ->> 'email', ''));
  end if;

  perform public.log_activity('order.notes', 'order', p_order_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.admin_update_customer(
  p_customer_id uuid,
  p_name text default null,
  p_email text default null,
  p_phone text default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();

  if p_name is not null and length(btrim(p_name)) < 2 then
    raise exception 'Customer name is too short.';
  end if;
  if p_phone is not null and regexp_replace(p_phone, '[^0-9]', '', 'g') !~ '^[0-9]{7,15}$' then
    raise exception 'Enter a valid customer phone number.';
  end if;
  if p_email is not null and btrim(p_email) <> '' and position('@' in p_email) < 2 then
    raise exception 'Enter a valid customer email.';
  end if;

  update public.customers set
    name = coalesce(nullif(btrim(p_name), ''), name),
    email = coalesce(btrim(p_email), email),
    phone = coalesce(nullif(btrim(p_phone), ''), phone),
    notes = coalesce(p_notes, notes)
  where id = p_customer_id;

  if not found then
    raise exception 'Customer not found.';
  end if;

  perform public.log_activity('customer.updated', 'customer', p_customer_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.admin_bulk_update_order_status(
  p_order_ids uuid[],
  p_status text,
  p_note text default ''
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  perform public.require_admin();
  if p_order_ids is null or array_length(p_order_ids, 1) is null then
    return 0;
  end if;
  foreach v_id in array p_order_ids
  loop
    perform public.admin_update_order_status(v_id, p_status, p_note);
    v_count := v_count + 1;
  end loop;
  perform public.log_activity('order.bulk_status', 'order', array_length(p_order_ids, 1)::text,
    jsonb_build_object('status', p_status, 'count', v_count));
  return v_count;
end;
$$;

create or replace function public.admin_analytics(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_revenue numeric := 0;
  v_orders integer := 0;
  v_sales_orders integer := 0;
  v_units integer := 0;
  v_cancelled integer := 0;
  v_returned integer := 0;
  v_pending integer := 0;
  v_awaiting integer := 0;
  v_out integer := 0;
  v_delivered integer := 0;
  v_low_count integer := 0;
  v_today integer := 0;
  v_week_orders integer := 0;
  v_week_sales numeric := 0;
  v_month_orders integer := 0;
  v_month_sales numeric := 0;
  v_series jsonb := '[]'::jsonb;
  v_best jsonb := '[]'::jsonb;
  v_low jsonb := '[]'::jsonb;
  v_recent jsonb := '[]'::jsonb;
  v_breakdown jsonb := '{}'::jsonb;
  v_activity jsonb := '[]'::jsonb;
begin
  perform public.require_admin();

  select timezone into v_tz from public.store_settings where id = 1;
  v_tz := coalesce(v_tz, 'Asia/Karachi');
  v_from := coalesce(p_from, now() - interval '30 days');
  v_to := coalesce(p_to, now());
  if v_from >= v_to then
    raise exception 'The analytics start date must be before the end date.';
  end if;

  select
    coalesce(sum(o.total) filter (
      where o.order_status not in ('cancelled', 'returned') and o.payment_status <> 'failed'
    ), 0),
    count(*),
    count(*) filter (
      where o.order_status not in ('cancelled', 'returned') and o.payment_status <> 'failed'
    ),
    count(*) filter (where o.order_status = 'cancelled'),
    count(*) filter (where o.order_status = 'returned')
  into v_revenue, v_orders, v_sales_orders, v_cancelled, v_returned
  from public.orders o
  where o.placed_at >= v_from and o.placed_at < v_to;

  select
    coalesce(sum(oi.quantity), 0)
  into v_units
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.placed_at >= v_from and o.placed_at < v_to
    and o.order_status not in ('cancelled', 'returned');

  select
    count(*) filter (where order_status in ('new', 'pending_confirmation')),
    count(*) filter (where order_status in ('confirmed', 'processing', 'packed')),
    count(*) filter (where order_status = 'out_for_delivery'),
    count(*) filter (where order_status = 'delivered')
  into v_pending, v_awaiting, v_out, v_delivered
  from public.orders;

  select count(*) into v_low_count
  from public.inventory_levels il
  join public.product_variants pv on pv.id = il.variant_id
  join public.products p on p.id = pv.product_id
  cross join public.store_settings ss
  where pv.is_active
    and p.status = 'published'
    and il.available_quantity <= coalesce(il.low_stock_threshold, ss.low_stock_threshold);

  select count(*) into v_today
  from public.orders
  where (placed_at at time zone v_tz)::date = (now() at time zone v_tz)::date;

  select count(*),
         coalesce(sum(total) filter (where order_status not in ('cancelled', 'returned')), 0)
  into v_week_orders, v_week_sales
  from public.orders
  where placed_at >= (date_trunc('week', now() at time zone v_tz) at time zone v_tz);

  select count(*),
         coalesce(sum(total) filter (where order_status not in ('cancelled', 'returned')), 0)
  into v_month_orders, v_month_sales
  from public.orders
  where placed_at >= (date_trunc('month', now() at time zone v_tz) at time zone v_tz);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', to_char(d.day, 'YYYY-MM-DD'),
      'revenue', coalesce(s.revenue, 0),
      'orders', coalesce(s.orders, 0)
    ) order by d.day
  ), '[]'::jsonb)
  into v_series
  from generate_series(v_from::date, v_to::date, interval '1 day') as d(day)
  left join lateral (
    select sum(o.total) revenue, count(*) orders
    from public.orders o
    where o.placed_at >= (d.day::timestamp at time zone v_tz)
      and o.placed_at < ((d.day + interval '1 day')::timestamp at time zone v_tz)
      and o.order_status not in ('cancelled', 'returned')
      and o.payment_status <> 'failed'
  ) s on true;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'product_id', s.product_id,
      'title', s.title,
      'units', s.units,
      'revenue', s.revenue
    ) order by s.units desc
  ), '[]'::jsonb)
  into v_best
  from (
    select oi.product_id, max(oi.title) title, sum(oi.quantity)::integer units, sum(oi.line_total) revenue
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.placed_at >= v_from and o.placed_at < v_to
      and o.order_status not in ('cancelled', 'returned')
      and oi.product_id is not null
    group by oi.product_id
    order by units desc
    limit 5
  ) s;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'variant_id', x.variant_id,
      'product_id', x.product_id,
      'title', x.title,
      'variant', x.variant,
      'sku', x.sku,
      'quantity', x.quantity,
      'reserved', x.reserved,
      'available', x.available,
      'threshold', x.threshold
    ) order by x.available
  ), '[]'::jsonb)
  into v_low
  from (
    select
      il.variant_id, pv.product_id, p.title,
      nullif(concat_ws(' / ', pv.size, pv.colour), '') variant,
      pv.sku, il.quantity, il.reserved_quantity reserved, il.available_quantity available,
      coalesce(il.low_stock_threshold, ss.low_stock_threshold) threshold
    from public.inventory_levels il
    join public.product_variants pv on pv.id = il.variant_id
    join public.products p on p.id = pv.product_id
    cross join public.store_settings ss
    where pv.is_active
      and il.available_quantity <= coalesce(il.low_stock_threshold, ss.low_stock_threshold)
    order by il.available_quantity
    limit 10
  ) x;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'customer_name', o.customer_name,
      'total', o.total,
      'order_status', o.order_status,
      'payment_status', o.payment_status,
      'placed_at', o.placed_at,
      'city', o.city,
      'item_count', (select count(*) from public.order_items oi where oi.order_id = o.id)
    ) order by o.placed_at desc
  ), '[]'::jsonb)
  into v_recent
  from (select * from public.orders order by placed_at desc limit 8) o;

  select coalesce(jsonb_object_agg(x.order_status, x.count), '{}'::jsonb)
  into v_breakdown
  from (
    select order_status, count(*)::integer as count
    from public.orders
    where placed_at >= v_from and placed_at < v_to
    group by order_status
  ) x;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'action', a.action,
      'entity_type', a.entity_type,
      'entity_id', a.entity_id,
      'actor_email', a.actor_email,
      'details', a.details,
      'created_at', a.created_at
    ) order by a.created_at desc
  ), '[]'::jsonb)
  into v_activity
  from (select * from public.activity_logs order by created_at desc limit 8) a;

  return jsonb_build_object(
    'range', jsonb_build_object('from', v_from, 'to', v_to, 'timezone', v_tz),
    'revenue', v_revenue,
    'orders', v_orders,
    'sales_orders', v_sales_orders,
    'units', v_units,
    'average_order', case when v_sales_orders > 0 then public.money_round(v_revenue / v_sales_orders) else 0 end,
    'cancelled', v_cancelled,
    'returned', v_returned,
    'pending', v_pending,
    'awaiting_dispatch', v_awaiting,
    'out_for_delivery', v_out,
    'delivered', v_delivered,
    'low_stock_count', v_low_count,
    'today_orders', v_today,
    'week_orders', v_week_orders,
    'week_sales', v_week_sales,
    'month_orders', v_month_orders,
    'month_sales', v_month_sales,
    'series', v_series,
    'best_sellers', v_best,
    'low_stock', v_low,
    'recent_orders', v_recent,
    'status_breakdown', v_breakdown,
    'activity', v_activity
  );
end;
$$;

create or replace function public.report_system_error(
  p_message text,
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();
  perform public.enqueue_email(
    'system_error', 'admin', null, 'system_error',
    'HALA.S admin error: ' || left(coalesce(p_message, 'Unknown error'), 120),
    jsonb_build_object('message', p_message, 'context', p_context, 'reported_at', now(),
                       'actor', coalesce(auth.jwt() ->> 'email', '')),
    null,
    'system_error:' || gen_random_uuid()::text
  );
  perform public.log_activity('system.error', 'system', '', jsonb_build_object('message', p_message, 'context', p_context));
end;
$$;

revoke all on function public.apply_inventory_change(uuid, integer, integer, text, uuid, text) from public;
revoke all on function public.reserve_order_stock(uuid) from public;
revoke all on function public.deduct_order_stock(uuid) from public;
revoke all on function public.release_order_stock(uuid) from public;
revoke all on function public.restore_order_stock(uuid, text) from public;
revoke all on function public.order_email_payload(public.orders) from public;
revoke all on function public.delivery_email_payload(public.delivery_records) from public;
revoke all on function public.submit_cod_order(text, text, text, text, text, text, text, jsonb, uuid) from public;
revoke all on function public.admin_update_order_status(uuid, text, text) from public;
revoke all on function public.admin_update_delivery(uuid, text, text, text, date, date, numeric, text, text, text) from public;
revoke all on function public.admin_update_payment(uuid, text, text, text) from public;
revoke all on function public.admin_update_order_notes(uuid, text, text) from public;
revoke all on function public.admin_update_customer(uuid, text, text, text, text) from public;
revoke all on function public.admin_bulk_update_order_status(uuid[], text, text) from public;
revoke all on function public.admin_analytics(timestamptz, timestamptz) from public;
revoke all on function public.report_system_error(text, jsonb) from public;
revoke all on function public.log_activity(text, text, text, jsonb) from public;
revoke all on function public.enqueue_email(text, text, text, text, text, jsonb, uuid, text) from public;

grant execute on function public.submit_cod_order(text, text, text, text, text, text, text, jsonb, uuid) to anon, authenticated;
grant execute on function public.admin_update_order_status(uuid, text, text) to authenticated;
grant execute on function public.admin_update_delivery(uuid, text, text, text, date, date, numeric, text, text, text) to authenticated;
grant execute on function public.admin_update_payment(uuid, text, text, text) to authenticated;
grant execute on function public.admin_update_order_notes(uuid, text, text) to authenticated;
grant execute on function public.admin_update_customer(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_bulk_update_order_status(uuid[], text, text) to authenticated;
grant execute on function public.admin_analytics(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_system_error(text, jsonb) to authenticated;
