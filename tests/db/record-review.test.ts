// record_review: saving a marked answer. The score always comes from the per-point hits, the
// rating must match it, the card stores the FSRS state the browser computed, and every missed
// key point is logged as a mistake. Overrides amend the card's latest review.

import { describe, expect, it } from 'vitest'
import type { CardRow, ReviewRow } from '../../src/lib/database.types.ts'
import { newCardSnapshot, scheduleNext, snapshotFromRow } from '../../src/lib/fsrs.ts'
import type { FsrsSnapshot, PointResult } from '../../src/lib/types.ts'
import { pgError, setupTestDb } from './harness.ts'
import type { Queryable } from './harness.ts'
import {
  callRecordReview,
  CARD_CONFLICT_CODE,
  cardById,
  count,
  insertCard,
  keyPoints,
  mistakesOf,
  ms,
  ratingFor,
  recordReview,
  resultsFor,
  reviewArgs,
  reviewsOf,
  single,
  snapshot,
  userWithCard,
} from './fixtures.ts'
import type { RecordReviewArgs } from './fixtures.ts'

const db = setupTestDb()

const T = true
const F = false

/** An FSRS snapshot with its timestamps as epoch ms, so jsonb strings and Dates compare equal. */
function normalizedSnapshot(s: FsrsSnapshot) {
  return { ...s, due: ms(s.due), last_review: ms(s.last_review) }
}

/** A card's FSRS columns, normalized like a snapshot. */
function fsrsOf(card: CardRow) {
  return normalizedSnapshot(snapshotFromRow(card))
}

/** Everything record_review may write for a card, to show that a rejected call wrote nothing. */
async function footprint(q: Queryable, cardId: string) {
  const card = await cardById(q, cardId)
  return {
    card: card && { ...card, updated_at: ms(card.updated_at) },
    reviews: await count(q, 'select 1 from public.reviews where card_id = $1', [cardId]),
    mistakes: await count(q, 'select 1 from public.mistakes'),
  }
}

