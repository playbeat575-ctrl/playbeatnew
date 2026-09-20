/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user, or null if signed out.
 * Used by the client to know whether to show the login button or the user menu.
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ ok: true, user: null })
  }
  return NextResponse.json({
    ok: true,
    user: {
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      image: session.user.image ?? null,
      // @ts-expect-error — augmented in auth.ts session callback
      provider: session.user.provider ?? null,
      // @ts-expect-error
      id: session.user.id ?? null,
    },
  })
}
