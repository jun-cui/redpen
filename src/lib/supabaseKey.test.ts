import { describe, expect, it } from 'vitest'
import { isSecretSupabaseKey } from './supabaseKey'

const base64url = (value: string) => btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (payload: unknown) => `${base64url('{"alg":"HS256","typ":"JWT"}')}.${base64url(JSON.stringify(payload))}.signature`

describe('isSecretSupabaseKey', () => {
  it('spots the new secret keys', () => {
    expect(isSecretSupabaseKey('sb_secret_abc123')).toBe(true)
    expect(isSecretSupabaseKey('sb_secret_x')).toBe(true)
  })

  it('spots a legacy service_role JWT', () => {
    expect(isSecretSupabaseKey(jwt({ iss: 'supabase', ref: 'abcdefgh', role: 'service_role', exp: 2000000000 }))).toBe(true)
  })

  it('copes with stray whitespace around a pasted key', () => {
    expect(isSecretSupabaseKey('  sb_secret_abc\n')).toBe(true)
    expect(isSecretSupabaseKey(` ${jwt({ role: 'service_role' })}\n`)).toBe(true)
  })

  it('decodes base64url, not just base64', () => {
    // Claims chosen so the encoded payload contains both - and _, which plain base64 rejects.
    const payload = base64url(JSON.stringify({ note: '>>>???', role: 'service_role', pad: '~~~' }))
    expect(payload).toMatch(/[-_]/)
    expect(isSecretSupabaseKey(`header.${payload}.signature`)).toBe(true)
  })

  it('reads a payload of any length without padding', () => {
    for (const pad of ['', 'x', 'xx']) {
      const key = jwt({ role: 'service_role', pad })
      expect(key).not.toContain('=')
      expect(isSecretSupabaseKey(key)).toBe(true)
    }
  })

  it('accepts the keys that are meant to be public', () => {
    expect(isSecretSupabaseKey('sb_publishable_abc123')).toBe(false)
    expect(isSecretSupabaseKey(jwt({ iss: 'supabase', ref: 'abcdefgh', role: 'anon', exp: 2000000000 }))).toBe(false)
  })

  it('leaves anything else alone', () => {
    for (const key of ['', ' ', 'not-a-key', 'a.b', 'a.b.c', 'a.b.c.d', '..', 'x.%%%.y', 'sb_secre', 'my_sb_secret_key']) {
      expect(isSecretSupabaseKey(key)).toBe(false)
    }
  })

  it('leaves a JWT alone when its payload is not an object with a role', () => {
    for (const payload of [null, 7, 'service_role', ['service_role'], {}, { role: 'authenticated' }, { app_metadata: { role: 'service_role' } }]) {
      expect(isSecretSupabaseKey(jwt(payload))).toBe(false)
    }
  })

  it('only trusts a three-part JWT', () => {
    const payload = base64url(JSON.stringify({ role: 'service_role' }))
    expect(isSecretSupabaseKey(`header.${payload}`)).toBe(false)
    expect(isSecretSupabaseKey(`header.${payload}.signature.extra`)).toBe(false)
  })
})
