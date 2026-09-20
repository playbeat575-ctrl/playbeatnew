/**
 * GET /api/rapid/orders
 *
 * Returns the most recent orders (newest first), capped at 50 rows.
 * Public for demo purposes — in production, gate this behind your auth.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { webhookEvents: { take: 5, orderBy: { processedAt: "desc" } } },
  });
  return NextResponse.json({ ok: true, orders });
}