describe('a new review', () => {
  it('saves the answer with the score computed from the hits', async () => {
    const { userId, card } = await userWithCard(db())
    const result = await db().asUser(userId, (tx) =>
      recordReview(
        tx,
        reviewArgs(card, [T, F, T, F], {
          p_answer: 'Momentum is conserved when no external force acts.',
          p_grading: 'ai',
          p_corrections: [{ exact_substring: 'conserved', correction: 'conserved in a closed system' }],
          p_missing: ['State that the total momentum before equals the total after.'],
          p_reviewed_at: '2026-10-22T08:30:00.000Z',
          p_duration_ms: 41_250,
        }),
      ),
    )
    expect(result.review).toMatchObject({
      user_id: userId,
      card_id: card.id,
      points_hit: 2,
      points_total: 4,
      rating: 2,
      easy: false,
      answer: 'Momentum is conserved when no external force acts.',
      grading: 'ai',
      corrections: [{ exact_substring: 'conserved', correction: 'conserved in a closed system' }],
      missing: ['State that the total momentum before equals the total after.'],
      duration_ms: 41_250,
      amended_at: null,
    })
    expect(ms(result.review.reviewed_at)).toBe(Date.parse('2026-10-22T08:30:00.000Z'))
    expect(result.review.results).toEqual(resultsFor(card, [T, F, T, F]))

    // The stored row is what the function returned.
    const [stored] = await db().asUser(userId, (tx) => reviewsOf(tx, card.id))
    expect(stored).toBeDefined()
    expect({ ...stored!, reviewed_at: ms(stored!.reviewed_at) }).toEqual({
      ...result.review,
      reviewed_at: ms(result.review.reviewed_at),
    })
    expect(result.card).toMatchObject({ id: card.id, last_score: 0.5, category: 'learning' })
  })

  it('uses the server time and an empty answer by default', async () => {
    const { userId, card } = await userWithCard(db())
    const before = Date.now()
    const { review } = await db().asUser(userId, (tx) =>
      callRecordReview(tx, {
        p_card_id: card.id,
        p_results: resultsFor(card, [T, T, T, T]),
        p_card_after: snapshot(),
        p_rating: 3,
      }),
    )
    expect(review).toMatchObject({ answer: '', grading: 'self', corrections: [], missing: [], duration_ms: null })
    expect(ms(review.reviewed_at)).toBeGreaterThanOrEqual(before - 5_000)
  })

  it.each([
    { hits: [F, F, F, F], easy: false, rating: 1 },
    { hits: [T, F, F, F], easy: false, rating: 2 },
    { hits: [T, T, T, F], easy: false, rating: 2 },
    { hits: [T, T, T, T], easy: false, rating: 3 },
    { hits: [T, T, T, T], easy: true, rating: 4 },
  ])('accepts $hits (easy: $easy) rated $rating', async ({ hits, easy, rating }) => {
    const { userId, card } = await userWithCard(db())
    const { review, card: after } = await db().asUser(userId, (tx) =>
      recordReview(tx, { ...reviewArgs(card, hits, { p_easy: easy }), p_rating: rating }),
    )
    const hit = hits.filter(Boolean).length
    expect(review).toMatchObject({ points_hit: hit, points_total: 4, rating, easy })
    expect(after.last_score).toBeCloseTo(hit / 4)
  })

  it('ignores "easy" unless every point was hit', async () => {
    const { userId, card } = await userWithCard(db())
    const { review } = await db().asUser(userId, (tx) =>
      recordReview(tx, { ...reviewArgs(card, [T, T, F, T]), p_easy: true, p_rating: 2 }),
    )
    expect(review).toMatchObject({ points_hit: 3, rating: 2, easy: false })
  })

  it.each([
    { name: 'no points rated Hard', hits: [F, F, F, F], easy: false, rating: 2 },
    { name: 'no points rated Good', hits: [F, F, F, F], easy: false, rating: 3 },
    { name: 'some points rated Again', hits: [T, F, F, F], easy: false, rating: 1 },
    { name: 'some points rated Good', hits: [T, T, T, F], easy: false, rating: 3 },
    { name: 'some points with "easy" rated Easy', hits: [T, T, T, F], easy: true, rating: 4 },
    { name: 'all points rated Hard', hits: [T, T, T, T], easy: false, rating: 2 },
    { name: 'all points rated Easy without "easy"', hits: [T, T, T, T], easy: false, rating: 4 },
    { name: 'all points with "easy" rated Good', hits: [T, T, T, T], easy: true, rating: 3 },
    { name: 'a rating of 0', hits: [F, F, F, F], easy: false, rating: 0 },
    { name: 'a rating of 5', hits: [T, T, T, T], easy: true, rating: 5 },
    { name: 'no rating', hits: [T, T, T, T], easy: false, rating: null },
  ])('rejects $name, and saves nothing', async ({ hits, easy, rating }) => {
    const { userId, card } = await userWithCard(db())
    const before = await footprint(db().superuser, card.id)
    const error = await pgError(
      db().asUser(userId, (tx) => callRecordReview(tx, { ...reviewArgs(card, hits, { p_easy: easy }), p_rating: rating })),
    )
    expect(error.code).toBe('22023')
    expect(await footprint(db().superuser, card.id)).toEqual(before)
  })

  describe('rejects results that do not mark each key point exactly once', () => {
    // Malformed input is the client's fault (22023). Results that are well formed but don't match
    // the key points mean the card changed under the client (a conflict it can recover from).
    const cases: { name: string; code: string; results: (card: CardRow) => unknown }[] = [
      { name: 'null results', code: '22023', results: () => null },
      { name: 'an object', code: '22023', results: (card) => resultsFor(card, [T, T, T, T])[0] },
      { name: 'an empty array', code: '22023', results: () => [] },
      { name: 'a point left out', code: CARD_CONFLICT_CODE, results: (card) => resultsFor(card, [T, T, T, T]).slice(1) },
      {
        name: 'a point marked twice',
        code: CARD_CONFLICT_CODE,
        results: (card) => {
          const results = resultsFor(card, [T, T, T, T])
          return [...results, results[0]]
        },
      },
      {
        name: 'a point marked twice in place of another',
        code: CARD_CONFLICT_CODE,
        results: (card) => {
          const results = resultsFor(card, [T, F, F, F])
          return [results[0], results[0], results[2], results[3]]
        },
      },
      {
        name: 'an unknown key point',
        code: CARD_CONFLICT_CODE,
        results: (card) => resultsFor(card, [T, T, T, T]).map((r, i) => (i === 3 ? { ...r, key_point_id: 'kp_x' } : r)),
      },
      {
        name: 'a result without a hit',
        code: '22023',
        results: (card) => resultsFor(card, [T, T, T, T]).map((r, i) => (i === 0 ? { ...r, hit: undefined } : r)),
      },
      {
        name: 'a hit that is a string',
        code: '22023',
        results: (card) => resultsFor(card, [T, T, T, T]).map((r, i) => (i === 0 ? { ...r, hit: 'true' } : r)),
      },
      {
        name: 'a numeric key_point_id',
        code: '22023',
        results: (card) => resultsFor(card, [T, T, T, T]).map((r, i) => (i === 0 ? { ...r, key_point_id: 1 } : r)),
      },
      {
        name: 'a result that is not an object',
        code: '22023',
        results: (card) => [...resultsFor(card, [T, T, T, T]).slice(0, 3), 'kp_4'],
      },
    ]

    it.each(cases)('$name', async ({ code, results }) => {
      const { userId, card } = await userWithCard(db())
      const before = await footprint(db().superuser, card.id)
      const error = await pgError(
        db().asUser(userId, (tx) =>
          callRecordReview(tx, { p_card_id: card.id, p_results: results(card), p_card_after: snapshot(), p_rating: 3 }),
        ),
      )
      expect(error.code).toBe(code)
      expect(await footprint(db().superuser, card.id)).toEqual(before)
    })
  })

  it.each([
    { name: 'no scheduling state', after: null, code: '22023' },
    { name: 'a scheduling state that is not an object', after: [snapshot()], code: '22023' },
    { name: 'no due date', after: { ...snapshot(), due: null }, code: '22023' },
    { name: 'an unreadable due date', after: { ...snapshot(), due: 'next week' }, code: '22007' },
    { name: 'an impossible FSRS state', after: snapshot({ state: 7 as FsrsSnapshot['state'] }), code: '23514' },
    { name: 'a negative stability', after: snapshot({ stability: -1 }), code: '23514' },
    { name: 'no reps', after: { ...snapshot(), reps: undefined }, code: '23502' },
  ])('rejects $name and saves nothing, not even the review', async ({ after, code }) => {
    const { userId, card } = await userWithCard(db())
    const before = await footprint(db().superuser, card.id)
    const error = await pgError(
      db().asUser(userId, (tx) =>
        callRecordReview(tx, { ...reviewArgs(card, [T, F, T, T]), p_card_after: after }),
      ),
    )
    expect(error.code).toBe(code)
    expect(await footprint(db().superuser, card.id)).toEqual(before)
  })

  it.each([
    { name: 'an unknown grading', extra: { p_grading: 'robot' } },
    { name: 'an answer over 5000 characters', extra: { p_answer: 'x'.repeat(5_001) } },
    { name: 'a negative duration', extra: { p_duration_ms: -5 } },
    { name: 'corrections that are not an array', extra: { p_corrections: { exact_substring: 'a', correction: 'b' } } },
  ])('rejects $name and saves nothing', async ({ extra }) => {
    const { userId, card } = await userWithCard(db())
    const before = await footprint(db().superuser, card.id)
    const error = await pgError(
      db().asUser(userId, (tx) => callRecordReview(tx, { ...reviewArgs(card, [T, F, T, T]), ...extra })),
    )
    expect(error.code).toBe('23514')
    expect(await footprint(db().superuser, card.id)).toEqual(before)
  })

  it.each([1, 20])('marks a card with %i key points', async (n) => {
    const hits = Array.from({ length: n }, (_, i) => i % 2 === 0)
    const { userId, card } = await userWithCard(db(), { key_points: keyPoints(n) })
    const { review } = await db().asUser(userId, (tx) => recordReview(tx, reviewArgs(card, hits)))
    const hit = hits.filter(Boolean).length
    expect(review).toMatchObject({ points_hit: hit, points_total: n, rating: ratingFor(hits) })
    expect(await db().asUser(userId, (tx) => mistakesOf(tx, review.id))).toHaveLength(n - hit)
  })

  it('stores the FSRS state the browser computed on the card', async () => {
    const { userId, card } = await userWithCard(db())
    const after = snapshot({
      state: 1,
      due: '2026-10-22T09:10:00.000Z',
      stability: 2.3065,
      difficulty: 6.4133,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 1,
      reps: 1,
      lapses: 0,
      last_review: '2026-10-22T09:00:00.000Z',
    })
    const result = await db().asUser(userId, (tx) =>
      recordReview(tx, reviewArgs(card, [T, F, F, F], { p_card_after: after })),
    )
    const stored = await db().asUser(userId, (tx) => cardById(tx, card.id))
    expect(fsrsOf(stored!)).toEqual(normalizedSnapshot(after))
    expect(fsrsOf(result.card)).toEqual(normalizedSnapshot(after))
    expect(stored).toMatchObject({ last_score: 0.25, category: 'weak' })
    // Nothing else about the card changes.
    expect(stored).toMatchObject({ question: card.question, key_points: card.key_points, topic_id: card.topic_id })
  })

  it('snapshots the card’s FSRS state from before the review, for overrides', async () => {
    const { userId, card } = await userWithCard(db())
    const first = snapshot({ due: '2026-10-23T09:00:00.000Z', last_review: '2026-10-22T09:00:00.000Z', reps: 1 })
    const { review: firstReview } = await db().asUser(userId, (tx) =>
      recordReview(tx, reviewArgs(card, [T, T, T, T], { p_card_after: first, p_reviewed_at: '2026-10-22T09:00:00Z' })),
    )
    // A never-reviewed card: the defaults it was created with.
    expect(normalizedSnapshot(firstReview.card_before)).toEqual({
      state: 0,
      due: ms(card.due),
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      last_review: null,
    })

    const { review: secondReview } = await db().asUser(userId, (tx) =>
      recordReview(tx, reviewArgs(card, [T, T, F, T], { p_reviewed_at: '2026-10-23T09:00:00Z' })),
    )
    expect(normalizedSnapshot(secondReview.card_before)).toEqual(normalizedSnapshot(first))
  })

  it('logs one mistake per missed key point, worded from the card', async () => {
    const { userId, card } = await userWithCard(db())
    const results: PointResult[] = resultsFor(card, [T, F, F, F]).map((r, i) => {
      // The client's copy of the point may be stale or tampered with: the card is the truth.
      const tampered = { ...r, point: `Client wording ${i}` }
      if (i === 1) return { ...tampered, quote: 'it stays the same', reason: '  Did not say “in a closed system”.  ' }
      if (i === 2) return { ...tampered, quote: '   ', reason: '   ' }
      return tampered
    })
    const { review } = await db().asUser(userId, (tx) =>
      recordReview(tx, { ...reviewArgs(card, [T, F, F, F]), p_results: results }),
    )
    const mistakes = await db().asUser(userId, (tx) => mistakesOf(tx, review.id))
    expect(mistakes).toHaveLength(3)
    const [second, third, fourth] = mistakes
    const point = (i: number) => card.key_points[i]!.point
    for (const mistake of mistakes) {
      expect(mistake).toMatchObject({
        user_id: userId,
        origin: 'review',
        subject: card.subject,
        topic_id: card.topic_id,
        card_id: card.id,
        review_id: review.id,
        source: 'Flashcard review',
        raw_text: null,
        flashcard_id: null,
      })
    }
    expect(second).toMatchObject({
      key_point_id: 'kp_2',
      what_went_wrong: 'Did not say “in a closed system”.',
      fix: point(1),
      mistake_type: 'wording',
    })
    expect(third).toMatchObject({
      key_point_id: 'kp_3',
      what_went_wrong: `Missed: ${point(2)}`,
      fix: point(2),
      mistake_type: 'knowledge',
    })
    expect(fourth).toMatchObject({
      key_point_id: 'kp_4',
      what_went_wrong: `Missed: ${point(3)}`,
      fix: point(3),
      mistake_type: 'knowledge',
    })
  })

  it('logs no mistakes for full marks', async () => {
    const { userId, card } = await userWithCard(db())
    const { review } = await db().asUser(userId, (tx) => recordReview(tx, reviewArgs(card, [T, T, T, T])))
    expect(await db().asUser(userId, (tx) => mistakesOf(tx, review.id))).toEqual([])
  })

  it('keeps logged mistakes within the column limits, whatever the client sends', async () => {
    const { userId, card } = await userWithCard(db())
    const results = resultsFor(card, [F, T, T, T]).map((r, i) => (i === 0 ? { ...r, reason: 'r'.repeat(5_000) } : r))
    const { review } = await db().asUser(userId, (tx) =>
      recordReview(tx, { ...reviewArgs(card, [F, T, T, T]), p_results: results }),
    )
    const [mistake] = await db().asUser(userId, (tx) => mistakesOf(tx, review.id))
    expect(mistake?.what_went_wrong).toHaveLength(2_000)
  })

  it('cannot record a review of another user’s card', async () => {
    const { card } = await userWithCard(db())
    const intruder = await db().createUser()
    const before = await footprint(db().superuser, card.id)
    const error = await pgError(db().asUser(intruder, (tx) => recordReview(tx, reviewArgs(card, [T, T, T, T]))))
    expect(error).toMatchObject({ code: 'P0002', message: 'Card not found' })
    expect(await footprint(db().superuser, card.id)).toEqual(before)
  })

  it('reports an unknown card as not found', async () => {
    const userId = await db().createUser()
    const error = await pgError(
      db().asUser(userId, (tx) =>
        callRecordReview(tx, {
          p_card_id: '00000000-0000-4000-8000-000000000000',
          p_results: [],
          p_card_after: snapshot(),
          p_rating: 1,
        }),
      ),
    )
    expect(error.code).toBe('P0002')
  })
})

