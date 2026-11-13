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
