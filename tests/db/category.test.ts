// Card categories (compute_card_category, recomputed by record_review after every review):
//   new      : never reviewed
//   mastered : full marks on each of the last 3 reviews and an FSRS interval over 21 days
//   weak     : last mark under 50%, or rated Again 2+ times in the last 5 reviews
//   learning : everything in between
// Mastered is checked first. src/lib/category.ts mirrors this in the browser (demo mode, previews),
// so the two are also compared over a large set of generated review histories.

import { describe, expect, it } from 'vitest'
import { computeCategory } from '../../src/lib/category.ts'
import type { CardCategory } from '../../src/lib/types.ts'
import { setupTestDb } from './harness.ts'
import type { Queryable } from './harness.ts'
import { cardById, ratingFor, recordReview, reviewArgs, single, snapshot, userWithCard } from './fixtures.ts'

const db = setupTestDb()

/** One marked answer: which of the card's four key points were hit, and the interval after it. */
interface Step {
  hits: boolean[]
  easy?: boolean
  scheduledDays?: number
}

const ALL = [true, true, true, true]
const NONE = [false, false, false, false]
const ONE = [true, false, false, false]
const TWO = [true, true, false, false]
const THREE = [true, true, true, false]

/** Reviews a fresh four-point card once per step (a day apart) and returns its category after each. */
async function categoriesAfter(steps: Step[]): Promise<CardCategory[]> {
  const { userId, card } = await userWithCard(db())
  const categories: CardCategory[] = []
  for (const [i, step] of steps.entries()) {
    const { card: after } = await db().asUser(userId, (tx) =>
      recordReview(
        tx,
        reviewArgs(card, step.hits, {
          p_easy: step.easy ?? false,
          p_reviewed_at: new Date(Date.UTC(2026, 9, 1 + i, 9)).toISOString(),
          p_card_after: snapshot({ scheduled_days: step.scheduledDays ?? 1 }),
        }),
      ),
    )
    // record_review returns the card as stored.
    const stored = await db().asUser(userId, (tx) => cardById(tx, card.id))
    expect(stored?.category).toBe(after.category)
    categories.push(after.category)
  }
  return categories
}

async function categoryOf(q: Queryable, cardId: string): Promise<CardCategory> {
  const { rows } = await q.query<{ category: CardCategory }>('select public.compute_card_category($1) as category', [cardId])
  return single(rows).category
}

