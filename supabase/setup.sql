-- HALA.S independent commerce backend — complete one-shot setup.
-- Run this file once, in the Supabase SQL editor, on a NEW project.
-- It installs extensions, schema, RLS, functions, storage policy, email
-- queue and the seed catalogue inside a single transaction.
--
-- Do not run this against the legacy prototype schema. If the project
-- already contains the old public.products/public.orders tables, create a
-- fresh Supabase project (recommended) or drop those tables first.

begin;

-- ── 20261111000100_core.sql ─────────────────────────────────────────
-- HALA.S independent commerce platform
-- 01 — roles, settings, notification preferences and shared helpers.

create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'staff')),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.user_roles is
  'Administrators allowed to use the HALA.S admin portal. Only SQL/service role may write.';

alter table public.user_roles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'staff')
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.store_settings (
  id integer primary key default 1 check (id = 1),
  store_name text not null default 'HALA.S CLOTHING',
  brand_mark text not null default '.',
  support_email text not null default '',
  admin_notification_email text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  address text not null default '',
  currency text not null default 'PKR',
  cod_enabled boolean not null default true,
  shipping_fee numeric(12, 2) not null default 0 check (shipping_fee >= 0),
  free_shipping_threshold numeric(12, 2) not null default 0 check (free_shipping_threshold >= 0),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  prices_include_tax boolean not null default true,
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  restock_cancelled boolean not null default true,
  restock_returned boolean not null default true,
  timezone text not null default 'Asia/Karachi',
  store_url text not null default '',
  seo_title text not null default 'HALA.S CLOTHING — Contemporary Pakistani Womenswear',
  seo_description text not null default 'HALA.S CLOTHING — an editorial Pakistani womenswear label. Ready to wear, dresses and co-ord sets cut in Lahore.',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.store_settings (id) values (1) on conflict (id) do nothing;

alter table public.store_settings enable row level security;

drop trigger if exists store_settings_touch on public.store_settings;
create trigger store_settings_touch before update on public.store_settings
for each row execute function public.touch_updated_at();

-- Safe storefront projection: never exposes the administrator notification address.
create or replace view public.storefront_settings as
select
  store_name,
  brand_mark,
  currency,
  cod_enabled,
  shipping_fee,
  free_shipping_threshold,
  tax_rate,
  low_stock_threshold,
  support_email,
  phone,
  whatsapp,
  address,
  timezone,
  seo_title,
  seo_description
from public.store_settings
where id = 1;

create table if not exists public.notification_preferences (
  event_type text primary key,
  label text not null,
  audience text not null check (audience in ('admin', 'customer')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop trigger if exists notification_preferences_touch on public.notification_preferences;
create trigger notification_preferences_touch before update on public.notification_preferences
for each row execute function public.touch_updated_at();

insert into public.notification_preferences (event_type, label, audience) values
  ('new_order', 'New order placed', 'admin'),
  ('order_cancelled', 'Order cancelled', 'admin'),
  ('delivery_failed', 'Delivery failed', 'admin'),
  ('order_returned', 'Order returned', 'admin'),
  ('low_stock', 'Product low in stock', 'admin'),
  ('out_of_stock', 'Product out of stock', 'admin'),
  ('payment_status_change', 'Payment status changed', 'admin'),
  ('system_error', 'System error', 'admin'),
  ('order_confirmation', 'Order confirmation', 'customer'),
  ('order_status_update', 'Order status update', 'customer'),
  ('shipment_notification', 'Shipment notification', 'customer'),
  ('delivery_confirmation', 'Delivery confirmation', 'customer')
on conflict (event_type) do nothing;

-- Shared money rounding.
create or replace function public.money_round(p_amount numeric)
returns numeric
language sql
immutable
as $$
  select round(coalesce(p_amount, 0), 2);
$$;

-- ── 20261111000200_catalog.sql ─────────────────────────────────────────
-- 02 — catalogue: products, images, variants, inventory, collections.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  title text not null,
  description text not null default '',
  fabric text not null default '',
  care text not null default '',
  released_at date,
  brand text not null default 'HALA.S',
  vendor text not null default 'HALA.S',
  category text not null default '',
  product_type text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  price numeric(12, 2) not null default 0 check (price >= 0),
  compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price >= 0),
  cost_per_item numeric(12, 2) check (cost_per_item is null or cost_per_item >= 0),
  sku text,
  tags text[] not null default '{}',
  search_keywords text[] not null default '{}',
  seo_title text not null default '',
  seo_description text not null default '',
  featured boolean not null default false,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_handle_format check (handle ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint products_title_not_blank check (length(btrim(title)) > 0)
);

create unique index if not exists products_handle_key on public.products (lower(handle));
create unique index if not exists products_sku_key on public.products (lower(sku))
  where sku is not null and btrim(sku) <> '';
create index if not exists products_status_idx on public.products (status, published_at desc);
create index if not exists products_created_idx on public.products (created_at desc);
create index if not exists products_tags_idx on public.products using gin (tags);
create index if not exists products_search_idx on public.products using gin (
  to_tsvector('simple'::regconfig,
    coalesce(title, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(category, '') || ' ' ||
    coalesce(vendor, '')
  )
);

alter table public.products enable row level security;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
for each row execute function public.touch_updated_at();

create or replace function public.set_product_published_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published' or new.published_at is null) then
    new.published_at := coalesce(new.published_at, now());
  elsif new.status <> 'published' then
    new.published_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists products_published_at on public.products;
create trigger products_published_at before insert or update of status on public.products
for each row execute function public.set_product_published_at();

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  storage_path text,
  alt text not null default '',
  position integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_idx on public.product_images (product_id, position);
create unique index if not exists product_images_one_primary on public.product_images (product_id)
  where is_primary;

alter table public.product_images enable row level security;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text,
  title text not null default '',
  size text not null default '',
  colour text not null default '',
  colour_hex text not null default '',
  price numeric(12, 2) check (price is null or price >= 0),
  compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price >= 0),
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_variants_combo_key
  on public.product_variants (product_id, lower(size), lower(colour))
  where is_active;
create unique index if not exists product_variants_sku_key on public.product_variants (lower(sku))
  where sku is not null and btrim(sku) <> '' and is_active;
create index if not exists product_variants_product_idx on public.product_variants (product_id, position);
create index if not exists product_variants_size_idx on public.product_variants (lower(size));
create index if not exists product_variants_colour_idx on public.product_variants (lower(colour));

alter table public.product_variants enable row level security;

drop trigger if exists product_variants_touch on public.product_variants;
create trigger product_variants_touch before update on public.product_variants
for each row execute function public.touch_updated_at();

create table if not exists public.inventory_levels (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  low_stock_threshold integer check (low_stock_threshold is null or low_stock_threshold >= 0),
  updated_at timestamptz not null default now(),
  constraint inventory_reserved_not_above_quantity check (reserved_quantity <= quantity),
  available_quantity integer generated always as (quantity - reserved_quantity) stored
);

create index if not exists inventory_available_idx on public.inventory_levels (available_quantity);

alter table public.inventory_levels enable row level security;

drop trigger if exists inventory_levels_touch on public.inventory_levels;
create trigger inventory_levels_touch before update on public.inventory_levels
for each row execute function public.touch_updated_at();

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  order_id uuid,
  type text not null check (type in ('reserve', 'release', 'deduct', 'restore', 'adjust', 'set', 'return')),
  quantity_change integer not null default 0,
  reserved_change integer not null default 0,
  quantity_after integer not null,
  reserved_after integer not null,
  reason text not null default '',
  actor_id uuid,
  actor_email text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);
create index if not exists inventory_movements_order_idx on public.inventory_movements (order_id, created_at desc);

alter table public.inventory_movements enable row level security;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  title text not null,
  description text not null default '',
  image_url text not null default '',
  seo_title text not null default '',
  seo_description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_automatic boolean not null default false,
  rules jsonb not null default '{"match":"all","conditions":[]}'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_handle_format check (handle ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint collections_title_not_blank check (length(btrim(title)) > 0),
  constraint collections_rules_object check (jsonb_typeof(rules) = 'object')
);

create unique index if not exists collections_handle_key on public.collections (lower(handle));
create index if not exists collections_status_idx on public.collections (status, position);

alter table public.collections enable row level security;

drop trigger if exists collections_touch on public.collections;
create trigger collections_touch before update on public.collections
for each row execute function public.touch_updated_at();

create table if not exists public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, product_id)
);

