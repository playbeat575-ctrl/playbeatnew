# Rapid Gateway × Next.js — Payment Integration

Production-ready checkout built on [Rapid Gateway](https://rapidgateway.pk/) —
Pakistan's unified payment gateway (cards, Raast, JazzCash, easypaisa, bank
transfers). Implements the full [webhook verification spec](https://rapidgateway.pk/resources/payment-webhooks-guide):
HMAC-SHA256 signatures, 5-minute freshness window, constant-time comparison,
idempotent event handling.

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Prisma** + SQLite (Order + WebhookEvent tables)
- **shadcn/ui** + Tailwind
- **zod** for request validation

## Architecture

```
src/lib/rapid/
  config.ts        env-based config, never logs secrets
  webhook.ts       HMAC-SHA256 verify (5-min window, constant-time, salt rotation)
  client.ts        server-side Rapid API client (createHostedCheckout, getTxnStatus)
  money.ts         PKR ↔ paisa (minor units) helpers

src/app/api/rapid/
  create-session/route.ts   POST  — create order + Rapid hosted checkout URL
  webhook/route.ts          POST  — verify signature, dedupe by eventId, update order
  return/route.ts           GET   — Rapid redirects customer back here after checkout
  orders/route.ts           GET   — list recent orders
  order/[id]/route.ts       GET   — single order
  config/route.ts           GET   — safe config status for the UI banner

src/app/page.tsx           Checkout form + recent orders table (auto-refreshes every 5s)

prisma/schema.prisma       Order + WebhookEvent models
```

## The webhook flow

1. Customer fills the form on `/` and clicks **Pay with Rapid**.
2. `POST /api/rapid/create-session` creates an `Order` row (status `PENDING`)
   and calls Rapid's hosted-checkout endpoint. Returns a `checkoutUrl`.
3. Browser is redirected to `checkoutUrl` (Rapid's PCI-DSS hosted page).
4. Customer pays. Rapid redirects the browser back to `/api/rapid/return?mRef=…`
   which sends the user home. **The redirect is informational only — it cannot
   change order status.**
5. Rapid fires a signed webhook to `/api/rapid/webhook`. We:
   - Verify the `X-RapidGateway-Signature` header (HMAC-SHA256, uppercase hex,
     constant-time compare, 5-min freshness window).
   - De-duplicate by `eventId` (the same event may be delivered more than once).
   - Map `transaction.completed` → `SUCCESS`, `transaction.failed` → `FAILED`,
     `refund.completed` → `REFUNDED`, `reversal.completed` → `FAILED`.
6. The UI polls `/api/rapid/orders` every 5 seconds and shows the new status.

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — fill in your real values from https://rapidgateway.pk → Developers
```

### 3. Push the DB schema

```bash
bun run db:push
```

### 4. Run the dev server

```bash
bun run dev
```

### 5. Register your webhook URL in the Rapid portal

Go to **Developers → Webhooks → New Webhook** and paste:

```
https://YOUR-DOMAIN/api/rapid/webhook
```

For local testing use a tunnel like `ngrok http 3000` or `cloudflared tunnel`
and register the tunnel URL. Webhooks require HTTPS in production.

### 6. Test the webhook flow end-to-end

With the dev server running and `RAPID_GATEWAY_WEBHOOK_SALT` set in `.env`:

```bash
bun run scripts/test-webhook.ts
```

This script:
- Creates a PENDING order in the DB
- Builds a fake `transaction.completed` payload
- Computes the correct HMAC-SHA256 signature
- POSTs to `/api/rapid/webhook`
- Verifies: ✅ valid sig → 200 + status flip, ✅ dup → dedupe, ✅ bad sig → 401, ✅ stale → 401

## Security

- **Secrets**: `RAPID_GATEWAY_API_KEY` and `RAPID_GATEWAY_WEBHOOK_SALT` are
  different secrets. The API key is for outbound calls; the salt is for
  verifying inbound webhooks. Never reuse them.
- **Webhook verification**: ALL four checks from the Rapid spec are enforced —
  signature, timestamp freshness, constant-time compare, raw body bytes. The
  handler reads `req.text()` and never re-serializes JSON.
- **Salt rotation**: pass the previous salt via `previousSalt` to
  `verifyRapidWebhook()` to accept both salts during a rotation window.
- **Idempotency**: the `WebhookEvent.eventId` column has a unique constraint —
  replayed deliveries are silently no-op'd.
- **Return URL is informational only**: `/api/rapid/return` persists the query
  string for debugging but never mutates order status. Only the signed webhook
  can.

## Deploy to Vercel

### 1. Push to GitHub

The repo is already pushed to `https://github.com/playbeat575-ctrl/playbeatnew`.

### 2. Create a PostgreSQL database

Vercel serverless functions have ephemeral filesystems — SQLite won't work.
Create a free Postgres database from one of:

- **Vercel Postgres** (recommended — integrates directly): https://vercel.com/docs/storage/vercel-postgres
- **Neon** (free tier, generous): https://neon.tech
- **Supabase** (free tier): https://supabase.com/docs/guides/database

Copy the connection string — it looks like:
`postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`

### 3. Import to Vercel

1. Go to https://vercel.com/new
2. Import the `playbeat575-ctrl/playbeatnew` repo
3. Vercel auto-detects Next.js + the `vercel.json` build command
4. Add these Environment Variables (Project Settings → Environment Variables):

   | Key | Value | Notes |
   |---|---|---|
   | `DATABASE_URL` | `postgresql://...` | from step 2 |
   | `RAPID_GATEWAY_ENV` | `live` | for production |
   | `RAPID_GATEWAY_MERCHANT_ID` | your live merchant id | from Rapid portal |
   | `RAPID_GATEWAY_API_KEY` | your live API key | from Rapid portal |
   | `RAPID_GATEWAY_WEBHOOK_SALT` | your webhook salt | from Rapid portal |
   | `RAPID_GATEWAY_BASE_URL` | `https://api.rapidgateway.pk` | live API host |
   | `RAPID_GATEWAY_APP_BASE_URL` | `https://your-app.vercel.app` | your Vercel domain |

5. Click **Deploy**.

### 4. Push the database schema

After the first deploy, run Prisma's schema push against your Postgres database.
Easiest way: from your local machine with `DATABASE_URL` set to your Postgres connection string:

```bash
DATABASE_URL="postgresql://..." bun run db:push
```

Alternatively, use `prisma migrate` for production schema management.

### 5. Register the webhook URL in Rapid portal

Go to **Rapid Portal → Developers → Webhooks → New Webhook** and paste:

```
https://your-app.vercel.app/api/rapid/webhook
```

The URL MUST be HTTPS (Vercel gives you this automatically).

### 6. Test with a sandbox transaction first

Even if you set `RAPID_GATEWAY_ENV=live`, do one small real transaction (e.g. 1 PKR)
to confirm the full flow works end-to-end before scaling up.

## Local development

```bash
# 1. Install deps
bun install

# 2. Configure env
cp .env.example .env
# Edit .env — for local dev you can switch prisma/schema.prisma provider
# back to "sqlite" and use DATABASE_URL=file:./dev.db if you don't want Postgres locally

# 3. Push schema
bun run db:push

# 4. Run dev server
bun run dev

# 5. Test webhook verification end-to-end
bun run scripts/test-webhook.ts
```

## Verify the response shape

The exact response shape from Rapid's `POST /rapid/process-transaction` is not
in the public webhook guide. The code in `src/lib/rapid/client.ts` tries the
most common field names (`checkoutUrl`, `redirectUrl`, `paymentUrl`, `url`).
If your portal returns a different field, adjust the destructuring in
`createHostedCheckout()` — the rest of the flow (DB, webhook, UI) does not
change.

## License

MIT
