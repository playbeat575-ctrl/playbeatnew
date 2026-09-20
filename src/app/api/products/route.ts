/**
 * GET /api/products
 *
 * Public product listing. Supports:
 *   ?q=<search>      — search name/description (case-insensitive)
 *   ?category=<cat>  — filter by category
 *   ?featured=true   — only featured products
 *   ?limit=<n>       — max results (default 50, max 100)
 *
 * Only returns active=true products.
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get("q")?.trim() || undefined
  const category = url.searchParams.get("category")?.trim() || undefined
  const featured = url.searchParams.get("featured") === "true" ? true : undefined
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100)

  const where = {
    active: true,
    ...(featured !== undefined ? { featured } : {}),
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const products = await db.product.findMany({
    where,
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: limit,
  })

  return NextResponse.json({ ok: true, products })
}
