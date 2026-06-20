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
```

When the customer presses the send-order button, the app sends the order text and slip image link to Discord. The customer still gets copy/download buttons as a backup.

## Admin Quick Sale

Admin route:

```text
/admin/login
```

Required environment variables:

```text
ADMIN_PASSWORD=
SESSION_SECRET=
GOOGLE_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEET_TAB=Orders
```

The Google Sheet must be shared with the service account email. The app writes quick booth sales to the configured tab with these columns:

```text
createdAt, orderNumber, channel, total, paymentMethod, status, itemsText, updatedAt
```

`GOOGLE_PRIVATE_KEY` must keep escaped newlines as `\n`. The app converts them at runtime.
