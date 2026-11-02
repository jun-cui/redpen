import { describe, expect, it } from 'vitest'
import { isFullMarks, scoreOf } from './scoring'

describe('scoreOf', () => {
  it('counts hits out of the number of points', () => {
    expect(scoreOf([{ hit: true }, { hit: false }, { hit: true }, { hit: false }])).toEqual({
      hit: 2,
      total: 4,
      fraction: 0.5,
    })
  })

  it('handles no hits, all hits and no points', () => {
    expect(scoreOf([{ hit: false }, { hit: false }])).toEqual({ hit: 0, total: 2, fraction: 0 })
    expect(scoreOf([{ hit: true }])).toEqual({ hit: 1, total: 1, fraction: 1 })
    expect(scoreOf([])).toEqual({ hit: 0, total: 0, fraction: 0 })
  })
})

describe('isFullMarks', () => {
  it('needs every point and at least one', () => {
    expect(isFullMarks({ hit: 3, total: 3, fraction: 1 })).toBe(true)
    expect(isFullMarks({ hit: 2, total: 3, fraction: 2 / 3 })).toBe(false)
    expect(isFullMarks({ hit: 0, total: 0, fraction: 0 })).toBe(false)
  })
})
