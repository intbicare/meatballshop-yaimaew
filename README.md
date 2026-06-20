# Meatball Order

Customer ordering page for the fried snack shop.

## What It Does

- Shows the menu.
- Lets customers add items.
- Creates an order number.
- Shows a PromptPay QR only when the total is 1-5,000 baht.
- Blocks QR and order submit above 5,000 baht and asks customers to contact the shop.
- Saves a shop-side order slip PNG and JSON file when the order is submitted.

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

Generated order slips are saved to local disk in `generated/orders`. On many free hosts, local files can disappear after restart or redeploy, so this is best for testing or a simple first version.

## Discord Notifications

Create a Discord channel webhook, then set this environment variable in Render:

```text
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
APP_BASE_URL=https://your-render-url.onrender.com
SHOP_LAT=13.7426371
SHOP_LNG=100.3520867
OSRM_BASE_URL=https://router.project-osrm.org
```

When the customer presses the send-order button, the app asks for GPS once. If the customer blocks GPS or it fails, the order still goes through. If GPS is available, the app saves the customer map link, straight-line distance, OSRM driving distance, and estimated driving time.

Online orders use `WEB-YYMMDD-HHMM-XXX`, start as `pending_payment`, and get a private tracking link like:

```text
/track/WEB-260621-1200-123?t=random-token
```

The tracking page only shows customer-safe order details.

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
