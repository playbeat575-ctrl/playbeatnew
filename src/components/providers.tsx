/**
 * Client-side SessionProvider wrapper for NextAuth.
 * Must be a client component because SessionProvider uses React context.
 */

'use client'

import { SessionProvider } from "next-auth/react"
import type { ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
