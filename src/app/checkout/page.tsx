'use client'

/**
 * Cart-based checkout page (requires auth).
 *
 * Flow:
 *   1. Reads cart from localStorage on mount.
 *   2. POSTs the cart to /api/cart/validate — server returns real prices + total.
 *   3. Shows reviewed line items + total + a "Pay X with Rapid" button.
 *   4. On click, POSTs to /api/rapid/create-session with { items: [...] }.
 *   5. Server creates Order + OrderItem rows, calls Rapid, returns checkoutUrl.
 *   6. Browser redirects to Rapid's hosted checkout.
 *
 * Below the checkout card, the user's recent orders are shown (auto-refresh
 * every 5s so a webhook can flip PENDING → SUCCESS live).
 */

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Loader2, CreditCard, Shield, CheckCircle2, XCircle, Clock, RefreshCw,
  LogOut, Package, ArrowLeft, AlertCircle,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { AuthGate, type AuthUser } from "@/components/auth-gate"
import { readCartFromStorage, clearCart } from "@/lib/cart"

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface ValidatedItem {
  productId: string
  slug: string
  name: string
  priceMinor: number
  currency: string
  imageUrl: string | null
  quantity: number
  active: boolean
  inStock: boolean
  lineTotalMinor: number
}

interface DroppedItem {
  productId: string
  name: string
  active: boolean
  inStock: boolean
}

interface OrderRow {
  id: string
  merchantTransactionId: string
  amountMinor: number
  currency: string
  customerEmail: string
  description: string | null
  status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED"
  environment: string
  gatewayTxnRef: string | null
  createdAt: string
  items?: { id: string; name: string; priceMinor: number; quantity: number; imageUrl: string | null }[]
}

const statusConfig: Record<OrderRow["status"], { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:  { label: "Pending",  color: "bg-amber-100 text-amber-800 border-amber-200",  icon: <Clock className="h-3 w-3" /> },
  SUCCESS:  { label: "Paid",     color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  FAILED:   { label: "Failed",   color: "bg-rose-100 text-rose-800 border-rose-200",     icon: <XCircle className="h-3 w-3" /> },
  REFUNDED: { label: "Refunded", color: "bg-slate-100 text-slate-800 border-slate-200",  icon: <RefreshCw className="h-3 w-3" /> },
}

function formatPkr(minor: number, currency = "PKR") {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency, minimumFractionDigits: 2 }).format(minor / 100)
}

function timeAgo(iso: string) {
  const d = new Date(iso)
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short" })
}

// ------------------------------------------------------------------
// Checkout component (inside AuthGate)
// ------------------------------------------------------------------

