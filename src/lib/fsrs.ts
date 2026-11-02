// Spaced repetition with FSRS (ts-fsrs). Scheduling runs in the browser; the result is stored
// by the record_review RPC as an FsrsSnapshot (see supabase/migrations).

import { fsrs, Rating, State } from 'ts-fsrs'
import type { Card, FSRS, Grade } from 'ts-fsrs'
import type { CardRow } from './database.types'
import type { FsrsSnapshot } from './types'

export { Rating, State }
export type { Grade }

/** Ratings as stored in the database: 1 Again, 2 Hard, 3 Good, 4 Easy. */
export type RatingValue = 1 | 2 | 3 | 4

export const DEFAULT_RETENTION = 0.9
/** Bounds enforced by the profiles.desired_retention check constraint. */
export const MIN_RETENTION = 0.7
export const MAX_RETENTION = 0.97

export const RATING_LABELS: Record<RatingValue, string> = {
  1: 'Again',
  2: 'Hard',
  3: 'Good',
  4: 'Easy',
}

const schedulers = new Map<number, FSRS>()

function clampRetention(retention: number): number {
  if (!Number.isFinite(retention)) return DEFAULT_RETENTION
  return Math.min(MAX_RETENTION, Math.max(MIN_RETENTION, retention))
}

/**
 * A scheduler for the given desired retention. Fuzz spreads reviews out so cards learned
 * together don't stay bunched; it is seeded from the card and review time, so the same
 * inputs always give the same schedule (a preview matches what is then saved).
 */
export function createScheduler(desiredRetention: number = DEFAULT_RETENTION): FSRS {
  const retention = clampRetention(desiredRetention)
  let scheduler = schedulers.get(retention)
  if (!scheduler) {
    // One learning step: typing the same answer again minutes later adds little, and from Stage 2
    // each answer costs an AI call. A miss still gets a same-day retry; full marks moves on.
    scheduler = fsrs({ request_retention: retention, enable_fuzz: true, enable_short_term: true, learning_steps: ['10m'] })
    schedulers.set(retention, scheduler)
  }
  return scheduler
}

/**
 * The FSRS rating for a marked answer: no points = Again, some = Hard, all = Good,
 * all plus the student's "easy" tap = Easy. `easy` is ignored unless every point was hit.
 * Mirrors the check in the record_review RPC.
 */
export function ratingFromScore(hit: number, total: number, easy = false): Grade {
  if (hit <= 0) return Rating.Again
  if (hit < total) return Rating.Hard
  return easy ? Rating.Easy : Rating.Good
}

type FsrsColumns = Pick<
  CardRow,
  | 'fsrs_state'
  | 'due'
  | 'stability'
  | 'difficulty'
  | 'elapsed_days'
  | 'scheduled_days'
  | 'learning_steps'
  | 'reps'
  | 'lapses'
  | 'last_review'
>

function toStateValue(value: number): FsrsSnapshot['state'] {
  if (value === 0 || value === 1 || value === 2 || value === 3) return value
  throw new RangeError(`Invalid FSRS state: ${value}`)
}

/** The FSRS state of a card row, shaped like reviews.card_before. */
export function snapshotFromRow(row: FsrsColumns): FsrsSnapshot {
  return {
    state: toStateValue(row.fsrs_state),
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    last_review: row.last_review,
  }
}

/** The state of a card that has never been reviewed. */
export function newCardSnapshot(now: Date): FsrsSnapshot {
  return {
    state: 0,
    due: now.toISOString(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    last_review: null,
  }
}

export function toFsrsCard(snapshot: FsrsSnapshot): Card {
  return {
    state: snapshot.state as State,
    due: new Date(snapshot.due),
    stability: snapshot.stability,
    difficulty: snapshot.difficulty,
    elapsed_days: snapshot.elapsed_days,
    scheduled_days: snapshot.scheduled_days,
    learning_steps: snapshot.learning_steps,
    reps: snapshot.reps,
    lapses: snapshot.lapses,
    last_review: snapshot.last_review ? new Date(snapshot.last_review) : undefined,
  }
}

/** Integer columns must be sent as integers: Postgres rejects "1.0"-style casts to integer. */
function toInt(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

export function fromFsrsCard(card: Card): FsrsSnapshot {
  return {
    state: toStateValue(card.state),
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: toInt(card.elapsed_days),
    scheduled_days: toInt(card.scheduled_days),
    learning_steps: toInt(card.learning_steps),
    reps: toInt(card.reps),
    lapses: toInt(card.lapses),
    last_review: card.last_review ? card.last_review.toISOString() : null,
  }
}

/**
 * The card's FSRS state after a review with `rating` at `now`. This is what record_review
 * stores (p_card_after). For an override, pass the review's card_before and reviewed_at.
 */
export function scheduleNext(
  before: FsrsSnapshot,
  rating: Grade,
  now: Date,
  retention: number = DEFAULT_RETENTION,
): FsrsSnapshot {
  const { card } = createScheduler(retention).next(toFsrsCard(before), now, rating)
  return fromFsrsCard(card)
}

/** When the card would next be due for each possible rating. */
export function previewNextDue(
  before: FsrsSnapshot,
  now: Date,
  retention: number = DEFAULT_RETENTION,
): Record<RatingValue, Date> {
  const preview = createScheduler(retention).repeat(toFsrsCard(before), now)
  return {
    1: preview[Rating.Again].card.due,
    2: preview[Rating.Hard].card.due,
    3: preview[Rating.Good].card.due,
    4: preview[Rating.Easy].card.due,
  }
}
