// The demo's record_review must behave exactly like the SQL one. The same scenario runs against
// the real migrations (in PGlite, called with the arguments supabaseApi sends) and against the
// demo Api, and every outcome is compared: saved rows, mistake log, category and errors.

import { describe, expect, it } from 'vitest'
import type { CardRow, MistakeRow, ReviewRow } from '../../lib/database.types'
import { CARD_CONFLICT_CODE } from '../../lib/errors'
import { ratingFromScore, scheduleNext, snapshotFromRow } from '../../lib/fsrs'
import type { RatingValue } from '../../lib/fsrs'
import { scoreOf } from '../../lib/scoring'
import type { FsrsSnapshot, KeyPoint, PointResult } from '../../lib/types'
import type { RecordReviewInput } from '../api'
import { DEFAULT_TOPICS } from '../exampleContent'
import { normalizeCardDraft, normalizeKeyPoints } from '../normalize'
import { recordReviewArgs } from '../recordReviewArgs'
import type { RecordReviewArgs } from '../recordReviewArgs'
import { createDemoApi, DEMO_STORAGE_KEY } from './demoApi'
import type { DemoState } from './db'
import { memoryStorage } from './storage'

// The part of tests/db/harness.ts used here. The harness is Node-only code, type-checked by
// tsconfig.node.json; importing it through a computed path keeps it out of the app's (browser)
// type program, which has no Node types.
interface Tx {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}
interface TestDb {
  createUser(): Promise<string>
  asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T>
}
interface Harness {
  DB_TIMEOUT_MS: number
  setupTestDb(): () => TestDb
}
const HARNESS = '../../../tests/db/harness.ts'
const { DB_TIMEOUT_MS, setupTestDb } = (await import(/* @vite-ignore */ HARNESS)) as Harness

function single<T>(rows: readonly T[]): T {
  if (rows.length !== 1) throw new Error(`Expected exactly one row, got ${rows.length}`)
  return rows[0] as T
}

/** Calls record_review with named arguments, as PostgREST does for supabase.rpc(). */
async function callRecordReview(tx: Tx, args: RecordReviewArgs) {
  const entries = Object.entries(args)
  const { rows } = await tx.query<{ result: { review: ReviewRow; card: CardRow } }>(
    `select public.record_review(${entries.map(([name], i) => `${name} => $${i + 1}`).join(', ')}) as result`,
    entries.map(([, value]) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : value)),
  )
  return single(rows).result
}

const T0 = Date.parse('2026-10-01T09:00:00.000Z')
const at = (minutes: number) => new Date(T0 + minutes * 60_000)

/** One backend, as far as record_review is concerned. */
interface World {
  createCard(keyPoints: KeyPoint[], options?: { withTopic?: boolean }): Promise<CardRow>
  setKeyPoints(cardId: string, keyPoints: KeyPoint[]): Promise<CardRow>
  recordReview(input: RecordReviewInput): Promise<{ review: ReviewRow; card: CardRow }>
  mistakesFor(reviewId: string): Promise<MistakeRow[]>
  counts(): Promise<{ reviews: number; mistakes: number }>
}

const TOPIC = DEFAULT_TOPICS.physics[0]!.name
const QUESTION = '  State the principle of conservation of energy. '

