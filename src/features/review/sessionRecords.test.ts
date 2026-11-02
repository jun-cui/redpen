import { describe, expect, it } from 'vitest'
import { earliestDue, isLatestRecord, replaceRecord, sessionStats, summaryRows, type SessionRecord } from './sessionRecords'
import { cardRow, result, reviewRow } from './testFixtures'

function record(key: string, cardId: string, hits: boolean[], due = '2026-10-26T10:00:00.000Z'): SessionRecord {
  const results = hits.map((hit, index) => result(`kp_${index}`, hit))
  return { key, cardId, review: reviewRow({ id: `review-${key}`, card_id: cardId, results }), card: cardRow({ id: cardId, due }) }
}

describe('sessionStats', () => {
  it('is all zeros for an empty session', () => {
    expect(sessionStats([])).toEqual({ cards: 0, answers: 0, pointsHit: 0, pointsTotal: 0, percent: 0, fullMarks: 0 })
  })

  it('counts cards once, and points and full marks over every answer', () => {
    const records = [
      record('a#0', 'a', [true, false, false]),
      record('b#0', 'b', [true, true]),
      record('a#1', 'a', [true, true, true]),
    ]
    expect(sessionStats(records)).toEqual({ cards: 2, answers: 3, pointsHit: 6, pointsTotal: 8, percent: 75, fullMarks: 2 })
  })

  it('rounds the percentage', () => {
    expect(sessionStats([record('a#0', 'a', [true, false, false])]).percent).toBe(33)
    expect(sessionStats([record('a#0', 'a', [true, true, false])]).percent).toBe(67)
  })
})

describe('summaryRows', () => {
  it('lists each card once, in first-seen order, with its latest answer', () => {
    const records = [record('a#0', 'a', [false]), record('b#0', 'b', [true]), record('a#1', 'a', [true])]
    const rows = summaryRows(records)
    expect(rows.map((r) => [r.cardId, r.latest.key, r.attempts])).toEqual([
      ['a', 'a#1', 2],
      ['b', 'b#0', 1],
    ])
  })
})

describe('replaceRecord', () => {
  it('swaps in the amended review and card, keeping the order', () => {
    const records = [record('a#0', 'a', [false]), record('b#0', 'b', [false])]
    const amended = reviewRow({ id: 'review-b#0', results: [result('kp_0', true)] })
    const next = replaceRecord(records, 'b#0', { review: amended, card: cardRow({ id: 'b', due: '2026-11-01T00:00:00.000Z' }) })
    expect(next.map((r) => r.key)).toEqual(['a#0', 'b#0'])
    expect(next[1]?.review.points_hit).toBe(1)
    expect(next[1]?.card.due).toBe('2026-11-01T00:00:00.000Z')
    expect(next[0]).toBe(records[0])
  })
})

describe('isLatestRecord', () => {
  it('is true only for the last answer to a card', () => {
    const records = [record('a#0', 'a', [false]), record('b#0', 'b', [true]), record('a#1', 'a', [true])]
    expect(isLatestRecord(records, 'a#0')).toBe(false)
    expect(isLatestRecord(records, 'a#1')).toBe(true)
    expect(isLatestRecord(records, 'b#0')).toBe(true)
    expect(isLatestRecord(records, 'missing')).toBe(false)
  })
})

describe('earliestDue', () => {
  it("finds the soonest next due among the cards' latest answers", () => {
    const records = [
      record('a#0', 'a', [false], '2026-10-23T10:01:00.000Z'),
      record('b#0', 'b', [true], '2026-10-25T10:00:00.000Z'),
      record('a#1', 'a', [true], '2026-10-27T10:00:00.000Z'),
    ]
    expect(earliestDue(records)).toBe('2026-10-25T10:00:00.000Z')
    expect(earliestDue([])).toBeNull()
  })
})
