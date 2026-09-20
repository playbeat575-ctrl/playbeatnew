/**
 * POST /api/rapid/create-session
 *
 * Two modes:
 *
 * 1. CART CHECKOUT (preferred):
 *    Body: { items: [{ productId, quantity }], name?, phone? }
 *    Server validates each item against DB, computes the real total,
 *    creates an Order with OrderItem rows (snapshots of name+price),
 *    then calls Rapid with that total.
 *
 * 2. MANUAL AMOUNT (legacy / "pay what you want" / invoice style):
 *    Body: { amount: number, email, name?, phone?, description? }
 *    Used when there's no cart — e.g. a custom invoice or donation.
 *
 * Both modes require an authenticated session.
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { rapidConfig, rapidOutboundReady, assertRapidConfigured } from "@/lib/rapid/config"
import { createHostedCheckout } from "@/lib/rapid/client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface CartItemInput {
  productId: string
  quantity: number
}

interface CreateSessionBody {
  // Cart mode
  items?: CartItemInput[]
  // Manual mode
  amount?: number
  email?: string
  name?: string
  phone?: string
  description?: string
  // Common
  currency?: string
}

export async function POST(req: Request) {
  // Require an authenticated session — no anonymous checkouts.
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json(
      { ok: false, error: "You must be signed in to create a checkout session." },
      { status: 401 },
    )
  }

  if (!rapidOutboundReady()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Rapid Gateway is not configured. Set RAPID_GATEWAY_MERCHANT_ID and RAPID_GATEWAY_API_KEY in .env",
      },
      { status: 503 },
    )
  }
  assertRapidConfigured()

  let body: CreateSessionBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  // Resolve the authenticated user row so we can link the order to them.
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true },
  })

  const currency = (body.currency ?? "PKR").toUpperCase()
  const customerEmail = (body.email ?? user?.email ?? "").trim().toLowerCase()
  const customerName = (body.name ?? user?.name ?? "").trim() || null
  const customerPhone = body.phone?.trim() || null

  if (!customerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) {
    return NextResponse.json({ ok: false, error: "email is required and must be valid" }, { status: 400 })
  }

  // ─── Resolve amount + items ────────────────────────────────────────────
  let amountMinor: number
  let orderItems: {
    productId: string | null
    name: string
    priceMinor: number
    quantity: number
    imageUrl: string | null
  }[] = []
  let description: string | null = null

  if (Array.isArray(body.items) && body.items.length > 0) {
    // ─── CART MODE ───────────────────────────────────────────────────────
    if (body.items.length > 50) {
      return NextResponse.json({ ok: false, error: "Too many cart items (max 50)" }, { status: 400 })
    }

    // Normalize + deduplicate quantities.
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

    // Fetch products from DB — server is the source of truth for prices.
    const products = await db.product.findMany({
      where: { id: { in: Array.from(qtyByProductId.keys()) } },
      select: { id: true, name: true, priceMinor: true, imageUrl: true, active: true, stock: true },
    })

    let total = 0
    const droppedProductNames: string[] = []
    for (const p of products) {
      const quantity = qtyByProductId.get(p.id) ?? 0
      if (!p.active) {
        droppedProductNames.push(p.name)
        continue
      }
      // Stock check (null stock = unlimited)
      if (p.stock !== null && p.stock < quantity) {
        return NextResponse.json(
          { ok: false, error: `Insufficient stock for "${p.name}" (available: ${p.stock})` },
          { status: 400 },
        )
      }
      const lineTotal = p.priceMinor * quantity
      total += lineTotal
      orderItems.push({
        productId: p.id,
        name: p.name,
        priceMinor: p.priceMinor,
        quantity,
        imageUrl: p.imageUrl,
      })
    }

    if (orderItems.length === 0) {
      return NextResponse.json(
        { ok: false, error: "All items in your cart are no longer available.", droppedProductNames },
        { status: 400 },
      )
    }

    if (total <= 0) {
      return NextResponse.json({ ok: false, error: "Cart total must be greater than 0" }, { status: 400 })
    }
    if (total > 100_000_000) {
      // 1,000,000 PKR cap in paisa
      return NextResponse.json({ ok: false, error: "Cart total exceeds 1,000,000 PKR limit" }, { status: 400 })
    }

    amountMinor = total
    // Build a human-readable description for the Rapid portal.
    const summary = orderItems
      .map((i) => `${i.quantity}× ${i.name}`)
      .join(", ")
      .slice(0, 200)
    description = `Order: ${summary}`
  } else {
    // ─── MANUAL MODE ─────────────────────────────────────────────────────
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "amount must be a positive number" }, { status: 400 })
    }
    if (amount > 1_000_000) {
      return NextResponse.json({ ok: false, error: "amount exceeds 1,000,000 PKR limit" }, { status: 400 })
    }
    amountMinor = Math.round(amount * 100)
    description = body.description?.trim() || null
  }

  // ─── Create the order ──────────────────────────────────────────────────
  const order = await db.order.create({
    data: {
      merchantTransactionId: "", // placeholder, set below
      amountMinor,
      currency,
      customerEmail,
      customerName,
      customerPhone,
      description,
      status: "PENDING",
      environment: rapidConfig.environment.toUpperCase(),
      userId: user?.id ?? null,
      // Create OrderItem rows atomically with the order (snapshot of name+price).
      items: orderItems.length > 0
        ? { create: orderItems }
        : undefined,
    },
    include: { items: true },
  })

  // Use a short, readable merchantTransactionId (Rapid limits length — keep <= 40 chars).
  const mRef = `ORDER-${order.id.slice(-12).toUpperCase()}`
  await db.order.update({ where: { id: order.id }, data: { merchantTransactionId: mRef } })

  // ─── Call Rapid ────────────────────────────────────────────────────────
  try {
    const checkout = await createHostedCheckout({
      merchantTransactionId: mRef,
      amount: amountMinor / 100, // Rapid expects decimal currency
      currency,
      customerEmail,
      customerName: customerName ?? undefined,
      customerPhone: customerPhone ?? undefined,
      description: description ?? undefined,
    })

    if (!checkout.checkoutUrl) {
      await db.order.update({ where: { id: order.id }, data: { status: "FAILED" } })
      return NextResponse.json(
        {
          ok: false,
          error: "Rapid did not return a checkoutUrl. Check server logs — the response shape may differ.",
          orderId: order.id,
          raw: checkout.raw,
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      merchantTransactionId: mRef,
      checkoutUrl: checkout.checkoutUrl,
    })
  } catch (err) {
    console.error("[rapid/create-session] error", err)
    await db.order.update({ where: { id: order.id }, data: { status: "FAILED" } })
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error calling Rapid",
        orderId: order.id,
      },
      { status: 502 },
    )
  }
}
