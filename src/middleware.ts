/**
 * Server-side auth gate.
 *
 * PUBLIC paths (no session required):
 *   - /login
 *   - /api/auth/*          (NextAuth routes — must be public)
 *   - /api/rapid/webhook   (Rapid signs its own requests — auth via HMAC, not session)
 *   - /api/rapid/return    (customer redirect URL from Rapid — no session)
 *   - /api/rapid/config    (public read-only config status)
 *   - /_next/*, /favicon.ico, /logo.svg, /robots.txt  (static assets)
 *
 * PROTECTED paths (require session):
 *   - All other /api/* routes → return 401 JSON (NOT a redirect, so fetch() can handle it)
 *   - All other pages → redirect to /login?callbackUrl=<original path + query>
 *
 * 404 (unknown routes) → NOT redirected; Next.js renders its default 404 page.
 */

import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

const STATIC_ASSETS = [
  "/_next/",
  "/favicon.ico",
  "/logo.svg",
  "/robots.txt",
  "/sitemap.xml",
]

const PUBLIC_API_PATHS = [
  "/api/auth/",
  "/api/rapid/webhook",
  "/api/rapid/return",
  "/api/rapid/config",
]

function isStaticAsset(path: string): boolean {
  return STATIC_ASSETS.some((p) => path === p || path.startsWith(p))
}

function isPublicApi(path: string): boolean {
  return PUBLIC_API_PATHS.some((p) => path === p || path.startsWith(p))
}

export default withAuth(
  function _middleware(req) {
    return NextResponse.next()
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname

        // 1. Static assets — always allow
        if (isStaticAsset(path)) return true

        // 2. /login page itself — always allow (so user can sign in)
        if (path === "/login") return true

        // 3. Public API routes (NextAuth + Rapid webhook/return/config) — always allow
        if (isPublicApi(path)) return true

        // 4. Other API routes — if no session, the route handler will return 401 JSON.
        //    We allow the request through so the handler can respond cleanly (not a redirect).
        //    Returning false here would cause a redirect to /login which is wrong for fetch().
        if (path.startsWith("/api/")) return true

        // 5. All other routes (pages) — require session.
        //    If unauthorized, withAuth will redirect to /login?callbackUrl=<original>
        return Boolean(token)
      },
    },
  },
)

export const config = {
  // Run middleware on all routes except pure static asset prefixes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
