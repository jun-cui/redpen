// Small pieces of review copy built from numbers and dates (tested in copy.test.ts).

import type { DueSummary } from '../../data/api'
import { formatRelativeDue } from '../../lib/dates'
import type { SubjectCode } from '../../lib/types'

/** "2 of 3 points", "1 of 1 point". */
export function pointsLabel(hit: number, total: number): string {
  return `${hit} of ${total} ${total === 1 ? 'point' : 'points'}`
}

/** What saving means for the schedule: "Next review in 3 days", "Next review tomorrow", "Due again now". */
export function nextReviewLabel(due: Date | string, now: Date): string {
  const when = formatRelativeDue(typeof due === 'string' ? new Date(due) : due, now)
  return when === 'now' ? 'Due again now' : `Next review ${when}`
}

/** "1 card", "3 cards". */
export function cardCount(count: number): string {
  return `${count} ${count === 1 ? 'card' : 'cards'}`
}

/**
 * The end of a session with cards still to come back to: "1 card comes back in 8 min to help it
 * stick." `soonest` (ms since the epoch) is when the first is due, and may be past. Null for none.
 */
export function comeBackLabel(held: { count: number; soonest: number | null }, now: Date): string | null {
  if (held.count === 0 || held.soonest === null) return null
  const when = formatRelativeDue(new Date(held.soonest), now)
  const at = when === 'now' ? 'in a moment' : when
  return held.count === 1
    ? `1 card comes back ${at} to help it stick.`
    : `${held.count} cards come back to help them stick, the first ${at}.`
}

/** Cards due right now, for the whole box or one subject. */
export function dueNowCount(summary: Pick<DueSummary, 'dueNow' | 'bySubject'>, subject?: SubjectCode): number {
  return subject ? summary.bySubject[subject] : summary.dueNow
}

/**
 * The soonest due date among cards that aren't suspended (optionally one subject's), or null
 * when there are none. It can be in the past: a card that came due after the session's snapshot.
 */
export function soonestDue(
  cards: readonly { subject: SubjectCode; due: string; suspended: boolean }[],
  subject?: SubjectCode,
): string | null {
  let soonest: string | null = null
  let soonestTime = Infinity
  for (const card of cards) {
    if (card.suspended || (subject && card.subject !== subject)) continue
    const time = Date.parse(card.due)
    if (time < soonestTime) {
      soonestTime = time
      soonest = card.due
    }
  }
  return soonest
}
