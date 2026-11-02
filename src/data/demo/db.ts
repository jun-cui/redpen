// The demo "database": plain rows kept in localStorage, with the constraints, triggers and
// RPCs of supabase/migrations reproduced in TypeScript. Errors carry the same SQLSTATE codes
// as Postgres so friendlyError() treats both backends alike.

import { computeCategory } from '../../lib/category'
import type {
  CardRow,
  MistakeRow,
  ProfileRow,
  ReviewRow,
  TopicRow,
} from '../../lib/database.types'
import { CARD_CONFLICT_CODE } from '../../lib/errors'
import { newUuid } from '../../lib/ids'
import { SUBJECT_CODES } from '../../lib/subjects'
import type { CardOrigin, FsrsSnapshot, Grading, KeyPoint, SubjectCode } from '../../lib/types'
import { DEFAULT_TOPICS, EXAMPLE_CARDS } from '../exampleContent'
import type { RecordReviewResult } from '../api'
import type { RecordReviewArgs } from '../recordReviewArgs'

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'

export interface DemoState {
  version: 1
  profile: ProfileRow
  topics: TopicRow[]
  cards: CardRow[]
  reviews: ReviewRow[]
  mistakes: MistakeRow[]
}

/** Shaped like a PostgrestError: { code, message, details, hint }. */
export class DemoDbError extends Error {
  code: string
  details: string
  hint: string

  constructor(code: string, message: string, details = '') {
    super(message)
    this.name = 'PostgrestError'
    this.code = code
    this.details = details
    this.hint = ''
  }
}

// ---------------------------------------------------------------------------
// Postgres string semantics
// ---------------------------------------------------------------------------

/** Postgres btrim(text): strips spaces only, not other whitespace. */
function btrim(value: string): string {
  return value.replace(/^ +| +$/g, '')
}

/** char_length(): counts code points, not UTF-16 units. */
function charLength(value: string): number {
  return Array.from(value).length
}

/** left(text, n) */
function left(value: string, n: number): string {
  return Array.from(value).slice(0, n).join('')
}

/** nullif(btrim(value), '') for a jsonb ->> text value. */
function nonBlank(value: unknown): string | null {
  const text = jsonText(value)
  if (text === null) return null
  const trimmed = btrim(text)
  return trimmed === '' ? null : trimmed
}

