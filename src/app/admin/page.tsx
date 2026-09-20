'use client'

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Loader2, RefreshCw, Users, ShoppingBag, DollarSign, TrendingUp,
  AlertCircle, ShieldCheck, ArrowLeft, Clock, CheckCircle2, XCircle,
  Package, ExternalLink,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { AuthGate, type AuthUser } from "@/components/auth-gate"

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface AdminStats {
  totalUsers: number
  totalOrders: number
  pendingOrders: number
  successfulOrders: number
  failedOrders: number
  refundedOrders: number
  revenueMinor: number
  recentSignups: number
  totalProducts: number
  activeProducts: number
  lowStockProducts: number
}

interface AdminOrder {
  id: string
  merchantTransactionId: string
  amountMinor: number
  currency: string
  customerEmail: string
  status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED"
  environment: string
  gatewayTxnRef: string | null
  createdAt: string
  user: { id: string; name: string | null; email: string; image: string | null } | null
}

interface AdminUser {
  id: string
  name: string | null
  email: string
  image: string | null
  provider: string | null
  role: string
  createdAt: string
  _count: { orders: number }
}

const statusConfig: Record<AdminOrder["status"], { label: string; color: string; icon: React.ReactNode }> = {
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
// Admin dashboard
// ------------------------------------------------------------------

function AdminDashboard({ user }: { user: AuthUser }) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [activeTab, setActiveTab] = useState<"orders" | "users">("orders")

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, ordersRes, usersRes] = await Promise.all([
        fetch("/api/admin/stats", { cache: "no-store" }),
        fetch("/api/admin/orders", { cache: "no-store" }),
        fetch("/api/admin/users", { cache: "no-store" }),
      ])

      if (statsRes.status === 403 || ordersRes.status === 403 || usersRes.status === 403) {
        setForbidden(true)
        return
      }

      if (statsRes.ok) {
        const j = await statsRes.json()
        setStats(j.stats)
      }
      if (ordersRes.ok) {
        const j = await ordersRes.json()
        setOrders(j.orders ?? [])
      }
      if (usersRes.ok) {
        const j = await usersRes.json()
        setUsers(j.users ?? [])
      }
    } catch (e) {
      console.error(e)
      toast.error("Failed to load admin data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function toggleUserRole(u: AdminUser) {
    const newRole = u.role === "admin" ? "user" : "admin"
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, role: newRole }),
    })
    const j = await res.json()
    if (!j.ok) {
      toast.error(j.error ?? "Failed to update role")
      return
    }
    toast.success(`${u.email} is now ${newRole}`)
    refresh()
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <Card className="max-w-md mx-4 text-center">
          <CardHeader>
            <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-2" />
            <CardTitle>Admin access required</CardTitle>
            <CardDescription>
              Your account ({user.email}) doesn&apos;t have admin privileges.
              The first user to sign up is auto-promoted to admin. To grant admin
              to another user, edit their role in the database directly.
            </CardDescription>
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
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-[#007cdc] text-white grid place-items-center font-bold text-xs">RG</div>
            <div>
              <h1 className="text-sm font-semibold leading-tight flex items-center gap-1.5">
                Admin Dashboard
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/checkout">
              <Button variant="ghost" size="sm" className="text-xs">Checkout</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-xs">Home</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="text-xs">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Stats grid */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Revenue" value={stats ? formatPkr(stats.revenueMinor) : "—"} icon={<DollarSign className="h-4 w-4" />} accent="emerald" />
            <StatCard label="Total Orders" value={stats?.totalOrders ?? "—"} icon={<ShoppingBag className="h-4 w-4" />} accent="blue" />
            <StatCard label="Total Users" value={stats?.totalUsers ?? "—"} icon={<Users className="h-4 w-4" />} accent="purple" />
            <StatCard label="Products" value={stats?.activeProducts ?? "—"} icon={<Package className="h-4 w-4" />} accent="amber" />
          </div>

          {/* Quick links */}
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/admin/products">
              <Button variant="outline" size="sm" className="text-xs">
                <Package className="h-3.5 w-3.5 mr-1.5" />
                Manage products
              </Button>
            </a>
            <a href="/products" target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="text-xs">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                View storefront
              </Button>
            </a>
          </div>
        </section>

        {/* Order status breakdown */}
        <section>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Pending" value={stats?.pendingOrders ?? 0} color="amber" />
            <MiniStat label="Successful" value={stats?.successfulOrders ?? 0} color="emerald" />
            <MiniStat label="Failed" value={stats?.failedOrders ?? 0} color="rose" />
            <MiniStat label="Refunded" value={stats?.refundedOrders ?? 0} color="slate" />
          </div>
        </section>

        {/* Tabs */}
        <section>
          <div className="border-b mb-4">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("orders")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === "orders"
                    ? "border-[#007cdc] text-[#007cdc]"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                Orders ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab("users")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === "users"
                    ? "border-[#007cdc] text-[#007cdc]"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                Users ({users.length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Loading…
            </div>
          ) : activeTab === "orders" ? (
            <OrdersTable orders={orders} />
          ) : (
            <UsersTable users={users} currentUserId={user.id} onToggleRole={toggleUserRole} />
          )}
        </section>
      </main>

      <footer className="border-t bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-3 text-[11px] text-slate-500 text-center">
          PlayBeat Admin · https://playbeat.digital
        </div>
      </footer>
    </div>
  )
}

