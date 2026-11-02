// User-facing error copy. Components show friendlyError(error), never raw exception text.
// Handles Supabase AuthError (.code / .status / .name), PostgrestError and PostgREST error
// objects (.code / .message / .details), fetch failures, and our own FriendlyError.

/** An error whose message is already written for the user and is shown as it is. */
export class FriendlyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FriendlyError'
  }
}

export const OFFLINE_MESSAGE = 'You seem to be offline. Check your connection and try again.'
export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.'
export const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.'

/**
 * What record_review raises when a card changed under the client (PostgREST: HTTP 409). Must stay
 * in step with the migration. Never SQLSTATE 40001: PostgREST 14 retries that endlessly.
 */
export const CARD_CONFLICT_CODE = 'PT409'

interface ErrorFields {
  name: string
  message: string
  code: string
  status: number | null
  details: string
  reasons: string[]
}

function readFields(error: unknown): ErrorFields {
  const fields: ErrorFields = { name: '', message: '', code: '', status: null, details: '', reasons: [] }
  if (typeof error === 'string') {
    fields.message = error
    return fields
  }
  if (typeof error !== 'object' || error === null) return fields

  const record = error as Record<string, unknown>
  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  fields.name = text(record.name)
  fields.message = text(record.message)
  fields.code = typeof record.code === 'number' ? String(record.code) : text(record.code)
  fields.details = text(record.details)
  if (typeof record.status === 'number') fields.status = record.status
  if (Array.isArray(record.reasons)) {
    fields.reasons = record.reasons.filter((r): r is string => typeof r === 'string')
  }
  return fields
}

const NETWORK_PATTERN =
  /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet_disconnected|err_network/i

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function isNetworkFailure(f: ErrorFields): boolean {
  // Auth retries 502/503/504 responses with the same error class; those keep their status.
  if (f.name === 'AuthRetryableFetchError') return !f.status
  if (f.name === 'FunctionsFetchError') return true
  // PostgREST reports a failed fetch as { code: '', message: 'TypeError: Failed to fetch' }.
  return NETWORK_PATTERN.test(f.message)
}

function weakPasswordMessage(f: ErrorFields): string {
  if (f.reasons.includes('pwned')) {
    return 'That password has appeared in a data breach. Please choose a different one.'
  }
  const minLength = /at least (\d+) characters/i.exec(f.message)?.[1]
  if (f.reasons.includes('length') || minLength) {
    return minLength
      ? `That password is too short. Use at least ${minLength} characters.`
      : 'That password is too short. Please choose a longer one.'
  }
  if (f.reasons.includes('characters')) {
    return 'That password needs a mix of letters, numbers and symbols.'
  }
  return 'That password is too weak. Please choose a stronger one.'
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "That email and password don't match. Please check them and try again.",
  email_not_confirmed: 'Please confirm your email address first. The link is in your inbox.',
  over_email_send_rate_limit:
    'Too many emails have been sent recently. Please wait a while before trying again.',
  over_request_rate_limit: 'Too many attempts in a short time. Please wait a minute and try again.',
  same_password: 'Your new password must be different from your current one.',
  otp_expired: 'This link has expired or has already been used. Please ask for a new one.',
  flow_state_expired: 'This link has expired. Please ask for a new one.',
  signup_disabled: 'Redpen is invite-only. Ask whoever runs it to send you an invitation.',
  user_banned: 'This account has been disabled.',
  email_address_invalid: 'Please enter a valid email address.',
  email_address_not_authorized: "Emails can't be sent to that address.",
  user_not_found: "We couldn't find an account with that email address.",
  session_not_found: SESSION_EXPIRED_MESSAGE,
  session_expired: SESSION_EXPIRED_MESSAGE,
  refresh_token_not_found: SESSION_EXPIRED_MESSAGE,
  refresh_token_already_used: SESSION_EXPIRED_MESSAGE,
  bad_jwt: SESSION_EXPIRED_MESSAGE,
  no_authorization: SESSION_EXPIRED_MESSAGE,
  reauthentication_needed: 'For your security, please sign in again before changing your password.',
  request_timeout: 'That took too long. Please try again.',
}

