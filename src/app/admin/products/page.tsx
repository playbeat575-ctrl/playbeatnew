'use client'

/**
 * Admin product management page.
 *
 * List all products (including inactive) with the ability to:
 *   - Create new product (modal form)
 *   - Edit existing product (inline edit or modal)
 *   - Soft-delete (set active=false)
 *   - Toggle featured
 *
 * Requires admin role (enforced server-side in /api/admin/products).
 */

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Loader2, RefreshCw, Plus, Pencil, Trash2, Star, Package, ArrowLeft,
  LogOut, ShieldCheck, X, Save,
} from "lucide-react"
import { toast } from "sonner"
import { signOut } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { AuthGate, type AuthUser } from "@/components/auth-gate"

interface Product {
  id: string
  slug: string
  name: string
  description: string
  priceMinor: number
  currency: string
  imageUrl: string | null
  category: string | null
  stock: number | null
  active: boolean
  featured: boolean
  createdAt: string
}

function formatPkr(minor: number, currency = "PKR") {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency, minimumFractionDigits: 2 }).format(minor / 100)
}

function AdminProducts({ user }: { user: AuthUser }) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/products", { cache: "no-store" })
      if (res.status === 403) {
        setForbidden(true)
        return
      }
      const j = await res.json()
      setProducts(j.products ?? [])
    } catch (e) {
      console.error(e)
      toast.error("Failed to load products")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleToggleFeatured(p: Product) {
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: !p.featured }),
    })
    const j = await res.json()
    if (!j.ok) {
      toast.error(j.error ?? "Failed to update")
      return
    }
    toast.success(`${p.name} ${!p.featured ? "is now featured" : "is no longer featured"}`)
    refresh()
  }

  async function handleToggleActive(p: Product) {
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    })
    const j = await res.json()
    if (!j.ok) {
      toast.error(j.error ?? "Failed to update")
      return
    }
    toast.success(`${p.name} ${!p.active ? "activated" : "deactivated"}`)
    refresh()
  }

  async function handleDelete(p: Product) {
    if (!confirm(`Deactivate "${p.name}"? It will be hidden from the storefront but order history is preserved.`)) return
    const res = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" })
    const j = await res.json()
    if (!j.ok) {
      toast.error(j.error ?? "Failed to delete")
      return
    }
    toast.success(`${p.name} deactivated`)
    refresh()
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <Card className="max-w-md mx-4 text-center">
          <CardHeader>
            <ShieldCheck className="h-10 w-10 text-rose-500 mx-auto mb-2" />
            <CardTitle>Admin access required</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Sonner />

      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-[#007cdc] text-white grid place-items-center font-bold text-xs">RG</div>
            <div>
              <h1 className="text-sm font-semibold leading-tight flex items-center gap-1.5">
                Products <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight">{user.email}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/admin"><Button variant="ghost" size="sm" className="text-xs">Dashboard</Button></Link>
            <Link href="/"><Button variant="ghost" size="sm" className="text-xs">Storefront</Button></Link>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })} className="text-xs">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link href="/admin" className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="h-3 w-3" /> Back to dashboard
            </Link>
            <h2 className="text-xl font-bold">Products</h2>
            <p className="text-xs text-slate-500">{products.length} total</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span className="ml-1.5 text-xs">Refresh</span>
            </Button>
            <Button size="sm" onClick={() => { setEditingProduct(null); setShowForm(true) }} className="bg-[#007cdc] hover:bg-[#0068b8]">
              <Plus className="h-3.5 w-3.5 mr-1" /> New product
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading products…
          </div>
        ) : products.length === 0 ? (
          <Card className="border-dashed bg-white">
            <CardContent className="py-16 text-center text-slate-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-slate-400" />
              <p className="text-sm font-medium">No products yet</p>
              <p className="text-xs mt-1">Click "New product" to add your first item.</p>
              <Button onClick={() => { setEditingProduct(null); setShowForm(true) }} className="mt-4 bg-[#007cdc] hover:bg-[#0068b8]" size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" /> New product
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white">
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium text-slate-600">Product</th>
                    <th className="text-left p-3 font-medium text-slate-600">Category</th>
                    <th className="text-right p-3 font-medium text-slate-600">Price</th>
                    <th className="text-right p-3 font-medium text-slate-600">Stock</th>
                    <th className="text-center p-3 font-medium text-slate-600">Status</th>
                    <th className="text-center p-3 font-medium text-slate-600">Featured</th>
                    <th className="text-right p-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded bg-slate-100 overflow-hidden shrink-0">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full grid place-items-center text-slate-300">
                                <Package className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-[11px] line-clamp-1">{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{p.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-[11px]">{p.category ?? "—"}</td>
                      <td className="p-3 text-right font-medium text-[11px]">{formatPkr(p.priceMinor, p.currency)}</td>
                      <td className="p-3 text-right text-[11px]">
                        {p.stock === null ? <span className="text-slate-400">∞</span> : p.stock}
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleToggleActive(p)} className="cursor-pointer">
                          <Badge variant={p.active ? "default" : "secondary"} className="text-[10px]">
                            {p.active ? "Active" : "Hidden"}
                          </Badge>
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleToggleFeatured(p)} className="cursor-pointer">
                          {p.featured ? (
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          ) : (
                            <Star className="h-4 w-4 text-slate-300" />
                          )}
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingProduct(p); setShowForm(true) }}
                            className="h-7 text-[11px]"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(p)}
                            className="h-7 text-[11px] text-rose-600 hover:text-rose-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {showForm && (
        <ProductForm
          product={editingProduct}
          onClose={() => { setShowForm(false); setEditingProduct(null) }}
          onSaved={() => { setShowForm(false); setEditingProduct(null); refresh() }}
        />
      )}
    </div>
  )
}

