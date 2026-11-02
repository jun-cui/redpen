// Turns the tokens from an email link (see ./captureAuthRedirect) into a session. A link can only
// be used once, so this is the person's way in: a dropped connection deserves another go, and if
// it still fails they need to be told what to do next.

import { isAuthRetryableFetchError, type AuthResponse } from '@supabase/supabase-js'
import type { PasswordSetupReason } from './authContext'
import type { LinkTokens } from './captureAuthRedirect'

/** A short wait, spent on the splash, so a brief drop in the connection can pass. */
const RETRY_DELAY_MS = 1500

/** Couldn't reach the server, or the server turned the tokens down. */
export type LinkFailure = 'network' | 'rejected'

export type LinkHandoff = { userId: string; failure: null } | { userId: null; failure: LinkFailure }

type SetSession = (session: { access_token: string; refresh_token: string }) => Promise<AuthResponse>

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** Hands the tokens to `setSession`, retrying once after a network failure. Never rejects. */
export async function handOffLinkTokens(
  { accessToken, refreshToken }: LinkTokens,
  setSession: SetSession,
  retryDelayMs = RETRY_DELAY_MS,
): Promise<LinkHandoff> {
  const attempt = async (): Promise<LinkHandoff> => {
    try {
      const { data, error } = await setSession({ access_token: accessToken, refresh_token: refreshToken })
      if (data.session) return { userId: data.session.user.id, failure: null }
      return { userId: null, failure: isAuthRetryableFetchError(error) ? 'network' : 'rejected' }
    } catch {
      return { userId: null, failure: 'rejected' }
    }
  }

  const first = await attempt()
  if (first.failure !== 'network') return first
  await wait(retryDelayMs)
  return attempt()
}

const UNFINISHED: Record<PasswordSetupReason | 'other', string> = {
  invite: 'We couldn’t finish setting up your account from that link.',
  recovery: 'We couldn’t finish resetting your password from that link.',
  other: 'We couldn’t finish signing you in from that link.',
}

/** Copy for the sign-in page. "Forgot password?" works for invited accounts too. */
export function linkHandoffMessage(reason: PasswordSetupReason | null, failure: LinkFailure): string {
  const nextStep =
    failure === 'network'
      ? 'Check your connection, then tap Forgot password to get a new link.'
      : 'Tap Forgot password to get a new link.'
  return `${UNFINISHED[reason ?? 'other']} ${nextStep}`
}
