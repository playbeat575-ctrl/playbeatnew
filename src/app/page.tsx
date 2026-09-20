'use client'

import { useEffect, useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, CreditCard, Shield, CheckCircle2, XCircle, Clock, RefreshCw, ExternalLink, LogOut } from "lucide-react"
import { signOut } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { toast } from "sonner"
import { AuthGate, type AuthUser } from "@/components/auth-gate"

// ------------------------------------------------------------------
// Types & helpers
// ------------------------------------------------------------------

interface OrderRow {
  id: string
  merchantTransactionId: string
  amountMinor: number
  currency: string
  customerEmail: string
  customerName: string | null
  customerPhone: string | null
  description: string | null
  status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED"
  environment: string
  gatewayTxnRef: string | null
  createdAt: string
  webhookEvents: { id: string; eventId: string; eventType: string; processedAt: string }[]
}

const statusConfig: Record<OrderRow["status"], { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:  { label: "Pending",  color: "bg-amber-100 text-amber-800 border-amber-200",  icon: <Clock className="h-3 w-3" /> },
  SUCCESS:  { label: "Paid",     color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  FAILED:   { label: "Failed",   color: "bg-rose-100 text-rose-800 border-rose-200",     icon: <XCircle className="h-3 w-3" /> },
  REFUNDED: { label: "Refunded", color: "bg-slate-100 text-slate-800 border-slate-200",  icon: <RefreshCw className="h-3 w-3" /> },
}

function formatPkr(minor: number, currency = "PKR") {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100)
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
// Form schema
// ------------------------------------------------------------------

const checkoutSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0").max(1_000_000, "Max 1,000,000 PKR"),
  email: z.string().email("Valid email is required"),
  name: z.string().optional(),
  phone: z.string().optional(),
  description: z.string().max(200, "Max 200 characters").optional(),
})

type CheckoutForm = z.infer<typeof checkoutSchema>

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

