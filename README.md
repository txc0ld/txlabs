# TXLABS — Research Peptides Storefront

A complete, production-ready e-commerce storefront for a research-grade peptide
catalog (198 references across 8 categories). Built as a fast, dependency-free
static site in the **High-Contrast Tech** design language (see `../DESIGN.md`).

## What's included

| Page | File | Purpose |
|------|------|---------|
| Home | `index.html` | Hero, QC console, category rail, bestsellers, trust, CTA |
| Catalog | `shop.html` | Live search, category filters, sort, full product grid |
| Product | `product.html?p=<slug>` | Variant/size selection, qty, add-to-cart, spec table, related |
| Cart & Checkout | `cart.html` | Cart editing → shipping form → payment → place order |
| Confirmation | `confirmation.html` | Order reference + summary after checkout |
| Resources | `info.html` | About, testing, shipping, payment, FAQ, compliance, contact |

### Features
- **102 products / 198 SKUs** generated directly from `../Product List.xlsx`.
- Persistent **cart** (localStorage), live totals, free shipping over $300.
- **Search** by name / category / catalog number; category filters with counts; sorting.
- **Checkout** with validation, payment selection (crypto/wire/Zelle), and a
  compliance gate (21+, Research-Use-Only confirmation).
- Fully **responsive** (desktop → mobile), reduced-motion friendly, accessible focus states.
- Scroll-reveal animations, magnetic buttons, floating glass nav, custom cubic-bezier motion.
- **For Research Use Only** compliance messaging throughout.

## Going live

This is a static site — host it anywhere (Netlify, Vercel, Cloudflare Pages, S3,
nginx). Just upload the `site/` folder. No build step required.

```bash
# local preview
cd site && python -m http.server 8080
# open http://localhost:8080
```

### Wiring real order delivery
By default, **Place order** opens a pre-filled email to `orders@txlabs.bio` and
shows the confirmation page. To POST orders to a backend/automation instead
(Formspree, a serverless function, etc.), add the endpoint to the cart page body:

```html
<body data-order-endpoint="https://your-endpoint.example/orders">
```
The order JSON (`ref`, customer, items, totals) is POSTed there; the email is the
fallback if the request fails.

### Customising
- **Catalog**: edit `../Product List.xlsx` then re-run `python ../gen_catalog.py`
  to regenerate `assets/js/data.js`.
- **Brand / contact**: search for `orders@txlabs.bio` and `@txlabs_orders` in
  `assets/js/store.js` and the HTML.
- **Design tokens**: all colors/typography/spacing live at the top of
  `assets/css/styles.css` (sourced from `../DESIGN.md`).