create index if not exists collection_products_product_idx on public.collection_products (product_id);

alter table public.collection_products enable row level security;

-- Rule matcher used by automatic collections. Rules are evaluated by PostgreSQL
-- so every surface (storefront, admin preview, reports) agrees on membership.
create or replace function public.collection_rule_match(p_rules jsonb, p_product public.products)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match text := lower(coalesce(p_rules ->> 'match', 'all'));
  v_conditions jsonb := coalesce(p_rules -> 'conditions', '[]'::jsonb);
  v_condition jsonb;
  v_field text;
  v_operator text;
  v_value text;
  v_text text;
  v_number numeric;
  v_product_number numeric;
  v_matched boolean;
  v_all boolean := true;
  v_any boolean := false;
  v_count integer := 0;
begin
  if v_conditions is null or jsonb_typeof(v_conditions) <> 'array' or jsonb_array_length(v_conditions) = 0 then
    return false;
  end if;

  for v_condition in select value from jsonb_array_elements(v_conditions)
  loop
    v_field := lower(btrim(coalesce(v_condition ->> 'field', '')));
    v_operator := lower(btrim(coalesce(v_condition ->> 'operator', 'equals')));
    v_value := btrim(coalesce(v_condition ->> 'value', ''));
    v_matched := false;

    case v_field
      when 'tag' then v_text := array_to_string(p_product.tags, ',');
      when 'keyword' then v_text := array_to_string(p_product.search_keywords, ',');
      when 'category' then v_text := p_product.category;
      when 'vendor' then v_text := p_product.vendor;
      when 'brand' then v_text := p_product.brand;
      when 'product_type' then v_text := p_product.product_type;
      when 'title' then v_text := p_product.title;
      when 'price' then v_product_number := p_product.price;
      when 'compare_at_price' then v_product_number := coalesce(p_product.compare_at_price, 0);
      when 'inventory' then
        select coalesce(sum(il.quantity - il.reserved_quantity), 0)
          into v_product_number
          from public.inventory_levels il
          join public.product_variants pv on pv.id = il.variant_id
         where pv.product_id = p_product.id and pv.is_active;
      when 'colour' then
        select string_agg(distinct pv.colour, ',')
          into v_text
          from public.product_variants pv
         where pv.product_id = p_product.id and pv.is_active;
      when 'on_sale' then
        v_text := case
          when p_product.compare_at_price is not null and p_product.compare_at_price > p_product.price then 'true'
          else 'false'
        end;
      when 'released_within_days' then
        v_product_number := greatest(0, floor(
          extract(epoch from (now() - coalesce(p_product.published_at, p_product.created_at))) / 86400
        )::numeric);
      when 'status' then v_text := p_product.status;
      else
        v_matched := false;
    end case;

    if v_field in ('tag', 'keyword', 'category', 'vendor', 'brand', 'product_type', 'title', 'colour', 'on_sale', 'status') then
      v_text := lower(coalesce(v_text, ''));
      v_value := lower(v_value);
      v_matched := case v_operator
        when 'equals' then v_text = v_value
        when 'not_equals' then v_text <> v_value
        when 'contains' then position(v_value in v_text) > 0
        when 'not_contains' then position(v_value in v_text) = 0
        when 'starts_with' then left(v_text, length(v_value)) = v_value
        when 'ends_with' then right(v_text, length(v_value)) = v_value
        when 'in' then v_text = any(string_to_array(v_value, ','))
        else false
      end;
    elsif v_field in ('price', 'compare_at_price', 'inventory', 'released_within_days') then
      begin
        v_number := v_value::numeric;
      exception when others then
        v_matched := false;
        v_number := null;
      end;
      if v_number is not null then
        v_matched := case v_operator
          when 'equals' then v_product_number = v_number
          when 'not_equals' then v_product_number <> v_number
          when 'gt' then v_product_number > v_number
          when 'gte' then v_product_number >= v_number
          when 'lt' then v_product_number < v_number
          when 'lte' then v_product_number <= v_number
          else false
        end;
      end if;
    end if;

    v_count := v_count + 1;
    v_all := v_all and v_matched;
    v_any := v_any or v_matched;
  end loop;

  if v_count = 0 then
    return false;
  end if;
  return case when v_match = 'any' then v_any else v_all end;
