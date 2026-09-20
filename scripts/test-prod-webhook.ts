/**
 * Verify production webhook signature verification end-to-end.
 *
 * Sends a `webhook.test` event (which the handler accepts without needing
 * a matching order in the DB) with:
 *   1. A valid HMAC-SHA256 signature → expect 200
 *   2. A bad signature → expect 401
 *   3. A stale timestamp → expect 401
 *
 * Usage:
 *   BASE_URL=https://playbeat.digital \
 *   RAPID_GATEWAY_WEBHOOK_SALT=... \
 *   bun run scripts/test-prod-webhook.ts
 */

import crypto from "node:crypto"

const BASE = process.env.BASE_URL ?? "https://playbeat.digital"
const SALT = process.env.RAPID_GATEWAY_WEBHOOK_SALT
if (!SALT) {
  console.error("Set RAPID_GATEWAY_WEBHOOK_SALT (pull from Vercel: `vercel env pull`)")
  process.exit(1)
}

const payload = {
  eventId: crypto.randomUUID(),
  eventType: "webhook.test",
  source: "PORTAL",
  merchantId: Number(process.env.RAPID_GATEWAY_MERCHANT_ID ?? 375),
  occurredAt: new Date().toISOString(),
}
const rawBody = JSON.stringify(payload)
const timestamp = Math.floor(Date.now() / 1000).toString()

const signature = crypto
  .createHmac("sha256", SALT)
  .update(`${timestamp}.${rawBody}`)
  .digest("hex")
  .toUpperCase()

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  "X-RapidGateway-Signature": signature,
  "X-RapidGateway-Timestamp": timestamp,
  "X-RapidGateway-Event": payload.eventType,
  "X-RapidGateway-Delivery": payload.eventId,
}

console.log(`Target: ${BASE}/api/rapid/webhook`)
console.log(`Event:  ${payload.eventType}  (eventId: ${payload.eventId})`)
console.log(`Salt:   ${SALT.length} chars`)
console.log(`Sig:    ${signature.slice(0, 16)}…\n`)

console.log("--- Test 1: valid signature ---")
const r1 = await fetch(`${BASE}/api/rapid/webhook`, { method: "POST", headers, body: rawBody })
console.log(`  HTTP ${r1.status}  ${await r1.text()}`)

console.log("\n--- Test 2: duplicate (should dedupe) ---")
const r2 = await fetch(`${BASE}/api/rapid/webhook`, { method: "POST", headers, body: rawBody })
console.log(`  HTTP ${r2.status}  ${await r2.text()}`)

console.log("\n--- Test 3: bad signature ---")
const r3 = await fetch(`${BASE}/api/rapid/webhook`, {
  method: "POST",
  headers: { ...headers, "X-RapidGateway-Signature": "0".repeat(64) },
  body: rawBody,
})
console.log(`  HTTP ${r3.status}  ${await r3.text()}`)

console.log("\n--- Test 4: stale timestamp ---")
const r4 = await fetch(`${BASE}/api/rapid/webhook`, {
  method: "POST",
  headers: { ...headers, "X-RapidGateway-Timestamp": "1000000000" },
  body: rawBody,
})
console.log(`  HTTP ${r4.status}  ${await r4.text()}`)

const pass = r1.status === 200 && r2.status === 200 && r3.status === 401 && r4.status === 401
console.log(`\n${pass ? "✅ PRODUCTION WEBHOOK VERIFICATION: PASS" : "❌ FAIL"}`)
process.exit(pass ? 0 : 1)
