/**
 * Server-side auth gate.
 *
 * Redirects unauthenticated users to /login for any path EXCEPT:
 *   - /login
 *   - /api/auth/*          (NextAuth routes — must be public)
 *   - /api/rapid/webhook   (Rapid signs its own requests — auth via HMAC, not session)
 *   - /api/rapid/return    (customer redirect URL from Rapid — no session)
 *   - /api/rapid/config    (public read-only config status)
 *   - /_next/*, /favicon.ico, /logo.svg, /robots.txt  (static assets)
 *
 * All other API routes (e.g. /api/rapid/create-session, /api/rapid/orders)
 * require a session cookie. They ALSO re-check inside the handler in case
 * middleware is bypassed.
 */

import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function _middleware(_req) {
    // If we get here, the user has a valid session cookie.
    return NextResponse.next()
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      // Return true to ALLOW the request through (no redirect to login).
      // Return false to redirect to /login.
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname

        // Public paths — always allow
        if (path === "/login") return true
        if (path.startsWith("/api/auth/")) return true
        if (path === "/api/rapid/webhook") return true
        if (path === "/api/rapid/return") return true
        if (path === "/api/rapid/config") return true
        if (path.startsWith("/_next/")) return true
        if (path === "/favicon.ico" || path === "/logo.svg" || path === "/robots.txt") return true

        // Everything else requires a session token.
        return Boolean(token)
      },
    },
  },
)

export const config = {
  // Run middleware on all routes except static asset prefixes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
