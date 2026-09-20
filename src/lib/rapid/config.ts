/**
 * Rapid Gateway configuration — read from environment.
 *
 * Required env vars (see .env.example):
 *   RAPID_GATEWAY_ENV            = "sandbox" | "live"
 *   RAPID_GATEWAY_MERCHANT_ID    = numeric merchant id from portal
 *   RAPID_GATEWAY_API_KEY        = server-to-server API key (secret)
 *   RAPID_GATEWAY_WEBHOOK_SALT   = webhook signing salt from Developers → Webhooks
 *   RAPID_GATEWAY_BASE_URL       = e.g. https://sandbox-api.rapidgateway.pk
 *   RAPID_GATEWAY_APP_BASE_URL   = public URL of THIS app (e.g. https://shop.example.com)
 *
 * The webhook salt is the ONLY secret used to verify inbound webhooks.
 * The API key is used for outbound calls (create session, query txn).
 * They are different secrets — do not reuse.
 */

export type RapidEnv = "sandbox" | "live";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    throw new Error(
      `[rapid] Missing required env var: ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const rapidConfig = {
  /** sandbox or live — defaults to sandbox so a fresh checkout never charges a real card. */
  environment: (optional("RAPID_GATEWAY_ENV", "sandbox") as RapidEnv) === "live"
    ? "live"
    : "sandbox",

  /** Numeric merchant id shown in the Rapid portal. */
  merchantId: optional("RAPID_GATEWAY_MERCHANT_ID", ""),

  /** Server-to-server API key (NEVER expose to the client). */
  apiKey: optional("RAPID_GATEWAY_API_KEY", ""),

  /** Webhook HMAC-SHA256 salt — from Developers → Webhooks. */
  webhookSalt: optional("RAPID_GATEWAY_WEBHOOK_SALT", ""),

  /** Rapid API base URL (sandbox or live). */
  baseUrl: optional(
    "RAPID_GATEWAY_BASE_URL",
    "https://sandbox-api.rapidgateway.pk",
  ),

  /** Public base URL of THIS app — used to build return URLs. */
  appBaseUrl: optional("RAPID_GATEWAY_APP_BASE_URL", "http://localhost:3000"),
} as const;

/** True when all the secrets needed for OUTBOUND calls are present. */
export function rapidOutboundReady(): boolean {
  return Boolean(rapidConfig.merchantId && rapidConfig.apiKey);
}

/** True when the webhook salt is configured (needed to verify inbound webhooks). */
export function rapidWebhookReady(): boolean {
  return Boolean(rapidConfig.webhookSalt);
}

/**
 * Throws if any required env is missing — used by API routes that must fail loud,
 * not by UI code that should render a "configure first" banner.
 */
export function assertRapidConfigured(): void {
  required("RAPID_GATEWAY_MERCHANT_ID");
  required("RAPID_GATEWAY_API_KEY");
  required("RAPID_GATEWAY_WEBHOOK_SALT");
  required("RAPID_GATEWAY_BASE_URL");
  required("RAPID_GATEWAY_APP_BASE_URL");
}
