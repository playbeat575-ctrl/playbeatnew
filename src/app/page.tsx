/**
 * Public storefront landing page.
 *
 * No auth required. Indexable by search engines (in sitemap.xml).
 * Marketing content + CTA to sign up / sign in.
 */

import Link from "next/link"
import { CreditCard, Shield, Zap, Wallet, Banknote, QrCode, ArrowRight, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const metadata = {
  title: "PlayBeat — Accept Payments in Pakistan with Rapid Gateway",
  description:
    "Accept cards, Raast, JazzCash, easypaisa, and bank transfers through one checkout. PCI-DSS ready, SBP compliant. Sign in with Google or Facebook to start.",
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
  { icon: CreditCard, name: "Cards", desc: "Visa, Mastercard & UnionPay — local and international." },
  { icon: Zap, name: "Raast", desc: "Pakistan's instant payment rail by SBP. Zero hassle." },
  { icon: Wallet, name: "Mobile Wallets", desc: "JazzCash, easypaisa, SadaPay, NayaPay — all supported." },
  { icon: Banknote, name: "Bank Transfers", desc: "Direct transfers from all major Pakistani banks." },
  { icon: QrCode, name: "QR Payments", desc: "Dynamic & static QR codes for in-store acceptance." },
]

export default function StorefrontPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-[#007cdc] text-white grid place-items-center font-bold text-sm">RG</div>
            <div>
              <h1 className="text-base font-semibold leading-tight">PlayBeat</h1>
              <p className="text-xs text-slate-500 leading-tight">Powered by Rapid Gateway</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 text-center">
          <Badge variant="outline" className="mb-4 bg-white/70 backdrop-blur">
            <Shield className="h-3 w-3 mr-1.5 text-[#007cdc]" />
            PCI-DSS ready · SBP compliant
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 max-w-3xl mx-auto">
            Accept payments in Pakistan.
            <br />
            <span className="text-[#007cdc]">One checkout. Every method.</span>
          </h2>
          <p className="mt-5 text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
            Cards, Raast, JazzCash, easypaisa, and bank transfers — through a single hosted checkout.
            No setup fees, no monthly subscriptions. Sign in with Google or Facebook to start collecting payments in minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-[#007cdc] hover:bg-[#0068b8] w-full sm:w-auto h-12 px-8">
                Create your account
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8">
                Sign in
              </Button>
            </Link>
          </div>

          {/* Trust signals */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              99.9% uptime SLA
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              2% starting MDR
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              T+1 settlement
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Real-time webhooks
            </span>
          </div>
        </div>
      </section>

      {/* Payment methods */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <h3 className="text-2xl md:text-3xl font-bold">One integration. Every way Pakistanis pay.</h3>
            <p className="mt-2 text-sm text-slate-600">
              No separate contracts. No technical overhead. One checkout covers them all.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PAYMENT_METHODS.map((m) => (
              <Card key={m.name} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="h-10 w-10 rounded-md bg-[#007cdc]/10 text-[#007cdc] grid place-items-center mb-2">
                    <m.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{m.name}</CardTitle>
                  <CardDescription className="text-sm">{m.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-white border-y">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <h3 className="text-2xl md:text-3xl font-bold">Start accepting payments in 3 steps</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-[#007cdc] text-white grid place-items-center font-bold text-lg mb-3">1</div>
              <h4 className="font-semibold mb-1">Sign in with Google or Facebook</h4>
              <p className="text-sm text-slate-600">No sign-up form. We use your real identity to keep things secure.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-[#007cdc] text-white grid place-items-center font-bold text-lg mb-3">2</div>
              <h4 className="font-semibold mb-1">Create a checkout link</h4>
              <p className="text-sm text-slate-600">Enter the amount and customer email. We generate a Rapid hosted checkout URL.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-[#007cdc] text-white grid place-items-center font-bold text-lg mb-3">3</div>
              <h4 className="font-semibold mb-1">Get paid — webhook confirmed</h4>
              <p className="text-sm text-slate-600">Rapid signs every payment notification with HMAC-SHA256. We verify before updating your dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-[#007cdc] to-[#005a9e] text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-2xl md:text-3xl font-bold">Ready to start accepting payments?</h3>
          <p className="mt-3 text-white/80">
            No setup fees. No monthly subscriptions. Sign in with your real Google or Facebook account.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto h-12 px-8 bg-white text-[#007cdc] hover:bg-slate-100">
                Create your account
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 bg-transparent text-white border-white/40 hover:bg-white/10 hover:text-white">
                Sign in
              </Button>
            </Link>
          </div>
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
            <Link href="/login" className="hover:text-slate-900">Sign in</Link>
            <Link href="/signup" className="hover:text-slate-900">Sign up</Link>
            <a href="https://rapidgateway.pk" target="_blank" rel="noreferrer" className="hover:text-slate-900">Rapid Gateway ↗</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
