/**
 * Executes every Supabase migration against a real, throwaway PostgreSQL
 * cluster and verifies the catalogue, RLS, order, inventory, delivery and
 * email automation contracts. No Docker or Supabase CLI required.
 *
 *   node tests/db/smoke.mjs
 */
import EmbeddedPostgres from 'embedded-postgres'
import { Client } from 'pg'
import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const dataDir = path.join(root, '.tmp', 'pgdata')

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const assigned = server.address().port
      server.close(() => resolve(assigned))
    })
  })

const adminId = '11111111-1111-4111-8111-111111111111'
const idempotency = '22222222-2222-4222-8222-222222222222'

let passed = 0
const failures = []

const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1
    console.log(`  ok  ${label}`)
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`)
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const expectError = async (label, fn, match) => {
  try {
    await fn()
    check(label, false, 'expected an error but the statement succeeded')
  } catch (error) {
    const message = String(error.message ?? error)
    check(label, match ? message.toLowerCase().includes(match.toLowerCase()) : true, message)
  }
}

const asRole = async (client, role, claims, fn) => {
  await client.query('begin')
  try {
    await client.query('select set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify(claims ?? {}),
    ])
    await client.query(`set local role ${role}`)
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

const main = async () => {
  await rm(dataDir, { recursive: true, force: true })
  await mkdir(dataDir, { recursive: true })
  const port = await freePort()

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    autoRehydrateSymlinks: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  })

  let client
  try {
    console.log('Starting embedded PostgreSQL…')
    await pg.initialise()
    await pg.start()
    await pg.createDatabase('halas_test')

    client = new Client({
      host: 'localhost',
      port,
      user: 'postgres',
      password: 'postgres',
      database: 'halas_test',
    })
    await client.connect()

    console.log('Creating Supabase-compatible shims…')
    await client.query(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;

      create schema auth;
      create table auth.users (
        id uuid primary key,
        email text unique not null,
        created_at timestamptz not null default now()
      );

      create or replace function auth.jwt()
      returns jsonb language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
      $$;

      create or replace function auth.uid()
      returns uuid language sql stable as $$
        select nullif(auth.jwt() ->> 'sub', '')::uuid
      $$;

      create schema storage;
      create table storage.buckets (
        id text primary key,
        name text not null,
        public boolean not null default false,
        file_size_limit bigint,
        allowed_mime_types text[],
        created_at timestamptz not null default now()
      );
      create table storage.objects (
        id uuid primary key default gen_random_uuid(),
        bucket_id text not null,
        name text not null,
        owner uuid,
        created_at timestamptz not null default now()
      );
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon, authenticated, service_role;
      grant select on storage.buckets to anon, authenticated, service_role;
    `)

    console.log('Applying migrations…')
    const migrationsDir = path.join(root, 'supabase', 'migrations')
    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort()
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), 'utf8')
      try {
        await client.query(sql)
        console.log(`  applied ${file}`)
      } catch (error) {
        console.error(`  FAILED ${file}`)
        throw error
      }
    }

    console.log('\nCatalogue and RLS')
    const seeded = await client.query('select count(*)::int as count from public.products')
    check('seed created 12 products', seeded.rows[0].count === 12, `saw ${seeded.rows[0].count}`)
    const collections = await client.query('select count(*)::int as count from public.collections')
    check('seed created 6 collections', collections.rows[0].count === 6, `saw ${collections.rows[0].count}`)
    const variants = await client.query(
      'select count(*)::int as count from public.product_variants where is_active',
    )
    check('every product has active variants', variants.rows[0].count === 60, `saw ${variants.rows[0].count}`)

    const publicProducts = await asRole(client, 'anon', {}, (c) =>
      c.query('select count(*)::int as count from public.products'),
    )
    check('anonymous visitors read published products', publicProducts.rows[0].count === 12)

    const publicCollections = await asRole(client, 'anon', {}, (c) =>
      c.query(`select count(*)::int as count from public.collection_products_effective where collection_handle = 'dresses'`),
    )
    check('published collection membership is public', publicCollections.rows[0].count === 4,
      `saw ${publicCollections.rows[0].count}`)

    const saleMembership = await asRole(client, 'anon', {}, (c) =>
      c.query(`select count(*)::int as count from public.collection_products_effective where collection_handle = 'sale'`),
    )
    check('automatic sale collection matches compare-at prices', saleMembership.rows[0].count === 4,
      `saw ${saleMembership.rows[0].count}`)

    await expectError(
      'anonymous visitors cannot read orders',
      () => asRole(client, 'anon', {}, (c) => c.query('select count(*) from public.orders')),
      'permission denied',
    )

    console.log('\nAdmin authentication and writes')
    await client.query(
      `insert into auth.users (id, email) values ($1, 'owner@halas.test')`,
      [adminId],
    )
    await client.query(
      `insert into public.user_roles (user_id, role, display_name) values ($1, 'admin', 'Owner')`,
      [adminId],
    )
    await client.query(
      `update public.store_settings set admin_notification_email = 'alerts@halas.test',
         shipping_fee = 250, free_shipping_threshold = 0, low_stock_threshold = 3,
         store_url = 'https://halas.test' where id = 1`,
    )

    const adminClaims = { sub: adminId, email: 'owner@halas.test', role: 'authenticated' }

    await expectError(
      'anonymous visitors cannot save products',
      () => asRole(client, 'anon', {}, (c) => c.query(`select public.admin_save_product('{"title":"Nope"}'::jsonb)`)),
      'permission denied',
    )

    await expectError(
      'authenticated non-admins cannot use admin RPCs',
      () => asRole(client, 'authenticated', { sub: '99999999-9999-4999-8999-999999999999' },
        (c) => c.query(`select public.admin_save_product('{"title":"Nope"}'::jsonb)`)),
      'administrator access required',
    )

    await expectError(
      'browsers cannot update products directly',
      () => asRole(client, 'authenticated', adminClaims,
        (c) => c.query(`update public.products set title = 'Hacked' where handle = 'zohra-chikankari-midi-dress'`)),
      'permission denied',
    )

    const created = await asRole(client, 'authenticated', adminClaims, (c) =>
      c.query(
        `select public.admin_save_product(
           '{"title":"Test Atelier Kaftan","handle":"test-atelier-kaftan","description":"A test piece.","price":5000,"status":"published","category":"Ready to Wear","tags":["test"],"search_keywords":["kaftan"]}'::jsonb,
           '[{"url":"/images/products/p-zohra.jpg","alt":"Test kaftan","is_primary":true}]'::jsonb,
           '[{"size":"S","colour":"Ivory","quantity":4,"low_stock_threshold":1},{"size":"M","colour":"Ivory","quantity":2,"low_stock_threshold":1}]'::jsonb
         ) as id`,
      ),
    )
    const testProductId = created.rows[0].id
    check('admin can create a published product', Boolean(testProductId))

    const publicAfterCreate = await asRole(client, 'anon', {}, (c) =>
      c.query(`select title from public.products where handle = 'test-atelier-kaftan'`),
    )
    check('new product appears on the public storefront immediately',
      publicAfterCreate.rows[0]?.title === 'Test Atelier Kaftan')

    const autoAll = await asRole(client, 'anon', {}, (c) =>
      c.query(`select count(*)::int as count from public.collection_products_effective where collection_handle = 'all'`),
    )
    check('automatic "all" collection includes the new product', autoAll.rows[0].count === 13,
      `saw ${autoAll.rows[0].count}`)

    await asRole(client, 'authenticated', adminClaims, (c) =>
      c.query(`select public.admin_set_product_status($1, 'draft')`, [testProductId]),
    )
    const hidden = await asRole(client, 'anon', {}, (c) =>
      c.query(`select count(*)::int as count from public.products where id = $1`, [testProductId]),
    )
    check('unpublished products disappear from public reads', hidden.rows[0].count === 0)

    await asRole(client, 'authenticated', adminClaims, (c) =>
      c.query(`select public.admin_set_product_status($1, 'published')`, [testProductId]),
    )

    console.log('\nCOD checkout, stock reservation and idempotency')
    const stockBefore = await client.query(
      `select il.quantity, il.reserved_quantity
         from public.inventory_levels il
         join public.product_variants pv on pv.id = il.variant_id
         join public.products p on p.id = pv.product_id
        where p.handle = 'zohra-chikankari-midi-dress' and pv.size = 'M'`,
    )
    const unitPrice = (
      await client.query(`select price from public.products where handle = 'zohra-chikankari-midi-dress'`)
    ).rows[0].price

    const order = await asRole(client, 'anon', {}, (c) =>
      c.query(
        `select * from public.submit_cod_order(
           'Ayesha Khan', 'ayesha@example.com', '0300 1234567',
           'House 4, Street 7, Gulberg III', 'Lahore', '54000', 'Please call before delivery',
           '[{"handle":"zohra-chikankari-midi-dress","size":"M","quantity":2}]'::jsonb,
           $1
         )`,
        [idempotency],
      ),
    )
    const orderRow = order.rows[0]
    const expectedTotal = Number(unitPrice) * 2 + 250
    check('COD order is created', Boolean(orderRow.order_id))
    check('order total is calculated on the server', Number(orderRow.total) === expectedTotal,
      `expected ${expectedTotal}, saw ${orderRow.total}`)

    const stockAfter = await client.query(
      `select il.quantity, il.reserved_quantity, il.available_quantity
         from public.inventory_levels il
         join public.product_variants pv on pv.id = il.variant_id
         join public.products p on p.id = pv.product_id
        where p.handle = 'zohra-chikankari-midi-dress' and pv.size = 'M'`,
    )
    check('stock is reserved, not deducted, at checkout',
      stockAfter.rows[0].quantity === stockBefore.rows[0].quantity &&
      stockAfter.rows[0].reserved_quantity === stockBefore.rows[0].reserved_quantity + 2,
      JSON.stringify(stockAfter.rows[0]))

    const retry = await asRole(client, 'anon', {}, (c) =>
      c.query(
        `select * from public.submit_cod_order(
           'Ayesha Khan', 'ayesha@example.com', '0300 1234567',
           'House 4, Street 7, Gulberg III', 'Lahore', '54000', '',
           '[{"handle":"zohra-chikankari-midi-dress","size":"M","quantity":2}]'::jsonb,
           $1
         )`,
        [idempotency],
      ),
    )
    check('duplicate submission returns the same order',
      retry.rows[0].order_id === orderRow.order_id)
    const orderCount = await client.query(
      `select count(*)::int as count from public.orders where idempotency_key = $1`,
      [idempotency],
    )
    check('duplicate submission does not create a second order', orderCount.rows[0].count === 1)

    await expectError(
      'overselling is rejected',
      () => asRole(client, 'anon', {}, (c) =>
        c.query(
          `select * from public.submit_cod_order(
             'Oversell Test', '', '0311 9999999', 'House 9, Street 2, Model Town', 'Lahore', '',
             '', '[{"handle":"zohra-chikankari-midi-dress","size":"M","quantity":12}]'::jsonb
           )`,
        )),
      'no longer available',
    )

    console.log('\nOrder lifecycle, delivery and stock restoration')
    const orderId = orderRow.order_id
    await asRole(client, 'authenticated', adminClaims, (c) =>
      c.query(`select public.admin_update_order_status($1, 'confirmed', 'Confirmed by phone')`, [orderId]),
    )
    const deducted = await client.query(
      `select il.quantity, il.reserved_quantity from public.inventory_levels il
         join public.product_variants pv on pv.id = il.variant_id
         join public.products p on p.id = pv.product_id
        where p.handle = 'zohra-chikankari-midi-dress' and pv.size = 'M'`,
    )
    check('confirming an order deducts stock and clears the reservation',
      deducted.rows[0].quantity === stockBefore.rows[0].quantity - 2 && deducted.rows[0].reserved_quantity === 0,
      JSON.stringify(deducted.rows[0]))

    await asRole(client, 'authenticated', adminClaims, (c) =>
      c.query(
        `select public.admin_update_delivery($1, 'TCS', 'TCS-778899', 'https://tcs.example/track', current_date, current_date + 2, 250, 'shipped', 'Handle with care', 'https://tcs.example/track')`,
        [orderId],
      ),
    )
    const shipped = await client.query(
      `select o.order_status, d.status as delivery_status, d.tracking_number
         from public.orders o join public.delivery_records d on d.order_id = o.id where o.id = $1`,
      [orderId],
    )
    check('courier dispatch updates order and delivery status together',
      shipped.rows[0].order_status === 'shipped' &&
      shipped.rows[0].delivery_status === 'shipped' &&
      shipped.rows[0].tracking_number === 'TCS-778899',
      JSON.stringify(shipped.rows[0]))

    await asRole(client, 'authenticated', adminClaims, (c) =>
      c.query(`select public.admin_update_delivery($1, null, null, null, null, null, null, 'delivered', 'Left with recipient')`, [orderId]),
    )
    const delivered = await client.query(
      `select o.order_status, o.payment_status, o.delivered_at, d.status as delivery_status
         from public.orders o join public.delivery_records d on d.order_id = o.id where o.id = $1`,
      [orderId],
    )
    check('delivery marks the COD order paid and delivered',
      delivered.rows[0].order_status === 'delivered' &&
      delivered.rows[0].payment_status === 'paid' &&
      delivered.rows[0].delivery_status === 'delivered' &&
      delivered.rows[0].delivered_at !== null,
      JSON.stringify(delivered.rows[0]))

    const analyticsBeforeReturn = await asRole(client, 'authenticated', adminClaims, (c) =>
      c.query(`select public.admin_analytics(now() - interval '30 days', now()) as data`),
    )
    check('analytics reports the delivered order', analyticsBeforeReturn.rows[0].data.orders >= 1,
      JSON.stringify(analyticsBeforeReturn.rows[0].data.orders))
    check('analytics includes best sellers',
      Array.isArray(analyticsBeforeReturn.rows[0].data.best_sellers) &&
      analyticsBeforeReturn.rows[0].data.best_sellers.length > 0)

    await asRole(client, 'authenticated', adminClaims, (c) =>
      c.query(`select public.admin_update_order_status($1, 'returned', 'Customer returned the parcel')`, [orderId]),
    )
    const restored = await client.query(
      `select il.quantity, il.reserved_quantity from public.inventory_levels il
         join public.product_variants pv on pv.id = il.variant_id
         join public.products p on p.id = pv.product_id
        where p.handle = 'zohra-chikankari-midi-dress' and pv.size = 'M'`,
    )
    check('returned orders restore stock exactly once',
      restored.rows[0].quantity === stockBefore.rows[0].quantity,
      JSON.stringify(restored.rows[0]))

    const history = await client.query(
      `select field, to_value from public.order_status_history where order_id = $1 order by created_at`,
      [orderId],
    )
    check('order history records every transition', history.rows.length >= 4,
      `saw ${history.rows.length} entries`)

    console.log('\nEmail automation')
    const emails = await client.query(
      `select template, audience, recipient, status from public.email_outbox where order_id = $1 order by created_at`,
      [orderId],
    )
    const templates = new Set(emails.rows.map((row) => row.template))
    check('new-order admin email is queued', templates.has('admin_new_order'))
    check('customer confirmation email is queued', templates.has('customer_order_confirmation'))
    check('shipment notification is queued', templates.has('customer_shipment_notification'))
    check('delivery confirmation is queued', templates.has('customer_delivery_confirmation'))
    check('payment change alert is queued', templates.has('admin_payment_status'))
    const adminEmail = emails.rows.find((row) => row.template === 'admin_new_order')
    check('admin email resolves the configured address', adminEmail?.recipient === 'alerts@halas.test')
    check('queued emails are pending for the worker',
      emails.rows.every((row) => row.status === 'pending'))

    const claimed = await asRole(client, 'service_role', {}, (c) =>
      c.query(`select id, template, attempts, status from public.email_claim_batch(50)`),
    )
    check('email worker can atomically claim the queue', claimed.rows.length >= 5,
      `claimed ${claimed.rows.length}`)
    check('claimed emails are marked sending with an attempt counted',
      claimed.rows.every((row) => row.status === 'sending' && row.attempts === 1))
    await client.query(`select public.email_mark_sent($1, 'resend-test-id')`, [claimed.rows[0].id])
    const sent = await client.query(
      `select status, provider_message_id from public.email_outbox where id = $1`,
      [claimed.rows[0].id],
    )
    check('sent emails record the provider message id',
      sent.rows[0].status === 'sent' && sent.rows[0].provider_message_id === 'resend-test-id')

    console.log('\nAnalytics and audit trail')
    const analyticsAfterReturn = await asRole(client, 'authenticated', adminClaims, (c) =>
      c.query(`select public.admin_analytics(now() - interval '30 days', now()) as data`),
    )
    check('total orders still count returned orders', analyticsAfterReturn.rows[0].data.orders >= 1)
    check('returned orders are reported separately', analyticsAfterReturn.rows[0].data.returned === 1,
      JSON.stringify(analyticsAfterReturn.rows[0].data.returned))

    const audit = await client.query(
      `select count(*)::int as count from public.activity_logs where action in ('order.placed', 'product.created', 'order.status')`,
    )
    check('important admin actions are audited', audit.rows[0].count >= 3,
      `saw ${audit.rows[0].count}`)

    const final = await client.query(
      `select count(*)::int as count from public.order_items where order_id = $1`,
      [orderId],
    )
    check('order items retain product detail', final.rows[0].count === 1)

    console.log(`\n${passed} checks passed, ${failures.length} failed`)
    if (failures.length) {
      console.error('\nFailures:')
      failures.forEach((failure) => console.error(` - ${failure}`))
      process.exitCode = 1
    }
  } finally {
    if (client) await client.end().catch(() => {})
    await pg.stop().catch(() => {})
    await rm(dataDir, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((error) => {
  console.error('\nDatabase smoke test crashed:')
  console.error(error)
  process.exitCode = 1
})
