'use client'

/**
 * AuthGate — wraps a page and requires a logged-in user.
 *
 * While checking the session, shows a loading spinner.
 * If no session, redirects to /login?callbackUrl=<current path>.
 * Once authenticated, renders the wrapped children with the user object.
 */

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export interface AuthUser {
  id: string
  name: string | null
  email: string | null
  image: string | null
  provider: string | null
}

export function AuthGate({ children }: { children: (user: AuthUser) => ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.user) {
          setUser(j.user)
        } else {
          // Not signed in → redirect to login with a callback to the current path
          const here = window.location.pathname + window.location.search
          router.replace(`/login?callbackUrl=${encodeURIComponent(here)}`)
        }
      })
      .catch((e) => {
        console.error(e)
        setError("Could not reach the auth service. Please reload.")
      })
    return () => { cancelled = true }
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-700">
        <div className="text-center max-w-sm px-4">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#007cdc]" />
          <p className="mt-3 text-sm text-slate-600">Checking your session…</p>
        </div>
      </div>
    )
  }

  return <>{children(user)}</>
}
