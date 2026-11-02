// Reads what an emailed auth link left in the URL, once, before anything else runs.
//
// main.tsx imports this module first. With the implicit flow, Supabase's default email templates
// send people back to the site with the outcome in the URL fragment:
//   #access_token=...&refresh_token=...&type=invite|recovery|signup|magiclink
//   #error=access_denied&error_code=otp_expired&error_description=...
// This module keeps the tokens in memory, along with the link type and a friendly version of any
// error, and takes the fragment out of the current history entry at once. That has to happen
// before anything pushes a new entry, or the tokens stay behind the Back button.
//
// AuthProvider hands the tokens to supabase-js, which no longer reads the URL itself.
// Tokens only count from the fragment, never the query string.
//
// It imports only types: the point is to run before anything else, the router above all.

import type { PasswordSetupReason } from './authContext'

export interface LinkTokens {
  accessToken: string
  refreshToken: string
}

export interface CapturedAuthRedirect {
  /** invite or recovery when the URL carried a session from that kind of link. */
  passwordSetup: PasswordSetupReason | null
  /** Calm copy for a failed link (expired, already used, ...). */
  linkError: string | null
  /** The session the link carried, for AuthProvider to hand to supabase-js. */
  tokens: LinkTokens | null
}

const EXPIRED_LINK = 'That link has expired or has already been used. Ask for a new one.'
const BROKEN_LINK = "That link didn't work. It may be incomplete or out of date. Ask for a new one."

/** Error codes GoTrue puts in the redirect URL, mapped to copy for the sign-in page. */
const LINK_ERRORS: Record<string, string> = {
  otp_expired: EXPIRED_LINK,
  flow_state_expired: EXPIRED_LINK,
  flow_state_not_found: EXPIRED_LINK,
  bad_code_verifier: EXPIRED_LINK,
  user_banned: 'This account has been disabled. Ask whoever runs Redpen for help.',
  signup_disabled: 'Redpen is invite-only. Ask whoever runs it to send you an invitation.',
  email_address_not_authorized: "That address can't be used with Redpen. Ask whoever runs it for help.",
}

/** What marks a fragment as an auth link's result rather than the page's own. */
const AUTH_FRAGMENT_KEYS = ['access_token', 'refresh_token', 'error', 'error_code', 'error_description']

function fragmentParams(hash: string): URLSearchParams {
  return new URLSearchParams(hash.replace(/^#\/?/, ''))
}

/** Works out what a link's URL says, from location.hash and location.search. */
export function parseAuthRedirect(hash: string, search: string): CapturedAuthRedirect {
  const fragment = fragmentParams(hash)
  const query = new URLSearchParams(search)
  // Errors can arrive in either; where implicit-flow results live, the fragment, wins.
  const errorParam = (name: string) => fragment.get(name) ?? query.get(name)

  let linkError: string | null = null
  const error = errorParam('error')
  const errorCode = errorParam('error_code')
  // Only GoTrue's own redirect errors: other pages are free to use ?error= for themselves.
  if ((error || errorCode) && (errorParam('error_description') !== null || errorCode)) {
    linkError = (errorCode ? LINK_ERRORS[errorCode] : undefined) ?? (error === 'access_denied' ? EXPIRED_LINK : BROKEN_LINK)
  }

  const accessToken = fragment.get('access_token')
  const refreshToken = fragment.get('refresh_token')
  const tokens = accessToken && refreshToken && !linkError ? { accessToken, refreshToken } : null
  if (!tokens && !linkError && (fragment.has('access_token') || fragment.has('refresh_token'))) linkError = BROKEN_LINK

  const type = fragment.get('type')
  const passwordSetup: PasswordSetupReason | null = tokens && (type === 'invite' || type === 'recovery') ? type : null

  return { passwordSetup, linkError, tokens }
}

function capture(): CapturedAuthRedirect {
  if (typeof window === 'undefined') return { passwordSetup: null, linkError: null, tokens: null }
  const { hash, pathname, search } = window.location
  const result = parseAuthRedirect(hash, search)
  const fragment = fragmentParams(hash)
  if (AUTH_FRAGMENT_KEYS.some((key) => fragment.has(key))) {
    window.history.replaceState(window.history.state, '', `${pathname}${search}`)
  }
  return result
}

const captured: CapturedAuthRedirect = capture()

/** What the URL said when the app started. Read by AuthProvider; the value never changes. */
export function getCapturedAuthRedirect(): CapturedAuthRedirect {
  return captured
}
