import { afterEach, describe, expect, it, vi } from 'vitest'
import { smoothScrollIntoView } from './scroll'

function stubReducedMotion(reduced: boolean) {
  const matchMedia = vi.fn((query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' && reduced }))
  vi.stubGlobal('window', { matchMedia })
  return matchMedia
}

function fakeElement() {
  return { scrollIntoView: vi.fn() } as unknown as Element & { scrollIntoView: ReturnType<typeof vi.fn> }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('smoothScrollIntoView', () => {
  it('scrolls smoothly by default and keeps the caller’s options', () => {
    stubReducedMotion(false)
    const element = fakeElement()
    smoothScrollIntoView(element, { block: 'center' })
    expect(element.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
  })

  it('jumps without animating when the person asks for less motion', () => {
    stubReducedMotion(true)
    const element = fakeElement()
    smoothScrollIntoView(element, { block: 'center' })
    expect(element.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' })
  })

  it('reads the setting on every call, so a change takes effect straight away', () => {
    const element = fakeElement()
    stubReducedMotion(false)
    smoothScrollIntoView(element)
    stubReducedMotion(true)
    smoothScrollIntoView(element)
    expect(element.scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto' })
  })
})
