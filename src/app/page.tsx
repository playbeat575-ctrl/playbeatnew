/**
 * Public storefront homepage.
 *
 * Server-rendered (no auth) for SEO + fast first paint.
 * Shows featured products from the DB. If no products exist yet, shows a
 * friendly "coming soon" state with a link to /products.
 */

import Link from "next/link"
import { ArrowRight, Shield, Zap, Wallet, Banknote, CreditCard, Package } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { db } from "@/lib/db"
import { formatPkr } from "@/lib/rapid/money"

export const metadata = {
  title: "PlayBeat — Accept Payments in Pakistan with Rapid Gateway",
  description:
    "Shop and pay with cards, Raast, JazzCash, easypaisa, and bank transfers through one checkout. PCI-DSS ready, SBP compliant. Sign in with Google or Facebook to start.",
  keywords: [
    "payment gateway Pakistan",
    "Rapid Gateway",
    "accept payments online",
    "Raast integration",
    "JazzCash",
    "easypaisa",
    "PlayBeat",
  ],
  openGraph: {
    title: "PlayBeat — Accept Payments in Pakistan",
    description: "Cards, Raast, JazzCash, easypaisa, and bank transfers through one checkout.",
    url: "https://playbeat.digital",
    siteName: "PlayBeat",
    type: "website",
  },
  alternates: { canonical: "https://playbeat.digital" },
}

const PAYMENT_METHODS = [
  { icon: CreditCard, name: "Cards", desc: "Visa, Mastercard & UnionPay." },
  { icon: Zap, name: "Raast", desc: "Pakistan's instant payment rail by SBP." },
  { icon: Wallet, name: "Wallets", desc: "JazzCash, easypaisa, SadaPay, NayaPay." },
  { icon: Banknote, name: "Bank", desc: "Direct transfers from major Pakistani banks." },
]

export const dynamic = "force-dynamic"

export default async function StorefrontPage() {
  // Fetch featured products + count of total products for the catalog link.
  const [featuredProducts, totalProducts] = await Promise.all([
    db.product.findMany({
      where: { active: true, featured: true },
      orderBy: [{ createdAt: "desc" }],
      take: 8,
    }),
    db.product.count({ where: { active: true } }),
  ])

  // If no featured products, fall back to the most recent products.
  const products =
    featuredProducts.length > 0
      ? featuredProducts
      : await db.product.findMany({
          where: { active: true },
          orderBy: [{ createdAt: "desc" }],
          take: 8,
        })

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-[#007cdc] text-white grid place-items-center font-bold text-sm">RG</div>
            <div>
              <h1 className="text-base font-semibold leading-tight">PlayBeat</h1>
              <p className="text-xs text-slate-500 leading-tight">Powered by Rapid Gateway</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/products">
              <Button variant="ghost" size="sm" className="text-sm">Products</Button>
            </Link>
            <Link href="/cart">
              <Button variant="ghost" size="sm" className="text-sm">Cart</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-[#007cdc] hover:bg-[#0068b8] text-sm">
                Get started
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-gradient-to-br from-white via-slate-50 to-blue-50/40">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-20 text-center">
          <Badge variant="outline" className="mb-4 bg-white/70 backdrop-blur">
            <Shield className="h-3 w-3 mr-1.5 text-[#007cdc]" />
            PCI-DSS ready · SBP compliant
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 max-w-3xl mx-auto">
            Shop and pay in Pakistan.
            <br />
            <span className="text-[#007cdc]">One checkout. Every method.</span>
          </h2>
          <p className="mt-5 text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
            Cards, Raast, JazzCash, easypaisa, and bank transfers — through a single hosted checkout.
            Browse our catalog below, add to cart, and pay with your preferred method.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/products">
              <Button size="lg" className="bg-[#007cdc] hover:bg-[#0068b8] w-full sm:w-auto h-12 px-8">
                Browse products
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8">
                Create your account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Payment methods */}
      <section className="py-12 bg-white border-b">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {PAYMENT_METHODS.map((m) => (
              <div key={m.name} className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-md bg-[#007cdc]/10 text-[#007cdc] grid place-items-center shrink-0">
                  <m.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{m.name}</div>
                  <div className="text-xs text-slate-500">{m.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="py-12 flex-1">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h3 className="text-xl md:text-2xl font-bold">
                {featuredProducts.length > 0 ? "Featured products" : "Recent products"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {totalProducts > 0 ? `${totalProducts} product${totalProducts === 1 ? "" : "s"} available` : "No products yet — check back soon."}
              </p>
            </div>
            {totalProducts > 0 && (
              <Link href="/products" className="text-sm text-[#007cdc] hover:underline inline-flex items-center gap-1">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {products.length === 0 ? (
            <Card className="border-dashed bg-white">
              <CardContent className="py-12 text-center text-slate-500">
                <Package className="h-10 w-10 mx-auto mb-3 text-slate-400" />
                <p className="text-sm">No products yet. An admin can add products at <Link href="/admin/products" className="text-[#007cdc] hover:underline">/admin/products</Link>.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => (
                <Link key={p.id} href={`/products/${p.slug}`} className="group">
                  <Card className="overflow-hidden hover:shadow-md transition-shadow h-full">
                    <div className="aspect-square bg-slate-100 overflow-hidden">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-slate-300">
                          <Package className="h-12 w-12" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      {p.category && (
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{p.category}</div>
                      )}
                      <div className="font-medium text-sm line-clamp-2 group-hover:text-[#007cdc]">{p.name}</div>
                      <div className="mt-1.5 font-bold text-sm text-slate-900">{formatPkr(p.priceMinor, p.currency)}</div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[#007cdc] text-white grid place-items-center font-bold text-[10px]">RG</div>
            <span>© {new Date().getFullYear()} PlayBeat. Powered by Rapid Gateway.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/products" className="hover:text-slate-900">Products</Link>
            <Link href="/cart" className="hover:text-slate-900">Cart</Link>
            <Link href="/login" className="hover:text-slate-900">Sign in</Link>
            <Link href="/signup" className="hover:text-slate-900">Sign up</Link>
            <a href="https://rapidgateway.pk" target="_blank" rel="noreferrer" className="hover:text-slate-900">Rapid ↗</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
