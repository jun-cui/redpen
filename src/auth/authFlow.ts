// Internal auth details shared by the providers, the route guards and the auth screens.
// Not part of the useAuth() contract.

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { NavigateFunction } from 'react-router'
import type { PasswordSetupReason } from './authContext'

export interface AuthFlow {
  /** The last sign-out was the person's own choice (not an expired session). */
  signedOutByUser: boolean
}

export const AuthFlowContext = createContext<AuthFlow>({ signedOutByUser: false })

export function useAuthFlow(): AuthFlow {
  return useContext(AuthFlowContext)
}

// ---------------------------------------------------------------------------
// The password step an invite or reset link leaves pending. It lives where the session does, so
// a reload, a new tab or a restarted browser can't skip it, and it names its user, so it can't
// follow someone else who signs in on this device.
// ---------------------------------------------------------------------------

const PASSWORD_SETUP_KEY = 'redpen.passwordSetup'

export interface PendingPasswordSetup {
  userId: string
  reason: PasswordSetupReason
}

export function readStoredPasswordSetup(): PendingPasswordSetup | null {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(PASSWORD_SETUP_KEY) ?? 'null')
    if (typeof stored !== 'object' || stored === null) return null
    const { userId, reason } = stored as Partial<PendingPasswordSetup>
    return typeof userId === 'string' && (reason === 'invite' || reason === 'recovery') ? { userId, reason } : null
  } catch {
    return null
  }
}

export function storePasswordSetup(value: PendingPasswordSetup | null): void {
  try {
    if (value) window.localStorage.setItem(PASSWORD_SETUP_KEY, JSON.stringify(value))
    else window.localStorage.removeItem(PASSWORD_SETUP_KEY)
  } catch {
    // Storage blocked (private mode): the state still holds for this page view.
  }
}

/** What the signed-in user has to do, if anything. */
export function passwordSetupFor(
  pending: PendingPasswordSetup | null,
  userId: string | undefined,
): PasswordSetupReason | null {
  return pending && pending.userId === userId ? pending.reason : null
}

/** The pending step and its setter, kept in step with other open tabs. */
export function usePendingPasswordSetup() {
  const [pending, setPending] = useState(readStoredPasswordSetup)

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      // A null key means all of localStorage was cleared.
      if (event.key === PASSWORD_SETUP_KEY || event.key === null) setPending(readStoredPasswordSetup())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const update = useCallback((value: PendingPasswordSetup | null) => {
    storePasswordSetup(value)
    setPending(value)
  }, [])

  return [pending, update] as const
}

// ---------------------------------------------------------------------------
// Where to go after signing in
// ---------------------------------------------------------------------------

const AUTH_PATHS = ['/login', '/forgot-password', '/auth/confirm', '/set-password']

/**
 * A same-site path from a `next` query parameter, or null. Rejects other origins
 * ("//evil.example", "/\\evil.example", "https://..."), and the auth screens themselves.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
  try {
    const url = new URL(next, window.location.origin)
    if (url.origin !== window.location.origin) return null
    // Parsing collapses dot segments, so "/.//evil.example" only shows its "//" at this point.
    if (url.pathname.startsWith('//')) return null
    if (AUTH_PATHS.includes(url.pathname)) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

/** The sign-in URL that brings the person back to `path` afterwards. */
export function loginPathFor(path: string): string {
  const next = safeNextPath(path)
  return next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login'
}

/**
 * Leaves for `to`, or for home if the router refuses it: after a password is saved, a bad `next`
 * must never strand someone on the form.
 */
export async function navigateOrHome(navigate: NavigateFunction, to: string): Promise<void> {
  try {
    await navigate(to, { replace: true })
  } catch {
    await navigate('/', { replace: true })
  }
}