function StatCard({ label, value, icon, accent }: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent: "emerald" | "blue" | "purple" | "amber"
}) {
  const accentClass = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-700",
  }[accent]
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">{label}</span>
          <div className={`h-7 w-7 rounded-md grid place-items-center ${accentClass}`}>
            {icon}
          </div>
        </div>
        <div className="text-xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value, color }: {
  label: string
  value: number
  color: "amber" | "emerald" | "rose" | "slate"
}) {
  const colorClass = {
    amber: "text-amber-700 bg-amber-50",
    emerald: "text-emerald-700 bg-emerald-50",
    rose: "text-rose-700 bg-rose-50",
    slate: "text-slate-700 bg-slate-100",
  }[color]
  return (
    <div className={`rounded-lg p-3 ${colorClass}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  )
}

function OrdersTable({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) {
    return <div className="py-12 text-center text-sm text-slate-500">No orders yet.</div>
  }
  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="max-h-[600px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left p-3 font-medium text-slate-600">Order</th>
              <th className="text-left p-3 font-medium text-slate-600">User</th>
              <th className="text-left p-3 font-medium text-slate-600">Amount</th>
              <th className="text-left p-3 font-medium text-slate-600">Status</th>
              <th className="text-left p-3 font-medium text-slate-600">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((o) => {
              const s = statusConfig[o.status] ?? statusConfig.PENDING
              return (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-mono text-[11px]">{o.merchantTransactionId}</div>
                    {o.gatewayTxnRef && <div className="text-[10px] text-slate-400 font-mono">{o.gatewayTxnRef.slice(0, 16)}…</div>}
                  </td>
                  <td className="p-3">
                    {o.user ? (
                      <div>
                        <div className="text-[11px]">{o.user.name ?? o.user.email}</div>
                        <div className="text-[10px] text-slate-400">{o.user.email}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">{o.customerEmail}</span>
                    )}
                  </td>
                  <td className="p-3 font-medium">{formatPkr(o.amountMinor, o.currency)}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={`text-[10px] ${s.color}`}>
                      {s.icon}
                      <span className="ml-1">{s.label}</span>
                    </Badge>
                  </td>
                  <td className="p-3 text-[11px] text-slate-500">{timeAgo(o.createdAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UsersTable({ users, currentUserId, onToggleRole }: {
  users: AdminUser[]
  currentUserId: string
  onToggleRole: (u: AdminUser) => void
}) {
  if (users.length === 0) {
    return <div className="py-12 text-center text-sm text-slate-500">No users yet.</div>
  }
  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="max-h-[600px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left p-3 font-medium text-slate-600">User</th>
              <th className="text-left p-3 font-medium text-slate-600">Provider</th>
              <th className="text-left p-3 font-medium text-slate-600">Role</th>
              <th className="text-left p-3 font-medium text-slate-600">Orders</th>
              <th className="text-left p-3 font-medium text-slate-600">Joined</th>
              <th className="text-right p-3 font-medium text-slate-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {u.image ? (
                      <img src={u.image} alt="" className="h-6 w-6 rounded-full" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-slate-200 grid place-items-center text-[10px] font-semibold text-slate-600">
                        {(u.name ?? u.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-[11px] font-medium">{u.name ?? u.email}</div>
                      <div className="text-[10px] text-slate-400">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant="outline" className="text-[10px] capitalize">{u.provider ?? "—"}</Badge>
                </td>
                <td className="p-3">
                  <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                    {u.role}
                  </Badge>
                </td>
                <td className="p-3 text-[11px]">{u._count.orders}</td>
                <td className="p-3 text-[11px] text-slate-500">{timeAgo(u.createdAt)}</td>
                <td className="p-3 text-right">
                  {u.id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleRole(u)}
                      className="text-[11px] h-7"
                    >
                      {u.role === "admin" ? "Demote" : "Promote"}
                    </Button>
                  )}
                  {u.id === currentUserId && (
                    <span className="text-[10px] text-slate-400">you</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdminPage() {
  return (
    <AuthGate>
      {(user) => <AdminDashboard user={user} />}
    </AuthGate>
  )
}
