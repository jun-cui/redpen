import { describe, expect, it } from 'vitest'
import { computeCategory } from './category'
import type { CategoryReview } from './category'

const full = (total = 3): CategoryReview => ({ points_hit: total, points_total: total, rating: 3 })
const easy = (total = 3): CategoryReview => ({ points_hit: total, points_total: total, rating: 4 })
const partial = (hit: number, total: number): CategoryReview => ({ points_hit: hit, points_total: total, rating: 2 })
const zero = (total = 3): CategoryReview => ({ points_hit: 0, points_total: total, rating: 1 })

// Reviews are listed newest first, as compute_card_category orders them.
describe('computeCategory', () => {
  it('is new before any review', () => {
    expect(computeCategory([], 0)).toBe('new')
    expect(computeCategory([], 100)).toBe('new')
  })

  describe('mastered', () => {
    it('needs full marks on each of the last three reviews and an interval over 21 days', () => {
      expect(computeCategory([full(), easy(), full()], 22)).toBe('mastered')
    })

    it('is not reached at exactly 21 days', () => {
      expect(computeCategory([full(), full(), full()], 21)).toBe('learning')
    })

    it('needs three reviews', () => {
      expect(computeCategory([full(), full()], 60)).toBe('learning')
    })

    it('needs the three most recent to be full marks', () => {
      expect(computeCategory([full(), partial(2, 3), full(), full()], 60)).toBe('learning')
    })

    it('outweighs older lapses (checked before weak)', () => {
      expect(computeCategory([full(), full(), full(), zero(), zero()], 30)).toBe('mastered')
      expect(computeCategory([full(), full(), full(), zero(), zero()], 10)).toBe('weak')
    })
  })

  describe('weak', () => {
    it('when the last mark is under 50%', () => {
      expect(computeCategory([partial(1, 3)], 1)).toBe('weak')
      expect(computeCategory([zero()], 0)).toBe('weak')
      expect(computeCategory([partial(1, 3), full(), full()], 30)).toBe('weak')
    })

    it('not when the last mark is exactly 50%', () => {
      expect(computeCategory([partial(1, 2)], 1)).toBe('learning')
    })

    it('when rated Again twice in the last five reviews', () => {
      expect(computeCategory([full(), zero(), full(), zero()], 5)).toBe('weak')
      expect(computeCategory([full(), full(), full(), zero(), zero()], 21)).toBe('weak')
    })

    it('ignores Again ratings older than the last five reviews', () => {
      expect(computeCategory([full(), full(), zero(), full(), full(), zero()], 5)).toBe('learning')
    })
  })

  it('is learning in between', () => {
    expect(computeCategory([full()], 1)).toBe('learning')
    expect(computeCategory([partial(2, 3), zero()], 3)).toBe('learning')
  })

  it('only considers the latest five reviews', () => {
    const history = [full(), full(), full(), full(), full(), zero(), zero(), zero()]
    expect(computeCategory(history, 5)).toBe('learning')
  })
})
