/**
 * GET /api/admin/orders
 *
 * Returns ALL orders (newest first). Admin only.
 * Unlike /api/rapid/orders (which filters by userId), this returns every order.
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  // @ts-expect-error — role is augmented in auth.ts
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      webhookEvents: { take: 3, orderBy: { processedAt: "desc" } },
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  })
  return NextResponse.json({ ok: true, orders })
}
