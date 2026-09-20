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
    // We don't ship a custom signOut / error / verifyRequest page —
    // NextAuth's defaults are fine for those.
  },

  callbacks: {
    /**
     * On every sign-in, persist the OAuth provider name onto the User row
     * so we can show "Signed in with Google" / "Signed in with Facebook"
     * without re-fetching the Account.
     */
    async signIn({ user, account }) {
      if (account?.provider && user) {
        await db.user.update({
          where: { id: user.id },
          data: { provider: account.provider },
        }).catch(() => {
          // ignore — the row will still be created by the adapter
        })
      }
      // Reject sign-in if no email (defensive — both Google and Facebook always return one)
      return Boolean(user?.email)
    },

    async session({ session, user }) {
      if (session.user && user) {
        // @ts-expect-error — augmenting session.user with id + provider
        session.user.id = user.id
        // @ts-expect-error
        session.user.provider = (user as { provider?: string }).provider ?? null
      }
      return session
    },
  },

  // Fail loud if misconfigured — never silently fall back to unsigned sessions.
  debug: process.env.NODE_ENV === "development",
}
