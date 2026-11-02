// Domain helpers for the database tests: cards, key points, FSRS snapshots and record_review
// calls shaped exactly like the app's (types from src/lib/database.types.ts).

import type { CardRow, Database, MistakeRow, ReviewRow } from '../../src/lib/database.types.ts'
import type { FsrsSnapshot, KeyPoint, PointResult, SubjectCode } from '../../src/lib/types.ts'
import type { Queryable, TestDb } from './harness.ts'

export type RecordReviewArgs = Database['public']['Functions']['record_review']['Args']
export type RecordReviewResult = Database['public']['Functions']['record_review']['Returns']

/** What record_review raises when a card changed under the client (the app's CARD_CONFLICT_CODE). */
export const CARD_CONFLICT_CODE = 'PT409'

/** `count` key points with ids kp_1..kp_n. */
export function keyPoints(count: number): KeyPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `kp_${i + 1}`,
    point: `Key point ${i + 1} in the mark scheme's wording.`,
    accept: [`An accepted wording of point ${i + 1}`],
    reject: [`A rejected wording of point ${i + 1}`],
  }))
}

export interface CardInput {
  subject?: SubjectCode
  topic_id?: string | null
  question?: string
  key_points?: unknown
  origin?: string
}

/** Inserts a card through whatever role `tx` runs as, returning the stored row. */
export async function insertCard(tx: Queryable, input: CardInput = {}): Promise<CardRow> {
  const { rows } = await tx.query<CardRow>(
    `insert into public.cards (subject, topic_id, question, key_points, origin)
     values ($1, $2, $3, $4::jsonb, $5)
     returning *`,
    [
      input.subject ?? 'physics',
      input.topic_id ?? null,
      input.question ?? 'State Newton’s first law of motion.',
      JSON.stringify(input.key_points ?? keyPoints(4)),
      input.origin ?? 'manual',
    ],
  )
  return single(rows)
}

/** A new user (with the default topics) who owns one card. */
export async function userWithCard(
  db: TestDb,
  input: CardInput = {},
): Promise<{ userId: string; card: CardRow }> {
  const userId = await db.createUser()
  const card = await db.asUser(userId, (tx) => insertCard(tx, input))
  return { userId, card }
}

/** Adds a mistake typed into the log by hand (origin 'manual'), returning its id. */
export async function insertManualMistake(
  tx: Queryable,
  fields: { subject?: SubjectCode | null; topic_id?: string | null; card_id?: string | null } = {},
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.mistakes (origin, subject, topic_id, card_id, source, what_went_wrong, fix, mistake_type)
     values ('manual', $1, $2, $3, 'Paper 1, question 4', 'Dropped a minus sign.', 'Check the signs of each term.', 'slip')
     returning id`,
    [fields.subject === undefined ? 'physics' : fields.subject, fields.topic_id ?? null, fields.card_id ?? null],
  )
  return single(rows).id
}

/** The id of one of the user's own topics, by subject and name (as the user sees them). */
export async function topicId(tx: Queryable, subject: SubjectCode, name: string): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    'select id from public.topics where subject = $1 and name = $2',
    [subject, name],
  )
  return single(rows).id
}

/** Self-graded results for `card`, one per key point, with the given hits in order. */
export function resultsFor(card: Pick<CardRow, 'key_points'>, hits: readonly boolean[]): PointResult[] {
  if (hits.length !== card.key_points.length) {
    throw new Error(`resultsFor: ${hits.length} hits for ${card.key_points.length} key points`)
  }
  return card.key_points.map((kp, i) => ({
    key_point_id: kp.id,
    point: kp.point,
    quote: null,
    reason: null,
    hit: hits[i] === true,
    ai_hit: null,
    overridden: false,
  }))
}

/** The rating record_review requires for a score: 0 = Again, some = Hard, all = Good / Easy. */
export function ratingFor(hits: readonly boolean[], easy = false): 1 | 2 | 3 | 4 {
  const hit = hits.filter(Boolean).length
  if (hit === 0) return 1
  if (hit < hits.length) return 2
  return easy ? 4 : 3
}

/** A plausible ts-fsrs state after a review; override any field. */
export function snapshot(overrides: Partial<FsrsSnapshot> = {}): FsrsSnapshot {
  return {
    state: 2,
    due: '2026-11-01T09:00:00.000Z',
    stability: 7.5,
    difficulty: 5.25,
    elapsed_days: 1,
    scheduled_days: 7,
    learning_steps: 0,
    reps: 3,
    lapses: 1,
    last_review: '2026-10-25T09:00:00.000Z',
    ...overrides,
  }
}

/**
 * Calls record_review with named arguments, as PostgREST does for supabase.rpc(). Arguments
 * are deliberately untyped so tests can send malformed input; use recordReview() otherwise.
 */
export async function callRecordReview(
  tx: Queryable,
  args: Record<string, unknown>,
): Promise<RecordReviewResult> {
  const names = Object.keys(args)
  for (const name of names) {
    if (!/^p_[a-z_]+$/.test(name)) throw new Error(`Unexpected record_review argument: ${name}`)
  }
  const values = names.map((name) => {
    const value = args[name]
    return value !== null && typeof value === 'object' ? JSON.stringify(value) : value
  })
  const { rows } = await tx.query<{ result: RecordReviewResult }>(
    `select public.record_review(${names.map((name, i) => `${name} => $${i + 1}`).join(', ')}) as result`,
    values,
  )
  return single(rows).result
}

export function recordReview(tx: Queryable, args: RecordReviewArgs): Promise<RecordReviewResult> {
  return callRecordReview(tx, { ...args })
}

/** A review of `card` with the given hits, the matching rating and an FSRS state to store. */
export function reviewArgs(
  card: Pick<CardRow, 'id' | 'key_points'>,
  hits: readonly boolean[],
  extra: Partial<RecordReviewArgs> = {},
): RecordReviewArgs {
  return {
    p_card_id: card.id,
    p_results: resultsFor(card, hits),
    p_card_after: snapshot(),
    p_rating: ratingFor(hits, extra.p_easy ?? false),
    ...extra,
  }
}

export async function reviewsOf(tx: Queryable, cardId: string): Promise<ReviewRow[]> {
  const { rows } = await tx.query<ReviewRow>(
    'select * from public.reviews where card_id = $1 order by reviewed_at desc, id desc',
    [cardId],
  )
  return rows
}

/** The mistake-log rows made from a review, in key point order. */
export async function mistakesOf(tx: Queryable, reviewId: string): Promise<MistakeRow[]> {
  const { rows } = await tx.query<MistakeRow>(
    'select * from public.mistakes where review_id = $1 order by key_point_id',
    [reviewId],
  )
  return rows
}

export async function cardById(tx: Queryable, cardId: string): Promise<CardRow | undefined> {
  const { rows } = await tx.query<CardRow>('select * from public.cards where id = $1', [cardId])
  return rows[0]
}

export async function count(tx: Queryable, sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) as counted`, params)
  return single(rows).n
}

export function single<T>(rows: readonly T[]): T {
  if (rows.length !== 1) throw new Error(`Expected exactly one row, got ${rows.length}`)
  return rows[0] as T
}

/** Milliseconds since the epoch for a timestamp from Postgres (Date) or from jsonb (ISO string). */
export function ms(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return (value instanceof Date ? value : new Date(value)).getTime()
}
