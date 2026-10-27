# Shiroh Merchants

An all-in-one online shop: farm-fresh produce, groceries, pharmacy, clothing, flowers, electronics, networking gear, solar, home goods, games, and expert services including networking, web design and software development.

- **Orders by WhatsApp** work anywhere, including GitHub Pages. Checkout opens a ready-made WhatsApp message to 0110 291 686, and expert requests go to 0715 342 011.
- **Pay now with M-Pesa** (STK push) appears at checkout only when the site runs on Vercel with the payment settings below. On GitHub Pages it stays hidden.
- **Orders admin** is at `/admin.html` (Vercel only).

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The shop |
| `products.js` | Product catalogue and prices. Edit this to change products. The payment API reads the same file, so customers can't change prices in the browser. |
| `admin.html` | Orders list for staff, protected by a password |
| `api/` | Vercel functions: `pay` (starts STK push), `callback` (Safaricom result), `status`, `orders`, `health` |
| `lib/` | Pricing, M-Pesa and order storage helpers |

Product ids are positions in `products.js` (`p1`, `p2`, …). Add new products at the **end** of the list so ids of existing orders don't shift.

## Turning on M-Pesa payments

1. **Vercel:** sign in at vercel.com with GitHub, click *Add New → Project* and import this repository. Keep the default settings.
2. **Order storage:** in the Vercel project open *Storage → Create → Upstash for Redis* (free plan) and connect it. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
3. **Daraja:** at developer.safaricom.co.ke create an app with *M-Pesa Express*. For testing, use the sandbox shortcode `174379` and the sandbox passkey shown in the Daraja simulator. To go live, apply for M-Pesa Express on your Paybill or Till.
4. **Environment variables** (Vercel → Settings → Environment Variables). Never put these in the code or in chat.

| Name | Value |
| --- | --- |
| `MPESA_ENV` | `sandbox` while testing, `production` when live |
| `MPESA_CONSUMER_KEY` | From your Daraja app |
| `MPESA_CONSUMER_SECRET` | From your Daraja app |
| `MPESA_SHORTCODE` | Paybill number, or the Till's store number |
| `MPESA_PASSKEY` | M-Pesa Express passkey from Safaricom |
| `MPESA_TYPE` | `paybill` or `till` |
| `MPESA_TILL` | Till number (only when `MPESA_TYPE` is `till`) |
| `CALLBACK_SECRET` | Any long random text, e.g. 32 letters and numbers |
| `ADMIN_PASSWORD` | Password for `/admin.html`, at least 8 characters |
| `SITE_URL` | Optional: your final address, e.g. `https://shirohmerchants.co.ke` |

5. Redeploy. The checkout now shows **Pay now with M-Pesa**. Paid orders appear in `/admin.html`.

Prescription medicine and services are never paid directly. Prescriptions are checked by a pharmacist on WhatsApp first, and services are booked through *Talk to an expert*.

## Tests

`npm test` runs the payment API against fake Safaricom and Redis services.
