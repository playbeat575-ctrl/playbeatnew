/**
 * Dynamic robots.txt generator.
 *
 * Allows indexing of public pages (/, /login, /signup).
 * Disallows protected pages (/checkout, /admin) and all API routes.
 */

import type { MetadataRoute } from "next"

const BASE_URL = process.env.RAPID_GATEWAY_APP_BASE_URL ?? "https://playbeat.digital"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup"],
        disallow: ["/checkout", "/admin", "/api/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
