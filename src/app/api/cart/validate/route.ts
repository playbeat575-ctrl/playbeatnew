/**
 * POST /api/cart/validate
 *
 * Given a client-side cart (array of { productId, quantity }), validates each
 * item against the DB and returns the REAL cart with current prices + names +
 * image URLs + active status. The server's response is the source of truth
 * for the total — never trust client-side prices.
 *
 * Used at checkout time to compute the actual amount to charge.
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface ValidateBody {
  items?: { productId: string; quantity: number }[]
}

export async function POST(req: Request) {
  let body: ValidateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ ok: false, error: "items must be an array" }, { status: 400 })
  }

  // Cap the number of distinct line items to prevent abuse.
  if (body.items.length > 50) {
    return NextResponse.json({ ok: false, error: "Too many cart items (max 50)" }, { status: 400 })
  }

  // Normalize quantities and deduplicate by productId.
  const qtyByProductId = new Map<string, number>()
  for (const item of body.items) {
    if (typeof item.productId !== "string" || typeof item.quantity !== "number") continue
    const qty = Math.max(0, Math.min(99, Math.floor(item.quantity)))
    if (qty <= 0) continue
    qtyByProductId.set(item.productId, (qtyByProductId.get(item.productId) ?? 0) + qty)
  }

  if (qtyByProductId.size === 0) {
    return NextResponse.json({ ok: false, error: "Cart is empty" }, { status: 400 })
  }

  // Fetch all referenced products in one query.
  const products = await db.product.findMany({
    where: { id: { in: Array.from(qtyByProductId.keys()) } },
    select: {
      id: true, slug: true, name: true, priceMinor: true,
      currency: true, imageUrl: true, active: true, stock: true,
    },
  })

  const validatedItems = products.map((p) => {
    const quantity = qtyByProductId.get(p.id) ?? 0
    const inStock = p.stock === null ? true : p.stock >= quantity
    return {
      productId: p.id,
      slug: p.slug,
      name: p.name,
      priceMinor: p.priceMinor,
      currency: p.currency,
      imageUrl: p.imageUrl,
      quantity,
      active: p.active,
      inStock,
      lineTotalMinor: p.priceMinor * quantity,
    }
  })

  // Filter out inactive products (admin may have soft-deleted since add-to-cart).
  const availableItems = validatedItems.filter((x) => x.active && x.inStock)

  // Compute total in paisa (integer — no float drift).
  const totalMinor = availableItems.reduce((sum, x) => sum + x.lineTotalMinor, 0)

  // Find items that were dropped (so the client can warn the user).
  const droppedItems = validatedItems.filter((x) => !x.active || !x.inStock)

  return NextResponse.json({
    ok: true,
    items: availableItems,
    droppedItems,
    totalMinor,
    currency: "PKR",
  })
}