function Checkout({ user }: { user: AuthUser }) {
  const router = useRouter()
  const [items, setItems] = useState<ValidatedItem[]>([])
  const [droppedItems, setDroppedItems] = useState<DroppedItem[]>([])
  const [totalMinor, setTotalMinor] = useState(0)
  const [validating, setValidating] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [configStatus, setConfigStatus] = useState<{
    outbound: boolean; fullyConfigured: boolean; environment: string
  } | null>(null)

  // ─── Validate cart on mount ──────────────────────────────────────────
  const validateCart = useCallback(async () => {
    setValidating(true)
    const localCart = readCartFromStorage()
    if (localCart.length === 0) {
      setItems([])
      setTotalMinor(0)
      setValidating(false)
      return
    }
    try {
      const res = await fetch("/api/cart/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: localCart.map((x) => ({ productId: x.productId, quantity: x.quantity })),
        }),
      })
      const j = await res.json()
      if (!j.ok) {
        toast.error(j.error ?? "Could not validate cart")
        setItems([])
        setTotalMinor(0)
      } else {
        setItems(j.items)
        setDroppedItems(j.droppedItems || [])
        setTotalMinor(j.totalMinor)
        if ((j.droppedItems || []).length > 0) {
          toast.warning(`${(j.droppedItems || []).length} item(s) in your cart are no longer available and were removed.`)
        }
      }
    } catch (e) {
      console.error(e)
      toast.error("Network error validating cart")
    } finally {
      setValidating(false)
    }
  }, [])

  useEffect(() => { validateCart() }, [validateCart])

  // ─── Load recent orders + config status (polls every 5s) ─────────────
  const refreshOrders = useCallback(async () => {
    setLoadingOrders(true)
    try {
      const [ordersRes, cfgRes] = await Promise.all([
        fetch("/api/rapid/orders", { cache: "no-store" }),
        fetch("/api/rapid/config", { cache: "no-store" }),
      ])
      if (ordersRes.status === 401) {
        window.location.reload()
        return
      }
      if (ordersRes.ok) {
        const j = await ordersRes.json()
        setOrders(j.orders ?? [])
      }
      if (cfgRes.ok) {
        const j = await cfgRes.json()
        setConfigStatus(j)
      } else {
        setConfigStatus({ outbound: false, fullyConfigured: false, environment: "unknown" })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingOrders(false)
    }
  }, [])

  useEffect(() => {
    refreshOrders()
    const t = setInterval(refreshOrders, 5000)
    return () => clearInterval(t)
  }, [refreshOrders])

  // If we were redirected back from Rapid with ?order=..., surface a toast.
  useEffect(() => {
    const url = new URL(window.location.href)
    const orderRef = url.searchParams.get("order")
    const status = url.searchParams.get("status")
    if (orderRef) {
      if (status === "SUCCESS" || status === "success") {
        toast.success(`Payment for ${orderRef} reported as successful — verifying via webhook…`)
        // Cart was already cleared server-side when order was created.
        // Clear localStorage too.
        clearCart()
      } else if (status === "FAILED" || status === "failed") {
        toast.error(`Payment for ${orderRef} reported as failed.`)
      } else {
        toast.info(`Returned from Rapid for ${orderRef}. Webhook will confirm final status.`)
      }
      window.history.replaceState({}, "", "/checkout")
    }
  }, [])

  // ─── Submit: create checkout session from cart ───────────────────────
  async function handlePay() {
    if (items.length === 0) {
      toast.error("Your cart is empty")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/rapid/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      })
      if (res.status === 401) {
        toast.error("Your session expired. Redirecting to sign-in…")
        setTimeout(() => window.location.reload(), 1000)
        return
      }
      const j = await res.json()
      if (!j.ok) {
        toast.error(j.error ?? "Failed to create checkout session")
        // Re-validate the cart in case items changed.
        validateCart()
        return
      }
      toast.success(`Order ${j.merchantTransactionId} created — redirecting to Rapid…`)
      // Clear the cart after the order is successfully created.
      clearCart()
      setTimeout(() => {
        if (j.checkoutUrl) {
          window.location.href = j.checkoutUrl
        } else {
          toast.error("No checkoutUrl returned from Rapid")
        }
      }, 600)
    } catch (e) {
      console.error(e)
      toast.error("Network error creating checkout session")
    } finally {
      setSubmitting(false)
      refreshOrders()
    }
  }

  const envBadge = configStatus?.environment === "live"
    ? { label: "LIVE", className: "bg-rose-100 text-rose-800 border-rose-200" }
    : { label: "SANDBOX", className: "bg-amber-100 text-amber-800 border-amber-200" }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Sonner />

      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-[#007cdc] text-white grid place-items-center font-bold text-sm">RG</div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Checkout</h1>
              <p className="text-xs text-slate-500 leading-tight">PlayBeat · {user.email}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={envBadge.className}>{envBadge.label}</Badge>
            <Link href="/products"><Button variant="ghost" size="sm" className="text-xs">Products</Button></Link>
            <Link href="/admin"><Button variant="ghost" size="sm" className="text-xs">Admin</Button></Link>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })} className="text-xs">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1.5">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 grid gap-6 md:grid-cols-[1fr_320px]">
        {/* LEFT — cart items + recent orders */}
        <section className="space-y-6">
          {/* Cart items */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#007cdc]" />
                  Your cart
                </CardTitle>
                <Link href="/products" className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> Continue shopping
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {validating ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Validating cart…
                </div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  <Package className="h-10 w-10 mx-auto mb-2 text-slate-400" />
                  Your cart is empty.
                  <div className="mt-3">
                    <Link href="/products" className="inline-block">
                      <Button className="bg-[#007cdc] hover:bg-[#0068b8]" size="sm">
                        Browse products
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.productId} className="flex gap-3 border rounded-lg p-3 bg-white">
                      <Link href={`/products/${item.slug}`} className="shrink-0">
                        <div className="h-14 w-14 rounded-md bg-slate-100 overflow-hidden">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full grid place-items-center text-slate-300">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/products/${item.slug}`} className="font-medium text-sm hover:text-[#007cdc] line-clamp-2">
                          {item.name}
                        </Link>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {formatPkr(item.priceMinor, item.currency)} × {item.quantity}
                        </div>
                      </div>
                      <div className="font-bold text-sm shrink-0">
                        {formatPkr(item.lineTotalMinor, item.currency)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Dropped items warning */}
              {droppedItems.length > 0 && (
                <Alert variant="destructive" className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-sm">Some items were removed</AlertTitle>
                  <AlertDescription className="text-xs">
                    The following items are no longer available and were removed from your cart:
                    <ul className="list-disc pl-4 mt-1">
                      {droppedItems.map((d) => (
                        <li key={d.productId}>{d.name} ({d.active ? "out of stock" : "no longer available"})</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Recent orders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent orders</CardTitle>
                <Button variant="ghost" size="sm" onClick={refreshOrders} disabled={loadingOrders}>
                  {loadingOrders ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  <span className="ml-1.5 text-xs">Refresh</span>
                </Button>
              </div>
              <CardDescription className="text-xs">
                Auto-refreshes every 5s — webhook updates appear here live.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOrders && orders.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Loading orders…
                </div>
              ) : orders.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No orders yet. Your purchases will appear here.
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 -mr-1">
                  {orders.map((o) => {
                    const s = statusConfig[o.status] ?? statusConfig.PENDING
                    return (
                      <div key={o.id} className="border rounded-lg p-3 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-700 truncate">{o.merchantTransactionId}</span>
                              <Badge variant="outline" className={`text-[10px] ${s.color}`}>
                                {s.icon}
                                <span className="ml-1">{s.label}</span>
                              </Badge>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {timeAgo(o.createdAt)}
                            </div>
                            {o.description && (
                              <div className="text-xs text-slate-600 mt-1 line-clamp-2">{o.description}</div>
                            )}
                            {o.gatewayTxnRef && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                                gateway: {o.gatewayTxnRef}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold text-sm">{formatPkr(o.amountMinor, o.currency)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* RIGHT — order summary + pay button */}
        <section>
          <div className="md:sticky md:top-20">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Items ({items.reduce((s, x) => s + x.quantity, 0)})</span>
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
              </CardContent>
              <CardFooter className="flex flex-col gap-2 items-stretch">
                <Button
                  onClick={handlePay}
                  disabled={submitting || validating || items.length === 0 || !configStatus?.fullyConfigured}
                  className="w-full bg-[#007cdc] hover:bg-[#0068b8] h-12"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  {submitting ? "Creating checkout…" : `Pay ${formatPkr(totalMinor)} with Rapid`}
                </Button>
                {configStatus && !configStatus.fullyConfigured && configStatus.outbound && (
                  <p className="text-[11px] text-amber-700 text-center">
                    Rapid credentials are still placeholders — set real values in Vercel to enable live checkout.
                  </p>
                )}
                {configStatus && !configStatus.outbound && (
                  <p className="text-[11px] text-amber-700 text-center">
                    Rapid Gateway not configured. Contact an admin.
                  </p>
                )}
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5 justify-center">
                  <Shield className="h-3 w-3" />
                  Redirects to Rapid's PCI-DSS hosted checkout.
                </p>
              </CardFooter>
            </Card>

            {/* Webhook URL hint */}
            <Card className="mt-4 bg-slate-50 border-slate-200">
              <CardContent className="py-3">
                <div className="text-[11px] text-slate-600 space-y-1">
                  <div className="font-medium text-slate-700">Webhook URL (for Rapid portal):</div>
                  <code className="block bg-white border rounded px-2 py-1 text-[10px] break-all">
                    {typeof window !== "undefined" ? `${window.location.origin}/api/rapid/webhook` : "/api/rapid/webhook"}
                  </code>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t bg-white mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-3 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Rapid Gateway × Next.js</span>
          <a href="https://rapidgateway.pk" target="_blank" rel="noreferrer" className="hover:text-slate-900">
            rapidgateway.pk
          </a>
        </div>
      </footer>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <AuthGate>
      {(user) => <Checkout user={user} />}
    </AuthGate>
  )
}
