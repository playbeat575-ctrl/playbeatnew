/**
 * /api/admin/products
 *
 * GET    — list ALL products (including inactive). Admin only.
 * POST   — create a new product. Admin only.
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

/** Generate a URL-safe slug from a name. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!requireAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }
  const products = await db.product.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  })
  return NextResponse.json({ ok: true, products })
}

interface CreateProductBody {
  name?: string
  description?: string
  price?: number
  currency?: string
  imageUrl?: string
  category?: string
  stock?: number | null
  active?: boolean
  featured?: boolean
  slug?: string
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!requireAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  let body: CreateProductBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  // Validate required fields
  if (!body.name?.trim()) {
    return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 })
  }
  if (!body.description?.trim()) {
    return NextResponse.json({ ok: false, error: "description is required" }, { status: 400 })
  }
  const price = Number(body.price)
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ ok: false, error: "price must be a positive number" }, { status: 400 })
  }
  if (price > 1_000_000) {
    return NextResponse.json({ ok: false, error: "price exceeds 1,000,000 limit" }, { status: 400 })
  }

  // Generate slug, ensure uniqueness
  const baseSlug = slugify(body.slug || body.name)
  if (!baseSlug) {
    return NextResponse.json({ ok: false, error: "Could not generate a valid slug" }, { status: 400 })
  }
  let slug = baseSlug
  let suffix = 1
  while (await db.product.findUnique({ where: { slug }, select: { id: true } })) {
    suffix += 1
    slug = `${baseSlug}-${suffix}`
  }

  const product = await db.product.create({
    data: {
      slug,
      name: body.name.trim(),
      description: body.description.trim(),
      priceMinor: Math.round(price * 100),
      currency: (body.currency ?? "PKR").toUpperCase(),
      imageUrl: body.imageUrl?.trim() || null,
      category: body.category?.trim() || null,
      stock: body.stock === null || body.stock === undefined ? null : Math.max(0, Math.floor(body.stock)),
      active: body.active ?? true,
      featured: body.featured ?? false,
    },
  })

  return NextResponse.json({ ok: true, product }, { status: 201 })
}
