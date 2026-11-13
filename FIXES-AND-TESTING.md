# HALA.S — repair and handoff notes

## Changes made in this repair pass

- Product detail pages now request the selected published product directly from Supabase instead of depending on the full catalogue request succeeding. The query includes product images, active variants, and inventory.
- Collection membership is now supplementary on a product detail page. If the collection-membership view is unavailable, the published product detail can still load.
- If Supabase is configured but the live catalogue request fails, the storefront no longer silently substitutes the bundled demo catalogue. It surfaces the live-data failure instead of presenting misleading product data.
- Product detail breadcrumbs now tolerate products that have no collection membership.
- Product detail add-to-bag pricing now reflects the selected variant's price when that variant has an override.
- Admin product image uploads are resized to a maximum 1800px edge and converted to WebP when the browser supports it and the result is smaller. Original uploads are retained as a fallback.
- The admin product editor now prevents publishing a product without at least one image and enforces the database's 16-image limit before save.
- The cinematic scroll-frame background is restricted to the homepage. It now uses every third frame on desktop and every sixth frame on mobile, rather than downloading all 276 frames on every route.
- Added an environment-variable template and Git ignore rules so local environment files and build artifacts are not committed.
- Added older-browser fallbacks for horizontal overflow and viewport height.

## Backend and admin architecture

This project is a Vite + React + TypeScript storefront and admin portal backed by Supabase. The admin portal is at `/admin`; publishing, product images, variants, stock, orders, and authentication are handled by Supabase RPCs, RLS, and Storage. It is not currently wired to Shopify.

No database migrations were changed in this repair pass. Existing Supabase setup and policies remain the source of truth.

## Local setup

1. Install Node.js 22 or newer.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the values from the existing Supabase project.
4. Run `npm ci`.
5. Run `npm run build`.
6. Run `npm test`.
7. Run `npm run dev` and test the storefront at `/` and the admin portal at `/admin`.

For Vercel, set the same two `VITE_` variables in Project Settings → Environment Variables, then redeploy. Never put a Supabase service-role key in a `VITE_` variable.

## Admin publishing smoke test

1. Sign in with an administrator account that has the `admin` role in `public.user_roles`.
2. Create a product with at least one image, an active size/colour variant, and stock greater than zero.
3. Save it with status `Published`.
4. Confirm it appears in `/collections/all`.
5. Open the product card and verify its gallery, description, fabric/care, available sizes, colour, selected-variant price, and add-to-bag action.
6. Confirm the product is still visible in a private/incognito browser.
7. Edit the product in `/admin` and confirm the changes appear on the storefront.

## Verification limitation

A production build and automated test run could not be completed in the repair environment because `npm ci` repeatedly timed out while fetching dependencies. The source changes are included, but run the local build and test commands above before deploying. No live Supabase credentials or passwords are included in this ZIP; restore them locally from your own secure configuration.

## Windows launcher

Extract the ZIP, right-click `START-HALAS-WINDOWS.ps1`, and choose **Run with PowerShell** (or open PowerShell in the extracted `halas` folder and run `powershell -ExecutionPolicy Bypass -File .\START-HALAS-WINDOWS.ps1`). On first launch it creates `.env.local` from `.env.example`, opens it for the existing Supabase URL and anon/publishable key, installs dependencies with `npm ci`, and starts Vite. Keep `.env.local` private.

## Additional fixes in this pass

- A failed live collection request now shows the catalogue-unavailable state instead of being misreported as an unknown collection.
- The product page price display now updates when the selected variant has its own price.
- The email-template test script now uses Node 22's built-in TypeScript stripping so it can import the shared Edge Function template source directly.
