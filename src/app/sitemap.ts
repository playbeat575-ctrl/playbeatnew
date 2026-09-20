/**
 * Dynamic sitemap.xml generator.
 *
 * Serves a sitemap listing all public, indexable pages on the site.
 * Protected pages (/checkout, /admin) are NOT included.
 */

import type { MetadataRoute } from "next"

const BASE_URL = process.env.RAPID_GATEWAY_APP_BASE_URL ?? "https://playbeat.digital"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/signup`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ]
}
