
# HALA.S checkout repair — changes in this package

- The bag drawer now navigates to /checkout through a React Router Link, so closing the drawer cannot cancel navigation.
- Added a dedicated /cart page with editable quantities, remove actions, order summary and a direct checkout link.
- Registered /cart in the application router.
- Made the drawer footer/checkout action remain visible on small screens while the bag contents scroll.
- The COD submit button remains visible and clickable when Supabase is not configured; it displays a clear configuration message instead of appearing disabled. It does not create fake orders.
- Added Vercel and Netlify SPA fallback rules so refreshing /cart, /checkout or /admin serves the React app.

## Important before accepting real orders

This project still requires a real Supabase project. Run the complete `supabase/setup.sql` in Supabase SQL Editor, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting provider, create an admin user and grant the admin role as described in `BACKEND-SETUP.md`, then rebuild and redeploy. A frontend ZIP cannot configure your private Supabase project or hosting environment automatically.

## Verification status

Source files and route wiring were inspected and updated. Dependency installation was interrupted by the execution time limit, so a production TypeScript/Vite build could not be completed in this session. Run `npm ci` followed by `npm run build` locally before deploying.