describe('amending the latest review (an override)', () => {
  async function reviewed(hits: boolean[], extra: Partial<RecordReviewArgs> = {}) {
    const { userId, card } = await userWithCard(db())
    const { review } = await db().asUser(userId, (tx) =>
      recordReview(tx, reviewArgs(card, hits, { p_reviewed_at: '2026-10-22T09:00:00Z', ...extra })),
    )
    return { userId, card, review }
  }

  it('updates the score and rating, rebuilds the mistakes and marks the review amended', async () => {
    const { userId, card, review } = await reviewed([T, F, F, T], {
      p_corrections: [{ exact_substring: 'a', correction: 'b' }],
      p_missing: ['Mention the closed system.'],
      p_answer: 'Original answer',
      p_duration_ms: 9_000,
    })
    expect(await db().asUser(userId, (tx) => mistakesOf(tx, review.id))).toHaveLength(2)

    const overridden = resultsFor(card, [T, T, F, T]).map((r, i) => (i === 1 ? { ...r, overridden: true } : r))
    const after = snapshot({ scheduled_days: 3, due: '2026-10-25T09:00:00.000Z' })
    const result = await db().asUser(userId, (tx) =>
      recordReview(tx, {
        p_card_id: card.id,
        p_results: overridden,
        p_card_after: after,
        p_rating: 2,
        p_review_id: review.id,
        p_corrections: null,
        p_missing: null,
      }),
    )

    expect(result.review).toMatchObject({
      id: review.id,
      points_hit: 3,
      points_total: 4,
      rating: 2,
      results: overridden,
      // Left alone: what was answered and when, and the AI's notes (null keeps them).
      answer: 'Original answer',
      duration_ms: 9_000,
      corrections: [{ exact_substring: 'a', correction: 'b' }],
      missing: ['Mention the closed system.'],
    })
    expect(ms(result.review.reviewed_at)).toBe(ms(review.reviewed_at))
    expect(result.review.card_before).toEqual(review.card_before)
    expect(result.review.amended_at).not.toBeNull()
    expect(fsrsOf(result.card)).toEqual(normalizedSnapshot(after))
    expect(result.card.last_score).toBeCloseTo(0.75)

    const reviews = await db().asUser(userId, (tx) => reviewsOf(tx, card.id))
    expect(reviews).toHaveLength(1)
    const mistakes = await db().asUser(userId, (tx) => mistakesOf(tx, review.id))
    expect(mistakes.map((m) => m.key_point_id)).toEqual(['kp_3'])
    expect(await db().asUser(userId, (tx) => count(tx, 'select 1 from public.mistakes'))).toBe(1)
  })

  it('can turn a full-marks review into a miss, and back, without duplicating mistakes', async () => {
    const { userId, card, review } = await reviewed([T, T, T, T])
    for (const hits of [[F, F, T, T], [F, F, F, F], [F, F, T, T], [T, T, T, T], [F, T, T, T]]) {
      await db().asUser(userId, (tx) =>
        recordReview(tx, { ...reviewArgs(card, hits), p_review_id: review.id }),
      )
      const logged = await db().asUser(userId, (tx) => mistakesOf(tx, review.id))
      expect(logged.map((m) => m.key_point_id)).toEqual(
        card.key_points.filter((_, i) => !hits[i]).map((kp) => kp.id),
      )
    }
  })

  it('replaces the AI notes when new ones are sent', async () => {
    const { userId, card, review } = await reviewed([T, F, T, T], { p_corrections: [{ exact_substring: 'x', correction: 'y' }] })
    const { review: amended } = await db().asUser(userId, (tx) =>
      recordReview(tx, { ...reviewArgs(card, [T, T, T, T]), p_review_id: review.id, p_corrections: [], p_missing: [] }),
    )
    expect(amended).toMatchObject({ corrections: [], missing: [] })
  })

  it('marks the points that were reviewed, even if the card has been edited since', async () => {
    const { userId, card, review } = await reviewed([T, F, T, T])
    const edited = [
      { ...card.key_points[0]!, point: 'Reworded first point.' },
      { id: 'kp_new', point: 'A point added after the review.', accept: [], reject: [] },
    ]
    await db().asUser(userId, (tx) =>
      tx.query('update public.cards set key_points = $1::jsonb where id = $2', [JSON.stringify(edited), card.id]),
    )

    // The card's current key points are not what was reviewed.
    const current = await db().asUser(userId, (tx) => cardById(tx, card.id))
    const wrong = await pgError(
      db().asUser(userId, (tx) =>
        recordReview(tx, { ...reviewArgs(current!, [T, T]), p_review_id: review.id }),
      ),
    )
    expect(wrong.code).toBe('22023')

    // The reviewed points are, and a point that no longer exists falls back to its saved wording.
    const results = resultsFor(card, [F, F, T, T])
    const { review: amended } = await db().asUser(userId, (tx) =>
      recordReview(tx, { ...reviewArgs(card, [F, F, T, T]), p_results: results, p_review_id: review.id }),
    )
    expect(amended).toMatchObject({ points_hit: 2, points_total: 4, rating: 2 })
    const mistakes = await db().asUser(userId, (tx) => mistakesOf(tx, review.id))
    expect(mistakes.map((m) => [m.key_point_id, m.fix])).toEqual([
      ['kp_1', 'Reworded first point.'],
      ['kp_2', results[1]!.point],
    ])
  })

  it('checks the rating against the amended score', async () => {
    const { userId, card, review } = await reviewed([T, F, T, T])
    const error = await pgError(
      db().asUser(userId, (tx) =>
        recordReview(tx, { ...reviewArgs(card, [T, T, T, T]), p_rating: 2, p_review_id: review.id }),
      ),
    )
    expect(error.code).toBe('22023')
    const easy = await db().asUser(userId, (tx) =>
      recordReview(tx, { ...reviewArgs(card, [T, T, T, T], { p_easy: true }), p_review_id: review.id }),
    )
    expect(easy.review).toMatchObject({ rating: 4, easy: true })
  })

  it('refuses to amend anything but the card’s latest review', async () => {
    const { userId, card, review: older } = await reviewed([T, F, T, T])
    await db().asUser(userId, (tx) =>
      recordReview(tx, reviewArgs(card, [T, T, T, T], { p_reviewed_at: '2026-10-23T09:00:00Z' })),
    )
    const before = await footprint(db().superuser, card.id)
    const error = await pgError(
      db().asUser(userId, (tx) =>
        recordReview(tx, { ...reviewArgs(card, [T, T, T, T]), p_review_id: older.id }),
      ),
    )
    expect(error.code).toBe('55000')
    expect(await footprint(db().superuser, card.id)).toEqual(before)
  })

  it('breaks reviewed_at ties by id, as the category does', async () => {
    const { userId, card } = await userWithCard(db())
    const at = '2026-10-22T09:00:00Z'
    const first = await db().asUser(userId, (tx) => recordReview(tx, reviewArgs(card, [T, T, T, T], { p_reviewed_at: at })))
    const second = await db().asUser(userId, (tx) => recordReview(tx, reviewArgs(card, [T, T, T, T], { p_reviewed_at: at })))
    const [latest, older] = [first.review, second.review].sort((a, b) => (a.id < b.id ? 1 : -1)) as [ReviewRow, ReviewRow]
    const error = await pgError(
      db().asUser(userId, (tx) => recordReview(tx, { ...reviewArgs(card, [F, T, T, T]), p_review_id: older.id })),
    )
    expect(error.code).toBe('55000')
    await db().asUser(userId, (tx) => recordReview(tx, { ...reviewArgs(card, [F, T, T, T]), p_review_id: latest.id }))
  })

  it('refuses a review of a different card, and another user’s review', async () => {
    const { userId, card, review } = await reviewed([T, F, T, T])
    const other = await db().asUser(userId, async (tx) =>
      single((await tx.query<CardRow>(
        `insert into public.cards (subject, question, key_points) select subject, 'Another question?', key_points
         from public.cards where id = $1 returning *`,
        [card.id],
      )).rows),
    )
    const wrongCard = await pgError(
      db().asUser(userId, (tx) => recordReview(tx, { ...reviewArgs(other, [T, T, T, T]), p_review_id: review.id })),
    )
    expect(wrongCard).toMatchObject({ code: 'P0002', message: 'Review not found' })

    const intruder = await userWithCard(db())
    const before = await footprint(db().superuser, card.id)
    const theirs = await pgError(
      db().asUser(intruder.userId, (tx) =>
        recordReview(tx, { ...reviewArgs(intruder.card, [T, T, T, T]), p_review_id: review.id }),
      ),
    )
    expect(theirs).toMatchObject({ code: 'P0002', message: 'Review not found' })
    expect(await footprint(db().superuser, card.id)).toEqual(before)
  })
})