function sqlWorld(db: TestDb, userId: string): World {
  return {
    createCard: (keyPoints, options = {}) =>
      db.asUser(userId, async (tx) => {
        const topic = options.withTopic
          ? single((await tx.query<{ id: string }>(
              "select id from public.topics where subject = 'physics' and name = $1",
              [TOPIC],
            )).rows).id
          : null
        // Cleaned up as supabaseApi.createCard() does; due set so both worlds share a clock.
        const values = normalizeCardDraft({ subject: 'physics', topic_id: topic, question: QUESTION, key_points: keyPoints })
        const { rows } = await tx.query<CardRow>(
          `insert into public.cards (subject, topic_id, question, key_points, origin, due, created_at)
           values ($1, $2, $3, $4::jsonb, $5, $6, $6)
           returning *`,
          [
            values.subject,
            values.topic_id,
            values.question,
            JSON.stringify(values.key_points),
            values.origin,
            new Date(T0).toISOString(),
          ],
        )
        return single(rows)
      }),
    setKeyPoints: (cardId, keyPoints) =>
      db.asUser(userId, async (tx) => {
        const { rows } = await tx.query<CardRow>(
          'update public.cards set key_points = $1::jsonb where id = $2 returning *',
          [JSON.stringify(normalizeKeyPoints(keyPoints)), cardId],
        )
        return single(rows)
      }),
    recordReview: (input) => db.asUser(userId, (tx) => callRecordReview(tx, recordReviewArgs(input))),
    mistakesFor: (reviewId) =>
      db.asUser(userId, async (tx) => {
        const { rows } = await tx.query<MistakeRow>('select * from public.mistakes where review_id = $1', [reviewId])
        return rows
      }),
    counts: () =>
      db.asUser(userId, async (tx) => {
        const { rows } = await tx.query<{ reviews: number; mistakes: number }>(
          `select (select count(*)::int from public.reviews) as reviews,
                  (select count(*)::int from public.mistakes) as mistakes`,
        )
        return single(rows)
      }),
  }
}

function demoWorld(): World {
  const storage = memoryStorage()
  let clock = new Date(T0)
  const api = createDemoApi({ storage, latencyMs: [0, 0], exampleCards: false, now: () => clock })
  const state = () => JSON.parse(storage.getItem(DEMO_STORAGE_KEY) ?? 'null') as DemoState
  return {
    async createCard(keyPoints, options = {}) {
      clock = new Date(T0)
      const topic = options.withTopic
        ? (await api.listTopics()).find((t) => t.subject === 'physics' && t.name === TOPIC)
        : undefined
      return api.createCard({ subject: 'physics', topic_id: topic?.id ?? null, question: QUESTION, key_points: keyPoints })
    },
    setKeyPoints: (cardId, keyPoints) => api.updateCard(cardId, { key_points: keyPoints }),
    recordReview: (input) => api.recordReview(input),
    mistakesFor: async (reviewId) => state().mistakes.filter((m) => m.review_id === reviewId),
    counts: async () => ({ reviews: state().reviews.length, mistakes: state().mistakes.length }),
  }
}

// ---------------------------------------------------------------------------
// Normalising outcomes: ids, server clocks and timestamp formats differ between the two.
// ---------------------------------------------------------------------------

const time = (value: string | null) => (value === null ? null : Date.parse(value))

function snapshot(s: FsrsSnapshot) {
  return { ...s, due: time(s.due), last_review: time(s.last_review) }
}

function cardOutcome(card: CardRow) {
  return {
    ...snapshot(snapshotFromRow(card)),
    key_points: card.key_points,
    has_topic: card.topic_id !== null,
    category: card.category,
    // real (float4) in Postgres
    last_score: card.last_score === null ? null : Math.round(card.last_score * 1e6) / 1e6,
  }
}

function reviewOutcome(review: ReviewRow) {
  return {
    reviewed_at: time(review.reviewed_at),
    answer: review.answer,
    grading: review.grading,
    results: review.results,
    corrections: review.corrections,
    missing: review.missing,
    points_hit: review.points_hit,
    points_total: review.points_total,
    easy: review.easy,
    rating: review.rating,
    card_before: snapshot(review.card_before),
    duration_ms: review.duration_ms,
    amended: review.amended_at !== null,
  }
}

function mistakeOutcome(mistake: MistakeRow) {
  return {
    origin: mistake.origin,
    subject: mistake.subject,
    has_topic: mistake.topic_id !== null,
    has_card: mistake.card_id !== null,
    key_point_id: mistake.key_point_id,
    source: mistake.source,
    what_went_wrong: mistake.what_went_wrong,
    fix: mistake.fix,
    mistake_type: mistake.mistake_type,
    raw_text: mistake.raw_text,
    flashcard_id: mistake.flashcard_id,
  }
}

