/**
 * Public product catalog page.
 *
 * Server-rendered (no auth). Shows all active products with optional
 * search + category filter via query string.
 */

import Link from "next/link"
import { Package, Search, ArrowLeft } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { formatPkr } from "@/lib/rapid/money"

export const metadata = {
  title: "Products — PlayBeat",
  description: "Browse our full catalog. Pay with cards, Raast, JazzCash, easypaisa, or bank transfer.",
}

export const dynamic = "force-dynamic"

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>
}) {
  const sp = await searchParams
  const q = sp.q?.trim() || undefined
  const category = sp.category?.trim() || undefined

  const where = {
    active: true,
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [products, categories] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    db.product.findMany({
      where: { active: true, category: { not: null } },
      distinct: ["category"],
      select: { category: true },
    }),
  ])

  const categoryList = categories
    .map((c) => c.category)
    .filter((c): c is string => Boolean(c))

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
            <Link href="/cart"><Button variant="ghost" size="sm" className="text-sm">Cart</Button></Link>
            <Link href="/login"><Button variant="ghost" size="sm" className="text-sm">Sign in</Button></Link>
            <Link href="/signup"><Button size="sm" className="bg-[#007cdc] hover:bg-[#0068b8] text-sm">Sign up</Button></Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {/* Title + back link */}
        <div className="mb-6">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="h-3 w-3" /> Back to home
          </Link>
          <h2 className="text-2xl md:text-3xl font-bold">Products</h2>
          <p className="text-sm text-slate-600 mt-1">
            {products.length} product{products.length === 1 ? "" : "s"}
            {q && ` matching "${q}"`}
            {category && ` in ${category}`}
          </p>
        </div>

        {/* Search + category filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <form className="flex-1" action="/products" method="GET">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search products..."
                className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#007cdc]"
              />
            </div>
            {category && <input type="hidden" name="category" value={category} />}
          </form>
          {categoryList.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <Link href="/products">
                <Badge variant={category ? "outline" : "default"} className="cursor-pointer whitespace-nowrap">
                  All
                </Badge>
              </Link>
              {categoryList.map((c) => (
                <Link key={c} href={`/products?category=${encodeURIComponent(c)}`}>
                  <Badge variant={category === c ? "default" : "outline"} className="cursor-pointer whitespace-nowrap">
                    {c}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Products grid */}
        {products.length === 0 ? (
          <Card className="border-dashed bg-white">
            <CardContent className="py-16 text-center text-slate-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-slate-400" />
              <p className="text-sm">
                {q || category
                  ? "No products match your filters. Try clearing them."
                  : "No products yet. Check back soon."}
              </p>
              {(q || category) && (
                <Link href="/products" className="inline-block mt-3 text-sm text-[#007cdc] hover:underline">
                  Clear filters
                </Link>
              )}
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
                    {p.featured && (
                      <Badge variant="secondary" className="text-[10px] mt-1.5">Featured</Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} PlayBeat · Powered by Rapid Gateway
        </div>
      </footer>
    </div>
  )
}
