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
