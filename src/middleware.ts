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
 * 404 (unknown routes): middleware allows them through; Next.js renders not-found.tsx.
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

// Known page routes that EXIST in the app. Anything NOT in this list and NOT
// a public/api/static path is treated as a 404 → middleware lets it through
// so Next.js can render not-found.tsx instead of redirecting to /login.
const KNOWN_PAGE_ROUTES = ["/", "/login"]

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

        // 4. Other API routes — let the route handler return 401 JSON itself.
        //    (We don't redirect API routes because fetch() can't follow redirects
        //    to an HTML login page — it just gets the HTML and breaks.)
        if (path.startsWith("/api/")) return true

        // 5. Unknown non-API, non-static path → 404. Let it through so Next.js
        //    renders not-found.tsx (don't redirect to /login — that's confusing).
        if (!KNOWN_PAGE_ROUTES.includes(path)) return true

        // 6. Known page routes (just "/") — require session.
        return Boolean(token)
      },
    },
  },
)

export const config = {
  // Run middleware on all routes except pure static asset prefixes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}

