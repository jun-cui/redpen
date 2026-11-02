import { describe, expect, it } from 'vitest'
import { cardCount, comeBackLabel, dueNowCount, nextReviewLabel, pointsLabel, soonestDue } from './copy'

const NOW = new Date('2026-10-23T10:00:00.000Z')

describe('pointsLabel', () => {
  it('counts points, singular for a one-point card', () => {
    expect(pointsLabel(2, 3)).toBe('2 of 3 points')
    expect(pointsLabel(0, 1)).toBe('0 of 1 point')
    expect(pointsLabel(1, 1)).toBe('1 of 1 point')
  })
})

describe('nextReviewLabel', () => {
  it('says when the card is next reviewed', () => {
    expect(nextReviewLabel(new Date(NOW.getTime() + 10 * 60_000), NOW)).toBe('Next review in 10 min')
    expect(nextReviewLabel(new Date(NOW.getTime() + 3 * 86_400_000), NOW)).toBe('Next review in 3 days')
  })

  it('accepts ISO strings', () => {
    expect(nextReviewLabel('2026-10-26T10:00:00.000Z', NOW)).toBe('Next review in 3 days')
  })

  it('says "Due again now" rather than "Next review now"', () => {
    expect(nextReviewLabel(NOW, NOW)).toBe('Due again now')
    expect(nextReviewLabel(new Date(NOW.getTime() - 60_000), NOW)).toBe('Due again now')
  })
})

describe('cardCount', () => {
  it('pluralises', () => {
    expect(cardCount(1)).toBe('1 card')
    expect(cardCount(0)).toBe('0 cards')
    expect(cardCount(12)).toBe('12 cards')
  })
})

describe('comeBackLabel', () => {
  const inMinutes = (minutes: number) => NOW.getTime() + minutes * 60_000

  it('says when a held card comes back, singular and plural', () => {
    expect(comeBackLabel({ count: 1, soonest: inMinutes(8) }, NOW)).toBe('1 card comes back in 8 min to help it stick.')
    expect(comeBackLabel({ count: 2, soonest: inMinutes(8) }, NOW)).toBe(
      '2 cards come back to help them stick, the first in 8 min.',
    )
  })

  it('says "in a moment" once the first is due', () => {
    expect(comeBackLabel({ count: 1, soonest: inMinutes(0) }, NOW)).toBe('1 card comes back in a moment to help it stick.')
    expect(comeBackLabel({ count: 3, soonest: inMinutes(-2) }, NOW)).toBe(
      '3 cards come back to help them stick, the first in a moment.',
    )
  })

  it('is null with nothing held', () => {
    expect(comeBackLabel({ count: 0, soonest: null }, NOW)).toBeNull()
  })
})

describe('dueNowCount', () => {
  const summary = { dueNow: 7, bySubject: { maths: 3, further_maths: 0, physics: 4, computer_science: 0 } }

  it('counts the whole box without a subject', () => {
    expect(dueNowCount(summary)).toBe(7)
  })

  it("counts one subject's cards with one", () => {
    expect(dueNowCount(summary, 'physics')).toBe(4)
    expect(dueNowCount(summary, 'further_maths')).toBe(0)
  })
})

describe('soonestDue', () => {
  const cards = [
    { subject: 'physics' as const, due: '2026-10-25T10:00:00.000Z', suspended: false },
    { subject: 'physics' as const, due: '2026-10-24T10:00:00.000Z', suspended: true }, // suspended
    { subject: 'maths' as const, due: '2026-10-23T12:00:00.000Z', suspended: false },
    { subject: 'maths' as const, due: '2026-10-23T09:00:00.000Z', suspended: false }, // already due
  ]

  it('finds the soonest due date among cards that are not suspended, even one already past', () => {
    expect(soonestDue(cards)).toBe('2026-10-23T09:00:00.000Z')
  })

  it('can be limited to one subject', () => {
    expect(soonestDue(cards, 'physics')).toBe('2026-10-25T10:00:00.000Z')
  })

  it('is null when nothing is waiting', () => {
    expect(soonestDue(cards, 'computer_science')).toBeNull()
    expect(soonestDue([])).toBeNull()
  })
})