end;
$$;

-- Manual membership plus rule-based membership in one readable surface.
-- security_invoker keeps the public RLS policies on the base tables in force.
create or replace view public.collection_products_effective
with (security_invoker = true) as
select
  c.id as collection_id,
  c.handle as collection_handle,
  cp.product_id,
  cp.position,
  false as automatic
from public.collections c
join public.collection_products cp on cp.collection_id = c.id
where c.status = 'published'
union all
select
  c.id,
  c.handle,
  p.id,
  10000 + row_number() over (partition by c.id order by p.published_at desc nulls last, p.created_at desc),
  true
from public.collections c
join public.products p on p.status = 'published'
where c.status = 'published'
  and c.is_automatic
  and public.collection_rule_match(c.rules, p);

comment on view public.collection_products_effective is
  'Storefront collection membership: manual entries plus rule-matched automatic entries.';

-- ── 20261111000300_orders.sql ─────────────────────────────────────────
-- 03 — customers, orders, payments, deliveries and order history.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null default '',
  phone text not null,
  phone_normalized text generated always as (regexp_replace(phone, '[^0-9]', '', 'g')) stored,
  notes text not null default '',
  accepts_marketing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_not_blank check (length(btrim(name)) > 0),
  constraint customers_phone_not_blank check (length(btrim(phone)) > 0)
);

create unique index if not exists customers_phone_key on public.customers (phone_normalized);
create index if not exists customers_email_idx on public.customers (lower(email));
create index if not exists customers_name_idx on public.customers (lower(name));
create index if not exists customers_created_idx on public.customers (created_at desc);

alter table public.customers enable row level security;

drop trigger if exists customers_touch on public.customers;
create trigger customers_touch before update on public.customers
for each row execute function public.touch_updated_at();

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text not null default 'Delivery',
  address text not null,
  city text not null,
  postal_code text not null default '',
  country text not null default 'Pakistan',
  is_default boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists customer_addresses_customer_idx on public.customer_addresses (customer_id, created_at desc);

alter table public.customer_addresses enable row level security;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated by default as identity (start with 1001 increment by 1) unique,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text not null,
  email text not null default '',
  phone text not null,
  address text not null,
  city text not null,
  postal_code text not null default '',
  country text not null default 'Pakistan',
  customer_notes text not null default '',
  internal_notes text not null default '',
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  shipping_fee numeric(12, 2) not null default 0 check (shipping_fee >= 0),
  tax_total numeric(12, 2) not null default 0 check (tax_total >= 0),
  discount_total numeric(12, 2) not null default 0 check (discount_total >= 0),
  total numeric(12, 2) not null check (total >= 0),
  currency text not null default 'PKR',
  payment_method text not null default 'cod' check (payment_method = 'cod'),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  order_status text not null default 'new' check (
    order_status in (
      'new', 'pending_confirmation', 'confirmed', 'processing', 'packed',
      'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'
    )
  ),
  stock_reserved boolean not null default true,
  stock_deducted boolean not null default false,
  idempotency_key uuid,
  placed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  packed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists orders_idempotency_key on public.orders (idempotency_key);
create index if not exists orders_status_idx on public.orders (order_status, placed_at desc);
create index if not exists orders_payment_idx on public.orders (payment_status, placed_at desc);
create index if not exists orders_customer_idx on public.orders (customer_id, placed_at desc);
create index if not exists orders_phone_idx on public.orders (phone);
create index if not exists orders_email_idx on public.orders (lower(email));
create index if not exists orders_placed_idx on public.orders (placed_at desc);

alter table public.orders enable row level security;

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
for each row execute function public.touch_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  title text not null,
  variant_title text not null default '',
  size text not null default '',
  colour text not null default '',
  sku text not null default '',
  image_url text not null default '',
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);
create index if not exists order_items_variant_idx on public.order_items (variant_id);

alter table public.order_items enable row level security;

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  field text not null check (field in ('order_status', 'payment_status', 'delivery_status', 'note')),
  from_value text,
  to_value text,
  note text not null default '',
  actor_id uuid,
  actor_email text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists order_status_history_order_idx on public.order_status_history (order_id, created_at desc);

alter table public.order_status_history enable row level security;

create table if not exists public.delivery_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  courier_name text not null default '',
  tracking_number text not null default '',
  tracking_url text not null default '',
  dispatch_date date,
  expected_delivery_date date,
  delivered_at timestamptz,
  delivery_charges numeric(12, 2) not null default 0 check (delivery_charges >= 0),
  status text not null default 'pending' check (
    status in (
      'pending', 'ready_to_dispatch', 'shipped', 'out_for_delivery',
      'delivered', 'failed_delivery', 'returned', 'cancelled'
    )
  ),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_status_idx on public.delivery_records (status, dispatch_date);
create index if not exists delivery_expected_idx on public.delivery_records (expected_delivery_date);

alter table public.delivery_records enable row level security;

drop trigger if exists delivery_records_touch on public.delivery_records;
create trigger delivery_records_touch before update on public.delivery_records
for each row execute function public.touch_updated_at();

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.delivery_records (id) on delete cascade,
  status text not null,
  note text not null default '',
  actor_id uuid,
  actor_email text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists delivery_events_delivery_idx on public.delivery_events (delivery_id, created_at desc);

alter table public.delivery_events enable row level security;

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  method text not null default 'cod' check (method = 'cod'),
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  reference text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_records_order_idx on public.payment_records (order_id, created_at desc);

