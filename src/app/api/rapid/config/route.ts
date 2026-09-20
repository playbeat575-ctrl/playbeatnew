/**
 * GET /api/rapid/config
 *
 * Returns a SAFE subset of the Rapid config so the UI can show a "configure
 * first" banner when secrets are missing OR still set to placeholders.
 * NEVER returns the secrets themselves.
 */

import { NextResponse } from "next/server";
import {
  rapidConfig,
  rapidOutboundReady,
  rapidWebhookReady,
  rapidApiKeyReal,
  rapidWebhookSaltReal,
  rapidMerchantIdReal,
  rapidFullyConfigured,
} from "@/lib/rapid/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    // True if env vars exist (may still be placeholders).
    outbound: rapidOutboundReady(),
    webhook: rapidWebhookReady(),
    // True if env vars exist AND look like real values (not placeholders).
    outboundReal: rapidApiKeyReal() && rapidMerchantIdReal(),
    webhookReal: rapidWebhookSaltReal(),
    // True when ALL Rapid credentials look real.
    fullyConfigured: rapidFullyConfigured(),
    environment: rapidConfig.environment,
  });
}