describe('card categories', () => {
  it('a card that has never been reviewed is new', async () => {
    const { userId, card } = await userWithCard(db())
    expect(card.category).toBe('new')
    expect(await db().asUser(userId, (tx) => categoryOf(tx, card.id))).toBe('new')
  })

  it('one review with 1 of 4 points is weak; 2 of 4 (exactly half) is learning', async () => {
    expect(await categoriesAfter([{ hits: ONE }])).toEqual(['weak'])
    expect(await categoriesAfter([{ hits: TWO }])).toEqual(['learning'])
  })

  it('no points at all is weak; full marks with a short interval is learning', async () => {
    expect(await categoriesAfter([{ hits: NONE }])).toEqual(['weak'])
    expect(await categoriesAfter([{ hits: ALL, scheduledDays: 100 }])).toEqual(['learning'])
  })

  it('two Agains within the last five reviews make a card weak, even after a good answer', async () => {
    expect(await categoriesAfter([{ hits: NONE }, { hits: THREE }, { hits: NONE }, { hits: ALL }])).toEqual([
      'weak',
      'learning',
      'weak',
      'weak',
    ])
  })

  it('an Again more than five reviews ago no longer counts', async () => {
    const categories = await categoriesAfter([
      { hits: NONE },
      { hits: THREE },
      { hits: THREE },
      { hits: THREE },
      { hits: NONE }, // two Agains within the last five
      { hits: THREE }, // the first Again drops out of the last five
    ])
    expect(categories.slice(-2)).toEqual(['weak', 'learning'])
  })

  it('full marks on the last three reviews with an interval over 21 days is mastered', async () => {
    expect(
      await categoriesAfter([
        { hits: ALL, scheduledDays: 4 },
        { hits: ALL, scheduledDays: 12 },
        { hits: ALL, scheduledDays: 30 },
      ]),
    ).toEqual(['learning', 'learning', 'mastered'])
  })

  it('an interval of exactly 21 days is not enough to be mastered', async () => {
    expect(
      await categoriesAfter([
        { hits: ALL, scheduledDays: 21 },
        { hits: ALL, scheduledDays: 21 },
        { hits: ALL, scheduledDays: 21 },
      ]),
    ).toEqual(['learning', 'learning', 'learning'])
    expect(
      await categoriesAfter([
        { hits: ALL, scheduledDays: 21 },
        { hits: ALL, scheduledDays: 21 },
        { hits: ALL, scheduledDays: 22 },
      ]),
    ).toEqual(['learning', 'learning', 'mastered'])
  })

  it('easy answers count as full marks', async () => {
    expect(
      await categoriesAfter([
        { hits: ALL, easy: true },
        { hits: ALL, easy: true },
        { hits: ALL, easy: true, scheduledDays: 45 },
      ]),
    ).toEqual(['learning', 'learning', 'mastered'])
  })

  it('a missed point in the last three reviews stops a card being mastered', async () => {
    const categories = await categoriesAfter([
      { hits: ALL },
      { hits: THREE },
      { hits: ALL },
      { hits: ALL, scheduledDays: 60 },
    ])
    expect(categories.at(-1)).toBe('learning')
  })

  it('mastered takes precedence over weak: three perfect answers outweigh older Agains', async () => {
    const categories = await categoriesAfter([
      { hits: NONE },
      { hits: NONE },
      { hits: ALL, scheduledDays: 10 },
      { hits: ALL, scheduledDays: 20 },
      { hits: ALL, scheduledDays: 40 },
    ])
    // Two Agains are still within the last five reviews.
    expect(categories).toEqual(['weak', 'weak', 'weak', 'weak', 'mastered'])
  })

  it('a mastered card that is then missed drops back', async () => {
    const categories = await categoriesAfter([
      { hits: ALL },
      { hits: ALL },
      { hits: ALL, scheduledDays: 30 },
      { hits: ONE, scheduledDays: 2 },
    ])
    expect(categories.slice(-2)).toEqual(['mastered', 'weak'])
  })

  it('is recomputed when the latest review is overridden', async () => {
    const { userId, card } = await userWithCard(db())
    const { review, card: after } = await db().asUser(userId, (tx) => recordReview(tx, reviewArgs(card, ONE)))
    expect(after.category).toBe('weak')
    const { card: amended } = await db().asUser(userId, (tx) =>
      recordReview(tx, { ...reviewArgs(card, THREE), p_review_id: review.id }),
    )
    expect(amended.category).toBe('learning')
  })

  it('follows the order of reviewed_at, then id, not the order reviews were saved in', async () => {
    const { userId, card } = await userWithCard(db())
    await db().asUser(userId, async (tx) => {
      // Saved last, but answered first.
      await recordReview(tx, reviewArgs(card, TWO, { p_reviewed_at: '2026-10-03T09:00:00Z' }))
      await recordReview(tx, reviewArgs(card, ONE, { p_reviewed_at: '2026-10-01T09:00:00Z' }))
    })
    expect(await db().asUser(userId, (tx) => categoryOf(tx, card.id))).toBe('learning')

    // Same reviewed_at: the greater id is the later review.
    const insertAt = async (id: string, hits: boolean[]) =>
      db().superuser.query(
        `insert into public.reviews (id, user_id, card_id, reviewed_at, grading, results, points_hit, points_total, rating, card_before)
         values ($1, $2, $3, '2026-10-05T09:00:00Z', 'self', '[]', $4, 4, $5, '{}')`,
        [id, userId, card.id, hits.filter(Boolean).length, ratingFor(hits)],
      )
    await insertAt('ffffffff-ffff-4fff-8fff-ffffffffffff', TWO)
    await insertAt('00000000-0000-4000-8000-000000000000', ONE)
    expect(await db().asUser(userId, (tx) => categoryOf(tx, card.id))).toBe('learning')
  })
})