alter table public.payment_records enable row level security;

drop trigger if exists payment_records_touch on public.payment_records;
create trigger payment_records_touch before update on public.payment_records
for each row execute function public.touch_updated_at();

-- Admin order list projection: avoids loading every line just to count them.
create or replace view public.order_summaries
with (security_invoker = true) as
select
  o.*,
  coalesce(i.item_count, 0) as item_count,
  coalesce(i.total_quantity, 0) as total_quantity,
  i.first_image,
  d.status as delivery_status,
  d.courier_name,
  d.tracking_number,
  d.expected_delivery_date
from public.orders o
left join lateral (
  select
    count(*)::integer as item_count,
    sum(oi.quantity)::integer as total_quantity,
    (array_agg(oi.image_url order by oi.created_at))[1] as first_image
  from public.order_items oi
  where oi.order_id = o.id
) i on true
left join public.delivery_records d on d.order_id = o.id;

create or replace view public.customer_summaries
with (security_invoker = true) as
select
  c.*,
  coalesce(s.total_orders, 0) as total_orders,
  coalesce(s.lifetime_spend, 0) as lifetime_spend,
  s.last_order_at
from public.customers c
left join lateral (
  select
    count(*)::integer as total_orders,
    coalesce(sum(o.total) filter (where o.order_status not in ('cancelled', 'returned')), 0) as lifetime_spend,
    max(o.placed_at) as last_order_at
  from public.orders o
  where o.customer_id = c.id
) s on true;

create or replace view public.product_sales
with (security_invoker = true) as
select
  oi.product_id,
  sum(oi.quantity)::integer as units_sold,
  sum(oi.line_total) as revenue
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.order_status not in ('cancelled', 'returned')
  and oi.product_id is not null
group by oi.product_id;

-- ── 20261111000400_ops.sql ─────────────────────────────────────────
-- 04 — email outbox, audit trail and operational helpers.

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  audience text not null check (audience in ('admin', 'customer')),
  recipient text not null,
  template text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text not null default '',
  provider_message_id text not null default '',
  order_id uuid references public.orders (id) on delete set null,
  dedupe_key text not null,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists email_outbox_dedupe_key on public.email_outbox (dedupe_key);
create index if not exists email_outbox_due_idx on public.email_outbox (status, next_attempt_at);
create index if not exists email_outbox_order_idx on public.email_outbox (order_id, created_at desc);
create index if not exists email_outbox_created_idx on public.email_outbox (created_at desc);

alter table public.email_outbox enable row level security;

drop trigger if exists email_outbox_touch on public.email_outbox;
create trigger email_outbox_touch before update on public.email_outbox
for each row execute function public.touch_updated_at();

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text not null default '',
  action text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_idx on public.activity_logs (created_at desc);
create index if not exists activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);

alter table public.activity_logs enable row level security;

-- Every admin mutation funnels through this helper so the audit trail cannot be
-- forgotten by an individual RPC.
create or replace function public.log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  insert into public.activity_logs (actor_id, actor_email, action, entity_type, entity_id, details)
  values (auth.uid(), v_email, p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

create or replace function public.enqueue_email(
  p_event_type text,
  p_audience text,
  p_recipient text,
  p_template text,
  p_subject text,
  p_payload jsonb,
  p_order_id uuid,
  p_dedupe_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_enabled boolean;
  v_recipient text := btrim(coalesce(p_recipient, ''));
begin
  select np.enabled into v_enabled
    from public.notification_preferences np
   where np.event_type = p_event_type
     and np.audience = p_audience;

  if v_enabled is distinct from true then
    return;
  end if;

  if p_audience = 'admin' then
    select nullif(btrim(ss.admin_notification_email), '') into v_recipient
      from public.store_settings ss
     where ss.id = 1;
  end if;

  if v_recipient is null or v_recipient = '' then
    return;
  end if;

  insert into public.email_outbox (
    event_type, audience, recipient, template, subject, payload, order_id, dedupe_key
  ) values (
    p_event_type, p_audience, v_recipient, p_template, p_subject,
    coalesce(p_payload, '{}'::jsonb), p_order_id, p_dedupe_key
  )
  on conflict (dedupe_key) do nothing;
end;
$$;

-- ── 20261111000500_rls.sql ─────────────────────────────────────────
-- 05 — row level security, public read surfaces and grants.

alter table public.user_roles enable row level security;
alter table public.store_settings enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.delivery_records enable row level security;
alter table public.delivery_events enable row level security;
alter table public.payment_records enable row level security;
alter table public.email_outbox enable row level security;
alter table public.activity_logs enable row level security;

-- user_roles ---------------------------------------------------------------
drop policy if exists "admins read own role" on public.user_roles;
drop policy if exists "admins read roles" on public.user_roles;
create policy "admins read own role" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid());

create policy "admins read roles" on public.user_roles
  for select to authenticated
  using (public.is_admin());

-- store settings -----------------------------------------------------------
drop policy if exists "admins read settings" on public.store_settings;
create policy "admins read settings" on public.store_settings
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins read notification preferences" on public.notification_preferences;
create policy "admins read notification preferences" on public.notification_preferences
  for select to authenticated
  using (public.is_admin());

-- products -----------------------------------------------------------------
drop policy if exists "published products are public" on public.products;
drop policy if exists "admins read all products" on public.products;
create policy "published products are public" on public.products
  for select to anon, authenticated
  using (status = 'published' and coalesce(published_at, created_at) <= now());

create policy "admins read all products" on public.products
  for select to authenticated
  using (public.is_admin());

drop policy if exists "public reads published product images" on public.product_images;
drop policy if exists "admins read product images" on public.product_images;
create policy "public reads published product images" on public.product_images
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and p.status = 'published'
        and coalesce(p.published_at, p.created_at) <= now()
    )
  );

create policy "admins read product images" on public.product_images
  for select to authenticated
  using (public.is_admin());

drop policy if exists "public reads published variants" on public.product_variants;
drop policy if exists "admins read variants" on public.product_variants;
create policy "public reads published variants" on public.product_variants
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and p.status = 'published'
        and coalesce(p.published_at, p.created_at) <= now()
    )
  );

