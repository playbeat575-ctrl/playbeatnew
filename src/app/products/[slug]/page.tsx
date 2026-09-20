/**
 * Public product detail page.
 *
 * Server-rendered (no auth). Shows product image, name, price, description.
 * The "Add to cart" and "Buy now" buttons are client components (see
 * ProductActions below) because they need access to localStorage.
 */

import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Package, Shield, CreditCard } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { db } from "@/lib/db"
import { formatPkr } from "@/lib/rapid/money"
import { ProductActions } from "./product-actions"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await db.product.findUnique({ where: { slug } })
  if (!product || !product.active) {
    return { title: "Product not found — PlayBeat" }
  }
  return {
    title: `${product.name} — PlayBeat`,
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      images: product.imageUrl ? [{ url: product.imageUrl }] : undefined,
    },
    alternates: { canonical: `https://playbeat.digital/products/${product.slug}` },
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await db.product.findUnique({ where: { slug } })

  if (!product || !product.active) {
    notFound()
  }

  const outOfStock = product.stock !== null && product.stock <= 0

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-[#007cdc] text-white grid place-items-center font-bold text-sm">RG</div>
            <h1 className="text-base font-semibold">PlayBeat</h1>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/products"><Button variant="ghost" size="sm" className="text-sm">Products</Button></Link>
            <Link href="/cart"><Button variant="ghost" size="sm" className="text-sm">Cart</Button></Link>
            <Link href="/login"><Button variant="ghost" size="sm" className="text-sm">Sign in</Button></Link>
            <Link href="/signup"><Button size="sm" className="bg-[#007cdc] hover:bg-[#0068b8] text-sm">Sign up</Button></Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <Link href="/products" className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to products
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Image */}
          <div className="aspect-square bg-white border rounded-lg overflow-hidden">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-slate-300">
                <Package className="h-24 w-24" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-4">
            {product.category && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {product.category}
              </Badge>
            )}
            <h2 className="text-2xl md:text-3xl font-bold">{product.name}</h2>
            <div className="text-3xl font-bold text-[#007cdc]">{formatPkr(product.priceMinor, product.currency)}</div>

            {outOfStock ? (
              <Badge variant="destructive" className="text-xs">Out of stock</Badge>
            ) : product.stock !== null && product.stock < 10 ? (
              <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                Only {product.stock} left
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300 bg-emerald-50">
                In stock
              </Badge>
            )}

            <div className="prose prose-sm max-w-none text-slate-700">
              <p className="whitespace-pre-line">{product.description}</p>
            </div>

            {/* Actions (client component — needs localStorage) */}
            <ProductActions
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                priceMinor: product.priceMinor,
                imageUrl: product.imageUrl,
                outOfStock,
              }}
            />

            {/* Trust badges */}
            <div className="pt-4 border-t space-y-2 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-[#007cdc]" />
                PCI-DSS hosted checkout — your card data never touches our servers.
              </div>
              <div className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-[#007cdc]" />
                Pay with cards, Raast, JazzCash, easypaisa, or bank transfer.
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} PlayBeat · Powered by Rapid Gateway
        </div>
      </footer>
    </div>
  )
}