describe('retries and conflicts', () => {
  const REVIEW_ID = '00000000-0000-4000-8000-00000000cafe'
  const OTHER_ID = '00000000-0000-4000-8000-00000000f00d'
  const AT = '2026-10-22T09:00:00Z'

  /** A card reviewed once, with a client-chosen id. The card's reps are now 1. */
  async function reviewedWithId(hits: boolean[] = [T, F, F, T]) {
    const { userId, card } = await userWithCard(db())
    const args = reviewArgs(card, hits, {
      p_id: REVIEW_ID,
      p_expected_reps: 0,
      p_reviewed_at: AT,
      p_card_after: snapshot({ reps: 1 }),
    })
    const first = await db().asUser(userId, (tx) => recordReview(tx, args))
    return { userId, card, args, first }
  }

  /** Changes a card as another device would. */
  function edit(userId: string, cardId: string, column: string, value: unknown) {
    return db().asUser(userId, (tx) => tx.query(`update public.cards set ${column} = $1 where id = $2`, [value, cardId]))
  }

  /** Everything a replay must leave alone, down to each row. */
  async function stored(cardId: string) {
    return {
      ...(await footprint(db().superuser, cardId)),
      rows: await reviewsOf(db().superuser, cardId),
      mistakes: await db().superuser.query('select * from public.mistakes order by id'),
    }
  }

  describe('a review with a client-chosen id', () => {
    it('is saved under that id', async () => {
      const { first } = await reviewedWithId()
      expect(first.review.id).toBe(REVIEW_ID)
    })

    it('still gets an id of its own without one', async () => {
      const { userId, card } = await userWithCard(db())
      const { review } = await db().asUser(userId, (tx) => recordReview(tx, reviewArgs(card, [T, T, T, T])))
      expect(review.id).toMatch(/^[0-9a-f-]{36}$/)
    })
  })

  describe('sending the same id again', () => {
    it('returns the original with the card, and writes nothing', async () => {
      const { userId, card, args, first } = await reviewedWithId()
      const before = await stored(card.id)

      const replay = await db().asUser(userId, (tx) => recordReview(tx, args))

      expect(replay.review).toEqual(first.review)
      expect(replay.card).toEqual(first.card)
      expect(await stored(card.id)).toEqual(before)
      expect(await db().asUser(userId, (tx) => reviewsOf(tx, card.id))).toHaveLength(1)
      expect(await db().asUser(userId, (tx) => mistakesOf(tx, REVIEW_ID))).toHaveLength(2)
    })

    it('returns the current card after the card was edited, whose key points no longer match', async () => {
      const { userId, card, args, first } = await reviewedWithId()
      const points = [{ id: 'kp_new', point: 'A different point.', accept: [], reject: [] }]
      await edit(userId, card.id, 'key_points', JSON.stringify(points))
      const before = await stored(card.id)

      const replay = await db().asUser(userId, (tx) => recordReview(tx, args))

      expect(replay.review).toEqual(first.review)
      expect(replay.card.key_points).toEqual(points)
      expect(await stored(card.id)).toEqual(before)
    })

    it('succeeds with a stale p_expected_reps, after the card moved on', async () => {
      const { userId, card, args, first } = await reviewedWithId()
      await db().asUser(userId, (tx) =>
        recordReview(tx, reviewArgs(card, [T, T, T, T], { p_expected_reps: 1, p_card_after: snapshot({ reps: 2 }) })),
      )
      const before = await stored(card.id)

      const replay = await db().asUser(userId, (tx) => recordReview(tx, args))

      expect(replay.review).toEqual(first.review)
      expect(replay.card.reps).toBe(2)
      expect(await stored(card.id)).toEqual(before)
    })

    it('comes before every other check', async () => {
      const { userId, card, first } = await reviewedWithId()
      const before = await stored(card.id)
      const replay = await db().asUser(userId, (tx) =>
        callRecordReview(tx, { p_card_id: card.id, p_id: REVIEW_ID, p_results: null, p_card_after: null, p_rating: 9 }),
      )
      expect(replay.review).toEqual(first.review)
      expect(await stored(card.id)).toEqual(before)
    })

    it('is not a replay on a different card: the id is taken', async () => {
      const { userId, card } = await reviewedWithId()
      const other = await db().asUser(userId, (tx) => insertCard(tx, {}))
      const before = await stored(card.id)
      const error = await pgError(
        db().asUser(userId, (tx) => recordReview(tx, reviewArgs(other, [T, T, T, T], { p_id: REVIEW_ID }))),
      )
      expect(error.code).toBe('23505')
      expect(await stored(card.id)).toEqual(before)
      expect(await count(db().superuser, 'select 1 from public.reviews where card_id = $1', [other.id])).toBe(0)
    })

    it('cannot read another user’s review', async () => {
      const { card } = await reviewedWithId()
      const intruder = await userWithCard(db())
      const before = await stored(card.id)
      const error = await pgError(
        db().asUser(intruder.userId, (tx) =>
          recordReview(tx, reviewArgs(intruder.card, [T, T, T, T], { p_id: REVIEW_ID })),
        ),
      )
      expect(error.code).toBe('23505')
      expect(await stored(card.id)).toEqual(before)
    })
  })

  describe('p_expected_reps', () => {
    it('succeeds when it matches the card', async () => {
      const { userId, card } = await userWithCard(db())
      const { review } = await db().asUser(userId, (tx) =>
        recordReview(tx, reviewArgs(card, [T, T, T, T], { p_expected_reps: card.reps })),
      )
      expect(review.card_before.reps).toBe(0)
    })

    it('is a conflict when the card has moved on, and writes nothing', async () => {
      const { userId, card } = await reviewedWithId()
      const before = await stored(card.id)
      const error = await pgError(
        db().asUser(userId, (tx) => recordReview(tx, reviewArgs(card, [T, T, T, T], { p_id: OTHER_ID, p_expected_reps: 0 }))),
      )
      expect(error).toMatchObject({ code: CARD_CONFLICT_CODE, message: 'Card changed since it was shown' })
      expect(await stored(card.id)).toEqual(before)
    })

    it('is checked before the input, so a stale client always hears about the conflict', async () => {
      const { userId, card } = await reviewedWithId()
      const error = await pgError(
        db().asUser(userId, (tx) =>
          callRecordReview(tx, { p_card_id: card.id, p_results: [], p_card_after: snapshot(), p_rating: 3, p_expected_reps: 0 }),
        ),
      )
      expect(error.code).toBe(CARD_CONFLICT_CODE)
    })

    it('skips the check when null', async () => {
      const { userId, card } = await reviewedWithId()
      const { review } = await db().asUser(userId, (tx) =>
        recordReview(tx, reviewArgs(card, [T, T, T, T], { p_card_after: snapshot({ reps: 2 }) })),
      )
      expect(review.card_before.reps).toBe(1)
      const again = await db().asUser(userId, (tx) =>
        callRecordReview(tx, { ...reviewArgs(card, [T, T, T, T]), p_expected_reps: null }),
      )
      expect(again.review.card_before.reps).toBe(2)
    })

    it('still checks a count of 0', async () => {
      const { userId, card } = await reviewedWithId()
      const error = await pgError(
        db().asUser(userId, (tx) => recordReview(tx, reviewArgs(card, [T, T, T, T], { p_expected_reps: 0 }))),
      )
      expect(error.code).toBe(CARD_CONFLICT_CODE)
    })
  })

  it('treats results for the wrong key points as a conflict, and writes nothing', async () => {
    const { userId, card } = await userWithCard(db())
    const edited = [...card.key_points, { id: 'kp_new', point: 'A point added on another device.', accept: [], reject: [] }]
    await edit(userId, card.id, 'key_points', JSON.stringify(edited))
    const before = await stored(card.id)
    const error = await pgError(
      db().asUser(userId, (tx) => recordReview(tx, reviewArgs(card, [T, T, T, T], { p_id: OTHER_ID, p_expected_reps: 0 }))),
    )
    expect(error.code).toBe(CARD_CONFLICT_CODE)
    expect(await stored(card.id)).toEqual(before)
  })

  describe('amending', () => {
    it('ignores p_id and p_expected_reps', async () => {
      const { userId, card, first } = await reviewedWithId()
      const { review: amended } = await db().asUser(userId, (tx) =>
        recordReview(tx, {
          ...reviewArgs(card, [T, T, T, T]),
          p_review_id: first.review.id,
          p_id: OTHER_ID,
          p_expected_reps: 99,
        }),
      )
      expect(amended).toMatchObject({ id: REVIEW_ID, points_hit: 4 })
      expect(amended.amended_at).not.toBeNull()
      expect(await db().asUser(userId, (tx) => reviewsOf(tx, card.id))).toHaveLength(1)
    })

    it('is not a replay when p_id names the review being amended', async () => {
      const { userId, card, first } = await reviewedWithId()
      const { review: amended } = await db().asUser(userId, (tx) =>
        recordReview(tx, { ...reviewArgs(card, [T, T, T, T]), p_review_id: first.review.id, p_id: REVIEW_ID }),
      )
      expect(amended.points_hit).toBe(4)
      expect(amended.amended_at).not.toBeNull()
    })

    it('keeps the latest-review rule', async () => {
      const { userId, card, first } = await reviewedWithId()
      await db().asUser(userId, (tx) =>
        recordReview(tx, reviewArgs(card, [T, T, T, T], { p_reviewed_at: '2026-10-23T09:00:00Z' })),
      )
      const error = await pgError(
        db().asUser(userId, (tx) =>
          recordReview(tx, { ...reviewArgs(card, [T, T, T, T]), p_review_id: first.review.id, p_expected_reps: 0 }),
        ),
      )
      expect(error.code).toBe('55000')
    })

    it('still reports wrong points as bad input: the reviewed points can’t change', async () => {
      const { userId, card, first } = await reviewedWithId()
      const error = await pgError(
        db().asUser(userId, (tx) =>
          recordReview(tx, {
            ...reviewArgs(card, [T, T, T, T]),
            p_results: resultsFor(card, [T, T, T, T]).slice(1),
            p_review_id: first.review.id,
          }),
        ),
      )
      expect(error.code).toBe('22023')
    })
  })
})

