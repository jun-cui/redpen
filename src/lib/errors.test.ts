import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthWeakPasswordError,
  PostgrestError,
} from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CARD_CONFLICT_CODE,
  DEFAULT_ERROR_MESSAGE,
  friendlyError,
  FriendlyError,
  hasErrorCode,
  OFFLINE_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
} from './errors'

function postgrest(code: string, message: string, details = ''): PostgrestError {
  return new PostgrestError({ code, message, details, hint: '' })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('friendlyError: connection problems', () => {
  it('recognises a failed fetch in every browser', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toBe(OFFLINE_MESSAGE)
    expect(friendlyError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(
      OFFLINE_MESSAGE,
    )
    expect(friendlyError(new TypeError('Load failed'))).toBe(OFFLINE_MESSAGE)
  })

  it('recognises PostgREST and Auth network failures', () => {
    expect(friendlyError({ code: '', message: 'TypeError: Failed to fetch', details: '', hint: '' })).toBe(
      OFFLINE_MESSAGE,
    )
    expect(friendlyError(new AuthRetryableFetchError('Failed to fetch', 0))).toBe(OFFLINE_MESSAGE)
  })

  it('uses the browser offline flag', () => {
    vi.stubGlobal('navigator', { onLine: false })
    expect(friendlyError(new Error('anything'))).toBe(OFFLINE_MESSAGE)
  })

  it('does not call a server outage "offline"', () => {
    expect(friendlyError(new AuthRetryableFetchError('Service Unavailable', 503))).toMatch(
      /can't reach its server/,
    )
  })
})

describe('friendlyError: auth', () => {
  it('explains wrong credentials and unconfirmed email', () => {
    expect(
      friendlyError(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials')),
    ).toBe("That email and password don't match. Please check them and try again.")
    expect(friendlyError(new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'))).toMatch(
      /confirm your email/,
    )
    // Older servers send no code.
    expect(friendlyError(new AuthApiError('Invalid login credentials', 400, undefined))).toMatch(
      /don't match/,
    )
  })

  it('asks the user to wait when rate limited', () => {
    expect(
      friendlyError(new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit')),
    ).toMatch(/Too many emails/)
    expect(friendlyError(new AuthApiError('Too many requests', 429, undefined))).toMatch(
      /wait a minute/,
    )
  })

  it('explains a weak password', () => {
    expect(
      friendlyError(
        new AuthWeakPasswordError('Password should be at least 8 characters.', 422, ['length']),
      ),
    ).toBe('That password is too short. Use at least 8 characters.')
    expect(friendlyError(new AuthWeakPasswordError('Password is known to be weak', 422, ['pwned']))).toMatch(
      /data breach/,
    )
    expect(
      friendlyError(new AuthApiError('Password should contain letters', 422, 'weak_password')),
    ).toBe('That password is too weak. Please choose a stronger one.')
  })

  it('asks the user to sign in again when the session has gone', () => {
    expect(friendlyError(new AuthSessionMissingError())).toBe(SESSION_EXPIRED_MESSAGE)
    expect(friendlyError(new AuthApiError('Session not found', 403, 'session_not_found'))).toBe(
      SESSION_EXPIRED_MESSAGE,
    )
    expect(friendlyError(postgrest('PGRST303', 'JWT expired'))).toBe(SESSION_EXPIRED_MESSAGE)
    expect(friendlyError({ message: 'JWT expired' })).toBe(SESSION_EXPIRED_MESSAGE)
  })

  it('explains expired email links', () => {
    expect(
      friendlyError(new AuthApiError('Email link is invalid or has expired', 403, 'otp_expired')),
    ).toMatch(/expired or has already been used/)
  })
})

describe('friendlyError: database', () => {
  it('explains a duplicate topic name', () => {
    expect(
      friendlyError(
        postgrest('23505', 'duplicate key value violates unique constraint "topics_user_subject_name_key"'),
      ),
    ).toBe('You already have a topic with that name in this subject.')
    expect(friendlyError(postgrest('23505', 'duplicate key value violates unique constraint "x"'))).toBe(
      'That already exists.',
    )
  })

  it('explains permission, missing rows and invalid input', () => {
    expect(friendlyError(postgrest('42501', 'new row violates row-level security policy'))).toMatch(
      /permission/,
    )
    expect(friendlyError(postgrest('P0002', 'Card not found'))).toMatch(/card couldn't be found/)
    expect(friendlyError(postgrest('PGRST116', 'JSON object requested'))).toMatch(/couldn't find/)
    expect(friendlyError(postgrest('23514', 'violates check constraint "cards_key_points_check"'))).toMatch(
      /aren't valid/,
    )
    expect(
      friendlyError(postgrest('23503', 'violates foreign key constraint "cards_topic_id_user_id_subject_fkey"')),
    ).toMatch(/topic isn't available/)
  })

  it('explains record_review rejections', () => {
    expect(friendlyError(postgrest('22023', 'Rating 3 does not match a score of 1/2'))).toBe(
      "That mark couldn't be saved. Please close this review and try again.",
    )
    expect(
      friendlyError(postgrest('55000', 'Only the most recent review of a card can be changed')),
    ).toBe('Only your most recent answer to a card can be changed.')
  })

  it('stays calm when a card changed under a save', () => {
    expect(friendlyError(postgrest(CARD_CONFLICT_CODE, 'Card changed since it was shown'))).toBe(
      'This card was just changed on another device. Please try again.',
    )
  })

  it('never uses 40001 for a conflict: PostgREST 14 retries that SQLSTATE endlessly', () => {
    expect(CARD_CONFLICT_CODE).toBe('PT409')
  })
})

describe('hasErrorCode', () => {
  it('reads the code of database errors and plain objects', () => {
    expect(hasErrorCode(postgrest('P0002', 'Card not found'), 'P0002')).toBe(true)
    expect(hasErrorCode({ code: CARD_CONFLICT_CODE, message: 'Changed' }, CARD_CONFLICT_CODE)).toBe(true)
    expect(hasErrorCode(postgrest('22023', 'Bad input'), 'P0002')).toBe(false)
  })

  it('is false for anything without one', () => {
    expect(hasErrorCode(new Error('boom'), 'P0002')).toBe(false)
    expect(hasErrorCode('P0002', 'P0002')).toBe(false)
    expect(hasErrorCode(null, 'P0002')).toBe(false)
  })
})

describe('friendlyError: anything else', () => {
  it('never shows raw technical text', () => {
    expect(friendlyError(new Error('Cannot read properties of undefined (reading "id")'))).toBe(
      DEFAULT_ERROR_MESSAGE,
    )
    expect(friendlyError(postgrest('XX000', 'internal error'))).toBe(DEFAULT_ERROR_MESSAGE)
    expect(friendlyError('boom')).toBe(DEFAULT_ERROR_MESSAGE)
    expect(friendlyError(null)).toBe(DEFAULT_ERROR_MESSAGE)
    expect(friendlyError(undefined)).toBe(DEFAULT_ERROR_MESSAGE)
    expect(friendlyError(42)).toBe(DEFAULT_ERROR_MESSAGE)
  })

  it('shows messages written for the user as they are', () => {
    expect(friendlyError(new FriendlyError('Add at least one key point.'))).toBe(
      'Add at least one key point.',
    )
  })
})
