# HALA.S — backend, admin and deployment guide

This guide is the current, authoritative setup path for the independent HALA.S
commerce platform. Earlier checkout/launch notes in this repository are kept as
history only; where they disagree with this file, this file wins.

The storefront, `/admin` portal, order engine and email pipeline are already
implemented in this project. There is **no Shopify dependency** and no build or
deployment step per product: everything is managed from the admin portal against
Supabase.

---

## 1. What runs where

| Layer | Technology | Location |
| --- | --- | --- |
| Storefront | Vite + React + TypeScript | any static host (Vercel/Netlify/S3) |
| Admin portal | Same bundle, `/admin/*` routes | same host, private via Supabase Auth + RLS |
| Database | Supabase Postgres | Cloud project |
| Auth | Supabase Auth (email/password + recovery) | Cloud project |
| Media | Supabase Storage bucket `product-images` (public read, admin write) | Cloud project |
| Business logic | Security-definer Postgres functions (`admin_*`, `submit_cod_order`, order/stock/email engine) | Cloud project |
| Transactional email | Supabase Edge Function `send-emails` + Resend, queued in `email_outbox` | Cloud project |
| Scheduling | Supabase Cron (`pg_cron` + `pg_net`) calling the worker every minute | Cloud project |

The browser ships only `VITE_SUPABASE_URL` and the **anon** key. Row-level
security (RLS) and security-definer functions enforce every privileged action.
The service-role key, Resend key and worker secret exist only in Edge Function
secrets / Supabase Vault.

---

## 2. Prerequisites

- A Supabase account (free tier is sufficient to start).
- A Resend account with a verified sending domain (for transactional email).
- Node.js 22+ and npm (the email-template test runner uses Node 22 type stripping).
- A static host with SPA rewrites (this repo includes `vercel.json`).
- Optional: Supabase CLI for deploying the Edge Function.

---

## 3. Database — one-time setup

1. Create a **new** Supabase project.
2. Open **SQL Editor** and run the complete file `supabase/setup.sql`.
   It wraps all migrations in one transaction and installs:
   - extensions, tables, indexes, triggers
   - row-level security and grants
   - catalogue, order, inventory, delivery and email functions
   - the `product-images` Storage bucket and its policies
   - 12 seed products, 6 collections and 60 variants
3. Confirm the seed: **Table editor → products** should show 12 rows, and
   **collections** 6 rows.

> Run `setup.sql` on a fresh project. It is not a migration from the legacy
> prototype schema (`products.sizes`, `products.images`, `payment_settings`).
> If your project already has those old tables, create a new project or drop
> the old tables first.

If you prefer the Supabase CLI, the same files run in order from
`supabase/migrations/` with `supabase db push`.

---

## 4. Administrator account

1. Supabase Dashboard → **Authentication → Users → Add user**. Use the real
   administrator email and a strong password; confirm the email.
2. Open `supabase/admin-bootstrap.sql`, replace `admin@example.com` with that
   email, and run it in the SQL editor. It inserts the user's UUID into
   `public.user_roles` as `admin`.
3. Sign in at `https://YOUR-DOMAIN/admin`. Non-admin accounts are rejected even
   if they authenticate successfully.

Passwords and service keys are never written to SQL, source code or this repo.
Use **Forgot password?** on the login screen for recovery (see section 7).

---

## 5. Frontend environment

Create `.env.local` for development (never commit it):

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Add the same two variables to the hosting provider's build environment, then
rebuild. `.env.example` documents them and the server-only values that must
never use a `VITE_` prefix.

```bash
npm install
npm run dev      # http://localhost:5173 and /admin
npm run build    # typecheck + production bundle
```

---

## 6. Transactional email (Resend + Edge Function + Cron)

### 6.1 Deploy the worker

```bash
# from the repository root, with the Supabase CLI linked to the project
supabase functions deploy send-emails --no-verify-jwt
```

`--no-verify-jwt` is required because the worker authenticates the cron request
with its own `x-worker-secret` header rather than a user JWT.

### 6.2 Set function secrets

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxx \
  EMAIL_WORKER_SECRET=a-long-random-string \
  EMAIL_FROM="HALA.S <orders@your-verified-domain>"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase
automatically. `EMAIL_FROM` must use a domain verified in Resend.

### 6.3 Schedule the worker

Open `supabase/cron-email.sql`. It:

1. stores the project URL and worker secret in **Supabase Vault**,
2. schedules `send-emails` every minute with `pg_cron` + `pg_net`.

Replace the two placeholder values once, run the file in the SQL editor, then
clear your editor history. Do not commit real secrets. Alternatively create the
two Vault secrets in **Dashboard → Vault** and run only the cron statement.

### 6.4 Test it

1. Admin → **Notifications**: queue a test email to yourself.
2. Wait up to one minute; check the log row becomes `sent`.
3. If it fails, the row shows the provider error and a **Retry** action.

### 6.5 Which emails exist

- Admin: new order, order cancelled, delivery failed, returned, low stock,
  out of stock, payment status change, system error.
- Customer (transactional only): order confirmation, status update, shipment
  with tracking, delivery confirmation.
- Marketing: never sent automatically; the customer `accepts_marketing` flag is
  recorded but this build has no marketing campaign sender.

Each type has a toggle in **Notifications**. Templates live in
`supabase/functions/send-emails/templates.ts` and are covered by
`npm run test:email`.

