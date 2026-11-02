// Marking maths: per-point results, the rating they earn, and the record_review input built
// from them. Pure functions (tested in marking.test.ts).
//
// Stage 1 marks by self-grading: every key point starts unticked and the student ticks what they
// made. Stage 2 fills the same Marking from the AI (with quotes, reasons, corrections and missing
// points) and keeps self-grading as the fallback, so everything downstream takes a Marking.

import type { RecordReviewInput } from '../../data/api'
import type { CardRow, ReviewRow } from '../../lib/database.types'
import { previewNextDue, ratingFromScore, scheduleNext } from '../../lib/fsrs'
import type { RatingValue } from '../../lib/fsrs'
import { scoreOf, isFullMarks } from '../../lib/scoring'
import type { Correction, FsrsSnapshot, Grading, KeyPoint, PointResult } from '../../lib/types'

/** Everything the marker decided about one answer. */
export interface Marking {
  /** One per key point, in the card's order. */
  results: PointResult[]
  /** Suggested rewrites of parts of the answer (AI marking only). */
  corrections: Correction[]
  /** Points the answer left out, as the examiner would write them in (AI marking only). */
  missing: string[]
}

/** Longest answer the database accepts (reviews.answer). */
export const MAX_ANSWER_LENGTH = 5000

/** Every key point unticked: the starting point for self-grading. */
export function blankResults(keyPoints: readonly KeyPoint[]): PointResult[] {
  return keyPoints.map((keyPoint) => ({
    key_point_id: keyPoint.id,
    point: keyPoint.point,
    quote: null,
    reason: null,
    hit: false,
    ai_hit: null,
    overridden: false,
  }))
}

/** A self-graded marking before the student has ticked anything. */
export function selfMarking(keyPoints: readonly KeyPoint[]): Marking {
  return { results: blankResults(keyPoints), corrections: [], missing: [] }
}

/** Whether the results mark exactly these key points, in any order. */
export function marksKeyPoints(results: readonly PointResult[], keyPoints: readonly KeyPoint[]): boolean {
  const ids = new Set(keyPoints.map((keyPoint) => keyPoint.id))
  return results.length === ids.size && results.every((result) => ids.has(result.key_point_id))
}

/**
 * A marking brought up to date with a card's key points as they are now, in their order. Points
 * that still exist keep their marks and take the current wording; new ones start unticked.
 */
export function rebuildMarking(marking: Marking, keyPoints: readonly KeyPoint[]): Marking {
  const marked = new Map(marking.results.map((result) => [result.key_point_id, result]))
  const results = blankResults(keyPoints).map((blank) => {
    const kept = marked.get(blank.key_point_id)
    return kept ? { ...kept, point: blank.point } : blank
  })
  return { ...marking, results }
}

/**
 * The moment to schedule from when a card moved on after the answer was handed in: now, but never
 * before its latest review. Going back in time would show FSRS a negative interval, and the
 * reviews would no longer sort in the order they were applied.
 */
export function rescheduleTime(card: Pick<CardRow, 'last_review'>, now: Date): Date {
  const last = card.last_review === null ? null : new Date(card.last_review)
  return last !== null && last > now ? last : now
}

/**
 * Sets one point's hit. When the AI marked it (ai_hit is set), `overridden` records whether the
 * student now disagrees with the AI; a self-graded point is never an override.
 */
export function setPoint(results: readonly PointResult[], keyPointId: string, hit: boolean): PointResult[] {
  return results.map((result) =>
    result.key_point_id === keyPointId
      ? { ...result, hit, overridden: result.ai_hit !== null ? hit !== result.ai_hit : result.overridden }
      : result,
  )
}

/** Flips one point between ticked and not. */
export function togglePoint(results: readonly PointResult[], keyPointId: string): PointResult[] {
  const target = results.find((result) => result.key_point_id === keyPointId)
  return target ? setPoint(results, keyPointId, !target.hit) : [...results]
}

