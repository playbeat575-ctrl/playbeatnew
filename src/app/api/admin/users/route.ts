/**
 * GET /api/admin/users
 *
 * Returns ALL users. Admin only.
 * PATCH /api/admin/users — promote/demote a user (body: { userId, role }).
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

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      provider: true,
      role: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  })
  return NextResponse.json({ ok: true, users })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  // @ts-expect-error — role is augmented in auth.ts
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  let body: { userId?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.userId || !body.role) {
    return NextResponse.json({ ok: false, error: "userId and role required" }, { status: 400 })
  }
  if (!["user", "admin"].includes(body.role)) {
    return NextResponse.json({ ok: false, error: "role must be 'user' or 'admin'" }, { status: 400 })
  }

  // Prevent self-demotion (an admin shouldn't be able to lock themselves out)
  // @ts-expect-error
  if (body.userId === session.user.id && body.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "You cannot demote yourself. Ask another admin." },
      { status: 400 },
    )
  }

  const updated = await db.user.update({
    where: { id: body.userId },
    data: { role: body.role },
    select: { id: true, role: true },
  })

  return NextResponse.json({ ok: true, user: updated })
}
