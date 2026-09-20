'use client'

/**
 * Shopping cart page.
 *
 * Reads the cart from localStorage (no auth required to browse/add to cart).
 * Shows items with quantity controls + a "Proceed to checkout" button that
 * requires auth (redirects to /login if not signed in).
 */

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Trash2, Minus, Plus, ShoppingCart, ArrowLeft, ArrowRight, Package, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Toaster as Sonner } from "@/components/ui/sonner"
import {
  readCartFromStorage, setQuantity, removeFromCart, clearCart,
  cartTotalSnapshot, cartItemCount, type CartItem,
} from "@/lib/cart"

function formatPkr(minor: number, currency = "PKR") {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency, minimumFractionDigits: 2 }).format(minor / 100)
}

export default function CartPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)

  const refresh = useCallback(() => {
    setCart(readCartFromStorage())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    // Listen for cart changes from other tabs/components.
    const handler = () => refresh()
    window.addEventListener("playbeat-cart-changed", handler)
    window.addEventListener("storage", handler)
    return () => {
      window.removeEventListener("playbeat-cart-changed", handler)
      window.removeEventListener("storage", handler)
    }
  }, [refresh])

  function handleQty(productId: string, delta: number) {
    const item = cart.find((x) => x.productId === productId)
    if (!item) return
    const newQty = item.quantity + delta
    if (newQty <= 0) {
      handleRemove(productId)
    } else {
      setCart(setQuantity(productId, newQty))
    }
  }

  function handleRemove(productId: string) {
    const item = cart.find((x) => x.productId === productId)
    setCart(removeFromCart(productId))
    if (item) toast.success(`Removed "${item.name}" from cart`)
  }

  function handleClear() {
    clearCart()
    setCart([])
    toast.success("Cart cleared")
  }

  async function handleCheckout() {
    setCheckingOut(true)
    // Check if user is signed in.
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" })
      const j = await res.json()
      if (!j.user) {
        toast.info("Please sign in to checkout")
        router.push("/login?callbackUrl=%2Fcheckout")
        return
      }
      router.push("/checkout")
    } catch {
      toast.error("Could not verify session — please try again")
    } finally {
      setCheckingOut(false)
    }
  }

  const totalMinor = Math.round(cartTotalSnapshot(cart) * 100)
  const itemCount = cartItemCount(cart)

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Sonner />

      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-[#007cdc] text-white grid place-items-center font-bold text-sm">RG</div>
            <h1 className="text-base font-semibold">PlayBeat</h1>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/products"><Button variant="ghost" size="sm" className="text-sm">Products</Button></Link>
            <Link href="/login"><Button variant="ghost" size="sm" className="text-sm">Sign in</Button></Link>
            <Link href="/signup"><Button size="sm" className="bg-[#007cdc] hover:bg-[#0068b8] text-sm">Sign up</Button></Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <Link href="/products" className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" /> Continue shopping
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Your cart
            {itemCount > 0 && <Badge variant="secondary" className="text-xs">{itemCount}</Badge>}
          </h2>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs text-rose-600 hover:text-rose-700">
              <Trash2 className="h-3 w-3 mr-1" /> Clear all
            </Button>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading cart…
          </div>
        ) : cart.length === 0 ? (
          <Card className="border-dashed bg-white">
            <CardContent className="py-16 text-center text-slate-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-slate-400" />
              <p className="text-sm font-medium">Your cart is empty</p>
              <p className="text-xs mt-1">Browse our products and add something you like.</p>
              <Link href="/products" className="inline-block mt-4">
                <Button className="bg-[#007cdc] hover:bg-[#0068b8]">
                  Browse products
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-[1fr_300px] gap-6">
            {/* Items */}
            <div className="space-y-2">
              {cart.map((item) => (
                <Card key={item.productId}>
                  <CardContent className="p-3 flex gap-3">
                    {/* Image */}
                    <Link href={`/products/${item.slug}`} className="shrink-0">
                      <div className="h-20 w-20 rounded-md bg-slate-100 overflow-hidden">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-slate-300">
                            <Package className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <Link href={`/products/${item.slug}`} className="font-medium text-sm hover:text-[#007cdc] line-clamp-2">
                        {item.name}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {formatPkr(Math.round(item.price * 100))} each
                      </div>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center border rounded-md">
                          <button
                            onClick={() => handleQty(item.productId, -1)}
                            className="h-7 w-7 grid place-items-center hover:bg-slate-100"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="h-7 min-w-8 grid place-items-center text-sm font-medium px-1">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleQty(item.productId, 1)}
                            className="h-7 w-7 grid place-items-center hover:bg-slate-100"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => handleRemove(item.productId)}
                          className="text-xs text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      </div>
                    </div>

                    {/* Line total */}
                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm">
                        {formatPkr(Math.round(item.price * 100 * item.quantity))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Summary */}
            <div className="md:sticky md:top-20 md:self-start">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Order summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Items ({itemCount})</span>
                    <span>{formatPkr(totalMinor)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Processing fee</span>
                    <span className="text-emerald-600">Free</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatPkr(totalMinor)}</span>
                  </div>
                  <Button
                    onClick={handleCheckout}
                    disabled={checkingOut}
                    className="w-full h-12 bg-[#007cdc] hover:bg-[#0068b8]"
                  >
                    {checkingOut ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    Proceed to checkout
                  </Button>
                  <p className="text-[11px] text-slate-500 text-center">
                    You'll sign in with Google or Facebook to complete payment.
                  </p>
                </CardContent>
              </Card>
            </div>
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