/** "Easy" only counts with full marks (as record_review checks). */
export function effectiveEasy(results: readonly Pick<PointResult, 'hit'>[], easy: boolean): boolean {
  return easy && isFullMarks(scoreOf(results))
}

/** 0 points = Again, some = Hard, all = Good, all + easy = Easy. */
export function ratingFor(results: readonly Pick<PointResult, 'hit'>[], easy: boolean): RatingValue {
  const { hit, total } = scoreOf(results)
  return ratingFromScore(hit, total, effectiveEasy(results, easy))
}

/** When the card would next be due if saved now with these marks. */
export function nextDueFor(
  before: FsrsSnapshot,
  results: readonly Pick<PointResult, 'hit'>[],
  easy: boolean,
  now: Date,
  retention: number,
): Date {
  return previewNextDue(before, now, retention)[ratingFor(results, easy)]
}

export interface ReviewInputOptions {
  /** The review's own id, the same for every retry of this answer. */
  id: string
  cardId: string
  /** The card's FSRS state to schedule from. */
  before: FsrsSnapshot
  marking: Marking
  easy: boolean
  answer: string
  grading: Grading
  /** The one moment the answer was marked: scheduling and reviewed_at both use it. */
  now: Date
  retention: number
  durationMs: number | null
}

/** The record_review call for a newly marked answer. */
export function buildReviewInput({
  id,
  cardId,
  before,
  marking,
  easy,
  answer,
  grading,
  now,
  retention,
  durationMs,
}: ReviewInputOptions): RecordReviewInput {
  const easyCounts = effectiveEasy(marking.results, easy)
  const rating = ratingFor(marking.results, easyCounts)
  return {
    id,
    card_id: cardId,
    expected_reps: before.reps,
    results: marking.results.map((result) => ({ ...result })),
    card_after: scheduleNext(before, rating, now, retention),
    rating,
    easy: easyCounts,
    answer: answer.trim().slice(0, MAX_ANSWER_LENGTH),
    grading,
    corrections: marking.corrections,
    missing: marking.missing,
    reviewed_at: now.toISOString(),
    duration_ms: durationMs === null ? null : Math.max(0, Math.round(durationMs)),
  }
}

/**
 * The results for changing a saved review's marks: each point takes its new hit from `hits`
 * (points not listed keep theirs). A point counts as overridden when it now differs from the AI's
 * decision, or, for self-graded points, when it differs from what was saved (or was already
 * overridden).
 */
export function overrideResults(saved: readonly PointResult[], hits: Readonly<Record<string, boolean>>): PointResult[] {
  return saved.map((result) => {
    const hit = hits[result.key_point_id] ?? result.hit
    const overridden = result.ai_hit !== null ? hit !== result.ai_hit : result.overridden || hit !== result.hit
    return { ...result, hit, overridden }
  })
}

/** How many points differ between two sets of results. */
export function changedPointCount(a: readonly PointResult[], b: readonly PointResult[]): number {
  const before = new Map(a.map((result) => [result.key_point_id, result.hit]))
  return b.filter((result) => before.get(result.key_point_id) !== result.hit).length
}

/**
 * The record_review call that changes a saved review's marks. The schedule is recomputed from
 * the state before that review, at the time it was made, so it is as if it had been marked this
 * way in the first place. Corrections and missing points are left as they are.
 */
export function buildOverrideInput(
  review: Pick<ReviewRow, 'id' | 'card_id' | 'card_before' | 'reviewed_at'>,
  results: PointResult[],
  easy: boolean,
  retention: number,
): RecordReviewInput {
  const easyCounts = effectiveEasy(results, easy)
  const rating = ratingFor(results, easyCounts)
  return {
    card_id: review.card_id,
    review_id: review.id,
    results,
    rating,
    easy: easyCounts,
    card_after: scheduleNext(review.card_before, rating, new Date(review.reviewed_at), retention),
  }
}
