# HALA.S — launch configuration notes

## Private product and order portal
- Open `/admin` (also linked in the footer) to sign in to the private Product Studio.
- The portal supports product creation, editing, deletion, image uploads, draft/published visibility, and a customer COD order inbox with order-status updates.
- Create the administrator in Supabase Authentication > Users, then add that user's UUID to `public.user_roles` with role `admin` as described in `BACKEND-SETUP.md`.

## Cash on Delivery checkout
- The bag's **Proceed to checkout** button opens the delivery-details page.
- Customers enter name, phone, address and city, review their items, then confirm **Cash on Delivery**.
- A restricted Supabase RPC creates the order and returns its order reference. Customers cannot read the orders table; signed-in admins can view and manage orders in `/admin`.
- Online card, bank, JazzCash and SadaPay payments remain disabled.
- Run the current `supabase/setup.sql` in Supabase SQL Editor, configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then rebuild and redeploy before taking real orders.
- Delivery fee is not configured. The checkout clearly says the team must confirm any delivery fee before dispatch; do not add an unapproved fee.

## WhatsApp
1. Copy `.env.example` to `.env`.
2. Set `VITE_WHATSAPP_NUMBER` to the official HALA.S WhatsApp Business number in international digits-only format (for Pakistan, begin with `92`; do not include `+`, spaces or dashes).
3. Restart the Vite development server and test the floating WhatsApp link on desktop and mobile.

## Before launch
- Publish the brand's verified delivery coverage, delivery fee, returns/exchanges, privacy and terms policies.
- Test a COD order end-to-end and verify it appears in `/admin` before announcing checkout as live.
- Keep Supabase service-role keys and all payment-provider secrets out of frontend code and `VITE_` variables.


## Checkout hardening update
- White/light action buttons now use black text for contrast (including the COD submit button).
- Checkout validates required customer details and phone-number length.
- The browser sends only product handle, selected size and quantity to Supabase.
- Supabase calculates authoritative prices/totals from published products, validates size and stock, and reserves inventory in one transaction.
- Admin cancellation restores reserved stock; reactivating a cancelled order checks and reserves stock again.
- Delivery fee remains quoted by the store and is not silently added to the checkout total.
- Re-run the full `supabase/setup.sql` after deploying this version.
