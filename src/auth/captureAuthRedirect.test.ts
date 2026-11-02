import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseAuthRedirect } from './captureAuthRedirect'

const TOKENS = 'access_token=the-access&refresh_token=the-refresh&expires_in=3600&token_type=bearer'
const EXPIRED = 'That link has expired or has already been used. Ask for a new one.'
const BROKEN = "That link didn't work. It may be incomplete or out of date. Ask for a new one."

describe('parseAuthRedirect', () => {
  it('finds nothing in an ordinary URL', () => {
    expect(parseAuthRedirect('', '')).toEqual({ passwordSetup: null, linkError: null, tokens: null })
    expect(parseAuthRedirect('#section', '?subject=physics')).toEqual({ passwordSetup: null, linkError: null, tokens: null })
  })

  it('takes the tokens and link type from the fragment', () => {
    expect(parseAuthRedirect(`#${TOKENS}&type=invite`, '')).toEqual({
      passwordSetup: 'invite',
      linkError: null,
      tokens: { accessToken: 'the-access', refreshToken: 'the-refresh' },
    })
    expect(parseAuthRedirect(`#${TOKENS}&type=recovery`, '').passwordSetup).toBe('recovery')
    expect(parseAuthRedirect(`#/${TOKENS}&type=invite`, '').passwordSetup).toBe('invite')
  })

  it('needs no password step for the other kinds of link', () => {
    for (const type of ['signup', 'magiclink', 'email_change']) {
      const result = parseAuthRedirect(`#${TOKENS}&type=${type}`, '')
      expect(result.tokens).not.toBeNull()
      expect(result.passwordSetup).toBeNull()
    }
  })

  it('never takes tokens from the query string', () => {
    expect(parseAuthRedirect('', `?${TOKENS}&type=recovery`)).toEqual({ passwordSetup: null, linkError: null, tokens: null })
  })

  it('never takes the link type from the query string', () => {
    const result = parseAuthRedirect(`#${TOKENS}`, '?type=recovery')
    expect(result.tokens).not.toBeNull()
    expect(result.passwordSetup).toBeNull()
  })

  it('needs both tokens', () => {
    expect(parseAuthRedirect('#access_token=a&type=invite', '')).toEqual({ passwordSetup: null, linkError: BROKEN, tokens: null })
    expect(parseAuthRedirect('#refresh_token=r&type=invite', '')).toEqual({ passwordSetup: null, linkError: BROKEN, tokens: null })
  })

  it('turns an error in the fragment into calm copy', () => {
    const hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    expect(parseAuthRedirect(hash, '').linkError).toBe(EXPIRED)
  })

  it('also reads an error from the query string, with the fragment winning', () => {
    expect(parseAuthRedirect('', '?error=access_denied&error_code=otp_expired').linkError).toBe(EXPIRED)
    expect(parseAuthRedirect('#error_code=user_banned', '?error_code=otp_expired').linkError).toContain('disabled')
  })

  it('falls back on general copy for an error it does not know', () => {
    expect(parseAuthRedirect('#error=server_error&error_description=Oops', '').linkError).toBe(BROKEN)
    expect(parseAuthRedirect('#error=access_denied&error_description=Oops', '').linkError).toBe(EXPIRED)
  })

  it('leaves an unrelated ?error= alone', () => {
    expect(parseAuthRedirect('', '?error=nope').linkError).toBeNull()
  })

  it('treats a link carrying an error as an error, whatever else it says', () => {
    const result = parseAuthRedirect(`#${TOKENS}&type=recovery&error_code=otp_expired`, '')
    expect(result).toEqual({ passwordSetup: null, linkError: EXPIRED, tokens: null })
  })
})

describe('on load', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  async function load(url: string) {
    const location = new URL(url)
    const history = { state: { from: 'before' }, replaceState: vi.fn() }
    vi.stubGlobal('window', { location, history })
    vi.resetModules()
    const { getCapturedAuthRedirect } = await import('./captureAuthRedirect')
    return { captured: getCapturedAuthRedirect(), replaceState: history.replaceState }
  }

  it('removes tokens from the current history entry, keeping its state and path', async () => {
    const { captured, replaceState } = await load(`https://redpen.example/set-password?x=1#${TOKENS}&type=recovery`)
    expect(captured.tokens).toEqual({ accessToken: 'the-access', refreshToken: 'the-refresh' })
    expect(replaceState.mock.calls).toEqual([[{ from: 'before' }, '', '/set-password?x=1']])
  })

  it('removes an error link too', async () => {
    const { captured, replaceState } = await load('https://redpen.example/#error=access_denied&error_code=otp_expired')
    expect(captured.linkError).toBe(EXPIRED)
    expect(replaceState.mock.calls).toEqual([[{ from: 'before' }, '', '/']])
  })

  it('removes half a set of tokens', async () => {
    const { replaceState } = await load('https://redpen.example/#access_token=a')
    expect(replaceState).toHaveBeenCalledOnce()
  })

  it('leaves any other fragment, and every query string, alone', async () => {
    expect((await load('https://redpen.example/cards#section')).replaceState).not.toHaveBeenCalled()
    expect((await load(`https://redpen.example/?${TOKENS}`)).replaceState).not.toHaveBeenCalled()
  })
})
