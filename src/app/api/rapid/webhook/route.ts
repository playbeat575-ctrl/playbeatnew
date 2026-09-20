/**
 * POST /api/rapid/webhook
 *
 * Receives Rapid Gateway payment webhooks. Verifies the HMAC-SHA256 signature
 * over `${timestamp}.${rawBody}`, de-duplicates by eventId, and updates the
 * matching Order row.
 *
 * Register this URL in the Rapid portal: Developers → Webhooks.
 * The URL MUST be HTTPS in production.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rapidConfig, rapidWebhookReady } from "@/lib/rapid/config";
import {
  readRapidHeaders,
  verifyRapidWebhook,
  VERIFY_FAILURE_MESSAGES,
  type RapidWebhookPayload,
} from "@/lib/rapid/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CRITICAL: Next.js must NOT parse the body before our handler sees the raw bytes.
// We read `req.text()` ourselves and pass it to the verifier.

export async function POST(req: Request) {
  if (!rapidWebhookReady()) {
    // Return 500 so Rapid retries — but if the salt is genuinely missing the merchant
    // will see all deliveries fail in the portal and fix it.
    console.error("[rapid/webhook] RAPID_GATEWAY_WEBHOOK_SALT is not set");
    return NextResponse.json(
      { ok: false, error: "webhook salt not configured" },
      { status: 500 },
    );
  }

  const headers = readRapidHeaders(req.headers);
  const rawBody = await req.text();

  const result = verifyRapidWebhook({
    salt: rapidConfig.webhookSalt,
    headers,
    rawBody,
  });

  if (!result.ok) {
    const reason = VERIFY_FAILURE_MESSAGES[result.reason];
    console.warn(`[rapid/webhook] verification failed: ${result.reason} — ${reason}`);
    // Return 401 so Rapid retries — a transient clock skew might recover on retry.
    return NextResponse.json(
      { ok: false, reason: result.reason, message: reason },
      { status: 401 },
    );
  }

  // Parse the (now-authenticated) payload.
  let payload: RapidWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RapidWebhookPayload;
  } catch {
    console.error("[rapid/webhook] could not parse JSON body");
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  // Idempotency: dedupe on eventId. If we've already seen this delivery, return 200
  // so Rapid stops retrying — but DON'T re-process it.
  const existing = await db.webhookEvent.findUnique({
    where: { eventId: payload.eventId },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, deduplicated: true });
  }

  // Find the matching order (if any) by merchantTransactionId.
  let orderId: string | null = null;
  if (payload.merchantTransactionId) {
    const order = await db.order.findUnique({
      where: { merchantTransactionId: payload.merchantTransactionId },
      select: { id: true },
    });
    orderId = order?.id ?? null;
  }

  // Persist the event for audit.
  await db.webhookEvent.create({
    data: {
      eventId: payload.eventId,
      eventType: payload.eventType,
      rawBody,
      signature: result.signature,
      timestamp: result.timestamp,
      orderId,
    },
  });

  // Apply the event to the order state machine.
  if (orderId) {
    await applyEventToOrder(orderId, payload);
  }

  return NextResponse.json({ ok: true });
}

/**
 * Map a Rapid webhook event to an order status update.
 *
 *   transaction.completed  → SUCCESS
 *   transaction.failed     → FAILED
 *   refund.completed       → REFUNDED
 *   refund.failed          → (no change, log only)
 *   reversal.completed     → FAILED (void)
 *   reversal.failed        → (no change)
 *   webhook.test           → (no change, smoke test only)
 */
async function applyEventToOrder(orderId: string, p: RapidWebhookPayload): Promise<void> {
  const patch: { status?: string; gatewayTxnRef?: string } = {};
  if (p.gatewayTxnRef) patch.gatewayTxnRef = p.gatewayTxnRef;

  switch (p.eventType) {
    case "transaction.completed":
      patch.status = "SUCCESS";
      break;
    case "transaction.failed":
      patch.status = "FAILED";
      break;
    case "refund.completed":
      patch.status = "REFUNDED";
      break;
    case "reversal.completed":
      patch.status = "FAILED";
      break;
    case "refund.failed":
    case "reversal.failed":
    case "webhook.test":
      // No state transition — already recorded the event for audit.
      return;
    default:
      console.warn(`[rapid/webhook] unhandled eventType: ${p.eventType}`);
      return;
  }

  await db.order.update({ where: { id: orderId }, data: patch });
}
