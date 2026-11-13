-- 06 — catalogue, collection, settings and inventory RPCs.

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.slugify(p_value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.admin_save_product(
  p_product jsonb,
  p_images jsonb default '[]'::jsonb,
  p_variants jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := nullif(p_product ->> 'id', '')::uuid;
  v_title text := btrim(coalesce(p_product ->> 'title', ''));
  v_handle text := public.slugify(p_product ->> 'handle');
  v_status text := coalesce(nullif(p_product ->> 'status', ''), 'draft');
  v_price numeric;
  v_compare numeric;
  v_cost numeric;
  v_is_new boolean := nullif(p_product ->> 'id', '') is null;
  v_item jsonb;
  v_image jsonb;
  v_image_id uuid;
  v_primary_id uuid;
  v_variant_id uuid;
  v_size text;
  v_colour text;
  v_sku text;
  v_qty integer;
  v_old_qty integer;
  v_reserved integer;
  v_threshold integer;
  v_active_count integer;
  v_image_count integer;
  v_position integer;
begin
  perform public.require_admin();

  if v_title = '' then
    raise exception 'Product title is required.';
  end if;
  if v_handle = '' then
    v_handle := public.slugify(v_title);
  end if;
  if v_handle !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'The URL handle may contain lowercase letters, numbers and hyphens only.';
  end if;
  if v_status not in ('draft', 'published', 'archived') then
    raise exception 'Invalid product status.';
  end if;

  v_price := coalesce((p_product ->> 'price')::numeric, 0);
  v_compare := nullif(p_product ->> 'compare_at_price', '')::numeric;
  v_cost := nullif(p_product ->> 'cost_per_item', '')::numeric;
  if v_price < 0 or coalesce(v_compare, 0) < 0 or coalesce(v_cost, 0) < 0 then
    raise exception 'Prices cannot be negative.';
  end if;

  if v_id is null then
    insert into public.products (
      handle, title, description, fabric, care, released_at, brand, vendor, category, product_type, status,
      price, compare_at_price, cost_per_item, sku, tags, search_keywords,
      seo_title, seo_description, featured, created_by
    ) values (
      v_handle, v_title, coalesce(p_product ->> 'description', ''),
      coalesce(p_product ->> 'fabric', ''),
      coalesce(p_product ->> 'care', ''),
      nullif(p_product ->> 'released_at', '')::date,
      coalesce(nullif(p_product ->> 'brand', ''), 'HALA.S'),
      coalesce(nullif(p_product ->> 'vendor', ''), 'HALA.S'),
      coalesce(p_product ->> 'category', ''),
      coalesce(p_product ->> 'product_type', ''),
      v_status, v_price, v_compare, v_cost,
      nullif(btrim(coalesce(p_product ->> 'sku', '')), ''),
      coalesce(
        (select array_agg(value) from jsonb_array_elements_text(coalesce(p_product -> 'tags', '[]'::jsonb))),
        '{}'::text[]
      ),
      coalesce(
        (select array_agg(value) from jsonb_array_elements_text(coalesce(p_product -> 'search_keywords', '[]'::jsonb))),
        '{}'::text[]
      ),
      coalesce(p_product ->> 'seo_title', ''),
      coalesce(p_product ->> 'seo_description', ''),
      coalesce((p_product ->> 'featured')::boolean, false),
      auth.uid()
    )
    returning id into v_id;
  else
    update public.products set
      handle = v_handle,
      title = v_title,
      description = coalesce(p_product ->> 'description', description),
      fabric = coalesce(p_product ->> 'fabric', fabric),
      care = coalesce(p_product ->> 'care', care),
      released_at = coalesce(nullif(p_product ->> 'released_at', '')::date, released_at),
      brand = coalesce(nullif(p_product ->> 'brand', ''), brand),
      vendor = coalesce(nullif(p_product ->> 'vendor', ''), vendor),
      category = coalesce(p_product ->> 'category', category),
      product_type = coalesce(p_product ->> 'product_type', product_type),
      status = v_status,
      price = v_price,
      compare_at_price = v_compare,
      cost_per_item = v_cost,
      sku = nullif(btrim(coalesce(p_product ->> 'sku', '')), ''),
      tags = coalesce(
        (select array_agg(value) from jsonb_array_elements_text(coalesce(p_product -> 'tags', '[]'::jsonb))),
        '{}'::text[]
      ),
      search_keywords = coalesce(
        (select array_agg(value) from jsonb_array_elements_text(coalesce(p_product -> 'search_keywords', '[]'::jsonb))),
        '{}'::text[]
      ),
      seo_title = coalesce(p_product ->> 'seo_title', seo_title),
      seo_description = coalesce(p_product ->> 'seo_description', seo_description),
      featured = coalesce((p_product ->> 'featured')::boolean, false)
    where id = v_id;

    if not found then
      raise exception 'Product not found.';
    end if;
  end if;

  -- Images are replaced as a set; storage objects are managed by the browser.
  if jsonb_typeof(p_images) <> 'array' then
    raise exception 'Product images must be a list.';
  end if;
  if jsonb_array_length(p_images) > 16 then
    raise exception 'A product can have at most 16 images.';
  end if;

  delete from public.product_images where product_id = v_id;
  v_position := 0;
  v_primary_id := null;
  for v_image in select value from jsonb_array_elements(p_images)
  loop
    if btrim(coalesce(v_image ->> 'url', '')) = '' then
      continue;
    end if;
    v_position := v_position + 1;
    insert into public.product_images (product_id, url, storage_path, alt, position, is_primary)
    values (
      v_id,
      btrim(v_image ->> 'url'),
      nullif(v_image ->> 'storage_path', ''),
      coalesce(v_image ->> 'alt', ''),
      v_position,
      false
    )
    returning id into v_image_id;

    if v_primary_id is null and coalesce((v_image ->> 'is_primary')::boolean, false) then
      v_primary_id := v_image_id;
    end if;
  end loop;

  if v_primary_id is null then
    select id into v_primary_id
      from public.product_images
     where product_id = v_id
     order by position
     limit 1;
  end if;
  if v_primary_id is not null then
    update public.product_images set is_primary = true where id = v_primary_id;
  end if;

  if jsonb_typeof(p_variants) <> 'array' then
    raise exception 'Variants must be a list.';
  end if;

  create temp table if not exists _halas_variant_ids (id uuid primary key) on commit drop;
  truncate _halas_variant_ids;

  -- Deactivate the current set first so a replaced size/colour combination does
  -- not collide with the partial unique index while the new set is written.
  update public.product_variants
     set is_active = false,
         sku = null
   where product_id = v_id;

  for v_item in select value from jsonb_array_elements(p_variants)
  loop
    v_size := btrim(coalesce(v_item ->> 'size', ''));
    v_colour := btrim(coalesce(v_item ->> 'colour', ''));
    if v_size = '' and v_colour = '' then
      raise exception 'Every variant needs a size or a colour.';
    end if;

    v_sku := nullif(btrim(coalesce(v_item ->> 'sku', '')), '');
    v_variant_id := nullif(v_item ->> 'id', '')::uuid;

    if v_variant_id is not null and exists (
      select 1 from public.product_variants where id = v_variant_id and product_id = v_id
    ) then
      update public.product_variants set
        sku = v_sku,
        title = coalesce(nullif(btrim(v_item ->> 'title'), ''), nullif(concat_ws(' / ', v_size, v_colour), '')),
        size = v_size,
        colour = v_colour,
        colour_hex = coalesce(v_item ->> 'colour_hex', ''),
        price = nullif(v_item ->> 'price', '')::numeric,
        compare_at_price = nullif(v_item ->> 'compare_at_price', '')::numeric,
        position = coalesce((v_item ->> 'position')::integer, 0),
        is_active = coalesce((v_item ->> 'is_active')::boolean, true)
      where id = v_variant_id;
    else
      insert into public.product_variants (
        product_id, sku, title, size, colour, colour_hex, price, compare_at_price, position, is_active
      ) values (
        v_id, v_sku,
        coalesce(nullif(btrim(v_item ->> 'title'), ''), nullif(concat_ws(' / ', v_size, v_colour), '')),
        v_size, v_colour, coalesce(v_item ->> 'colour_hex', ''),
        nullif(v_item ->> 'price', '')::numeric,
        nullif(v_item ->> 'compare_at_price', '')::numeric,
        coalesce((v_item ->> 'position')::integer, 0),
        coalesce((v_item ->> 'is_active')::boolean, true)
      )
      returning id into v_variant_id;
    end if;

    insert into _halas_variant_ids (id) values (v_variant_id) on conflict do nothing;

    v_qty := greatest(coalesce((v_item ->> 'quantity')::integer, 0), 0);
    v_threshold := nullif(v_item ->> 'low_stock_threshold', '')::integer;

    select quantity, reserved_quantity into v_old_qty, v_reserved
      from public.inventory_levels
     where variant_id = v_variant_id
     for update;

    if found then
      if v_qty < v_reserved then
        raise exception 'Stock for % cannot be below the % unit(s) already reserved for open orders.', v_size, v_reserved;
      end if;
      update public.inventory_levels
         set quantity = v_qty,
             low_stock_threshold = coalesce(v_threshold, low_stock_threshold)
       where variant_id = v_variant_id;
      if v_qty <> v_old_qty then
        insert into public.inventory_movements (
          variant_id, type, quantity_change, reserved_change,
          quantity_after, reserved_after, reason, actor_id, actor_email
        ) values (
          v_variant_id, 'set', v_qty - v_old_qty, 0, v_qty, v_reserved,
          'Product editor', auth.uid(), coalesce(auth.jwt() ->> 'email', '')
        );
      end if;
    else
      insert into public.inventory_levels (variant_id, quantity, reserved_quantity, low_stock_threshold)
      values (v_variant_id, v_qty, 0, v_threshold);
      insert into public.inventory_movements (
        variant_id, type, quantity_change, reserved_change,
        quantity_after, reserved_after, reason, actor_id, actor_email
      ) values (
        v_variant_id, 'set', v_qty, 0, v_qty, 0,
        'Product editor', auth.uid(), coalesce(auth.jwt() ->> 'email', '')
      );
    end if;
  end loop;

  select count(*) into v_active_count
    from public.product_variants
   where product_id = v_id and is_active;
  if v_active_count = 0 then
    raise exception 'At least one active variant is required.';
  end if;

  select count(*) into v_image_count from public.product_images where product_id = v_id;

  perform public.log_activity(
    case when v_is_new then 'product.created' else 'product.updated' end,
    'product', v_id::text,
    jsonb_build_object('title', v_title, 'status', v_status, 'images', v_image_count, 'variants', v_active_count)
  );

  return v_id;
end;
$$;

create or replace function public.admin_set_product_status(p_product_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();
  if p_status not in ('draft', 'published', 'archived') then
    raise exception 'Invalid product status.';
  end if;
  update public.products set status = p_status where id = p_product_id;
  if not found then
    raise exception 'Product not found.';
  end if;
  perform public.log_activity('product.status', 'product', p_product_id::text, jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.admin_duplicate_product(p_product_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source public.products%rowtype;
  v_new_id uuid;
  v_handle text;
  v_variant public.product_variants%rowtype;
  v_new_variant_id uuid;
  v_suffix integer := 1;
begin
  perform public.require_admin();

  select * into v_source from public.products where id = p_product_id;
  if not found then
    raise exception 'Product not found.';
  end if;

  v_handle := v_source.handle || '-copy';
  while exists (select 1 from public.products where lower(handle) = lower(v_handle)) loop
    v_suffix := v_suffix + 1;
    v_handle := v_source.handle || '-copy-' || v_suffix;
  end loop;

  insert into public.products (
    handle, title, description, fabric, care, released_at, brand, vendor, category, product_type, status,
    price, compare_at_price, cost_per_item, sku, tags, search_keywords,
    seo_title, seo_description, featured, created_by
  ) values (
    v_handle, v_source.title || ' (Copy)', v_source.description, v_source.fabric, v_source.care,
    v_source.released_at, v_source.brand, v_source.vendor,
    v_source.category, v_source.product_type, 'draft', v_source.price, v_source.compare_at_price,
    v_source.cost_per_item, null, v_source.tags, v_source.search_keywords,
    v_source.seo_title, v_source.seo_description, false, auth.uid()
  )
  returning id into v_new_id;

  insert into public.product_images (product_id, url, storage_path, alt, position, is_primary)
  select v_new_id, url, storage_path, alt, position, is_primary
    from public.product_images
   where product_id = p_product_id
   order by position;

  for v_variant in select * from public.product_variants where product_id = p_product_id and is_active order by position
  loop
    insert into public.product_variants (
      product_id, sku, title, size, colour, colour_hex, price, compare_at_price, position, is_active
    ) values (
      v_new_id, null, v_variant.title, v_variant.size, v_variant.colour, v_variant.colour_hex,
      v_variant.price, v_variant.compare_at_price, v_variant.position, true
    )
    returning id into v_new_variant_id;

    insert into public.inventory_levels (variant_id, quantity, reserved_quantity, low_stock_threshold)
    select v_new_variant_id, quantity, 0, low_stock_threshold
      from public.inventory_levels
     where variant_id = v_variant.id;
  end loop;

  perform public.log_activity('product.duplicated', 'product', v_new_id::text, jsonb_build_object('source', p_product_id));
  return v_new_id;
end;
$$;

create or replace function public.admin_delete_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
begin
  perform public.require_admin();

  select title into v_title from public.products where id = p_product_id;
  if not found then
    raise exception 'Product not found.';
  end if;

  if exists (
    select 1
      from public.inventory_levels il
      join public.product_variants pv on pv.id = il.variant_id
     where pv.product_id = p_product_id and il.reserved_quantity > 0
  ) then
    raise exception 'This product has stock reserved for open orders. Archive it instead of deleting.';
  end if;

  if exists (
    select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.product_id = p_product_id
       and o.order_status not in ('cancelled', 'returned', 'delivered')
  ) then
    raise exception 'This product is used by an open order. Archive it instead of deleting.';
  end if;

  perform public.log_activity('product.deleted', 'product', p_product_id::text, jsonb_build_object('title', v_title));
  delete from public.products where id = p_product_id;
end;
$$;

create or replace function public.admin_save_collection(
  p_collection jsonb,
  p_product_ids jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := nullif(p_collection ->> 'id', '')::uuid;
  v_title text := btrim(coalesce(p_collection ->> 'title', ''));
  v_handle text := public.slugify(p_collection ->> 'handle');
  v_status text := coalesce(nullif(p_collection ->> 'status', ''), 'draft');
  v_rules jsonb := coalesce(p_collection -> 'rules', '{"match":"all","conditions":[]}'::jsonb);
  v_product_id uuid;
  v_position integer := 0;
begin
  perform public.require_admin();

  if v_title = '' then
    raise exception 'Collection title is required.';
  end if;
  if v_handle = '' then
    v_handle := public.slugify(v_title);
  end if;
  if v_handle !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'The collection handle may contain lowercase letters, numbers and hyphens only.';
  end if;
  if v_status not in ('draft', 'published', 'archived') then
    raise exception 'Invalid collection status.';
  end if;
  if jsonb_typeof(v_rules) <> 'object' then
    raise exception 'Collection rules must be an object.';
  end if;

  if v_id is null then
    insert into public.collections (
      handle, title, description, image_url, seo_title, seo_description,
      status, is_automatic, rules, position
    ) values (
      v_handle, v_title, coalesce(p_collection ->> 'description', ''),
      coalesce(p_collection ->> 'image_url', ''), coalesce(p_collection ->> 'seo_title', ''),
      coalesce(p_collection ->> 'seo_description', ''), v_status,
      coalesce((p_collection ->> 'is_automatic')::boolean, false), v_rules,
      coalesce((p_collection ->> 'position')::integer, 0)
    )
    returning id into v_id;
  else
    update public.collections set
      handle = v_handle,
      title = v_title,
      description = coalesce(p_collection ->> 'description', description),
      image_url = coalesce(p_collection ->> 'image_url', image_url),
      seo_title = coalesce(p_collection ->> 'seo_title', seo_title),
      seo_description = coalesce(p_collection ->> 'seo_description', seo_description),
      status = v_status,
      is_automatic = coalesce((p_collection ->> 'is_automatic')::boolean, false),
      rules = v_rules,
      position = coalesce((p_collection ->> 'position')::integer, position)
    where id = v_id;

    if not found then
      raise exception 'Collection not found.';
    end if;
    delete from public.collection_products where collection_id = v_id;
  end if;

  if jsonb_typeof(p_product_ids) <> 'array' then
    raise exception 'Collection products must be a list.';
  end if;

  for v_product_id in select value::uuid from jsonb_array_elements_text(p_product_ids)
  loop
    if exists (select 1 from public.products where id = v_product_id) then
      v_position := v_position + 1;
      insert into public.collection_products (collection_id, product_id, position)
      values (v_id, v_product_id, v_position)
      on conflict (collection_id, product_id) do update set position = excluded.position;
    end if;
  end loop;

  perform public.log_activity(
    case when p_collection ? 'id' then 'collection.updated' else 'collection.created' end,
    'collection', v_id::text,
    jsonb_build_object('title', v_title, 'status', v_status, 'automatic', coalesce((p_collection ->> 'is_automatic')::boolean, false))
  );
  return v_id;
end;
$$;

create or replace function public.admin_delete_collection(p_collection_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
begin
  perform public.require_admin();
  select title into v_title from public.collections where id = p_collection_id;
  if not found then
    raise exception 'Collection not found.';
  end if;
  perform public.log_activity('collection.deleted', 'collection', p_collection_id::text, jsonb_build_object('title', v_title));
  delete from public.collections where id = p_collection_id;
end;
$$;

create or replace function public.admin_update_settings(p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shipping numeric := coalesce((p_settings ->> 'shipping_fee')::numeric, 0);
  v_free numeric := coalesce((p_settings ->> 'free_shipping_threshold')::numeric, 0);
  v_tax numeric := coalesce((p_settings ->> 'tax_rate')::numeric, 0);
  v_low integer := coalesce((p_settings ->> 'low_stock_threshold')::integer, 3);
  v_admin_email text := coalesce(p_settings ->> 'admin_notification_email', '');
begin
  perform public.require_admin();

  if v_shipping < 0 or v_free < 0 then
    raise exception 'Shipping amounts cannot be negative.';
  end if;
  if v_tax < 0 or v_tax > 100 then
    raise exception 'Tax rate must be between 0 and 100.';
  end if;
  if v_low < 0 then
    raise exception 'The low-stock threshold cannot be negative.';
  end if;
  if btrim(v_admin_email) <> '' and position('@' in v_admin_email) < 2 then
    raise exception 'Enter a valid administrator notification email.';
  end if;

  update public.store_settings set
    store_name = case when p_settings ? 'store_name' then coalesce(nullif(btrim(p_settings ->> 'store_name'), ''), store_name) else store_name end,
    brand_mark = case when p_settings ? 'brand_mark' then coalesce(p_settings ->> 'brand_mark', brand_mark) else brand_mark end,
    support_email = case when p_settings ? 'support_email' then coalesce(p_settings ->> 'support_email', '') else support_email end,
    admin_notification_email = case when p_settings ? 'admin_notification_email' then btrim(v_admin_email) else admin_notification_email end,
    phone = case when p_settings ? 'phone' then coalesce(p_settings ->> 'phone', '') else phone end,
    whatsapp = case when p_settings ? 'whatsapp' then regexp_replace(coalesce(p_settings ->> 'whatsapp', ''), '[^0-9]', '', 'g') else whatsapp end,
    address = case when p_settings ? 'address' then coalesce(p_settings ->> 'address', '') else address end,
    currency = case when p_settings ? 'currency' then coalesce(nullif(btrim(p_settings ->> 'currency'), ''), currency) else currency end,
    cod_enabled = case when p_settings ? 'cod_enabled' then coalesce((p_settings ->> 'cod_enabled')::boolean, cod_enabled) else cod_enabled end,
    shipping_fee = case when p_settings ? 'shipping_fee' then v_shipping else shipping_fee end,
    free_shipping_threshold = case when p_settings ? 'free_shipping_threshold' then v_free else free_shipping_threshold end,
    tax_rate = case when p_settings ? 'tax_rate' then v_tax else tax_rate end,
    prices_include_tax = case when p_settings ? 'prices_include_tax' then coalesce((p_settings ->> 'prices_include_tax')::boolean, prices_include_tax) else prices_include_tax end,
    low_stock_threshold = case when p_settings ? 'low_stock_threshold' then v_low else low_stock_threshold end,
    restock_cancelled = case when p_settings ? 'restock_cancelled' then coalesce((p_settings ->> 'restock_cancelled')::boolean, restock_cancelled) else restock_cancelled end,
    restock_returned = case when p_settings ? 'restock_returned' then coalesce((p_settings ->> 'restock_returned')::boolean, restock_returned) else restock_returned end,
    timezone = case when p_settings ? 'timezone' then coalesce(nullif(btrim(p_settings ->> 'timezone'), ''), timezone) else timezone end,
    store_url = case when p_settings ? 'store_url' then btrim(coalesce(p_settings ->> 'store_url', '')) else store_url end,
    seo_title = case when p_settings ? 'seo_title' then coalesce(p_settings ->> 'seo_title', seo_title) else seo_title end,
    seo_description = case when p_settings ? 'seo_description' then coalesce(p_settings ->> 'seo_description', seo_description) else seo_description end,
    updated_by = auth.uid()
  where id = 1;

  perform public.log_activity('settings.updated', 'settings', '1', p_settings);
end;
$$;

create or replace function public.admin_update_notification_preference(p_event_type text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();
  update public.notification_preferences set enabled = p_enabled where event_type = p_event_type;
  if not found then
    raise exception 'Unknown notification type.';
  end if;
  perform public.log_activity('notification.preference', 'notification', p_event_type, jsonb_build_object('enabled', p_enabled));
end;
$$;

create or replace function public.admin_adjust_inventory(
  p_variant_id uuid,
  p_quantity_delta integer,
  p_reason text default ''
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quantity integer;
  v_reserved integer;
  v_new integer;
begin
  perform public.require_admin();
  if p_quantity_delta = 0 then
    raise exception 'Enter a non-zero stock adjustment.';
  end if;

  select quantity, reserved_quantity into v_quantity, v_reserved
    from public.inventory_levels
   where variant_id = p_variant_id
   for update;
  if not found then
    raise exception 'Inventory record not found.';
  end if;

  v_new := v_quantity + p_quantity_delta;
  if v_new < 0 then
    raise exception 'Stock cannot become negative.';
  end if;
  if v_new < v_reserved then
    raise exception 'Stock cannot be lower than the % unit(s) reserved for open orders.', v_reserved;
  end if;

  update public.inventory_levels set quantity = v_new where variant_id = p_variant_id;
  insert into public.inventory_movements (
    variant_id, type, quantity_change, reserved_change, quantity_after, reserved_after,
    reason, actor_id, actor_email
  ) values (
    p_variant_id, 'adjust', p_quantity_delta, 0, v_new, v_reserved,
    coalesce(nullif(btrim(p_reason), ''), 'Manual adjustment'),
    auth.uid(), coalesce(auth.jwt() ->> 'email', '')
  );
  perform public.log_activity('inventory.adjusted', 'variant', p_variant_id::text,
    jsonb_build_object('delta', p_quantity_delta, 'after', v_new, 'reason', p_reason));
  return v_new;
end;
$$;

create or replace function public.admin_collection_preview(p_rules jsonb)
returns table (
  product_id uuid,
  title text,
  handle text,
  price numeric,
  image_url text,
  status text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();
  return query
    select p.id, p.title, p.handle, p.price,
           coalesce((select pi.url from public.product_images pi where pi.product_id = p.id order by pi.is_primary desc, pi.position limit 1), ''),
           p.status
      from public.products p
     where public.collection_rule_match(p_rules, p)
     order by p.created_at desc
     limit 50;
end;
$$;

create or replace function public.search_products(p_query text, p_limit integer default 8)
returns table (
  id uuid,
  handle text,
  title text,
  colour text,
  price numeric,
  compare_at_price numeric,
  image_url text
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (p.id)
    p.id,
    p.handle,
    p.title,
    coalesce(nullif(pv.colour, ''), ''),
    p.price,
    p.compare_at_price,
    coalesce((select pi.url from public.product_images pi where pi.product_id = p.id order by pi.is_primary desc, pi.position limit 1), '')
  from public.products p
  left join public.product_variants pv on pv.product_id = p.id and pv.is_active
  where p.status = 'published'
    and coalesce(p.published_at, p.created_at) <= now()
    and btrim(coalesce(p_query, '')) <> ''
    and (
      p.title ilike '%' || btrim(p_query) || '%'
      or p.description ilike '%' || btrim(p_query) || '%'
      or p.category ilike '%' || btrim(p_query) || '%'
      or p.vendor ilike '%' || btrim(p_query) || '%'
      or array_to_string(p.tags, ' ') ilike '%' || btrim(p_query) || '%'
      or array_to_string(p.search_keywords, ' ') ilike '%' || btrim(p_query) || '%'
      or pv.colour ilike '%' || btrim(p_query) || '%'
    )
  order by p.id, p.featured desc, p.created_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 24);
$$;

revoke all on function public.require_admin() from public;
revoke all on function public.admin_save_product(jsonb, jsonb, jsonb) from public;
revoke all on function public.admin_set_product_status(uuid, text) from public;
revoke all on function public.admin_duplicate_product(uuid) from public;
revoke all on function public.admin_delete_product(uuid) from public;
revoke all on function public.admin_save_collection(jsonb, jsonb) from public;
revoke all on function public.admin_delete_collection(uuid) from public;
revoke all on function public.admin_update_settings(jsonb) from public;
revoke all on function public.admin_update_notification_preference(text, boolean) from public;
revoke all on function public.admin_adjust_inventory(uuid, integer, text) from public;
revoke all on function public.admin_collection_preview(jsonb) from public;

grant execute on function public.admin_save_product(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.admin_set_product_status(uuid, text) to authenticated;
grant execute on function public.admin_duplicate_product(uuid) to authenticated;
grant execute on function public.admin_delete_product(uuid) to authenticated;
grant execute on function public.admin_save_collection(jsonb, jsonb) to authenticated;
grant execute on function public.admin_delete_collection(uuid) to authenticated;
grant execute on function public.admin_update_settings(jsonb) to authenticated;
grant execute on function public.admin_update_notification_preference(text, boolean) to authenticated;
grant execute on function public.admin_adjust_inventory(uuid, integer, text) to authenticated;
grant execute on function public.admin_collection_preview(jsonb) to authenticated;
grant execute on function public.search_products(text, integer) to anon, authenticated;