// ---------------------------------------------------------------------------
// The scenario
// ---------------------------------------------------------------------------

const REVIEW_ID = '00000000-0000-4000-8000-00000000cafe'

const KEY_POINTS: KeyPoint[] = [
  { id: 'kp_a', point: 'Energy cannot be created or destroyed', accept: [], reject: [] },
  { id: 'kp_b', point: '  It can only be transferred between stores ', accept: ['changes form'], reject: [] },
  { id: 'kp_c', point: 'The total energy of a closed system is constant', accept: [], reject: ['energy is used up'] },
]

function resultsFor(card: Pick<CardRow, 'key_points'>, hits: boolean[], extra: Partial<PointResult>[] = []) {
  return card.key_points.map<PointResult>((kp, i) => ({
    key_point_id: kp.id,
    point: kp.point,
    quote: null,
    reason: null,
    hit: hits[i] ?? false,
    ai_hit: null,
    overridden: false,
    ...extra[i],
  }))
}

/** A review input as the review screen builds it: score -> rating -> FSRS. */
function marked(
  card: CardRow,
  results: PointResult[],
  when: Date,
  options: { easy?: boolean; after?: Partial<FsrsSnapshot>; input?: Partial<RecordReviewInput> } = {},
): RecordReviewInput {
  const { hit, total } = scoreOf(results)
  const rating = ratingFromScore(hit, total, options.easy) as RatingValue
  return {
    card_id: card.id,
    results,
    card_after: { ...scheduleNext(snapshotFromRow(card), rating, when), ...options.after },
    rating,
    easy: options.easy,
    answer: 'Energy gets transferred, never used up.',
    reviewed_at: when.toISOString(),
    ...options.input,
  }
}

type LogEntry = { step: string } & Record<string, unknown>

