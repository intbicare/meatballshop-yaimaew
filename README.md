# Meatball Order

Customer ordering page for the fried snack shop.

## What It Does

- Shows the menu.
- Lets customers add items.
- Creates an order number.
- Shows a PromptPay QR only when the total is 1-5,000 baht.
- Blocks QR and order submit above 5,000 baht and asks customers to contact the shop.
- Saves a shop-side order slip PNG and JSON file when the order is submitted.

## Code Layout

The app is being organized gradually:

```text
app.js                    Main Express app and routes
src/config.js             Environment/config defaults
src/storage/orderStorage.js
src/storage/orderLinkStorage.js
views/                    EJS pages and partials
```

Next safe refactor steps are moving Discord, order-link logic, and admin/customer routes out of `app.js`.

## Run Locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000/dashboard
```

## Deploy Notes

This app can run on Node hosting such as Render.

For paid Render services, attach a persistent disk and set:

```text
DATA_DIR=/var/data
```

The included `render.yaml` uses the Starter plan, mounts a 1 GB disk at `/var/data`, and points generated order data there. Without `DATA_DIR`, local development still saves to `generated/`.

## Discord Notifications

Create a Discord channel webhook, then set this environment variable in Render:

```text
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
APP_BASE_URL=https://your-render-url.onrender.com
DATA_DIR=/var/data
SHOP_LAT=13.7426371
SHOP_LNG=100.3520867
OSRM_BASE_URL=https://router.project-osrm.org
```

Customers can add their name, phone number, and map link before sending an order. The map link is saved as text. The app asks for browser GPS once on the ordering page; if GPS is blocked or fails, the order still goes through. If GPS is available, the app saves a generated customer map URL, straight-line distance, OSRM driving distance, and estimated driving time.

Online orders use `WEB-YYMMDD-HHMM-XXX`, start as `pending_payment`, and get a private tracking link like:

```text
/track/WEB-260621-1200-123?t=random-token
```

The tracking page only shows customer-safe order details.

Staff can update online order status at:

```text
/admin/orders
```

The customer tracking page stays read-only. When staff changes the status, the tracking page shows the new status after refresh.

## Order Links

Staff generates customer order links at:

```text
/admin/order-links
```

- Booth QR auto-rotates daily.
- Online link is manually rotated and can be enabled or disabled.
- Menu QR is static and lets customers view menu/prices only.
- Customers can view the menu without a token, but submitting an order requires a valid booth or online link.
- The admin page can download local QR PNG files and send the current links to Discord.

## Admin Quick Sale

Admin route:

```text
/admin/login
```

Required environment variables:

```text
ADMIN_PASSWORD=
SESSION_SECRET=
DISCORD_WEBHOOK_URL=
```

Staff can enter an amount, choose QR or Cash, and press Add Sale. The app sends a Discord message for each quick sale and each cancellation.

Important limitation: quick sale rows and today summary are stored in server memory only. They reset when Render restarts or redeploys. Discord is the durable order log for this option.
