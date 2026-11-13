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