---

## 7. Auth URL configuration

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL**: `https://YOUR-DOMAIN`
- **Redirect URLs**: add `https://YOUR-DOMAIN/admin/reset-password`
  and `http://localhost:5173/admin/reset-password` for local development.

The recovery email redirects to that route, where the user chooses a new
password. No account-existence information is disclosed by the reset form.

---

## 8. Deploy the site

Any static host works. This repo includes `vercel.json` with an SPA rewrite so
deep links such as `/admin/orders/<id>` and `/product/<handle>` load the app.

1. Build command: `npm run build`
2. Output directory: `dist`
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the host env.
4. Deploy, then open `/admin/login`.

Do not deploy `supabase/` service secrets to the static host.

---

## 9. Verification checklist

Run through this once after setup, on desktop and a phone:

| Area | Check |
| --- | --- |
| Access | `/admin` redirects to login when signed out; wrong password fails; non-admin account is refused; sign out works; refresh keeps the session |
| Products | Create a draft with images and variants; publish; it appears on the storefront; change price/stock/description and see the update; unpublish and see it disappear; duplicate, archive, delete |
| Collections | Create a manual collection; add products; publish; appears on site; create an automatic rule collection (e.g. tag contains `new`); preview matches |
| Orders | Place a COD order as a customer; it appears in Orders with correct server-calculated totals; open detail; move through statuses; cancel and confirm stock returns; print invoice/packing slip |
| Deliveries | Set courier, tracking number and dates; update delivery status; check manual tracking note; print label |
| Customers | Profile created at checkout; order history and lifetime spend correct; internal notes save; contact links work |
| Inventory | Adjust stock with a reason; movement history records it; low/out filters; reserve on order and deduct on dispatch |
| Emails | Test email queued; order confirmation and new-order alert delivered; retry a failed row; toggles persist |
| Analytics | KPIs and charts change with the date range; best sellers and low stock populate |
| Security | Logged-out API reads of orders/customers fail; only published products/collections are public |
| Build | `npm run typecheck`, `npm run build`, `npm run test` all pass |

---

## 10. Security model (summary)

- Public read: published products, published collections, their images and
  variants, `storefront_settings` (safe projection), `collection_products_effective`.
- No public reads of orders, customers, addresses, inventory movements, email
  logs, settings containing the admin address, or roles.
- All writes go through security-definer RPCs that call `require_admin()` and
  write an audit row. Direct `INSERT/UPDATE/DELETE` grants on operational tables
  are revoked from browser roles.
- Order totals, shipping, tax and stock are recalculated server-side from the
  database. The browser sends only product/variant identifiers and quantities.
- Idempotency keys prevent duplicate orders; stock reservation and deduction are
  atomic and guarded so a cancellation/return restores exactly once.
- Storage uploads are admin-only; the bucket is public-read so storefront images
  render without signed URLs.
- Central secrets never reach the browser: only the anon key is public by design.

---

## 11. Order, stock and delivery behaviour

Order statuses: `new → pending_confirmation → confirmed → processing → packed →
shipped → out_for_delivery → delivered`, with `cancelled` and `returned`
branches. Payment: `pending / paid / failed / refunded`.

- Creating an order **reserves** stock.
- Confirmation/processing keeps the reservation; dispatch **deducts** it.
- Cancelling releases or restores stock (once) according to Settings → Stock
  policy. Returns restore stock when the policy is enabled.
- Low-stock alerts fire at each variant's threshold (falling back to the store
  threshold).
- Courier tracking is **manual**. Administrators enter the courier, tracking
  number and dates. The UI says so explicitly; there is no live courier API.
  The data model is ready for an integration later.

---

## 12. Known limitations (explicit)

- Courier tracking is manual; no live courier integration is claimed.
- Cash on Delivery is the only payment method; no card/bank gateway is wired.
- The storefront displays prices in PKR. The Settings currency field is stored
  for documents and future multi-currency work, but the storefront formatter is
  PKR today.
- Customers do not have accounts; profiles are created from COD checkout data.
- Marketing email is not sent from this build.
- Supabase Cron, Resend delivery and browser flows require your cloud project;
  they cannot be exercised without those credentials.

---

## 13. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `/admin` shows the setup screen | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` missing at build time; rebuild |
| Login says the account is not an administrator | Run `admin-bootstrap.sql` for that exact email |
| Dashboard/tables are empty | RLS is working but the role row is missing, or seed did not run |
| Images upload but are invisible | Confirm Storage bucket `product-images` is public (created by `setup.sql`) |
| Emails stay `pending` | Cron job not scheduled, worker not deployed, or secrets missing; check `cron.job` and `net._http_response` |
| Emails fail with a provider error | Verify the Resend domain and that `EMAIL_FROM` uses it; retry from Notifications |
| Reset link opens the storefront | Add `/admin/reset-password` to Supabase Auth redirect URLs |
| Deep links 404 on hosting | Enable SPA rewrites (`vercel.json` is included) |

---

## 14. Local verification without cloud credentials

```bash
npm run test:email   # pure template renderers
npm run test:db      # real embedded PostgreSQL: schema, RLS, order, stock, email contracts
npm run typecheck
npm run build
```

The database suite spins up a throwaway PostgreSQL cluster, applies every
migration and exercises the real functions — no Docker or Supabase CLI needed.
