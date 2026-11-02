import { AuthApiError, AuthInvalidJwtError, AuthRetryableFetchError, type AuthResponse } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { handOffLinkTokens, linkHandoffMessage } from './linkHandoff'

const tokens = { accessToken: 'the-access', refreshToken: 'the-refresh' }

const signedIn = (id: string) =>
  ({ data: { user: { id }, session: { user: { id } } }, error: null }) as unknown as AuthResponse
const failed = (error: Error) => ({ data: { user: null, session: null }, error }) as unknown as AuthResponse

const offline = () => failed(new AuthRetryableFetchError('Failed to fetch', 0))
const rejected = () => failed(new AuthApiError('Invalid JWT', 401, 'bad_jwt'))

describe('handOffLinkTokens', () => {
  it('passes the tokens on and reports who signed in', async () => {
    const setSession = vi.fn(async () => signedIn('bob'))
    await expect(handOffLinkTokens(tokens, setSession, 0)).resolves.toEqual({ userId: 'bob', failure: null })
    expect(setSession.mock.calls).toEqual([[{ access_token: 'the-access', refresh_token: 'the-refresh' }]])
  })

  it('tries once more after a network failure', async () => {
    const setSession = vi.fn<() => Promise<AuthResponse>>().mockResolvedValueOnce(offline()).mockResolvedValueOnce(signedIn('bob'))
    await expect(handOffLinkTokens(tokens, setSession, 0)).resolves.toEqual({ userId: 'bob', failure: null })
    expect(setSession).toHaveBeenCalledTimes(2)
  })

  it('waits before trying again', async () => {
    vi.useFakeTimers()
    try {
      const setSession = vi.fn(async () => offline())
      const handoff = handOffLinkTokens(tokens, setSession, 1000)
      await vi.advanceTimersByTimeAsync(999)
      expect(setSession).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(setSession).toHaveBeenCalledTimes(2)
      await handoff
    } finally {
      vi.useRealTimers()
    }
  })

  it('gives up after the second network failure', async () => {
    const setSession = vi.fn(async () => offline())
    await expect(handOffLinkTokens(tokens, setSession, 0)).resolves.toEqual({ userId: null, failure: 'network' })
    expect(setSession).toHaveBeenCalledTimes(2)
  })

  it('counts a gateway error as a network failure', async () => {
    const setSession = vi.fn(async () => failed(new AuthRetryableFetchError('Bad gateway', 502)))
    await expect(handOffLinkTokens(tokens, setSession, 0)).resolves.toEqual({ userId: null, failure: 'network' })
    expect(setSession).toHaveBeenCalledTimes(2)
  })

  it('reports the second failure when a retry is turned down', async () => {
    const setSession = vi.fn<() => Promise<AuthResponse>>().mockResolvedValueOnce(offline()).mockResolvedValueOnce(rejected())
    await expect(handOffLinkTokens(tokens, setSession, 0)).resolves.toEqual({ userId: null, failure: 'rejected' })
  })

  it('does not retry tokens the server turned down', async () => {
    const setSession = vi.fn(async () => rejected())
    await expect(handOffLinkTokens(tokens, setSession, 0)).resolves.toEqual({ userId: null, failure: 'rejected' })
    expect(setSession).toHaveBeenCalledTimes(1)
  })

  it('does not retry tokens that are not even well formed', async () => {
    const setSession = vi.fn(async () => failed(new AuthInvalidJwtError('Invalid JWT structure')))
    await expect(handOffLinkTokens(tokens, setSession, 0)).resolves.toEqual({ userId: null, failure: 'rejected' })
    expect(setSession).toHaveBeenCalledTimes(1)
  })

  it('treats no session and no error as a failure', async () => {
    const setSession = vi.fn(async () => ({ data: { user: null, session: null }, error: null }) as unknown as AuthResponse)
    await expect(handOffLinkTokens(tokens, setSession, 0)).resolves.toEqual({ userId: null, failure: 'rejected' })
  })

  it('never rejects, so the splash can never stay up', async () => {
    const setSession = vi.fn(async () => {
      throw new TypeError('boom')
    })
    await expect(handOffLinkTokens(tokens, setSession, 0)).resolves.toEqual({ userId: null, failure: 'rejected' })
  })
})

describe('linkHandoffMessage', () => {
  it('fits the kind of link', () => {
    expect(linkHandoffMessage('invite', 'network')).toContain('setting up your account')
    expect(linkHandoffMessage('recovery', 'network')).toContain('resetting your password')
    expect(linkHandoffMessage(null, 'network')).toContain('signing you in')
  })

  it('mentions the connection only when that was the trouble', () => {
    expect(linkHandoffMessage('invite', 'network')).toBe(
      'We couldn’t finish setting up your account from that link. Check your connection, then tap Forgot password to get a new link.',
    )
    expect(linkHandoffMessage('invite', 'rejected')).toBe(
      'We couldn’t finish setting up your account from that link. Tap Forgot password to get a new link.',
    )
  })
})