describe('compute_card_category and src/lib/category.ts', () => {
  /** Deterministic PRNG (mulberry32), so a failure can be reproduced. */
  function random(seed: number): () => number {
    let a = seed
    return () => {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  interface GeneratedReview {
    points_hit: number
    points_total: number
    easy: boolean
    rating: 1 | 2 | 3 | 4
  }

  interface History {
    scheduledDays: number
    /** Oldest first. */
    reviews: GeneratedReview[]
  }

  function generateHistories(count: number, seed: number): History[] {
    const next = random(seed)
    const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!
    return Array.from({ length: count }, () => {
      const length = pick([0, 1, 2, 3, 3, 4, 5, 6, 7, 9])
      const reviews = Array.from({ length }, (): GeneratedReview => {
        const total = pick([1, 2, 3, 4, 5, 6])
        // Skewed towards full marks so mastered histories are common.
        const hit = next() < 0.45 ? total : Math.floor(next() * (total + 1))
        const easy = hit === total && next() < 0.3
        const hits = Array.from({ length: total }, (_, i) => i < hit)
        return { points_hit: hit, points_total: total, easy, rating: ratingFor(hits, easy) }
      })
      return { scheduledDays: pick([0, 1, 7, 20, 21, 22, 30, 180]), reviews }
    })
  }

  it('agree on 400 generated review histories', async () => {
    const histories = generateHistories(400, 20261022)
    const userId = await db().createUser()

    // Arranged directly (as the superuser) for speed; the comparison runs as the user, under RLS.
    const { rows: cards } = await db().superuser.query<{ id: string; question: string }>(
      `insert into public.cards (user_id, subject, question, key_points, scheduled_days)
       select $1, 'physics', h.n::text, '[{"id":"kp_1","point":"A point."}]', h.scheduled_days
       from jsonb_to_recordset($2::jsonb) as h (n int, scheduled_days int)
       returning id, question`,
      [userId, JSON.stringify(histories.map((h, n) => ({ n, scheduled_days: h.scheduledDays })))],
    )
    // The question holds the history's index.
    const cardIds: string[] = []
    for (const card of cards) cardIds[Number(card.question)] = card.id
    expect(cardIds.filter(Boolean)).toHaveLength(histories.length)

    const reviewRows = histories.flatMap((history, n) =>
      history.reviews.map((review, i) => ({ ...review, card_id: cardIds[n], minute: i })),
    )
    await db().superuser.query(
      `insert into public.reviews (user_id, card_id, reviewed_at, grading, results, points_hit, points_total, easy, rating, card_before)
       select $1, r.card_id, '2026-10-01Z'::timestamptz + r.minute * interval '1 minute', 'self', '[]',
              r.points_hit, r.points_total, r.easy, r.rating, '{}'
       from jsonb_to_recordset($2::jsonb) as r (card_id uuid, minute int, points_hit int, points_total int, easy boolean, rating int)`,
      [userId, JSON.stringify(reviewRows)],
    )

    const { rows } = await db().asUser(userId, (tx) =>
      tx.query<{ id: string; category: CardCategory }>(
        'select id, public.compute_card_category(id) as category from public.cards',
      ),
    )
    const sqlCategory = new Map(rows.map((r) => [r.id, r.category]))

    const seen = new Set<CardCategory>()
    for (const [n, history] of histories.entries()) {
      const expected = computeCategory([...history.reviews].reverse(), history.scheduledDays)
      seen.add(expected)
      expect(sqlCategory.get(cardIds[n]!), JSON.stringify(history)).toBe(expected)
    }
    // The generated histories reach every category.
    expect([...seen].sort()).toEqual(['learning', 'mastered', 'new', 'weak'])
  })
})
