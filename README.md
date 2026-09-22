# Hala.S Clothing — GitHub Pages

This package is prepared for free static hosting on GitHub Pages. It contains the Hala.S frontend converted from the Python/FastAPI development version.

## Important
- This static build does not run Python/FastAPI on GitHub Pages.
- Product, wishlist, reviews and newsletter demo interactions use browser/local storage.
- Shopify can be connected later through a client-side Storefront API integration; real checkout/inventory/order management should remain in Shopify.
- Replace demo product data with your Shopify catalog during the integration phase.

## GitHub Pages
1. Create a GitHub repository and upload `index.html` and `404.html`.
2. Repository → Settings → Pages → Deploy from a branch → `main` / root.
3. After deployment, use the Pages URL to test the site.
4. Add your real custom domain in Pages → Custom domain.
5. Add the DNS records GitHub shows/requests at your domain registrar (Hostinger).
6. Enable HTTPS after DNS is verified.

No PowerShell server or Python process is required for the live GitHub Pages site.
