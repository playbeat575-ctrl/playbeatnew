/**
 * Rapid Gateway webhook signature verification.
 *
 * Spec: https://rapidgateway.pk/resources/payment-webhooks-guide
 *
 * The signature is:
 *   HMAC-SHA256(
 *     key    = your webhook salt,
 *     message = `${timestamp}.${rawBody}`
 *   )
 *   → hex-encoded, UPPERCASE.
 *
 * Verification rules (all MUST pass):
 *   1. Reject if |now - X-RapidGateway-Timestamp| > 300 seconds (5-min window).
 *   2. Recompute HMAC over `${timestamp}.${rawBody}` using the salt.
 *   3. Constant-time compare with X-RapidGateway-Signature.
 *   4. Always use the RAW request body bytes — do NOT re-serialize JSON.
 *
 * During a salt rotation, accept the current OR previous salt (we support both
 * via the optional `previousSalt` argument).
 */

import crypto from "node:crypto";

/** Max age (in seconds) of a webhook delivery we'll still accept. */
const MAX_AGE_SECONDS = 300; // 5 minutes per Rapid spec

export interface WebhookHeaders {
  signature: string | null;
  timestamp: string | null;
  event: string | null;
  delivery: string | null;
}

/** Read the four X-RapidGateway-* headers from a Headers object. */
export function readRapidHeaders(headers: Headers): WebhookHeaders {
  // Rapid also sends legacy X-RapidPay-* aliases — prefer X-RapidGateway-*.
  return {
    signature: headers.get("x-rapidgateway-signature"),
    timestamp: headers.get("x-rapidgateway-timestamp"),
    event: headers.get("x-rapidgateway-event"),
    delivery: headers.get("x-rapidgateway-delivery"),
  };
}

/**
 * Compute the expected signature for a given (timestamp, rawBody, salt).
 * Returns an UPPERCASE hex string.
 */
export function computeRapidSignature(
  salt: string,
  timestamp: string,
  rawBody: string,
): string {
  return crypto
    .createHmac("sha256", salt)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")
    .toUpperCase();
}

/**
 * Verify a Rapid webhook delivery.
 *
 * @returns an object describing WHY verification failed (or `{ ok: true }`).
 */
export function verifyRapidWebhook(params: {
  salt: string;
  /** Optional previous salt — accepted during rotation. */
  previousSalt?: string;
  headers: WebhookHeaders;
  /** Raw request body as a UTF-8 string. MUST be the raw bytes, not JSON.stringify. */
  rawBody: string;
  /** Override the "now" used for the freshness check (useful for tests). */
  nowSeconds?: number;
}):
  | { ok: true; timestamp: string; signature: string }
  | { ok: false; reason: VerifyFailureReason } {
  const { salt, previousSalt, headers, rawBody, nowSeconds } = params;

  if (!headers.signature || !headers.timestamp) {
    return { ok: false, reason: "missing-headers" };
  }

  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "bad-timestamp" };
  }

  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_AGE_SECONDS) {
    return { ok: false, reason: "timestamp-too-old" };
  }

  const expected = computeRapidSignature(salt, headers.timestamp, rawBody);
  const expectedPrev = previousSalt
    ? computeRapidSignature(previousSalt, headers.timestamp, rawBody)
    : null;

  const a = Buffer.from(expected);
  const b = Buffer.from(headers.signature);
  const aPrev = expectedPrev ? Buffer.from(expectedPrev) : null;

  const currentMatch =
    a.length === b.length && crypto.timingSafeEqual(a, b);
  const prevMatch =
    aPrev !== null && aPrev.length === b.length && crypto.timingSafeEqual(aPrev, b);

  if (!currentMatch && !prevMatch) {
    return { ok: false, reason: "signature-mismatch" };
  }

  return {
    ok: true,
    timestamp: headers.timestamp,
    signature: headers.signature,
  };
}

export type VerifyFailureReason =
  | "missing-headers"
  | "bad-timestamp"
  | "timestamp-too-old"
  | "signature-mismatch";

/** Human-readable explanations for each failure reason. */
export const VERIFY_FAILURE_MESSAGES: Record<VerifyFailureReason, string> = {
  "missing-headers":
    "Missing X-RapidGateway-Signature or X-RapidGateway-Timestamp header.",
  "bad-timestamp":
    "X-RapidGateway-Timestamp is not a valid Unix epoch seconds integer.",
  "timestamp-too-old":
    "Webhook timestamp is more than 5 minutes from now — rejected per Rapid spec.",
  "signature-mismatch":
    "HMAC-SHA256 signature does not match — wrong salt, body re-serialized, or not from Rapid.",
};

/** The expected Rapid webhook payload shape. */
export interface RapidWebhookPayload {
  eventId: string;
  eventType: string;
  source?: string;
  merchantId?: number;
  gatewayTxnRef?: string;
  merchantTransactionId?: string;
  status?: string;
  amount?: number;
  currency?: string;
  environment?: string;
  occurredAt?: string;
}
