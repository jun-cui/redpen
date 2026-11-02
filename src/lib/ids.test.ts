import { describe, expect, it } from 'vitest'
import { isUuid, newKeyPointId, newUuid } from './ids'

describe('newKeyPointId', () => {
  it('is kp_ followed by 8 base-36 characters', () => {
    for (let i = 0; i < 200; i += 1) expect(newKeyPointId()).toMatch(/^kp_[0-9a-z]{8}$/)
  })

  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 2000 }, newKeyPointId))
    expect(ids.size).toBe(2000)
  })
})

describe('newUuid', () => {
  it('is a version 4 UUID', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(newUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    }
  })
})

describe('isUuid', () => {
  it('accepts canonical UUIDs only', () => {
    expect(isUuid(newUuid())).toBe(true)
    expect(isUuid('6F9619FF-8B86-D011-B42D-00C04FC964FF')).toBe(true)
    expect(isUuid('new')).toBe(false)
    expect(isUuid('')).toBe(false)
    expect(isUuid('6f9619ff8b86d011b42d00c04fc964ff')).toBe(false)
  })
})
