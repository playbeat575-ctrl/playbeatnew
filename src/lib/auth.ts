/**
 * NextAuth configuration — Google + Facebook OAuth only.
 *
 * No email/password, no magic links, no dummy accounts.
 * Users MUST sign in with a real Google or Facebook account.
 *
 * Required env vars:
 *   NEXTAUTH_URL              = https://playbeat.digital
 *   NEXTAUTH_SECRET           = <random 32+ char string>
 *   GOOGLE_CLIENT_ID          = <from Google Cloud Console>
 *   GOOGLE_CLIENT_SECRET      = <from Google Cloud Console>
 *   FACEBOOK_CLIENT_ID        = <from Meta for Developers>
 *   FACEBOOK_CLIENT_SECRET    = <from Meta for Developers>
 *
 * OAuth callback URLs to register in each provider's console:
 *   Google:    https://playbeat.digital/api/auth/callback/google
 *   Facebook:  https://playbeat.digital/api/auth/callback/facebook
 *
 * Admin role: the FIRST user to sign in is auto-promoted to admin.
 * Subsequent users get role="user". Change a user's role in the DB
 * to grant/revoke admin manually.
 */

import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import FacebookProvider from "next-auth/providers/facebook"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

export const authOptions: NextAuthOptions = {
  // @ts-expect-error — adapter typing differs slightly across next-auth v4 / @auth/prisma-adapter
  adapter: PrismaAdapter(db),

  // ONLY Google and Facebook — no credentials, no email links, no dummy signups.
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID ?? "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  session: { strategy: "database" },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    /** Persist the OAuth provider name on the User row on every sign-in. */
    async signIn({ user, account }) {
      if (account?.provider && user?.id) {
        await db.user.update({
          where: { id: user.id },
          data: { provider: account.provider },
        }).catch(() => {
          // ignore — row may not exist yet (adapter will create it)
        })
      }
      return Boolean(user?.email)
    },

    /** Expose id, provider, and role on the session so the client + middleware can read them. */
    async session({ session, user }) {
      if (session.user && user) {
        // @ts-expect-error — augmenting session.user
        session.user.id = user.id
        // @ts-expect-error
        session.user.provider = (user as { provider?: string }).provider ?? null
        // @ts-expect-error
        session.user.role = (user as { role?: string }).role ?? "user"
      }
      return session
    },
  },

  events: {
    /**
     * Fires after the Prisma adapter creates a new User row.
     * We use this to auto-promote the FIRST user to admin (bootstrap).
     * Subsequent users get the default "user" role from the schema.
     */
    async createUser({ user }) {
      const userCount = await db.user.count()
      if (userCount === 1 && user.id) {
        await db.user.update({
          where: { id: user.id },
          data: { role: "admin" },
        })
        console.log(`[auth] Auto-promoted first user ${user.email} to admin`)
      }
    },
  },

  // Fail loud if misconfigured — never silently fall back to unsigned sessions.
  debug: process.env.NODE_ENV === "development",
}