/** jsonb ->> 'key': strings as they are, JSON null or a missing key as SQL NULL. */
function jsonText(value: unknown): string | null {
  if (value === undefined || value === null) return null
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function compareTimestamps(a: string, b: string): number {
  return Date.parse(a) - Date.parse(b)
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

function checkViolation(table: string, constraint: string): DemoDbError {
  return new DemoDbError(
    '23514',
    `new row for relation "${table}" violates check constraint "${constraint}"`,
  )
}

function notNullViolation(table: string, column: string): DemoDbError {
  return new DemoDbError(
    '23502',
    `null value in column "${column}" of relation "${table}" violates not-null constraint`,
  )
}

/** Port of public.key_points_valid(jsonb). */
export function keyPointsValid(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return false
  const seen = new Set<string>()
  for (const element of value as unknown[]) {
    if (typeof element !== 'object' || element === null || Array.isArray(element)) return false
    const kp = element as Record<string, unknown>
    const id = kp.id
    if (typeof id !== 'string' || charLength(id) < 1 || charLength(id) > 64 || seen.has(id)) {
      return false
    }
    seen.add(id)
    const point = kp.point
    if (typeof point !== 'string') return false
    const pointLength = charLength(btrim(point))
    if (pointLength < 1 || pointLength > 500) return false
    const accept = kp.accept === undefined ? [] : kp.accept
    const reject = kp.reject === undefined ? [] : kp.reject
    if (!Array.isArray(accept) || !Array.isArray(reject)) return false
    for (const alternative of [...accept, ...reject] as unknown[]) {
      if (typeof alternative !== 'string' || charLength(alternative) > 300) return false
    }
  }
  return true
}

export function checkTopic(state: DemoState, topic: TopicRow): void {
  const nameLength = charLength(btrim(topic.name))
  if (nameLength < 1 || nameLength > 80) throw checkViolation('topics', 'topics_name_check')
  if (topic.unit !== null && charLength(topic.unit) > 40) {
    throw checkViolation('topics', 'topics_unit_check')
  }
  const key = btrim(topic.name).toLowerCase()
  const duplicate = state.topics.some(
    (other) =>
      other.id !== topic.id &&
      other.subject === topic.subject &&
      btrim(other.name).toLowerCase() === key,
  )
  if (duplicate) {
    throw new DemoDbError(
      '23505',
      'duplicate key value violates unique constraint "topics_user_subject_name_key"',
      `Key (user_id, subject, lower(btrim(name)))=(${topic.user_id}, ${topic.subject}, ${key}) already exists.`,
    )
  }
}

const ORIGINS: readonly CardOrigin[] = ['manual', 'generated', 'mistake', 'example']

export function checkCard(state: DemoState, card: CardRow): void {
  const questionLength = charLength(btrim(card.question))
  if (questionLength < 1 || questionLength > 4000) {
    throw checkViolation('cards', 'cards_question_check')
  }
  if (!keyPointsValid(card.key_points)) throw checkViolation('cards', 'cards_key_points_check')
  if (!ORIGINS.includes(card.origin)) throw checkViolation('cards', 'cards_origin_check')
  if (!SUBJECT_CODES.includes(card.subject)) {
    throw new DemoDbError('23514', `value for domain subject_code violates check constraint`)
  }
  if (
    card.topic_id !== null &&
    !state.topics.some((t) => t.id === card.topic_id && t.subject === card.subject)
  ) {
    throw new DemoDbError(
      '23503',
      'insert or update on table "cards" violates foreign key constraint "cards_topic_id_user_id_subject_fkey"',
      `Key (topic_id, user_id, subject)=(${card.topic_id}, ${card.user_id}, ${card.subject}) is not present in table "topics".`,
    )
  }
  if (card.fsrs_state < 0 || card.fsrs_state > 3) throw checkViolation('cards', 'cards_fsrs_state_check')
  for (const column of [
    'stability',
    'difficulty',
    'elapsed_days',
    'scheduled_days',
    'learning_steps',
    'reps',
    'lapses',
  ] as const) {
    if (!(card[column] >= 0)) throw checkViolation('cards', `cards_${column}_check`)
  }
}

export function checkProfile(profile: ProfileRow): void {
  if (profile.display_name !== null && charLength(profile.display_name) > 60) {
    throw checkViolation('profiles', 'profiles_display_name_check')
  }
  if (!(profile.desired_retention >= 0.7 && profile.desired_retention <= 0.97)) {
    throw checkViolation('profiles', 'profiles_desired_retention_check')
  }
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export function newCardRow(
  values: Pick<CardRow, 'subject' | 'topic_id' | 'question' | 'key_points' | 'origin'>,
  now: string,
): CardRow {
  return {
    id: newUuid(),
    user_id: DEMO_USER_ID,
    ...values,
    suspended: false,
    fsrs_state: 0,
    due: now,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    last_review: null,
    category: 'new',
    last_score: null,
    created_at: now,
    updated_at: now,
  }
}

function findTopicByName(state: DemoState, subject: SubjectCode, name: string): TopicRow | undefined {
  const key = btrim(name).toLowerCase()
  return state.topics.find((t) => t.subject === subject && btrim(t.name).toLowerCase() === key)
}

/**
 * Port of public.add_example_cards(): adds the example cards once (none if the user already
 * has any example card), topics matched by name. Returns how many were added.
 */
export function insertExampleCards(state: DemoState, now: Date): number {
  if (state.cards.some((card) => card.origin === 'example')) return 0
  const count = EXAMPLE_CARDS.length
  EXAMPLE_CARDS.forEach((example, index) => {
    // Distinct timestamps keep the cards in their written order.
    const createdAt = new Date(now.getTime() - (count - 1 - index)).toISOString()
    const card = newCardRow(
      {
        subject: example.subject,
        topic_id: findTopicByName(state, example.subject, example.topic)?.id ?? null,
        question: example.question,
        key_points: structuredClone(example.key_points),
        origin: 'example',
      },
      createdAt,
    )
    card.updated_at = now.toISOString()
    checkCard(state, card)
    state.cards.push(card)
  })
  return count
}

export function seedState(now: Date, options: { exampleCards: boolean }): DemoState {
  const timestamp = now.toISOString()
  const state: DemoState = {
    version: 1,
    profile: {
      id: DEMO_USER_ID,
      display_name: null,
      desired_retention: 0.9,
      created_at: timestamp,
      updated_at: timestamp,
    },
    topics: SUBJECT_CODES.flatMap((subject) =>
      DEFAULT_TOPICS[subject].map((topic, position) => ({
        id: newUuid(),
        user_id: DEMO_USER_ID,
        subject,
        name: topic.name,
        unit: topic.unit,
        position,
        archived: false,
        created_at: timestamp,
      })),
    ),
    cards: [],
    reviews: [],
    mistakes: [],
  }
  // Seeded a minute in the past so the cards are already due when the first query runs, which
  // captures its own `now` before this lazy seed happens.
  if (options.exampleCards) insertExampleCards(state, new Date(now.getTime() - 60_000))
  return state
}

export function isDemoState(value: unknown): value is DemoState {
  if (typeof value !== 'object' || value === null) return false
  const state = value as Partial<DemoState>
  return (
    state.version === 1 &&
    typeof state.profile === 'object' &&
    Array.isArray(state.topics) &&
    Array.isArray(state.cards) &&
    Array.isArray(state.reviews) &&
    Array.isArray(state.mistakes)
  )
}

/** The card's reviews, newest first (ORDER BY reviewed_at DESC, id DESC). */
export function reviewsNewestFirst(state: DemoState, cardId: string): ReviewRow[] {
  return state.reviews
    .filter((review) => review.card_id === cardId)
    .sort((a, b) => compareTimestamps(b.reviewed_at, a.reviewed_at) || compareText(b.id, a.id))
}

// ---------------------------------------------------------------------------
// record_review
// ---------------------------------------------------------------------------

/** (p_card_after ->> key)::integer, or ::smallint */
function integerField(
  after: Record<string, unknown>,
  key: string,
  type: 'integer' | 'smallint' = 'integer',
): number | null {
  const text = jsonText(after[key])
  if (text === null) return null
  if (!/^\s*[+-]?\d+\s*$/.test(text)) {
    throw new DemoDbError('22P02', `invalid input syntax for type ${type}: "${text}"`)
  }
  return Number(text)
}

/** (p_card_after ->> key)::double precision */
function numberField(after: Record<string, unknown>, key: string): number | null {
  const text = jsonText(after[key])
  if (text === null) return null
  const number = text.trim() === '' ? NaN : Number(text)
  if (!Number.isFinite(number)) {
    throw new DemoDbError('22P02', `invalid input syntax for type double precision: "${text}"`)
  }
  return number
}

/** (p_card_after ->> key)::timestamptz, as an ISO string */
function timestampField(after: Record<string, unknown>, key: string): string | null {
  const value = after[key]
  if (value === undefined || value === null) return null
  const time = typeof value === 'string' ? Date.parse(value) : NaN
  if (Number.isNaN(time)) {
    throw new DemoDbError(
      '22007',
      `invalid input syntax for type timestamp with time zone: "${String(value)}"`,
    )
  }
  return new Date(time).toISOString()
}

function required<T>(value: T | null, column: string): T {
  if (value === null) throw notNullViolation('cards', column)
  return value
}

const GRADINGS: readonly Grading[] = ['self', 'ai', 'ai_fallback']

/** Whether two id lists hold the same ids the same number of times (SQL: sorted arrays equal). */
function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].sort(compareText)
  const right = [...b].sort(compareText)
  return left.every((id, i) => id === right[i])
}

/**
 * Port of public.record_review(): validates, saves the review, reschedules, logs mistakes.
 * Takes the RPC's named arguments (see ../recordReviewArgs), with the same defaults: an
 * omitted argument gets the SQL default, while an explicit null is passed through. Checks run
 * in the same order as in SQL, so the same bad input fails with the same error.
 */
export function recordReview(state: DemoState, args: RecordReviewArgs, now: Date): RecordReviewResult {
  const nowIso = now.toISOString()
  const card = state.cards.find((c) => c.id === args.p_card_id)
  if (!card) throw new DemoDbError('P0002', 'Card not found')

  if (args.p_review_id == null) {
    const replayed = state.reviews.find((r) => r.id === args.p_id && r.card_id === card.id)
    if (replayed) return { review: replayed, card }
    if (args.p_expected_reps != null && args.p_expected_reps !== card.reps) {
      throw new DemoDbError(CARD_CONFLICT_CODE, 'Card changed since it was shown')
    }
  }

  const results: unknown = args.p_results
  if (!Array.isArray(results) || results.length === 0) {
    throw new DemoDbError('22023', 'Results must be a non-empty array')
  }
  const resultsValid = (results as unknown[]).every((r) => {
    if (typeof r !== 'object' || r === null || Array.isArray(r)) return false
    const result = r as Record<string, unknown>
    return typeof result.hit === 'boolean' && typeof result.key_point_id === 'string'
  })
  if (!resultsValid) {
    throw new DemoDbError('22023', 'Each result needs a key_point_id and a boolean hit')
  }
  const after: unknown = args.p_card_after
  if (
    typeof after !== 'object' ||
    after === null ||
    Array.isArray(after) ||
    jsonText((after as Record<string, unknown>).due) === null
  ) {
    throw new DemoDbError('22023', 'Missing scheduling state')
  }

  let existing: ReviewRow | undefined
  if (args.p_review_id != null) {
    existing = state.reviews.find((r) => r.id === args.p_review_id && r.card_id === card.id)
    if (!existing) throw new DemoDbError('P0002', 'Review not found')
    if (reviewsNewestFirst(state, card.id)[0] !== existing) {
      throw new DemoDbError('55000', 'Only the most recent review of a card can be changed')
    }
  }

  // Exactly one result per key point: the card's points for a new review, the reviewed points
  // for an override (the card may have been edited since). For a new review a mismatch means
  // the card's key points changed under the client.
  const input = args.p_results
  const expectedIds = existing
    ? existing.results.map((r) => r.key_point_id)
    : card.key_points.map((kp) => kp.id)
  if (!sameIds(input.map((r) => r.key_point_id), expectedIds)) {
    throw new DemoDbError(
      existing ? '22023' : CARD_CONFLICT_CODE,
      "Results must mark each of the card's key points exactly once",
    )
  }

  const total = input.length
  const hit = input.filter((r) => r.hit === true).length
  const easy = (args.p_easy ?? false) && hit === total
  const expected = hit === 0 ? 1 : hit < total ? 2 : easy ? 4 : 3
  if (args.p_rating !== expected) {
    throw new DemoDbError('22023', `Rating ${args.p_rating} does not match a score of ${hit}/${total}`)
  }

  // Omitted: the SQL default '[]'. Explicit null: '[]' for a new review, kept when amending.
  const corrections = args.p_corrections === undefined ? [] : args.p_corrections
  const missing = args.p_missing === undefined ? [] : args.p_missing

  let review: ReviewRow
  if (!existing) {
    const answer = args.p_answer ?? ''
    const grading = args.p_grading ?? 'self'
    const durationMs = args.p_duration_ms ?? null
    if (charLength(answer) > 5000) throw checkViolation('reviews', 'reviews_answer_check')
    if (!GRADINGS.includes(grading)) throw checkViolation('reviews', 'reviews_grading_check')
    if (durationMs !== null && !(durationMs >= 0)) {
      throw checkViolation('reviews', 'reviews_duration_ms_check')
    }
    const id = args.p_id ?? newUuid()
    if (state.reviews.some((r) => r.id === id)) {
      throw new DemoDbError('23505', 'duplicate key value violates unique constraint "reviews_pkey"')
    }
    const cardBefore: FsrsSnapshot = {
      state: card.fsrs_state as FsrsSnapshot['state'],
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: card.elapsed_days,
      scheduled_days: card.scheduled_days,
      learning_steps: card.learning_steps,
      reps: card.reps,
      lapses: card.lapses,
      last_review: card.last_review,
    }
    review = {
      id,
      user_id: card.user_id,
      card_id: card.id,
      reviewed_at: timestampField({ reviewed_at: args.p_reviewed_at }, 'reviewed_at') ?? nowIso,
      answer,
      grading,
      results: structuredClone(input),
      corrections: structuredClone(corrections ?? []),
      missing: structuredClone(missing ?? []),
      points_hit: hit,
      points_total: total,
      easy,
      rating: expected,
      card_before: cardBefore,
      duration_ms: durationMs,
      amended_at: null,
    }
    state.reviews.push(review)
  } else {
    existing.results = structuredClone(input)
    if (corrections !== null) existing.corrections = structuredClone(corrections)
    if (missing !== null) existing.missing = structuredClone(missing)
    existing.points_hit = hit
    existing.points_total = total
    existing.easy = easy
    existing.rating = expected
    existing.amended_at = nowIso
    review = existing
  }

  const fields = after as Record<string, unknown>
  const updated: CardRow = {
    ...card,
    fsrs_state: required(integerField(fields, 'state', 'smallint'), 'fsrs_state'),
    due: required(timestampField(fields, 'due'), 'due'),
    stability: required(numberField(fields, 'stability'), 'stability'),
    difficulty: required(numberField(fields, 'difficulty'), 'difficulty'),
    elapsed_days: integerField(fields, 'elapsed_days') ?? 0,
    scheduled_days: integerField(fields, 'scheduled_days') ?? 0,
    learning_steps: integerField(fields, 'learning_steps') ?? 0,
    reps: required(integerField(fields, 'reps'), 'reps'),
    lapses: required(integerField(fields, 'lapses'), 'lapses'),
    last_review: timestampField(fields, 'last_review'),
    last_score: hit / total,
    updated_at: nowIso,
  }
  checkCard(state, updated)

  // Mistake log: one entry per missed key point, rebuilt whenever the review changes.
  state.mistakes = state.mistakes.filter((m) => m.review_id !== review.id)
  for (const result of input) {
    if (result.hit !== false) continue
    const keyPoint: KeyPoint | undefined = card.key_points.find((kp) => kp.id === result.key_point_id)
    const pointText = nonBlank(keyPoint?.point) ?? nonBlank(result.point)
    state.mistakes.push({
      id: newUuid(),
      user_id: card.user_id,
      created_at: nowIso,
      origin: 'review',
      subject: card.subject,
      topic_id: card.topic_id,
      card_id: card.id,
      review_id: review.id,
      key_point_id: result.key_point_id,
      source: 'Flashcard review',
      what_went_wrong: left(nonBlank(result.reason) ?? `Missed: ${pointText ?? 'a key point'}`, 2000),
      fix: left(pointText ?? 'See the mark scheme for this card.', 2000),
      // Said something relevant but not precise enough = wording; said nothing = knowledge.
      mistake_type: nonBlank(result.quote) !== null ? 'wording' : 'knowledge',
      raw_text: null,
      flashcard_id: null,
    })
  }

  Object.assign(card, updated)
  card.category = computeCategory(reviewsNewestFirst(state, card.id), card.scheduled_days)

  return { review, card }
}
