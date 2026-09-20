/**
 * GET /api/rapid/config
 *
 * Returns a SAFE subset of the Rapid config so the UI can show a "configure
 * first" banner when secrets are missing. NEVER returns the secrets themselves.
 */

import { NextResponse } from "next/server";
import { rapidConfig, rapidOutboundReady, rapidWebhookReady } from "@/lib/rapid/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    outbound: rapidOutboundReady(),
    webhook: rapidWebhookReady(),
    environment: rapidConfig.environment,
  });
}
