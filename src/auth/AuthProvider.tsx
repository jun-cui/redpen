// Supplies useAuth(). With Supabase configured it wraps supabase.auth; in demo mode (a dev server
// without Supabase settings) a fake user is signed in straight away (see ./demoAuth).

import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isDemoMode } from '../lib/env'
import { supabase } from '../lib/supabase'
import { AuthContext, type AuthContextValue, type AuthStatus, type PasswordSetupReason } from './authContext'
import { AuthFlowContext, passwordSetupFor, usePendingPasswordSetup, type AuthFlow } from './authFlow'
import { getCapturedAuthRedirect, type LinkTokens } from './captureAuthRedirect'
import { DemoAuthProvider } from './demoAuth'
import { handOffLinkTokens, linkHandoffMessage, type LinkHandoff } from './linkHandoff'

export interface AuthProviderProps {
  children: ReactNode
}

/**
 * Provides the signed-in state to the app. Must sit inside <QueryClientProvider>: the query cache
 * is cleared on sign-out and whenever the signed-in user changes, so one person's data never
 * shows to the next.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  // import.meta.env.DEV is a build-time constant, so production builds drop the demo branch.
  if (import.meta.env.DEV && isDemoMode) return <DemoAuthProvider>{children}</DemoAuthProvider>
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
}

/** Supabase answers "no such user" in a few ways; none of them may reach the screen. */
function isAccountLookupError(error: { code?: string; status?: number; message?: string }): boolean {
  if (error.code === 'user_not_found') return true
  return (error.status === 404 || error.status === 400) && /user not found|no user/i.test(error.message ?? '')
}

/** One hand-off per page load, even when React runs the effect twice (development). */
let linkHandoff: Promise<LinkHandoff> | undefined

function handOffOnce(tokens: LinkTokens): Promise<LinkHandoff> {
  linkHandoff ??= handOffLinkTokens(tokens, (session) => supabase.auth.setSession(session))
  return linkHandoff
}

interface SessionState {
  status: AuthStatus
  session: Session | null
}

function SupabaseAuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient()
  const [captured] = useState(getCapturedAuthRedirect)
  const [{ status, session }, setSessionState] = useState<SessionState>({ status: 'loading', session: null })
  const [pendingPassword, setPendingPassword] = usePendingPasswordSetup()
  const [linkError, setLinkError] = useState<string | null>(captured.linkError)
  const [signedOutByUser, setSignedOutByUser] = useState(false)
  /** undefined until the first auth event: there is no previous user to compare with yet. */
  const lastUserId = useRef<string | null | undefined>(undefined)
  /** A link's tokens are on their way to supabase-js: whoever it reports until then isn't final. */
  const handingOff = useRef(captured.tokens !== null)

  useEffect(() => {
    let active = true

    // Only state updates in here: supabase-js warns against awaiting its own calls inside this
    // callback, which runs while it holds its auth lock.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      const userId = next?.user.id ?? null
      if (lastUserId.current !== undefined && lastUserId.current !== userId) {
        // Before React renders the new user, so nothing cached for the old one can show.
        queryClient.clear()
      }
      lastUserId.current = userId

      if (event === 'PASSWORD_RECOVERY' && next) setPendingPassword({ userId: next.user.id, reason: 'recovery' })
      if (event === 'SIGNED_OUT') setPendingPassword(null)
      if (!handingOff.current) setSessionState({ status: next ? 'signedIn' : 'signedOut', session: next })
    })

    // The INITIAL_SESSION event above normally settles the first status. Asking directly as well
    // means the splash can never outstay a missed event; it only counts while still loading.
    // A link's tokens go first, and an existing session that outlasts a failed link stays quiet.
    const settleFirstStatus = async () => {
      const handoff = captured.tokens ? await handOffOnce(captured.tokens) : null
      const initial = await supabase.auth.getSession().then(
        (result) => result.data.session,
        () => null,
      )
      if (!active) return
      if (handoff?.userId && captured.passwordSetup) {
        setPendingPassword({ userId: handoff.userId, reason: captured.passwordSetup })
      }
      if (handoff?.failure && !initial) setLinkError(linkHandoffMessage(captured.passwordSetup, handoff.failure))
      handingOff.current = false
      setSessionState((current) =>
        current.status === 'loading' ? { status: initial ? 'signedIn' : 'signedOut', session: initial } : current,
      )
    }
    void settleFirstStatus()

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [captured, queryClient, setPendingPassword])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
    setSignedOutByUser(false)
    setLinkError(null)
  }, [])

  const signOut = useCallback(async () => {
    setSignedOutByUser(true)
    // This device only: signing out on a laptop shouldn't sign the phone out too.
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) {
      // supabase-js still drops the local session when the server can't be reached; only a
      // session that is somehow still here counts as a failure.
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setSignedOutByUser(false)
        throw error
      }
    }
    setPendingPassword(null)
    queryClient.clear()
  }, [queryClient, setPendingPassword])

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/set-password`,
    })
    // Same answer whether or not the account exists; rate limits and network errors still show.
    if (error && !isAccountLookupError(error)) throw error
  }, [])

  const updatePassword = useCallback(
    async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPendingPassword(null)
    },
    [setPendingPassword],
  )

  const verifyEmailLink = useCallback(
    async (tokenHash: string, type: PasswordSetupReason) => {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      if (error) throw error
      if (data.user) setPendingPassword({ userId: data.user.id, reason: type })
      setSignedOutByUser(false)
      setLinkError(null)
    },
    [setPendingPassword],
  )

  const clearLinkError = useCallback(() => setLinkError(null), [])

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
