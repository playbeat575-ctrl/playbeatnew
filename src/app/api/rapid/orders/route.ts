/**
 * GET /api/rapid/orders
 *
 * Returns the most recent orders (newest first), capped at 50 rows.
 * Requires an authenticated session — users only see orders they created.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Resolve the user so we can filter orders by userId.
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  const orders = await db.order.findMany({
    where: user ? { userId: user.id } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      webhookEvents: { take: 5, orderBy: { processedAt: "desc" } },
      items: true, // include OrderItem snapshots so user sees what they bought
    },
  });
  return NextResponse.json({ ok: true, orders });
}
