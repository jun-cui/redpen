import { describe, expect, it } from 'vitest'
import { summarizeDue } from './summary'
import type { SummaryCard } from './summary'

const NOW = new Date(2026, 9, 21, 10, 0)
const iso = (date: Date) => date.toISOString()

describe('summarizeDue', () => {
  it('counts due, later today, subjects and categories', () => {
    const cards: SummaryCard[] = [
      { subject: 'maths', due: iso(new Date(2026, 9, 20)), suspended: false, category: 'weak' },
      { subject: 'maths', due: iso(NOW), suspended: false, category: 'new' },
      { subject: 'physics', due: iso(new Date(2026, 9, 21, 9)), suspended: false, category: 'learning' },
      { subject: 'physics', due: iso(new Date(2026, 9, 21, 18)), suspended: false, category: 'learning' },
      { subject: 'computer_science', due: iso(new Date(2026, 9, 21, 12)), suspended: false, category: 'new' },
      { subject: 'further_maths', due: iso(new Date(2026, 9, 30)), suspended: false, category: 'mastered' },
      { subject: 'maths', due: iso(new Date(2026, 9, 1)), suspended: true, category: 'weak' },
    ]
    expect(summarizeDue(cards, NOW)).toEqual({
      dueNow: 3,
      dueLaterToday: 2,
      total: 7,
      bySubject: { maths: 2, further_maths: 0, physics: 1, computer_science: 0 },
      byCategory: { new: 2, learning: 2, weak: 1, mastered: 1 },
      nextDueAt: iso(new Date(2026, 9, 21, 12)),
    })
  })

  it('handles no cards', () => {
    expect(summarizeDue([], NOW)).toMatchObject({ dueNow: 0, dueLaterToday: 0, total: 0, nextDueAt: null })
  })
})
