/**
 * Server-to-server client for Rapid Gateway.
 *
 * Endpoints (per https://rapidgateway.pk/resources/payment-webhooks-guide):
 *   POST {baseUrl}/rapid/process-transaction  — hosted redirect checkout
 *   POST {baseUrl}/v1/checkout-sessions       — embedded checkout (supports per-txn webhookUrl)
 *
 * NOTE: The exact request body shape for `process-transaction` is not in the
 * public webhook guide. The field names below match the webhook payload fields
 * (merchantId, merchantTransactionId, amount, currency, ...) which is the
 * strongest hint available. If your portal shows different field names, adjust
 * `createHostedCheckout()` accordingly — the rest of the flow (DB, webhook
 * verification, UI) does not change.
 */

import { rapidConfig } from "./config";

export interface CreateCheckoutInput {
  /** Our internal order id (also used as merchantTransactionId). */
  merchantTransactionId: string;
  /** Decimal currency amount, e.g. 100.00. We store paisa in DB and convert here. */
  amount: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  description?: string;
}

export interface CreateCheckoutResult {
  /** URL the browser should be redirected to (hosted checkout) OR the session id (embedded). */
  checkoutUrl?: string;
  sessionId?: string;
  /** Raw response from Rapid, for debugging. */
  raw: unknown;
}

/**
 * Create a hosted-checkout session and return the URL the browser should be sent to.
 * Uses POST {baseUrl}/rapid/process-transaction.
 */
export async function createHostedCheckout(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  const url = `${rapidConfig.baseUrl}/rapid/process-transaction`;

  const returnUrl = `${rapidConfig.appBaseUrl}/api/rapid/return?mRef=${encodeURIComponent(
    input.merchantTransactionId,
  )}`;

  const body = {
    merchantId: rapidConfig.merchantId,
    merchantTransactionId: input.merchantTransactionId,
    amount: input.amount,
    currency: input.currency,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    description: input.description,
    // Where Rapid redirects the customer AFTER the hosted page finishes.
    redirectUrl: returnUrl,
    // Rapid sends webhooks to the URL you registered in the portal — not this field —
    // for the hosted flow. We include webhookUrl only for parity / future embedded flow.
    webhookUrl: `${rapidConfig.appBaseUrl}/api/rapid/webhook`,
    environment: rapidConfig.environment.toUpperCase(),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${rapidConfig.apiKey}`,
      "X-RapidGateway-MerchantId": rapidConfig.merchantId,
    },
    body: JSON.stringify(body),
    // Don't let a sandbox hang block the whole request thread.
    next: { revalidate: 0 },
    cache: "no-store",
  });

  const rawText = await res.text();
  let rawJson: unknown = rawText;
  try {
    rawJson = JSON.parse(rawText);
  } catch {
    /* keep raw text */
  }

  if (!res.ok) {
    throw new Error(
      `Rapid createHostedCheckout failed: HTTP ${res.status} — ${rawText.slice(0, 500)}`,
    );
  }

  // Try the most common response shapes. Adjust to match your portal's actual response.
  const r = rawJson as Record<string, unknown> | undefined;
  const checkoutUrl =
    (r?.checkoutUrl as string) ||
    (r?.redirectUrl as string) ||
    (r?.paymentUrl as string) ||
    (r?.url as string);

  return {
    checkoutUrl,
    sessionId: r?.sessionId as string | undefined,
    raw: rawJson,
  };
}

/**
 * Look up the status of a transaction by merchantTransactionId or gatewayTxnRef.
 * Uses GET {baseUrl}/v1/transactions/{ref}.
 */
export async function getTransactionStatus(
  ref: string,
): Promise<Record<string, unknown>> {
  const url = `${rapidConfig.baseUrl}/v1/transactions/${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${rapidConfig.apiKey}`,
      "X-RapidGateway-MerchantId": rapidConfig.merchantId,
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Rapid getTransactionStatus failed: HTTP ${res.status} — ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}
