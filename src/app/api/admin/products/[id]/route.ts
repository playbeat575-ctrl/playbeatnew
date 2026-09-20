/**
 * /api/admin/products/[id]
 *
 * GET    — fetch a single product by id (admin only, includes inactive)
 * PATCH  — update a product (admin only)
 * DELETE — soft-delete a product (sets active=false; preserves order history)
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function requireAdmin(session: any): boolean {
  return Boolean(session?.user && (session.user as any).role === "admin")
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!requireAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }
  const { id } = await ctx.params
  const product = await db.product.findUnique({ where: { id } })
  if (!product) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, product })
}

interface UpdateBody {
  name?: string
  description?: string
  price?: number
  currency?: string
  imageUrl?: string | null
  category?: string | null
  stock?: number | null
  active?: boolean
  featured?: boolean
  slug?: string
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!requireAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }
  const { id } = await ctx.params

  let body: UpdateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  // Build the update payload, validating as we go.
  const data: Record<string, unknown> = {}

  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ ok: false, error: "name cannot be empty" }, { status: 400 })
    data.name = body.name.trim()
  }
  if (body.description !== undefined) {
    if (!body.description.trim()) return NextResponse.json({ ok: false, error: "description cannot be empty" }, { status: 400 })
    data.description = body.description.trim()
  }
  if (body.price !== undefined) {
    const p = Number(body.price)
    if (!Number.isFinite(p) || p <= 0) return NextResponse.json({ ok: false, error: "price must be positive" }, { status: 400 })
    if (p > 1_000_000) return NextResponse.json({ ok: false, error: "price exceeds 1,000,000 limit" }, { status: 400 })
    data.priceMinor = Math.round(p * 100)
  }
  if (body.currency !== undefined) data.currency = body.currency.toUpperCase()
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl?.trim() || null
  if (body.category !== undefined) data.category = body.category?.trim() || null
  if (body.stock !== undefined) {
    data.stock = body.stock === null ? null : Math.max(0, Math.floor(body.stock))
  }
  if (body.active !== undefined) data.active = Boolean(body.active)
  if (body.featured !== undefined) data.featured = Boolean(body.featured)
  if (body.slug !== undefined) {
    const newSlug = slugify(body.slug)
    if (!newSlug) return NextResponse.json({ ok: false, error: "invalid slug" }, { status: 400 })
    // Check uniqueness (excluding the current product)
    const existing = await db.product.findUnique({ where: { slug: newSlug }, select: { id: true } })
    if (existing && existing.id !== id) {
      return NextResponse.json({ ok: false, error: "slug already in use" }, { status: 409 })
    }
    data.slug = newSlug
  }

  const updated = await db.product.update({ where: { id }, data })
  return NextResponse.json({ ok: true, product: updated })
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!requireAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }
  const { id } = await ctx.params

  // Soft-delete: set active=false. This preserves order history (OrderItem.productId
  // is a nullable FK with onDelete: SetNull, so historical orders keep their snapshots).
  const updated = await db.product.update({
    where: { id },
    data: { active: false, featured: false },
  })
  return NextResponse.json({ ok: true, product: updated })
}
