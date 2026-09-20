/**
 * GET /api/admin/stats
 *
 * Returns aggregate dashboard stats. Admin only.
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

  const [
    totalUsers,
    totalOrders,
    pendingOrders,
    successfulOrders,
    failedOrders,
    refundedOrders,
    revenueAgg,
    recentSignups,
    totalProducts,
    activeProducts,
    lowStockProducts,
  ] = await Promise.all([
    db.user.count(),
    db.order.count(),
    db.order.count({ where: { status: "PENDING" } }),
    db.order.count({ where: { status: "SUCCESS" } }),
    db.order.count({ where: { status: "FAILED" } }),
    db.order.count({ where: { status: "REFUNDED" } }),
    // Revenue = sum of amountMinor for SUCCESS orders
    db.order.aggregate({
      where: { status: "SUCCESS" },
      _sum: { amountMinor: true },
    }),
    db.user.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
    db.product.count(),
    db.product.count({ where: { active: true } }),
    // Products with stock < 5 (excluding unlimited/null stock)
    db.product.count({
      where: { active: true, stock: { not: null, lt: 5 } },
    }),
  ])

  return NextResponse.json({
    ok: true,
    stats: {
      totalUsers,
      totalOrders,
      pendingOrders,
      successfulOrders,
      failedOrders,
      refundedOrders,
      revenueMinor: revenueAgg._sum.amountMinor ?? 0,
      recentSignups,
      totalProducts,
      activeProducts,
      lowStockProducts,
    },
  })
}