// ------------------------------------------------------------------
// Product form modal
// ------------------------------------------------------------------

function ProductForm({ product, onClose, onSaved }: {
  product: Product | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(product?.name ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [price, setPrice] = useState(product ? (product.priceMinor / 100).toString() : "")
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "")
  const [category, setCategory] = useState(product?.category ?? "")
  const [stock, setStock] = useState(product?.stock === null ? "" : (product?.stock ?? "").toString())
  const [featured, setFeatured] = useState(product?.featured ?? false)
  const [active, setActive] = useState(product?.active ?? true)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim() || !description.trim() || !price) {
      toast.error("Name, description, and price are required")
      return
    }
    const priceNum = Number(price)
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("Price must be a positive number")
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        price: priceNum,
        imageUrl: imageUrl.trim() || null,
        category: category.trim() || null,
        stock: stock === "" ? null : Math.max(0, parseInt(stock, 10)),
        featured,
        active,
      }
      const url = product
        ? `/api/admin/products/${product.id}`
        : "/api/admin/products"
      const method = product ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (!j.ok) {
        toast.error(j.error ?? "Failed to save")
        return
      }
      toast.success(product ? "Product updated" : "Product created")
      onSaved()
    } catch (e) {
      console.error(e)
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50" onClick={onClose}>
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{product ? "Edit product" : "New product"}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">Description *</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What is this product?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price" className="text-xs">Price (PKR) *</Label>
              <Input id="price" type="number" step="0.01" min="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="100.00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock" className="text-xs">Stock <span className="text-slate-400">(blank = unlimited)</span></Label>
              <Input id="stock" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="∞" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imageUrl" className="text-xs">Image URL <span className="text-slate-400">(optional)</span></Label>
            <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category" className="text-xs">Category <span className="text-slate-400">(optional)</span></Label>
            <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Stickers, Digital, Services" />
          </div>
          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              Featured (show on homepage)
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active (visible in storefront)
            </label>
          </div>
        </CardContent>
        <div className="p-4 pt-0 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-[#007cdc] hover:bg-[#0068b8]">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {product ? "Save changes" : "Create product"}
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default function AdminProductsPage() {
  return (
    <AuthGate>
      {(user) => <AdminProducts user={user} />}
    </AuthGate>
  )
}
