import type { NavigateFunction } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loginPathFor,
  navigateOrHome,
  passwordSetupFor,
  readStoredPasswordSetup,
  safeNextPath,
  storePasswordSetup,
} from './authFlow'

const ORIGIN = 'https://redpen.example'
const KEY = 'redpen.passwordSetup'

function fakeStorage(entries: Record<string, string> = {}) {
  const items = new Map(Object.entries(entries))
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

function stubWindow(localStorage: unknown = fakeStorage()) {
  vi.stubGlobal('window', { location: { origin: ORIGIN }, localStorage })
}

beforeEach(() => stubWindow())
afterEach(() => vi.unstubAllGlobals())

describe('safeNextPath', () => {
  it('keeps same-site paths with their query and fragment', () => {
    expect(safeNextPath('/')).toBe('/')
    expect(safeNextPath('/cards')).toBe('/cards')
    expect(safeNextPath('/cards?subject=physics#top')).toBe('/cards?subject=physics#top')
    expect(safeNextPath('/cards/./new')).toBe('/cards/new')
  })

  it('has nothing to say about an empty value', () => {
    expect(safeNextPath(null)).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
    expect(safeNextPath('')).toBeNull()
  })

  it('rejects anything that is not a path', () => {
    for (const next of ['cards', 'https://evil.example', 'javascript:alert(1)', ' /cards']) {
      expect(safeNextPath(next)).toBeNull()
    }
  })

  it('rejects protocol-relative paths', () => {
    for (const next of ['//evil.example', '/\\evil.example', '/\t/evil.example', '/\n/evil.example']) {
      expect(safeNextPath(next)).toBeNull()
    }
  })

  it('rejects dot segments that collapse into a protocol-relative path', () => {
    for (const next of [
      '/.//evil.example',
      '/..//evil.example',
      '/%2e//evil.example',
      '/%2e%2e//evil.example',
      '/%2E%2E//evil.example',
      '/x/..//evil.example',
      '/./\\evil.example',
      '/.\\/evil.example',
      '/.//evil.example/phish?x=1#y',
    ]) {
      expect(safeNextPath(next)).toBeNull()
    }
  })

  it('never hands back a path the router would treat as another site', () => {
    const slashes = ['/', '\\', '%2f', '%5c']
    const steps = ['', '.', '..', '%2e', '%2e%2e', 'x/..']
    for (const step of steps) {
      for (const first of slashes) {
        for (const second of slashes) {
          const result = safeNextPath(`/${step}${first}${second}evil.example`)
          expect(result === null || (result.startsWith('/') && !result.startsWith('//'))).toBe(true)
        }
      }
    }
  })

  it('rejects the auth screens, which would go round in circles', () => {
    for (const next of ['/login', '/forgot-password', '/auth/confirm', '/set-password', '/set-password?x=1']) {
      expect(safeNextPath(next)).toBeNull()
    }
  })
})

describe('loginPathFor', () => {
  it('brings the person back to where they were', () => {
    expect(loginPathFor('/cards?subject=physics')).toBe('/login?next=%2Fcards%3Fsubject%3Dphysics')
  })

  it('needs no next for home, or for anywhere unsafe', () => {
    expect(loginPathFor('/')).toBe('/login')
    expect(loginPathFor('/.//evil.example')).toBe('/login')
  })
})

describe('navigateOrHome', () => {
  it('goes where it was asked to', async () => {
    const navigate = vi.fn(async () => undefined)
    await navigateOrHome(navigate as NavigateFunction, '/cards')
    expect(navigate.mock.calls).toEqual([['/cards', { replace: true }]])
  })

  it('falls back to home when the router refuses the path', async () => {
    const navigate = vi.fn(async (to: unknown) => {
      if (to !== '/') throw new Error('External navigation is not allowed')
    })
    await navigateOrHome(navigate as unknown as NavigateFunction, '//evil.example')
    expect(navigate.mock.calls).toEqual([
      ['//evil.example', { replace: true }],
      ['/', { replace: true }],
    ])
  })
})

describe('the pending password step', () => {
  it('survives in storage, with the user it belongs to', () => {
    storePasswordSetup({ userId: 'bob', reason: 'invite' })
    expect(readStoredPasswordSetup()).toEqual({ userId: 'bob', reason: 'invite' })
    storePasswordSetup({ userId: 'bob', reason: 'recovery' })
    expect(readStoredPasswordSetup()).toEqual({ userId: 'bob', reason: 'recovery' })
  })

  it('can be cleared', () => {
    storePasswordSetup({ userId: 'bob', reason: 'invite' })
    storePasswordSetup(null)
    expect(readStoredPasswordSetup()).toBeNull()
  })

  it('ignores anything in storage that does not look right', () => {
    for (const value of ['invite', '', 'null', '7', '[]', '{}', '{"reason":"invite"}', '{"userId":"bob"}', '{"userId":1,"reason":"invite"}', '{"userId":"bob","reason":"signup"}']) {
      stubWindow(fakeStorage({ [KEY]: value }))
      expect(readStoredPasswordSetup()).toBeNull()
    }
  })

  it('still works, for this page view, when storage is blocked', () => {
    const blocked = () => {
      throw new Error('blocked')
    }
    stubWindow({ getItem: blocked, setItem: blocked, removeItem: blocked })
    expect(readStoredPasswordSetup()).toBeNull()
    expect(() => storePasswordSetup({ userId: 'bob', reason: 'invite' })).not.toThrow()
    expect(() => storePasswordSetup(null)).not.toThrow()
  })

  it('applies only to the user it belongs to', () => {
    const pending = { userId: 'bob', reason: 'invite' } as const
    expect(passwordSetupFor(pending, 'bob')).toBe('invite')
    expect(passwordSetupFor(pending, 'alice')).toBeNull()
    expect(passwordSetupFor(pending, undefined)).toBeNull()
    expect(passwordSetupFor(null, 'bob')).toBeNull()
  })
})