create policy "admins read variants" on public.product_variants
  for select to authenticated
  using (public.is_admin());

drop policy if exists "public reads published inventory" on public.inventory_levels;
drop policy if exists "admins read inventory" on public.inventory_levels;
create policy "public reads published inventory" on public.inventory_levels
  for select to anon, authenticated
  using (
    exists (
      select 1
        from public.product_variants v
        join public.products p on p.id = v.product_id
       where v.id = variant_id
         and p.status = 'published'
         and coalesce(p.published_at, p.created_at) <= now()
    )
  );

create policy "admins read inventory" on public.inventory_levels
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins read inventory movements" on public.inventory_movements;
create policy "admins read inventory movements" on public.inventory_movements
  for select to authenticated
  using (public.is_admin());

-- collections --------------------------------------------------------------
drop policy if exists "published collections are public" on public.collections;
drop policy if exists "admins read all collections" on public.collections;
create policy "published collections are public" on public.collections
  for select to anon, authenticated
  using (status = 'published');

create policy "admins read all collections" on public.collections
  for select to authenticated
  using (public.is_admin());

drop policy if exists "public reads published collection products" on public.collection_products;
drop policy if exists "admins read collection products" on public.collection_products;
create policy "public reads published collection products" on public.collection_products
  for select to anon, authenticated
  using (
    exists (select 1 from public.collections c where c.id = collection_id and c.status = 'published')
    and exists (
      select 1 from public.products p
      where p.id = product_id
        and p.status = 'published'
        and coalesce(p.published_at, p.created_at) <= now()
    )
  );

create policy "admins read collection products" on public.collection_products
  for select to authenticated
  using (public.is_admin());

-- customers and orders -----------------------------------------------------
drop policy if exists "admins manage customers" on public.customers;
drop policy if exists "admins read customers" on public.customers;
create policy "admins read customers" on public.customers
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins read customer addresses" on public.customer_addresses;
create policy "admins read customer addresses" on public.customer_addresses
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins manage orders" on public.orders;
drop policy if exists "admins read orders" on public.orders;
create policy "admins read orders" on public.orders
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins read order items" on public.order_items;
create policy "admins read order items" on public.order_items
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins read order history" on public.order_status_history;
create policy "admins read order history" on public.order_status_history
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins read deliveries" on public.delivery_records;
create policy "admins read deliveries" on public.delivery_records
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins read delivery events" on public.delivery_events;
create policy "admins read delivery events" on public.delivery_events
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins read payments" on public.payment_records;
create policy "admins read payments" on public.payment_records
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins read email outbox" on public.email_outbox;
create policy "admins read email outbox" on public.email_outbox
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins read activity logs" on public.activity_logs;
create policy "admins read activity logs" on public.activity_logs
  for select to authenticated
  using (public.is_admin());

-- grants -------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant execute on function public.is_admin() to authenticated, anon;

grant select on public.products, public.product_images, public.product_variants,
  public.inventory_levels, public.collections, public.collection_products,
  public.collection_products_effective, public.storefront_settings
  to anon, authenticated;

grant select on public.user_roles, public.store_settings, public.notification_preferences,
  public.inventory_movements, public.customers, public.customer_addresses,
  public.orders, public.order_items, public.order_status_history,
  public.delivery_records, public.delivery_events, public.payment_records,
  public.email_outbox, public.activity_logs, public.order_summaries,
  public.customer_summaries, public.product_sales
  to authenticated;

-- Admin writes are deliberately restricted to security-definer RPCs so prices,
-- totals, inventory and order transitions cannot be edited directly by a browser.
revoke insert, update, delete on all tables in schema public from anon, authenticated;

-- ── 20261111000600_functions_catalog.sql ─────────────────────────────────────────
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

-- ── 20261111000700_functions_orders.sql ─────────────────────────────────────────
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

-- ── 20261111000800_automation.sql ─────────────────────────────────────────
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

-- ── 20261111000900_storage.sql ─────────────────────────────────────────
-- 09 — Supabase Storage bucket and policies for product media.

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not present; skipping product-images bucket setup.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'product-images',
    'product-images',
    true,
    8388608,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "product images are publicly readable" on storage.objects';
  execute 'create policy "product images are publicly readable" on storage.objects
             for select to anon, authenticated
             using (bucket_id = ''product-images'')';

  execute 'drop policy if exists "admins upload product images" on storage.objects';
  execute 'create policy "admins upload product images" on storage.objects
             for insert to authenticated
             with check (bucket_id = ''product-images'' and public.is_admin())';

  execute 'drop policy if exists "admins update product images" on storage.objects';
  execute 'create policy "admins update product images" on storage.objects
             for update to authenticated
             using (bucket_id = ''product-images'' and public.is_admin())
             with check (bucket_id = ''product-images'' and public.is_admin())';

  execute 'drop policy if exists "admins delete product images" on storage.objects';
  execute 'create policy "admins delete product images" on storage.objects
             for delete to authenticated
             using (bucket_id = ''product-images'' and public.is_admin())';
end;
$$;

-- ── 20261111001000_seed_catalog.sql ─────────────────────────────────────────
-- 10 — seed the existing HALA.S catalogue so the storefront is not empty on a
-- fresh Supabase project. Runs only when the products table is still empty.

do $$
declare
  v_product jsonb;
  v_image jsonb;
  v_size_label text;
  v_product_id uuid;
  v_variant_id uuid;
  v_collection text;
  v_category text;
  v_tags text[];
  v_qty integer;
  v_position integer;
