import type { CardRow } from '../lib/database.types'
import { endOfLocalDay } from '../lib/dates'
import type { CardCategory, SubjectCode } from '../lib/types'
import type { DueSummary } from './api'

export type SummaryCard = Pick<CardRow, 'subject' | 'due' | 'suspended' | 'category'>

export function emptySubjectCounts(): Record<SubjectCode, number> {
  return { maths: 0, further_maths: 0, physics: 0, computer_science: 0 }
}

export function emptyCategoryCounts(): Record<CardCategory, number> {
  return { new: 0, learning: 0, weak: 0, mastered: 0 }
}

export function summarizeDue(cards: readonly SummaryCard[], now: Date): DueSummary {
  const nowMs = now.getTime()
  const endOfToday = endOfLocalDay(now).getTime()
  const summary: DueSummary = {
    dueNow: 0,
    dueLaterToday: 0,
    total: cards.length,
    bySubject: emptySubjectCounts(),
    byCategory: emptyCategoryCounts(),
    nextDueAt: null,
  }
  let nextDue = Infinity

  for (const card of cards) {
    if (card.suspended) continue
    summary.byCategory[card.category] += 1
    const due = new Date(card.due).getTime()
    if (due <= nowMs) {
      summary.dueNow += 1
      summary.bySubject[card.subject] += 1
      continue
    }
    if (due <= endOfToday) summary.dueLaterToday += 1
    if (due < nextDue) {
      nextDue = due
      summary.nextDueAt = card.due
    }
  }
  return summary
}