/** Supabase AuthError: either a code we know, a named client-side error, or a status. */
function authMessage(f: ErrorFields): string | null {
  if (f.code === 'weak_password' || f.name === 'AuthWeakPasswordError') return weakPasswordMessage(f)
  const byCode = AUTH_MESSAGES[f.code]
  if (byCode) return byCode
  if (f.code === 'validation_failed' && /email/i.test(f.message)) {
    return AUTH_MESSAGES.email_address_invalid ?? null
  }
  if (f.name === 'AuthSessionMissingError' || f.name === 'AuthInvalidJwtError') {
    return SESSION_EXPIRED_MESSAGE
  }
  if (f.name === 'AuthInvalidCredentialsError') {
    return 'Please enter your email address and password.'
  }
  if (f.name === 'AuthImplicitGrantRedirectError') {
    return 'This link is invalid or has expired. Please ask for a new one.'
  }
  // Older Auth servers send messages without codes.
  if (/invalid login credentials/i.test(f.message)) return AUTH_MESSAGES.invalid_credentials ?? null
  if (/email not confirmed/i.test(f.message)) return AUTH_MESSAGES.email_not_confirmed ?? null
  return null
}

/** Postgres SQLSTATE and PostgREST (PGRST...) codes. */
function databaseMessage(f: ErrorFields): string | null {
  const text = `${f.message} ${f.details}`
  switch (f.code) {
    case '23505':
      return /topic/i.test(text)
        ? 'You already have a topic with that name in this subject.'
        : 'That already exists.'
    case '23503':
      return /topic/i.test(text)
        ? "That topic isn't available for this subject. Choose another topic and try again."
        : 'Something this depends on no longer exists. Please refresh and try again.'
    case '23514':
    case '23502':
    case '22P02':
      return "Some of the details aren't valid. Please check them and try again."
    case '22001':
      return "That's longer than allowed. Please shorten it and try again."
    case '42501':
      return "You don't have permission to do that. Try signing out and in again."
    case 'P0002':
      return /review/i.test(f.message)
        ? "That answer couldn't be found. It may have been deleted."
        : "That card couldn't be found. It may have been deleted."
    case 'PGRST116':
      return "We couldn't find that. It may have been deleted."
    case '22023':
      return "That mark couldn't be saved. Please close this review and try again."
    case CARD_CONFLICT_CODE:
      return 'This card was just changed on another device. Please try again.'
    case '55000':
      return 'Only your most recent answer to a card can be changed.'
    case '57014':
      return 'That took too long. Please try again.'
    case 'PGRST301':
    case 'PGRST302':
    case 'PGRST303':
      return SESSION_EXPIRED_MESSAGE
  }
  if (/jwt expired/i.test(f.message)) return SESSION_EXPIRED_MESSAGE
  return null
}

function statusMessage(status: number | null): string | null {
  if (status === null) return null
  if (status === 429) return AUTH_MESSAGES.over_request_rate_limit ?? null
  if (status === 401) return SESSION_EXPIRED_MESSAGE
  if (status === 0) return OFFLINE_MESSAGE
  if (status === 503 || status === 504 || status === 540 || status === 544) {
    return "Redpen can't reach its server right now. Please try again in a moment."
  }
  return null
}

/** Whether an error from the data layer carries this Postgres or PostgREST code. */
export function hasErrorCode(error: unknown, code: string): boolean {
  return readFields(error).code === code
}

/** Calm, specific copy for any error thrown by the data layer, Supabase or the browser. */
export function friendlyError(error: unknown): string {
  if (error instanceof FriendlyError) return error.message

  const fields = readFields(error)
  if (isOffline() || isNetworkFailure(fields)) return OFFLINE_MESSAGE

  const isAuthError =
    fields.name.startsWith('Auth') ||
    (typeof error === 'object' && error !== null && '__isAuthError' in error)

  return (
    (isAuthError ? authMessage(fields) : null) ??
    databaseMessage(fields) ??
    (isAuthError ? null : authMessage(fields)) ??
    statusMessage(fields.status) ??
    DEFAULT_ERROR_MESSAGE
  )
}