describe('with the app’s FSRS scheduler (ts-fsrs)', () => {
  it('round-trips the state, and an override reschedules from card_before as documented', async () => {
    const { userId, card } = await userWithCard(db())
    const firstAt = new Date('2026-10-01T09:00:00.000Z')
    const hits = [T, T, T, T]
    const firstAfter = scheduleNext(newCardSnapshot(new Date(ms(card.due)!)), 3, firstAt)
    const first = await db().asUser(userId, (tx) =>
      recordReview(tx, reviewArgs(card, hits, { p_card_after: firstAfter, p_reviewed_at: firstAt.toISOString() })),
    )
    expect(fsrsOf(first.card)).toEqual(normalizedSnapshot(firstAfter))

    // Second review, as the review page does it: from the card as stored.
    const secondAt = new Date(ms(first.card.due)! + 60_000)
    const before = snapshotFromRow(first.card)
    const goodAfter = scheduleNext(before, 3, secondAt)
    const second = await db().asUser(userId, (tx) =>
      recordReview(tx, reviewArgs(card, hits, { p_card_after: goodAfter, p_reviewed_at: secondAt.toISOString() })),
    )
    expect(normalizedSnapshot(second.review.card_before)).toEqual(normalizedSnapshot(before))

    // Override to a miss: re-run the scheduler from card_before at reviewed_at.
    const missHits = [T, F, F, T]
    const reviewedAt = new Date(ms(second.review.reviewed_at)!)
    const hardAfter = scheduleNext(second.review.card_before, ratingFor(missHits), reviewedAt)
    const amended = await db().asUser(userId, (tx) =>
      recordReview(tx, { ...reviewArgs(card, missHits, { p_card_after: hardAfter }), p_review_id: second.review.id }),
    )
    // The same state as if the answer had been marked that way in the first place.
    expect(fsrsOf(amended.card)).toEqual(normalizedSnapshot(scheduleNext(before, 2, secondAt)))
  })
})
