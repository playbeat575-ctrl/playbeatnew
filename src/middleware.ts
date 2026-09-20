/**
 * Server-side auth gate.
 *
 * PUBLIC pages (no session required, indexable by search engines):
 *   - /                  (storefront)
 *   - /login             (sign-in page)
 *   - /signup            (sign-up page)
 *
 * PROTECTED pages (session required):
 *   - /checkout          (the Rapid checkout form)
 *   - /admin             (admin dashboard — also requires role=admin, enforced in route handlers)
 *
 * PUBLIC API routes:
 *   - /api/auth/*        (NextAuth routes)
 *   - /api/rapid/webhook (HMAC-signed by Rapid)
 *   - /api/rapid/return  (customer redirect from Rapid)
 *   - /api/rapid/config  (public read-only config status)
 *
 * PROTECTED API routes — handlers return 401/403 JSON themselves:
 *   - All other /api/* routes (including /api/admin/*, /api/rapid/orders, etc.)
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
const PUBLIC_PAGE_ROUTES = ["/", "/login", "/signup", "/products", "/cart"]
const PROTECTED_PAGE_ROUTES = ["/checkout", "/admin"]

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

        // 2. Public pages — always allow
        if (PUBLIC_PAGE_ROUTES.includes(path)) return true

        // 2b. Product detail pages (/products/<slug>) are public too.
        if (path.startsWith("/products/")) return true

        // 3. Public API routes — always allow
        if (isPublicApi(path)) return true

        // 4. Other API routes — let the route handler return 401/403 JSON itself.
        //    (We don't redirect API routes because fetch() can't follow redirects
        //    to an HTML login page — it just gets the HTML and breaks.)
        if (path.startsWith("/api/")) return true

        // 5. Protected pages — require session.
        //    Note: paths starting with "/admin/" or "/checkout" (with sub-routes)
        //    also require a session.
        if (path === "/checkout" || path.startsWith("/checkout/") ||
            path === "/admin" || path.startsWith("/admin/")) {
          return Boolean(token)
        }

        // 6. Unknown non-API, non-static path → 404. Let it through so Next.js
        //    renders not-found.tsx (don't redirect to /login — that's confusing).
        return true
      },
    },
  },
)

export const config = {
  // Run middleware on all routes except pure static asset prefixes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
