/**
 * GET /api/rapid/order/[id]
 *
 * Returns a single order (by internal id OR merchantTransactionId).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  // Try internal id first, then merchantTransactionId.
  const order = await db.order.findUnique({ where: { id } }).catch(() => null)
    ?? (await db.order.findUnique({ where: { merchantTransactionId: id } }).catch(() => null));

  if (!order) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, order });
}
