/**
 * Seed the database with demo products so the storefront isn't empty.
 *
 * Run: bun run scripts/seed-products.ts
 *
 * Idempotent: checks for existing products by slug and skips if present.
 */

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const DEMO_PRODUCTS = [
  {
    slug: "raast-qr-sticker",
    name: "Raast QR Sticker (Premium)",
    description:
      "Premium-quality vinyl sticker with your Raast QR code printed at 600 DPI. Weatherproof, scratch-resistant, ideal for shop counters. Includes free digital preview before printing.",
    priceMinor: 50000, // 500 PKR
    imageUrl: "https://images.unsplash.com/photo-1607386236221-9c5c0d4d8c8c?w=600&q=80",
    category: "Stickers",
    stock: 50,
    featured: true,
  },
  {
    slug: "playbeat-digital-subscription-monthly",
    name: "PlayBeat Digital Subscription — Monthly",
    description:
      "Monthly subscription to PlayBeat Digital. Unlimited access to premium features, priority support, and no transaction fees on the first 100 payments.",
    priceMinor: 150000, // 1,500 PKR
    imageUrl: "https://images.unsplash.com/photo-1556745753-b2904692b88d?w=600&q=80",
    category: "Digital",
    stock: null, // unlimited
    featured: true,
  },
  {
    slug: "premium-rapid-integration-consultation",
    name: "Premium Rapid Integration Consultation (1hr)",
    description:
      "One-hour video consultation with a payment integration expert. We'll review your setup, optimize your webhook handling, and answer any questions about Rapid Gateway.",
    priceMinor: 100000, // 1,000 PKR
    imageUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e39?w=600&q=80",
    category: "Services",
    stock: null, // unlimited
    featured: true,
  },
  {
    slug: "playbeat-branded-tote-bag",
    name: "PlayBeat Branded Tote Bag",
    description:
      "Eco-friendly cotton canvas tote bag with the PlayBeat logo. Perfect for everyday use. Supports up to 10kg. Available in natural beige.",
    priceMinor: 120000, // 1,200 PKR
    imageUrl: "https://images.unsplash.com/photo-1597481499750-3e738e0f4b8b?w=600&q=80",
    category: "Merchandise",
    stock: 25,
    featured: false,
  },
  {
    slug: "raast-payment-setup-service",
    name: "Raast Payment Setup Service",
    description:
      "We'll set up your Raast merchant account, configure your payment gateway, and train your team on accepting Raast payments. Includes 30 days of post-setup support.",
    priceMinor: 250000, // 2,500 PKR
    imageUrl: "https://images.unsplash.com/photo-1563013544-82420f65cd16?w=600&q=80",
    category: "Services",
    stock: 10,
    featured: true,
  },
  {
    slug: "playbeat-coffee-mug",
    name: "PlayBeat Ceramic Coffee Mug",
    description:
      "11oz ceramic mug with the PlayBeat logo. Dishwasher and microwave safe. Perfect for your morning chai or coffee.",
    priceMinor: 80000, // 800 PKR
    imageUrl: "https://images.unsplash.com/photo-1572119865084-43c285814d63?w=600&q=80",
    category: "Merchandise",
    stock: 40,
    featured: false,
  },
  {
    slug: "annual-payment-analytics-report",
    name: "Annual Payment Analytics Report",
    description:
      "Comprehensive annual report of your payment data, including transaction trends, success rates, customer insights, and recommendations for improving your payment flow.",
    priceMinor: 350000, // 3,500 PKR
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80",
    category: "Digital",
    stock: null,
    featured: false,
  },
  {
    slug: "playbeat-tshirt",
    name: "PlayBeat T-Shirt (Unisex)",
    description:
      "Soft cotton blend t-shirt with the PlayBeat logo. Available in black and navy blue, sizes S-XXL. Specify size and color at checkout notes.",
    priceMinor: 180000, // 1,800 PKR
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80",
    category: "Merchandise",
    stock: 30,
    featured: false,
  },
]

async function main() {
  console.log(`Seeding ${DEMO_PRODUCTS.length} demo products...`)

  let created = 0
  let skipped = 0

  for (const p of DEMO_PRODUCTS) {
    const existing = await db.product.findUnique({ where: { slug: p.slug }, select: { id: true } })
    if (existing) {
      console.log(`  SKIP  ${p.slug} (already exists)`)
      skipped += 1
      continue
    }
    await db.product.create({ data: p })
    console.log(`  OK    ${p.slug}  (${p.priceMinor / 100} PKR)`)
    created += 1
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped}.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