begin
  if exists (select 1 from public.products) then
    raise notice 'Catalogue already has products; seed skipped.';
    return;
  end if;

  for v_product in
    select value from jsonb_array_elements($catalog$[
      {
        "handle": "zohra-chikankari-midi-dress",
        "title": "Zohra Chikankari Midi Dress",
        "description": "A midi dress in ivory lawn worked entirely in white-on-white chikankari, with a modest neckline and a flare that moves without weight. Cut long through the body so it sits flat at the shoulder.",
        "fabric": "Fine cotton lawn",
        "care": "Cold hand wash separately; dry in shade.",
        "price": 14900,
        "category": "Dresses",
        "released_at": "2026-10-02",
        "collections": ["dresses"],
        "tags": ["chikankari", "midi", "ivory"],
        "sizes": ["XS", "S", "M", "L"],
        "images": [
          {"url": "/images/products/p-zohra.jpg", "alt": "Zohra Chikankari Midi Dress in ivory cotton lawn, front view on a model."},
          {"url": "/images/lookbook/l1.jpg", "alt": "Zohra Chikankari Midi Dress photographed against a Lahore plaster wall."}
        ]
      },
      {
        "handle": "mehr-raw-silk-co-ord",
        "title": "Mehr Raw Silk Co-Ord",
        "description": "A boxy camp-collar shirt in matte raw silk, paired with a straight tailored trouser. The silk holds its shape through the day, so the line stays crisp from the first meeting to the last.",
        "fabric": "Raw silk",
        "care": "Dry clean only.",
        "price": 18500,
        "category": "Co-Ord Sets",
        "released_at": "2026-08-14",
        "collections": ["co-ord-sets"],
        "tags": ["raw silk", "co-ord", "ink black"],
        "sizes": ["S", "M", "L", "XL"],
        "images": [
          {"url": "/images/products/p-mehr.jpg", "alt": "Mehr Raw Silk Co-Ord: black raw silk shirt and straight trousers, front view."},
          {"url": "/images/lookbook/l2.jpg", "alt": "Models in linen and raw-silk co-ords seated on a charpai."}
        ]
      },
      {
        "handle": "rani-zardozi-formal-gown",
        "title": "Rani Zardozi Formal Gown",
        "description": "A floor-length gown in garnet silk canvas, finished with hand zardozi along the hem and cuffs. The bodice is structured, the skirt left quiet — the embroidery does the speaking.",
        "fabric": "Silk canvas with gold zardozi",
        "care": "Dry clean only; store flat.",
        "price": 32000,
        "compare_at_price": 39500,
        "category": "Dresses",
        "released_at": "2026-05-20",
        "collections": ["dresses"],
        "tags": ["zardozi", "formal", "garnet"],
        "sizes": ["XS", "S", "M"],
        "images": [
          {"url": "/images/products/p-rani.jpg", "alt": "Rani Zardozi Formal Gown in garnet silk with gold embroidered hem, front view."}
        ]
      },
      {
        "handle": "sahil-linen-shirt-trouser",
        "title": "Sahil Linen Shirt & Trouser",
        "description": "A camp-collar shirt in washed stone linen with a rolled sleeve, cut to sit over wide straight trousers. Made for long afternoons — the linen softens rather than creases badly.",
        "fabric": "Washed linen",
        "care": "Machine wash cold on gentle; iron damp.",
        "price": 12900,
        "category": "Ready to Wear",
        "released_at": "2026-07-08",
        "collections": ["ready-to-wear", "co-ord-sets"],
        "tags": ["linen", "co-ord", "stone"],
        "sizes": ["S", "M", "L", "XL"],
        "images": [
          {"url": "/images/products/p-sahil.jpg", "alt": "Sahil Linen Shirt and Trouser set in stone beige linen, front view."},
          {"url": "/images/lookbook/l2.jpg", "alt": "Sahil linen set in a sunlit courtyard."}
        ]
      },
      {
        "handle": "noor-ochre-kurta-set",
        "title": "Noor Ochre Kurta Set",
        "description": "A straight kurta in ochre cotton slub with a small hand-blocked motif down the placket, matched to plain straight pants. The block print is deliberately sparse so it reads as texture, not pattern.",
        "fabric": "Cotton slub with block print",
        "care": "First wash separate; cold machine wash.",
        "price": 9800,
        "compare_at_price": 12400,
        "category": "Ready to Wear",
        "released_at": "2026-04-11",
        "collections": ["ready-to-wear"],
        "tags": ["block print", "kurta", "ochre"],
        "sizes": ["XS", "S", "M", "L", "XL"],
        "images": [
          {"url": "/images/products/p-noor.jpg", "alt": "Noor Ochre Kurta Set: block-printed ochre kurta with straight pants."}
        ]
      },
      {
        "handle": "gul-rose-gharara-set",
        "title": "Gul Rose Gharara Set",
        "description": "A short kurta with gathered flowing trousers in dusty rose silk cotton, finished with a plain organza dupatta. The gather sits low on the hip so the volume falls from the knee, not the waist.",
        "fabric": "Silk cotton with organza dupatta",
        "care": "Dry clean only.",
        "price": 24500,
        "category": "Co-Ord Sets",
        "released_at": "2026-10-10",
        "collections": ["co-ord-sets"],
        "tags": ["gharara", "organza", "dusty rose"],
        "sizes": ["S", "M", "L"],
        "images": [
          {"url": "/images/products/p-gul.jpg", "alt": "Gul Rose Gharara Set with organza dupatta, front view on a model."},
          {"url": "/images/lookbook/l4.jpg", "alt": "Gul Rose Gharara Set on a rooftop at dusk."}
        ]
      },
      {
        "handle": "sitara-embellished-evening-dress",
        "title": "Sitara Embellished Evening Dress",
        "description": "A column evening dress in ink crepe with tonal beadwork concentrated at the shoulder, so the light catches it only when you move. No contrast, no sequin spill — one quiet surface of work.",
        "fabric": "Crepe with tonal beadwork",
        "care": "Dry clean only; do not hang beaded section.",
        "price": 38000,
        "category": "Dresses",
        "released_at": "2026-09-28",
        "collections": ["dresses"],
        "tags": ["evening", "beaded", "ink black"],
        "sizes": ["XS", "S", "M", "L"],
        "images": [
          {"url": "/images/products/p-sitara.jpg", "alt": "Sitara Embellished Evening Dress in ink black with tonal beadwork."},
          {"url": "/images/lookbook/l6.jpg", "alt": "Sitara evening dress in a carved Lahore courtyard."}
        ]
      },
      {
        "handle": "aman-ecru-shirt-dress",
        "title": "Aman Ecru Shirt Dress",
        "description": "An oversized ecru poplin shirt dress with dropped shoulders and a hem at mid-calf. Comes with a self belt, worn loose — the shape is meant to be lived in, not cinched.",
        "fabric": "Cotton poplin",
        "care": "Machine wash warm; tumble low.",
        "price": 8900,
        "compare_at_price": 11200,
        "category": "Ready to Wear",
        "released_at": "2026-03-30",
        "collections": ["ready-to-wear"],
        "tags": ["shirt dress", "poplin", "ecru"],
        "sizes": ["S", "M", "L", "XL"],
        "images": [
          {"url": "/images/products/p-aman.jpg", "alt": "Aman Ecru Shirt Dress in cotton poplin, worn loose with self belt."}
        ]
      },
      {
        "handle": "laila-emerald-kurta-dupatta",
        "title": "Laila Emerald Kurta with Dupatta",
        "description": "A straight kurta in deep emerald silk blend, sold with a plain ivory dupatta finished with a narrow hand-rolled edge. Worn together it reads formal; apart, the kurta is everyday.",
        "fabric": "Silk blend with ivory dupatta",
        "care": "Dry clean recommended for the dupatta.",
        "price": 16700,
        "category": "Ready to Wear",
        "released_at": "2026-06-18",
        "collections": ["ready-to-wear"],
        "tags": ["kurta", "dupatta", "emerald"],
        "sizes": ["XS", "S", "M", "L"],
        "images": [
          {"url": "/images/products/p-laila.jpg", "alt": "Laila Emerald Kurta with contrasting ivory dupatta, front view."},
          {"url": "/images/lookbook/l3.jpg", "alt": "Laila emerald kurta walking through a sandstone corridor."}
        ]
      },
      {
        "handle": "nadia-champagne-silk-slip",
        "title": "Nadia Champagne Silk Slip Dress",
        "description": "A bias-cut champagne slip with resham floral embroidery only at the neckline. Cut on the true bias so the fabric skims rather than clings — it needs no lining to fall well.",
        "fabric": "Bias-cut silk with resham embroidery",
        "care": "Dry clean only.",
        "price": 21300,
        "category": "Dresses",
        "released_at": "2026-10-16",
        "collections": ["dresses"],
        "tags": ["slip dress", "silk", "champagne"],
        "sizes": ["XS", "S", "M", "XL"],
        "images": [
          {"url": "/images/products/p-nadia.jpg", "alt": "Nadia Champagne Silk Slip Dress with resham embroidery at the neckline."},
          {"url": "/images/lookbook/l5.jpg", "alt": "Seated portrait in the Nadia champagne silk slip."}
        ]
      },
      {
        "handle": "zubia-charcoal-trouser-tunic",
        "title": "Zubia Charcoal Trouser & Tunic",
        "description": "A short boxy tunic in charcoal wool blend over a wide-leg tailored trouser. The suiting has enough body to hold the wide leg, which is the whole point of the set.",
        "fabric": "Wool-blend suiting",
        "care": "Dry clean only; steam to refresh.",
        "price": 15400,
        "category": "Co-Ord Sets",
        "released_at": "2026-09-05",
        "collections": ["co-ord-sets"],
        "tags": ["suiting", "co-ord", "charcoal"],
        "sizes": ["S", "M", "L"],
        "images": [
          {"url": "/images/products/p-zubia.jpg", "alt": "Zubia Charcoal Trouser and Tunic co-ord, front view."}
        ]
      },
      {
        "handle": "ira-sand-cape-kurta",
        "title": "Ira Sand Cape Kurta",
        "description": "A sleeveless voile cape layered over a simple straight kurta and trousers in sand. The cape is unlined and unhurried — it moves before the rest of the outfit does.",
        "fabric": "Cotton voile over kurta",
        "care": "Hand wash cold; reshape while damp.",
        "price": 11600,
        "compare_at_price": 14800,
        "category": "Ready to Wear",
        "released_at": "2026-05-02",
        "collections": ["ready-to-wear"],
        "tags": ["cape", "kurta", "sand"],
        "sizes": ["XS", "S", "L", "XL"],
        "images": [
          {"url": "/images/products/p-ira.jpg", "alt": "Ira Sand Cape Kurta with layered voile cape, front view."}
        ]
      }
    ]$catalog$::jsonb)
  loop
    v_category := coalesce(v_product ->> 'category', '');
    v_tags := array(
      select jsonb_array_elements_text(coalesce(v_product -> 'tags', '[]'::jsonb))
    );
    if (v_product ->> 'compare_at_price') is not null then
      v_tags := array_append(v_tags, 'sale');
    end if;

    insert into public.products (
      handle, title, description, fabric, care, released_at, brand, vendor,
      category, product_type, status, price, compare_at_price, sku, tags,
      search_keywords, seo_title, seo_description, published_at
    ) values (
      v_product ->> 'handle',
      v_product ->> 'title',
      coalesce(v_product ->> 'description', ''),
      coalesce(v_product ->> 'fabric', ''),
      coalesce(v_product ->> 'care', ''),
      (v_product ->> 'released_at')::date,
      'HALA.S',
      'HALA.S',
      v_category,
      v_category,
      'published',
      (v_product ->> 'price')::numeric,
      nullif(v_product ->> 'compare_at_price', '')::numeric,
      'HLS-' || upper(left(regexp_replace(v_product ->> 'handle', '[^a-z0-9]', '', 'g'), 8)),
      v_tags,
      v_tags || array['halas', 'pakistani womenswear'],
      (v_product ->> 'title') || ' — HALA.S CLOTHING',
      left(coalesce(v_product ->> 'description', ''), 300),
      (v_product ->> 'released_at')::date::timestamptz + time '10:00'
    )
    returning id into v_product_id;

    v_position := 0;
    for v_image in select value from jsonb_array_elements(coalesce(v_product -> 'images', '[]'::jsonb))
    loop
      v_position := v_position + 1;
      insert into public.product_images (product_id, url, alt, position, is_primary)
      values (
        v_product_id,
        v_image ->> 'url',
        coalesce(v_image ->> 'alt', ''),
        v_position,
        v_position = 1
      );
    end loop;

    foreach v_size_label in array array['XS', 'S', 'M', 'L', 'XL']
    loop
      v_qty := case
        when (v_product -> 'sizes') @> to_jsonb(v_size_label) then 6 + (length(v_product ->> 'handle') % 4)
        else 0
      end;
      insert into public.product_variants (
        product_id, sku, title, size, colour, colour_hex, position, is_active
      ) values (
        v_product_id,
        'HLS-' || upper(left(regexp_replace(v_product ->> 'handle', '[^a-z0-9]', '', 'g'), 6)) || '-' || v_size_label,
        v_size_label,
        v_size_label,
        '',
        '',
        array_position(array['XS', 'S', 'M', 'L', 'XL'], v_size_label),
        true
      )
      returning id into v_variant_id;

      insert into public.inventory_levels (variant_id, quantity, reserved_quantity, low_stock_threshold)
      values (v_variant_id, v_qty, 0, 3);

      insert into public.inventory_movements (
        variant_id, type, quantity_change, reserved_change,
        quantity_after, reserved_after, reason
      ) values (
        v_variant_id, 'set', v_qty, 0, v_qty, 0, 'Initial catalogue seed'
      );
    end loop;
  end loop;

  insert into public.collections (
    handle, title, description, image_url, seo_title, seo_description,
    status, is_automatic, rules, position
  ) values
    (
      'new-in', 'New In',
      'The latest cuts, fresh off the atelier floor.',
      '/images/lookbook/l1.jpg',
      'New In — HALA.S CLOTHING',
      'The latest HALA.S cuts, fresh off the atelier floor.',
      'published', true,
      '{"match":"all","conditions":[{"field":"released_within_days","operator":"lte","value":"35"}]}'::jsonb,
      1
    ),
    (
      'sale', 'Sale',
      'End-of-season pieces, honestly reduced.',
      '/images/products/p-rani.jpg',
      'Sale — HALA.S CLOTHING',
      'End-of-season HALA.S pieces, honestly reduced.',
      'published', true,
      '{"match":"all","conditions":[{"field":"on_sale","operator":"equals","value":"true"}]}'::jsonb,
      2
    ),
    (
      'ready-to-wear', 'Ready to Wear',
      'Everyday tailoring with an editorial hand.',
      '/images/products/p-sahil.jpg',
      'Ready to Wear — HALA.S CLOTHING',
      'Everyday HALA.S tailoring with an editorial hand.',
      'published', false, '{"match":"all","conditions":[]}'::jsonb, 3
    ),
    (
      'dresses', 'Dresses',
      'From lawn afternoons to formal nights.',
      '/images/products/p-zohra.jpg',
      'Dresses — HALA.S CLOTHING',
      'HALA.S dresses, from lawn afternoons to formal nights.',
      'published', false, '{"match":"all","conditions":[]}'::jsonb, 4
    ),
    (
      'co-ord-sets', 'Co-Ord Sets',
      'Matched sets, considered to the millimetre.',
      '/images/products/p-mehr.jpg',
      'Co-Ord Sets — HALA.S CLOTHING',
      'Matched HALA.S sets, considered to the millimetre.',
      'published', false, '{"match":"all","conditions":[]}'::jsonb, 5
    ),
    (
      'all', 'All Products',
      'The complete HALA.S wardrobe.',
      '/images/campaign/hero-wide.jpg',
      'Shop All — HALA.S CLOTHING',
      'The complete HALA.S wardrobe.',
      'published', true,
      '{"match":"all","conditions":[{"field":"status","operator":"equals","value":"published"}]}'::jsonb,
      6
    );

  insert into public.collection_products (collection_id, product_id, position)
  select c.id, p.id, row_number() over (partition by c.id order by p.published_at desc)
    from public.collections c
    join public.products p
      on (
        (c.handle = 'ready-to-wear' and p.category = 'Ready to Wear')
        or (c.handle = 'dresses' and p.category = 'Dresses')
        or (c.handle = 'co-ord-sets' and p.category = 'Co-Ord Sets')
        or (c.handle = 'co-ord-sets' and p.handle = 'sahil-linen-shirt-trouser')
      )
   where c.handle in ('ready-to-wear', 'dresses', 'co-ord-sets');

  update public.product_variants pv
     set colour = c.colour,
         colour_hex = c.hex
    from public.products p,
         (values
           ('zohra-chikankari-midi-dress', 'Ivory', '#efe9dc'),
           ('mehr-raw-silk-co-ord', 'Ink Black', '#16140f'),
           ('rani-zardozi-formal-gown', 'Garnet', '#6d1f26'),
           ('sahil-linen-shirt-trouser', 'Stone', '#c3bcac'),
           ('noor-ochre-kurta-set', 'Ochre', '#c8922e'),
           ('gul-rose-gharara-set', 'Dusty Rose', '#c08b8b'),
           ('sitara-embellished-evening-dress', 'Ink Black', '#1a1815'),
           ('aman-ecru-shirt-dress', 'Ecru', '#e6ddcb'),
           ('laila-emerald-kurta-dupatta', 'Deep Emerald', '#1f3d33'),
           ('nadia-champagne-silk-slip', 'Champagne', '#d9c8a8'),
           ('zubia-charcoal-trouser-tunic', 'Charcoal', '#3c3b39'),
           ('ira-sand-cape-kurta', 'Sand', '#cdbfa3')
         ) as c(handle, colour, hex)
   where pv.product_id = p.id
     and p.handle = c.handle;

  update public.store_settings
     set currency = 'PKR',
         cod_enabled = true
   where id = 1;

  perform public.log_activity('catalogue.seeded', 'system', '', jsonb_build_object(
    'products', (select count(*) from public.products),
    'collections', (select count(*) from public.collections)
  ));
end;
$$;

commit;
