/**
 * Next.js App Router route handler for NextAuth.
 *
 * Exposes:
 *   GET  /api/auth/signin           — provider chooser
 *   GET  /api/auth/signin/google    — start Google OAuth flow
 *   GET  /api/auth/signin/facebook  — start Facebook OAuth flow
 *   GET  /api/auth/callback/*       — OAuth callback
 *   GET  /api/auth/signout          — sign out
 *   GET  /api/auth/session          — current session JSON
 */

import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
