/**
 * End-to-end test of the Rapid webhook verification flow.
 *
 * Steps:
 *   1. Insert a PENDING order directly into the DB.
 *   2. Build a fake `transaction.completed` webhook payload.
 *   3. Compute the correct HMAC-SHA256 signature.
 *   4. POST to /api/rapid/webhook and observe the response.
 *   5. Confirm dedupe works (replay the same event).
 *   6. Confirm bad signature → 401.
 *   7. Confirm stale timestamp → 401.
 *
 * Run: bun run /home/z/my-project/scripts/test-webhook.ts
 */

import crypto from "node:crypto"
import { PrismaClient } from "@prisma/client"

const WEBHOOK_SALT = process.env.RAPID_GATEWAY_WEBHOOK_SALT
if (!WEBHOOK_SALT) {
  console.error("Set RAPID_GATEWAY_WEBHOOK_SALT in your env (use the same value as the dev server).")
  process.exit(1)
}
const BASE = process.env.BASE_URL ?? "http://localhost:3000"

const db = new PrismaClient()

async function main() {
  // 1. Create a PENDING order directly.
  const order = await db.order.create({
    data: {
      merchantTransactionId: `TEST-${Date.now()}`,
      amountMinor: 10000, // 100 PKR
      currency: "PKR",
      customerEmail: "test@example.com",
      status: "PENDING",
      environment: "SANDBOX",
    },
  })
  console.log(`Created PENDING order ${order.merchantTransactionId}`)

  // 2. Build a valid webhook payload.
  const payload = {
    eventId: crypto.randomUUID(),
    eventType: "transaction.completed",
    source: "ORCHESTRATOR",
    merchantId: 375,
    gatewayTxnRef: crypto.randomUUID(),
    merchantTransactionId: order.merchantTransactionId,
    status: "SUCCESS",
    amount: 100.0,
    currency: "PKR",
    environment: "SANDBOX",
    occurredAt: new Date().toISOString(),
  }
  const rawBody = JSON.stringify(payload)
  const timestamp = Math.floor(Date.now() / 1000).toString()

  // 3. Compute the expected signature.
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SALT)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")
    .toUpperCase()

  console.log(`Computed signature: ${signature.slice(0, 16)}…`)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-RapidGateway-Signature": signature,
    "X-RapidGateway-Timestamp": timestamp,
    "X-RapidGateway-Event": payload.eventType,
    "X-RapidGateway-Delivery": payload.eventId,
  }

  console.log("\n--- Test 1: valid signature ---")
  const res1 = await fetch(`${BASE}/api/rapid/webhook`, {
    method: "POST",
    headers,
    body: rawBody,
  })
  console.log(`  HTTP ${res1.status}  body=${await res1.text()}`)

  console.log("\n--- Test 2: duplicate delivery (should dedupe) ---")
  const res2 = await fetch(`${BASE}/api/rapid/webhook`, {
    method: "POST",
    headers,
    body: rawBody,
  })
  console.log(`  HTTP ${res2.status}  body=${await res2.text()}`)

  console.log("\n--- Test 3: bad signature ---")
  const res3 = await fetch(`${BASE}/api/rapid/webhook`, {
    method: "POST",
    headers: { ...headers, "X-RapidGateway-Signature": "DEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF" },
    body: rawBody,
  })
  console.log(`  HTTP ${res3.status}  body=${await res3.text()}`)

  console.log("\n--- Test 4: stale timestamp ---")
  const res4 = await fetch(`${BASE}/api/rapid/webhook`, {
    method: "POST",
    headers: { ...headers, "X-RapidGateway-Timestamp": "1000000000" },
    body: rawBody,
  })
  console.log(`  HTTP ${res4.status}  body=${await res4.text()}`)

  // 5. Check final order state.
  const final = await db.order.findUnique({ where: { id: order.id } })
  console.log(`\n--- Final order state ---`)
  console.log(`  status=${final?.status}  gatewayTxnRef=${final?.gatewayTxnRef}`)
  const eventCount = await db.webhookEvent.count({ where: { orderId: order.id } })
  console.log(`  webhook events for this order: ${eventCount}`)

  if (final?.status === "SUCCESS" && final.gatewayTxnRef === payload.gatewayTxnRef && eventCount === 1) {
    console.log("\n✅ END-TO-END PASS: webhook verification + state machine + dedupe all working.")
  } else if (res1.status === 500) {
    console.log("\n⚠️  Server returned 500 — ensure RAPID_GATEWAY_WEBHOOK_SALT is set in .env and the dev server was restarted, then re-run.")
  } else {
    console.log("\n❌ END-TO-END FAIL: see logs above.")
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
