// Demo mode only (a dev server without Supabase settings): a fake user who is signed in straight
// away. Every call succeeds after a short, realistic pause. AuthProvider only reaches this behind
// an import.meta.env.DEV check, so production builds leave the whole module out.

import type { Session, User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue, type PasswordSetupReason } from './authContext'
import { AuthFlowContext, passwordSetupFor, usePendingPasswordSetup, type AuthFlow } from './authFlow'
import { getCapturedAuthRedirect } from './captureAuthRedirect'

const SIGNED_OUT_KEY = 'redpen.demoSignedOut'
const DEMO_USER_ID = '00000000-0000-4000-8000-0000000000de'

function createDemoSession(): Session {
  const now = new Date().toISOString()
  const user: User = {
    id: DEMO_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'demo@redpen.local',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: now,
    confirmed_at: now,
    email_confirmed_at: now,
    last_sign_in_at: now,
  }
  return {
    access_token: 'demo',
    refresh_token: 'demo',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  }
}

function readSignedOut(): boolean {
  try {
    return window.sessionStorage.getItem(SIGNED_OUT_KEY) === '1'
  } catch {
    return false
  }
}

function storeSignedOut(signedOut: boolean) {
  try {
    if (signedOut) window.sessionStorage.setItem(SIGNED_OUT_KEY, '1')
    else window.sessionStorage.removeItem(SIGNED_OUT_KEY)
  } catch {
    // Not important in the demo.
  }
}

function pause(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [captured] = useState(getCapturedAuthRedirect)
  const [session, setSession] = useState<Session | null>(() => (readSignedOut() ? null : createDemoSession()))
  const [pendingPassword, setPendingPassword] = usePendingPasswordSetup()
  const [linkError, setLinkError] = useState<string | null>(captured.linkError)
  const [signedOutByUser, setSignedOutByUser] = useState(false)

  useEffect(() => {
    if (captured.passwordSetup) setPendingPassword({ userId: DEMO_USER_ID, reason: captured.passwordSetup })
  }, [captured, setPendingPassword])

  const signIn = useCallback(async () => {
    await pause(500)
    storeSignedOut(false)
    setSignedOutByUser(false)
    setLinkError(null)
    setSession(createDemoSession())
  }, [])

  const signOut = useCallback(async () => {
    await pause(150)
    storeSignedOut(true)
    setSignedOutByUser(true)
    setPendingPassword(null)
    setSession(null)
    queryClient.clear()
  }, [queryClient, setPendingPassword])

  const sendPasswordReset = useCallback(async () => {
    await pause(700)
  }, [])

  const updatePassword = useCallback(async () => {
    await pause(600)
    setPendingPassword(null)
  }, [setPendingPassword])

  const verifyEmailLink = useCallback(
    async (_tokenHash: string, type: PasswordSetupReason) => {
      await pause(900)
      storeSignedOut(false)
      setSignedOutByUser(false)
      setLinkError(null)
      setPendingPassword({ userId: DEMO_USER_ID, reason: type })
      setSession((current) => current ?? createDemoSession())
    },
    [setPendingPassword],
  )

  const clearLinkError = useCallback(() => setLinkError(null), [])

  const status = session ? 'signedIn' : 'signedOut'
  const passwordSetup = passwordSetupFor(pendingPassword, session?.user.id)
  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      session,
      passwordSetup,
      linkError,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
      verifyEmailLink,
      clearLinkError,
    }),
    [status, session, passwordSetup, linkError, signIn, signOut, sendPasswordReset, updatePassword, verifyEmailLink, clearLinkError],
  )
  const flow = useMemo<AuthFlow>(() => ({ signedOutByUser }), [signedOutByUser])

  return (
    <AuthContext value={value}>
      <AuthFlowContext value={flow}>{children}</AuthFlowContext>
    </AuthContext>
  )
}
