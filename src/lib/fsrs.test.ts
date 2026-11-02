import { describe, expect, it } from 'vitest'
import type { CardRow } from './database.types'
import {
  createScheduler,
  fromFsrsCard,
  newCardSnapshot,
  previewNextDue,
  Rating,
  ratingFromScore,
  scheduleNext,
  snapshotFromRow,
  State,
  toFsrsCard,
} from './fsrs'
import type { RatingValue } from './fsrs'
import type { FsrsSnapshot } from './types'

const NOW = new Date('2026-10-21T09:00:00.000Z')
const SNAPSHOT_KEYS = [
  'state',
  'due',
  'stability',
  'difficulty',
  'elapsed_days',
  'scheduled_days',
  'learning_steps',
  'reps',
  'lapses',
  'last_review',
].sort()
const INTEGER_KEYS = ['state', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses'] as const

function expectDbShape(snapshot: FsrsSnapshot) {
  expect(Object.keys(snapshot).sort()).toEqual(SNAPSHOT_KEYS)
  for (const key of INTEGER_KEYS) expect(Number.isInteger(snapshot[key]), key).toBe(true)
  // Survives the trip through JSON unchanged (it is sent as jsonb).
  expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
}

const MINUTE = 60_000
const DAY = 86_400_000

/** A card in long-term review: Good twice, the second time when it comes due. */
function reviewCard(): { snapshot: FsrsSnapshot; at: Date } {
  const first = scheduleNext(newCardSnapshot(NOW), Rating.Good, NOW)
  const learnt = scheduleNext(first, Rating.Good, new Date(first.due))
  const at = new Date(learnt.due)
  return { snapshot: learnt, at }
}

describe('ratingFromScore', () => {
  it.each([
    [0, 3, false, 1],
    [0, 3, true, 1],
    [0, 1, true, 1],
    [1, 3, false, 2],
    [2, 3, true, 2],
    [3, 3, false, 3],
    [1, 1, false, 3],
    [3, 3, true, 4],
    [1, 1, true, 4],
  ] as const)('%i of %i, easy=%s -> %i', (hit, total, easy, expected) => {
    expect(ratingFromScore(hit, total, easy)).toBe(expected)
  })

  it('treats easy as optional', () => {
    expect(ratingFromScore(2, 2)).toBe(Rating.Good)
  })
})

describe('scheduleNext', () => {
  const ratings: RatingValue[] = [1, 2, 3, 4]
  const results = ratings.map((rating) => scheduleNext(newCardSnapshot(NOW), rating, NOW))

  it('orders a new card Again < Hard < Good < Easy', () => {
    const dues = results.map((r) => Date.parse(r.due))
    expect(dues[0]).toBeLessThan(dues[1]!)
    expect(dues[1]).toBeLessThan(dues[2]!)
    expect(dues[2]).toBeLessThan(dues[3]!)
    expect(dues[0]).toBeGreaterThan(NOW.getTime())
  })

  it('keeps a new card in learning after a miss, and moves it to review with full marks', () => {
    expect(results.map((r) => r.state)).toEqual([
      State.Learning,
      State.Learning,
      State.Review,
      State.Review,
    ])
    for (const result of results) {
      expect(result.reps).toBe(1)
      expect(result.lapses).toBe(0)
      expect(result.last_review).toBe(NOW.toISOString())
    }
    expect(results[3]!.scheduled_days).toBeGreaterThanOrEqual(1)
  })

  it('gives a miss a same-day retry, and full marks days', () => {
    const inMinutes = results.map((r) => (Date.parse(r.due) - NOW.getTime()) / MINUTE)
    expect(inMinutes.slice(0, 2)).toEqual([10, 15])
    const inDays = results.map((r) => (Date.parse(r.due) - NOW.getTime()) / DAY)
    expect(inDays[2]).toBeGreaterThanOrEqual(1)
    expect(inDays[3]).toBeGreaterThan(inDays[2]!)
  })

  it('produces exactly the shape record_review stores', () => {
    for (const result of results) expectDbShape(result)
  })

  it('sends a forgotten review card to relearning and counts the lapse', () => {
    const { snapshot, at } = reviewCard()
    expect(snapshot.state).toBe(State.Review)
    const forgotten = scheduleNext(snapshot, Rating.Again, at)
    expect(forgotten.state).toBe(State.Relearning)
    expect(forgotten.lapses).toBe(snapshot.lapses + 1)
    expect(Date.parse(forgotten.due) - at.getTime()).toBe(10 * MINUTE)
    expectDbShape(forgotten)
  })

  it('is deterministic for the same inputs, fuzz included', () => {
    const { snapshot, at } = reviewCard()
    expect(scheduleNext(snapshot, Rating.Good, at)).toEqual(scheduleNext(snapshot, Rating.Good, at))
  })

  it('schedules sooner for a higher desired retention', () => {
    const { snapshot, at } = reviewCard()
    const relaxed = scheduleNext(snapshot, Rating.Good, at, 0.7)
    const strict = scheduleNext(snapshot, Rating.Good, at, 0.97)
    expect(strict.scheduled_days).toBeLessThan(relaxed.scheduled_days)
  })
})

describe('previewNextDue', () => {
  it('matches what scheduleNext then saves, for every rating', () => {
    const { snapshot, at } = reviewCard()
    const preview = previewNextDue(snapshot, at)
    for (const rating of [1, 2, 3, 4] as const) {
      expect(preview[rating].toISOString()).toBe(scheduleNext(snapshot, rating, at).due)
    }
  })
})

describe('snapshots', () => {
  it('round-trips through a ts-fsrs card', () => {
    const { snapshot } = reviewCard()
    expect(fromFsrsCard(toFsrsCard(snapshot))).toEqual(snapshot)
    const fresh = newCardSnapshot(NOW)
    expect(fromFsrsCard(toFsrsCard(fresh))).toEqual(fresh)
    expect(toFsrsCard(fresh).last_review).toBeUndefined()
  })

  it('reads the FSRS columns of a card row', () => {
    const row = {
      fsrs_state: 2,
      due: '2026-11-01T09:00:00+00:00',
      stability: 12.5,
      difficulty: 4.2,
      elapsed_days: 3,
      scheduled_days: 11,
      learning_steps: 0,
      reps: 4,
      lapses: 1,
      last_review: '2026-10-21T09:00:00+00:00',
    } satisfies Partial<CardRow>
    expect(snapshotFromRow(row)).toEqual({
      state: 2,
      due: '2026-11-01T09:00:00+00:00',
      stability: 12.5,
      difficulty: 4.2,
      elapsed_days: 3,
      scheduled_days: 11,
      learning_steps: 0,
      reps: 4,
      lapses: 1,
      last_review: '2026-10-21T09:00:00+00:00',
    })
    // Postgres-style timestamps are understood.
    expect(toFsrsCard(snapshotFromRow(row)).due.toISOString()).toBe('2026-11-01T09:00:00.000Z')
  })

  it('rejects an impossible state', () => {
    expect(() => snapshotFromRow({ ...snapshotRow(), fsrs_state: 7 })).toThrow(RangeError)
  })

  it('rounds integer fields', () => {
    const card = { ...toFsrsCard(newCardSnapshot(NOW)), elapsed_days: 1.4, scheduled_days: 2.6 }
    const snapshot = fromFsrsCard(card)
    expect(snapshot.elapsed_days).toBe(1)
    expect(snapshot.scheduled_days).toBe(3)
  })
})

describe('createScheduler', () => {
  it('reuses a scheduler per retention and clamps out-of-range values', () => {
    expect(createScheduler(0.9)).toBe(createScheduler(0.9))
    expect(createScheduler(0.5).parameters.request_retention).toBe(0.7)
    expect(createScheduler(0.999).parameters.request_retention).toBe(0.97)
    expect(createScheduler(Number.NaN).parameters.request_retention).toBe(0.9)
    expect(createScheduler().parameters.enable_fuzz).toBe(true)
    expect(createScheduler().parameters.enable_short_term).toBe(true)
    expect(createScheduler().parameters.learning_steps).toEqual(['10m'])
  })
})

function snapshotRow() {
  return {
    fsrs_state: 0,
    due: NOW.toISOString(),
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