async function runScenario(world: World): Promise<LogEntry[]> {
  const log: LogEntry[] = []

  async function attempt(step: string, input: RecordReviewInput) {
    try {
      const { review, card } = await world.recordReview(input)
      const mistakes = (await world.mistakesFor(review.id))
        .map(mistakeOutcome)
        .sort((a, b) => (a.key_point_id ?? '').localeCompare(b.key_point_id ?? ''))
      log.push({
        step,
        review: reviewOutcome(review),
        card: cardOutcome(card),
        mistakes,
        counts: await world.counts(),
        kept_id: review.id === input.id,
      })
      return { review, card }
    } catch (error) {
      const { code, message } = error as { code?: unknown; message?: unknown }
      log.push({ step, error: { code, message }, counts: await world.counts() })
      return null
    }
  }

  let card = await world.createCard(KEY_POINTS, { withTopic: true })
  const full = resultsFor(card, [true, true, true])

  // Rejected input: nothing is saved.
  await attempt('unknown card', { ...marked(card, full, at(1)), card_id: '00000000-0000-4000-8000-00000000dead' })
  await attempt('no results', { ...marked(card, full, at(1)), results: [] })
  await attempt('result without a boolean hit', {
    ...marked(card, full, at(1)),
    results: full.map((r, i) => (i === 0 ? ({ ...r, hit: 'true' } as unknown as PointResult) : r)),
  })
  await attempt('missing scheduling state', {
    ...marked(card, full, at(1)),
    card_after: { ...scheduleNext(snapshotFromRow(card), 3, at(1)), due: null } as unknown as FsrsSnapshot,
  })
  await attempt('missing point', marked(card, full.slice(0, 2), at(1)))
  await attempt('repeated point', marked(card, [...full.slice(0, 2), full[1]!], at(1)))
  await attempt('unknown point', marked(card, [...full.slice(0, 2), { ...full[2]!, key_point_id: 'kp_x' }], at(1)))
  await attempt('rating too high', { ...marked(card, resultsFor(card, [true, false, false]), at(1)), rating: 3 })
  await attempt('easy without full marks', {
    ...marked(card, resultsFor(card, [true, true, false]), at(1)),
    easy: true,
    rating: 4,
  })
  await attempt('good when easy was tapped', { ...marked(card, full, at(1), { easy: true }), rating: 3 })
  await attempt('fractional reps', marked(card, full, at(1), { after: { reps: 1.5 } }))
  await attempt('fractional state', marked(card, full, at(1), { after: { state: 1.5 as FsrsSnapshot['state'] } }))
  await attempt('blank stability', marked(card, full, at(1), { after: { stability: '' as unknown as number } }))
  await attempt('missing reps', marked(card, full, at(1), { after: { reps: null as unknown as number } }))
  await attempt('negative stability', marked(card, full, at(1), { after: { stability: -1 } }))
  await attempt('impossible state', marked(card, full, at(1), { after: { state: 5 as FsrsSnapshot['state'] } }))
  await attempt('unreadable due date', marked(card, full, at(1), { after: { due: 'next week' } }))
  await attempt('unknown grading', marked(card, full, at(1), { input: { grading: 'robot' as 'self' } }))
  await attempt('answer too long', marked(card, full, at(1), { input: { answer: 'x'.repeat(5001) } }))
  await attempt('negative duration in the RPC', marked(card, full, at(1), { input: { duration_ms: -5 } }))

  // Saved reviews, through the categories.
  const first = await attempt(
    'nothing right',
    marked(
      card,
      resultsFor(card, [false, false, false], [
        { reason: '  Said energy is "used up"  ', quote: ' energy gets used up ' },
        { reason: '\tNo stores named\t', quote: '   ', point: 'Stale wording' },
        { reason: '   ', quote: null },
      ]),
      at(10),
      { input: { duration_ms: 12_345.6, corrections: [{ exact_substring: 'used up', correction: 'transferred' }] } },
    ),
  )
  card = first!.card
  const second = await attempt('two of three', marked(card, resultsFor(card, [true, false, true]), at(20)))
  card = second!.card
  card = (await attempt('again', marked(card, resultsFor(card, [false, false, false]), at(30))))!.card
  const longInterval = { after: { scheduled_days: 40 } }
  card = (await attempt('full marks 1', marked(card, full, at(40), longInterval)))!.card
  card = (await attempt('full marks 2', marked(card, full, at(50), longInterval)))!.card
  const easy = await attempt('full marks 3, easy', marked(card, full, at(60), { ...longInterval, easy: true }))
  card = easy!.card
  const boundary = await attempt(
    'full marks at 21 days',
    marked(card, full, at(70), {
      after: { scheduled_days: 21 },
      input: { grading: 'ai', corrections: [{ exact_substring: 'never', correction: 'not' }], missing: ['closed system'] },
    }),
  )
  card = boundary!.card

  // Overrides: only the latest review, against the points that were reviewed.
  await attempt('override an older review', {
    ...marked(card, full, at(0)),
    review_id: first!.review.id,
  })
  await attempt('override an unknown review', {
    ...marked(card, full, at(0)),
    review_id: '00000000-0000-4000-8000-00000000beef',
  })
  const before = boundary!.review.card_before
  const reviewedAt = new Date(boundary!.review.reviewed_at)
  const override = (hits: boolean[], extra: Partial<PointResult>[] = [], input: Partial<RecordReviewInput> = {}) => {
    const results = resultsFor({ key_points: KEY_POINTS }, hits, extra)
    const rating = ratingFromScore(scoreOf(results).hit, results.length) as RatingValue
    return {
      card_id: card.id,
      review_id: boundary!.review.id,
      results,
      rating,
      card_after: scheduleNext(before, rating, reviewedAt),
      ...input,
    }
  }
  await attempt('override to one of three', override([false, true, false], [{ overridden: true }, {}, { overridden: true }]))
  await attempt('override keeps corrections when omitted', override([true, true, false], [], { missing: ['stores'] }))

  card = await world.setKeyPoints(card.id, [
    { id: 'kp_a', point: 'Energy is conserved', accept: [], reject: [] },
    { id: 'kp_d', point: 'A point added later', accept: [], reject: [] },
  ])
  await attempt('new review with the old points', marked(card, full, at(80)))
  await attempt('override with the new points', {
    ...override([true, true]),
    results: resultsFor(card, [true, true]),
  })
  await attempt('override after the card was edited', override([false, false, false], [{}, {}, { point: ' ' }]))
  const edited = await attempt('new review of the edited card', marked(card, resultsFor(card, [true, false]), at(90)))
  card = edited!.card

  // Retries and conflicts.
  const withId = (hits: boolean[], when: Date, input: Partial<RecordReviewInput>) =>
    marked(card, resultsFor(card, hits), when, { input: { id: REVIEW_ID, ...input } })
  const original = withId([false, true], at(100), { expected_reps: card.reps })
  await attempt('stale expected reps', { ...original, expected_reps: card.reps - 1 })
  await attempt('stale expected reps with malformed results', { ...original, expected_reps: card.reps - 1, results: [] })
  const saved = await attempt('matching expected reps', original)
  await attempt('the same review again', original)
  await attempt('the same id with stale reps and nothing valid', {
    ...original,
    results: [],
    rating: 4,
    card_after: { due: null } as unknown as FsrsSnapshot,
    expected_reps: 0,
  })
  await attempt('the same id after an edit changed the points', {
    ...original,
    results: resultsFor({ key_points: KEY_POINTS }, [true, true, true]),
  })
  card = saved!.card
  const other = await world.createCard(KEY_POINTS)
  await attempt("the id of another card's review", marked(other, resultsFor(other, [true, true, true]), at(110), { input: { id: REVIEW_ID } }))
  await attempt('no expected reps skips the check', marked(card, resultsFor(card, [true, true]), at(120)))
  await attempt('stale expected reps of 0', marked(card, resultsFor(card, [true, true]), at(125), { input: { expected_reps: 0 } }))
  card = (await attempt('a new card expects 0', marked(other, resultsFor(other, [false, true, true]), at(130), { input: { expected_reps: 0 } })))!.card

  // Amending ignores both: the id is not looked up, and the count is not compared.
  const latest = await attempt('a review to amend', marked(card, resultsFor(card, [true, true, false]), at(140)))
  card = latest!.card
  await attempt('amending ignores the id and the count', {
    card_id: card.id,
    review_id: latest!.review.id,
    id: REVIEW_ID,
    expected_reps: 0,
    results: resultsFor(card, [true, true, true]),
    rating: 3,
    card_after: scheduleNext(latest!.review.card_before, 3, new Date(latest!.review.reviewed_at)),
  })

  return log
}

describe('demo record_review matches the SQL', () => {
  const db = setupTestDb()

  it(
    'for every outcome of the same scenario',
    async () => {
      const userId = await db().createUser()
      const sql = await runScenario(sqlWorld(db(), userId))
      const demo = await runScenario(demoWorld())

      expect(demo.map((entry) => entry.step)).toEqual(sql.map((entry) => entry.step))
      for (const [i, expected] of sql.entries()) expect(demo[i], expected.step).toEqual(expected)

      // The scenario reaches every branch it is meant to.
      const errors = sql.flatMap((entry) => ('error' in entry ? [(entry.error as { code: string }).code] : []))
      expect(new Set(errors)).toEqual(
        new Set(['P0002', '22023', CARD_CONFLICT_CODE, '22P02', '23502', '23505', '23514', '22007', '55000']),
      )
      const categories = sql.flatMap((entry) => ('card' in entry ? [(entry.card as { category: string }).category] : []))
      expect(new Set(categories)).toEqual(new Set(['weak', 'learning', 'mastered']))
    },
    DB_TIMEOUT_MS,
  )
})
