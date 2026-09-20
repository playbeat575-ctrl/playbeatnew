'use client'

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { Loader2, ShieldCheck, AlertCircle, X } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/** Map NextAuth error codes to friendly messages. */
const ERROR_MESSAGES: Record<string, { title: string; body: string }> = {
  Configuration: {
    title: "Authentication not fully configured",
    body: "The server is missing Google or Facebook OAuth credentials. A site administrator needs to set GOOGLE_CLIENT_ID/SECRET and FACEBOOK_CLIENT_ID/SECRET in the environment.",
  },
  AccessDenied: {
    title: "Access denied",
    body: "You denied the sign-in request or your account doesn't have permission.",
  },
  Verification: {
    title: "Sign-in token expired",
    body: "The sign-in link expired. Please try again.",
  },
  OAuthSignin: {
    title: "Could not start OAuth flow",
    body: "The provider didn't respond. Please try again in a moment.",
  },
  OAuthCallback: {
    title: "Sign-in failed",
    body: "The provider rejected the sign-in. This usually means the OAuth client ID or secret is incorrect, or the callback URL isn't registered in the provider's console.",
  },
  OAuthCreateAccount: {
    title: "Could not create account",
    body: "We couldn't create a local account from your provider identity. If this persists, contact support.",
  },
  EmailCreateAccount: {
    title: "Could not create account",
    body: "We couldn't create a local account from your email.",
  },
  Callback: {
    title: "Callback error",
    body: "Something went wrong during the sign-in callback. Please try again.",
  },
  google: {
    title: "Google sign-in failed",
    body: "Google rejected the sign-in. The site admin may need to register https://playbeat.digital/api/auth/callback/google in the Google Cloud Console.",
  },
  facebook: {
    title: "Facebook sign-in failed",
    body: "Facebook rejected the sign-in. The site admin may need to register https://playbeat.digital/api/auth/callback/facebook in the Meta for Developers console.",
  },
  default: {
    title: "Sign-in failed",
    body: "Something went wrong. Please try again, or contact support if the problem persists.",
  },
}

function LoginButtons() {
  const searchParams = useSearchParams()
  const callbackUrl = (() => {
    const url = searchParams.get("callbackUrl")
    return url && url.startsWith("/") ? url : "/"
  })()
  const errorCode = searchParams.get("error")
  const error = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.default) : null
  const [dismissedError, setDismissedError] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState<"google" | "facebook" | null>(null)

  function handleGoogle() {
    setLoadingProvider("google")
    signIn("google", { callbackUrl })
  }

  function handleFacebook() {
    setLoadingProvider("facebook")
    signIn("facebook", { callbackUrl })
  }

  const showError = error && !dismissedError

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <main className="flex-1 grid place-items-center px-4 py-12">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-md bg-[#007cdc] text-white grid place-items-center font-bold text-lg mb-2">RG</div>
            <CardTitle className="text-2xl">Sign in to PlayBeat</CardTitle>
            <CardDescription>
              Continue with Google or Facebook to access Rapid Gateway checkout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {showError && (
              <Alert variant="destructive" className="text-left relative pr-9">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm">{error!.title}</AlertTitle>
                <AlertDescription className="text-xs mt-1">{error!.body}</AlertDescription>
                <button
                  type="button"
                  onClick={() => setDismissedError(true)}
                  className="absolute top-2 right-2 text-rose-700/70 hover:text-rose-900"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Alert>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 bg-white hover:bg-slate-50"
              onClick={handleGoogle}
              disabled={loadingProvider !== null}
            >
              {loadingProvider === "google" ? (
                <Loader2 className="h-4 w-4 mr-3 animate-spin" />
              ) : (
                <GoogleIcon className="h-5 w-5 mr-3" />
              )}
              Continue with Google
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 bg-white hover:bg-slate-50"
              onClick={handleFacebook}
              disabled={loadingProvider !== null}
            >
              {loadingProvider === "facebook" ? (
                <Loader2 className="h-4 w-4 mr-3 animate-spin" />
              ) : (
                <FacebookIcon className="h-5 w-5 mr-3" />
              )}
              Continue with Facebook
            </Button>

            <div className="pt-2 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              No sign-up form. We use your real Google / Facebook identity only.
            </div>
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginButtons />
    </Suspense>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8v8.44C19.61 23.08 24 18.09 24 12.07z" />
    </svg>
  )
}
