/**
 * Custom 404 page.
 *
 * Next.js App Router: placing a not-found.tsx at the app root overrides
 * the default 404. This must NOT redirect to /login — a missing page is
 * a 404, not an auth issue.
 */

import Link from "next/link"
import { Home, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <main className="flex-1 grid place-items-center px-4 py-12">
        <Card className="w-full max-w-md shadow-lg text-center">
          <CardHeader>
            <div className="mx-auto text-6xl font-bold text-slate-300 mb-2">404</div>
            <CardTitle className="text-2xl">Page not found</CardTitle>
            <CardDescription>
              The page you're looking for doesn't exist or has moved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/" className="block">
              <Button className="w-full bg-[#007cdc] hover:bg-[#0068b8]">
                <Home className="h-4 w-4 mr-2" />
                Go to checkout
              </Button>
            </Link>
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t bg-white mt-auto">
        <div className="max-w-md mx-auto px-4 py-3 text-center text-[11px] text-slate-500">
          PlayBeat × Rapid Gateway · https://playbeat.digital
        </div>
      </footer>
    </div>
  )
}
