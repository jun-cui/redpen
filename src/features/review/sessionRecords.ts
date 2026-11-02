// The end-of-session numbers and list (tested in sessionRecords.test.ts).

import type { CardRow, ReviewRow } from '../../lib/database.types'

/** One saved answer in this session. */
export interface SessionRecord {
  /** The queue entry it answered (unique per appearance). */
  key: string
  cardId: string
  /** The saved review (replaced when its marks are changed). */
  review: ReviewRow
  /** The card as saved: content plus its new schedule. */
  card: CardRow
}

export interface SessionStats {
  /** Different cards answered. */
  cards: number
  /** Answers given, counting a card that came back again. */
  answers: number
  pointsHit: number
  pointsTotal: number
  /** Points earned across every answer, as a whole percentage (0 when there were none). */
  percent: number
  /** Answers that earned every point. */
  fullMarks: number
}

export function sessionStats(records: readonly SessionRecord[]): SessionStats {
  const cards = new Set(records.map((record) => record.cardId)).size
  let pointsHit = 0
  let pointsTotal = 0
  let fullMarks = 0
  for (const { review } of records) {
    pointsHit += review.points_hit
    pointsTotal += review.points_total
    if (review.points_total > 0 && review.points_hit === review.points_total) fullMarks += 1
  }
  const percent = pointsTotal > 0 ? Math.round((pointsHit / pointsTotal) * 100) : 0
  return { cards, answers: records.length, pointsHit, pointsTotal, percent, fullMarks }
}

export interface SummaryRow {
  cardId: string
  /** The card's latest answer this session: its marks can still be changed. */
  latest: SessionRecord
  /** How many times the card was answered this session. */
  attempts: number
}

/** One row per card, in the order the cards first came up, each with its latest answer. */
export function summaryRows(records: readonly SessionRecord[]): SummaryRow[] {
  const rows = new Map<string, SummaryRow>()
  for (const record of records) {
    const row = rows.get(record.cardId)
    if (row) {
      row.latest = record
      row.attempts += 1
    } else {
      rows.set(record.cardId, { cardId: record.cardId, latest: record, attempts: 1 })
    }
  }
  return [...rows.values()]
}

/** Replaces a record (after its marks were changed), keeping its place. */
export function replaceRecord(
  records: readonly SessionRecord[],
  key: string,
  update: Pick<SessionRecord, 'review' | 'card'>,
): SessionRecord[] {
  return records.map((record) => (record.key === key ? { ...record, ...update } : record))
}

/** Whether a record is its card's latest answer this session (only that one can be changed). */
export function isLatestRecord(records: readonly SessionRecord[], key: string): boolean {
  const record = records.find((r) => r.key === key)
  if (!record) return false
  const last = records.findLast((r) => r.cardId === record.cardId)
  return last?.key === key
}

/** The earliest next due among the cards answered (for "The next card is due ..."), or null. */
export function earliestDue(records: readonly SessionRecord[]): string | null {
  let earliest: string | null = null
  for (const { latest } of summaryRows(records)) {
    if (earliest === null || Date.parse(latest.card.due) < Date.parse(earliest)) earliest = latest.card.due
  }
  return earliest
}
