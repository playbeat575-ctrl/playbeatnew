/**
 * GET /api/products/[slug]
 *
 * Public product detail. Returns 404 if product doesn't exist or is inactive.
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params
  const product = await db.product.findUnique({ where: { slug } })

  if (!product || !product.active) {
    return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, product })
}