function Checkout({ user }: { user: AuthUser }) {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [configStatus, setConfigStatus] = useState<{ outbound: boolean; webhook: boolean; environment: string } | null>(null)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      amount: 100,
      email: user.email ?? "",
      name: user.name ?? "",
      phone: "",
      description: "",
    },
  })

  // Load recent orders + config status
  const refresh = useCallback(async () => {
    setLoadingOrders(true)
    try {
      const [ordersRes, cfgRes] = await Promise.all([
        fetch("/api/rapid/orders", { cache: "no-store" }),
        fetch("/api/rapid/config", { cache: "no-store" }),
      ])
      if (ordersRes.ok) {
        const j = await ordersRes.json()
        setOrders(j.orders ?? [])
      }
      if (cfgRes.ok) {
        const j = await cfgRes.json()
        setConfigStatus(j)
      } else {
        setConfigStatus({ outbound: false, webhook: false, environment: "unknown" })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingOrders(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    // Poll for status updates every 5s — a webhook may flip PENDING → SUCCESS shortly after redirect.
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [refresh])

  // If we were redirected back from Rapid with ?order=..., surface a toast.
  useEffect(() => {
    const url = new URL(window.location.href)
    const orderRef = url.searchParams.get("order")
    const status = url.searchParams.get("status")
    if (orderRef) {
      if (status === "SUCCESS" || status === "success") {
        toast.success(`Payment for ${orderRef} reported as successful — verifying via webhook…`)
      } else if (status === "FAILED" || status === "failed") {
        toast.error(`Payment for ${orderRef} reported as failed.`)
      } else {
        toast.info(`Returned from Rapid for ${orderRef}. Webhook will confirm final status.`)
      }
      // Clean the URL so a refresh doesn't re-trigger the toast.
      window.history.replaceState({}, "", "/")
    }
  }, [])

  // ------------------------------------------------------------------
  // Submit handler — create session, then redirect to Rapid hosted checkout
  // ------------------------------------------------------------------
  async function onSubmit(values: CheckoutForm) {
    setSubmitting(true)
    try {
      const res = await fetch("/api/rapid/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const j = await res.json()
      if (!j.ok) {
        toast.error(j.error ?? "Failed to create checkout session")
        return
      }
      toast.success(`Order ${j.merchantTransactionId} created — redirecting to Rapid…`)
      // Brief delay so the user sees the toast before navigating away.
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
      refresh()
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
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-[#007cdc] text-white grid place-items-center font-bold text-sm">RG</div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Rapid Gateway Checkout</h1>
              <p className="text-xs text-slate-500 leading-tight">Playbeat Digital · Next.js integration</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Logged-in user info */}
            <div className="flex items-center gap-2">
              {user.image ? (
                <img src={user.image} alt={user.name ?? "avatar"} className="h-7 w-7 rounded-full border" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-slate-200 grid place-items-center text-xs font-semibold text-slate-600">
                  {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-medium text-slate-900">{user.name ?? "Signed in"}</div>
                <div className="text-[10px] text-slate-500">{user.provider ? `via ${user.provider}` : user.email}</div>
              </div>
            </div>
            <Badge variant="outline" className={envBadge.className}>{envBadge.label}</Badge>
            <a
              href="https://rapidgateway.pk/resources/payment-webhooks-guide"
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline text-xs text-slate-500 hover:text-slate-900 items-center gap-1"
            >
              Webhook docs <ExternalLink className="h-3 w-3" />
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out"
              className="text-xs h-8"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1.5">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 grid gap-8 md:grid-cols-[1fr_1.2fr]">

        {/* LEFT — checkout form */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#007cdc]" />
                Pay with Rapid
              </CardTitle>
              <CardDescription>
                Cards, Raast, JazzCash, easypaisa & bank transfers — through one checkout.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="amount">Amount (PKR)</Label>
                  <Input id="amount" type="number" step="0.01" min="1" placeholder="100.00" {...register("amount")} />
                  {errors.amount && <p className="text-xs text-rose-600">{errors.amount.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="customer@example.com" {...register("email")} />
                  {errors.email && <p className="text-xs text-rose-600">{errors.email.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name <span className="text-slate-400">(optional)</span></Label>
                    <Input id="name" placeholder="Customer name" {...register("name")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone <span className="text-slate-400">(optional)</span></Label>
                    <Input id="phone" placeholder="+92..." {...register("phone")} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Description <span className="text-slate-400">(optional)</span></Label>
                  <Textarea id="description" rows={2} placeholder="What is this payment for?" {...register("description")} />
                  {errors.description && <p className="text-xs text-rose-600">{errors.description.message}</p>}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 items-stretch">
                <Button type="submit" disabled={submitting || !configStatus?.outbound} className="w-full bg-[#007cdc] hover:bg-[#0068b8]">
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                  {submitting ? "Creating checkout…" : `Pay ${"(PKR)"} with Rapid`}
                </Button>
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5 justify-center">
                  <Shield className="h-3 w-3" />
                  You'll be redirected to Rapid's PCI-DSS hosted checkout page.
                </p>
              </CardFooter>
            </form>
          </Card>

          {/* Config status */}
          {configStatus && !configStatus.outbound && (
            <Card className="mt-4 border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-900">Rapid Gateway not configured</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-amber-800 space-y-1.5">
                <p>Set these in <code className="bg-amber-100 px-1 rounded">.env</code> to enable live checkout:</p>
                <pre className="bg-amber-100/60 p-2 rounded text-[11px] overflow-x-auto">
{`RAPID_GATEWAY_ENV=sandbox
RAPID_GATEWAY_MERCHANT_ID=...
RAPID_GATEWAY_API_KEY=...
RAPID_GATEWAY_WEBHOOK_SALT=...
RAPID_GATEWAY_BASE_URL=https://sandbox-api.rapidgateway.pk
RAPID_GATEWAY_APP_BASE_URL=http://localhost:3000`}
                </pre>
                <p className="pt-1">The form will work end-to-end once these are set and the dev server restarts.</p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* RIGHT — recent orders */}
        <section>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Orders</CardTitle>
                <Button variant="ghost" size="sm" onClick={refresh} disabled={loadingOrders}>
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
                <div className="py-12 text-center text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading orders…
                </div>
              ) : orders.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  No orders yet. Submit the form on the left to create your first checkout.
                </div>
              ) : (
                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1 -mr-1">
                  {orders.map((o) => {
                    const s = statusConfig[o.status] ?? statusConfig.PENDING
                    return (
                      <div key={o.id} className="border rounded-lg p-3 bg-white hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-700 truncate">{o.merchantTransactionId}</span>
                              <Badge variant="outline" className={`text-[10px] ${s.color}`}>
                                {s.icon}
                                <span className="ml-1">{s.label}</span>
                              </Badge>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {o.customerEmail} · {timeAgo(o.createdAt)}
                            </div>
                            {o.description && (
                              <div className="text-xs text-slate-600 mt-1 line-clamp-1">{o.description}</div>
                            )}
                            {o.gatewayTxnRef && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                                gateway: {o.gatewayTxnRef}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold text-sm">{formatPkr(o.amountMinor, o.currency)}</div>
                            {o.webhookEvents.length > 0 && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {o.webhookEvents.length} webhook{o.webhookEvents.length > 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhook URL hint */}
          <Card className="mt-4 bg-slate-50 border-slate-200">
            <CardContent className="py-3">
              <div className="text-[11px] text-slate-600 space-y-1">
                <div className="font-medium text-slate-700">Register this URL in your Rapid dashboard:</div>
                <code className="block bg-white border rounded px-2 py-1 text-[10px] break-all">
                  {typeof window !== "undefined" ? `${window.location.origin}/api/rapid/webhook` : "/api/rapid/webhook"}
                </code>
                <div className="text-slate-500">Developers → Webhooks → New Webhook → paste the URL above.</div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-3 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Rapid Gateway × Next.js — sandbox checkout</span>
          <Separator orientation="vertical" className="h-3" />
          <a href="https://rapidgateway.pk" target="_blank" rel="noreferrer" className="hover:text-slate-900">
            rapidgateway.pk
          </a>
        </div>
      </footer>
    </div>
  )
}

export default function Home() {
  return (
    <AuthGate>
      {(user) => <Checkout user={user} />}
    </AuthGate>
  )
}
