// Data integrity: the constraints that keep cards, topics, reviews and the mistake log
// consistent, and what happens to dependent rows when something is deleted.

import { describe, expect, it } from 'vitest'
import type { KeyPoint } from '../../src/lib/types.ts'
import { pgError, setupTestDb } from './harness.ts'
import type { Queryable } from './harness.ts'
import {
  cardById,
  count,
  insertCard,
  insertManualMistake,
  keyPoints,
  ms,
  recordReview,
  reviewArgs,
  single,
  topicId,
  userWithCard,
} from './fixtures.ts'

const db = setupTestDb()

function kp(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, point: `The wording of ${id}.`, accept: [], reject: [], ...overrides }
}

async function keyPointsValid(q: Queryable, value: unknown): Promise<boolean> {
  const { rows } = await q.query<{ ok: boolean }>('select public.key_points_valid($1::jsonb) as ok', [
    JSON.stringify(value),
  ])
  return single(rows).ok
}

describe('key points (cards.key_points)', () => {
  const rejected: [string, unknown][] = [
    ['an object instead of an array', kp('kp_1')],
    ['a string', 'kp_1'],
    ['JSON null', null],
    ['an empty array', []],
    ['21 key points', keyPoints(21)],
    ['a key point that is not an object', ['kp_1']],
    ['a null key point', [null]],
    ['a missing id', [{ point: 'x', accept: [], reject: [] }]],
    ['a numeric id', [kp('kp_1', { id: 1 })]],
    ['an empty id', [kp('kp_1', { id: '' })]],
    ['an id over 64 characters', [kp('k'.repeat(65))]],
    ['a duplicate id', [kp('kp_1'), kp('kp_2'), kp('kp_1')]],
    ['a missing point', [{ id: 'kp_1', accept: [], reject: [] }]],
    ['an empty point', [kp('kp_1', { point: '' })]],
    ['a blank point', [kp('kp_1', { point: '   ' })]],
    ['a point over 500 characters', [kp('kp_1', { point: 'x'.repeat(501) })]],
    ['a point that is not a string', [kp('kp_1', { point: 42 })]],
    ['accept that is not an array', [kp('kp_1', { accept: 'also fine' })]],
    ['accept: null', [kp('kp_1', { accept: null })]],
    ['reject that is an object', [kp('kp_1', { reject: { 0: 'no' } })]],
    ['a number in accept', [kp('kp_1', { accept: ['ok', 3] })]],
    ['a null in reject', [kp('kp_1', { reject: [null] })]],
    ['an object in reject', [kp('kp_1', { reject: [{ text: 'no' }] })]],
    ['an accept entry over 300 characters', [kp('kp_1', { accept: ['x'.repeat(301)] })]],
  ]

  const accepted: [string, unknown][] = [
    ['a well-formed list', keyPoints(4)],
    ['20 key points', keyPoints(20)],
    ['one key point with no alternatives', [kp('kp_1')]],
    ['accept and reject left out', [{ id: 'kp_1', point: 'Energy is conserved.' }]],
    ['limits reached exactly', [kp('k'.repeat(64), { point: 'p'.repeat(500), accept: ['a'.repeat(300)], reject: [''] })]],
    ['symbols and non-Latin text', [kp('kp_α', { point: 'E = hf, where f ≥ f₀ and φ is the work function', accept: ['hf ≥ φ'] })]],
  ]

  it.each(rejected)('rejects %s', async (_label, value) => {
    const userId = await db().createUser()
    expect(await db().asUser(userId, (tx) => keyPointsValid(tx, value))).toBe(false)
  })

  it.each(accepted)('accepts %s', async (_label, value) => {
    const userId = await db().createUser()
    expect(await db().asUser(userId, (tx) => keyPointsValid(tx, value))).toBe(true)
    const card = await db().asUser(userId, (tx) => insertCard(tx, { key_points: value }))
    expect(card.key_points).toEqual(value)
  })

  it('is enforced on insert and update by the cards_key_points_check constraint', async () => {
    const { userId, card } = await userWithCard(db())
    const onInsert = await pgError(db().asUser(userId, (tx) => insertCard(tx, { key_points: [] })))
    expect(onInsert).toMatchObject({ code: '23514', constraint: 'cards_key_points_check' })

    const onUpdate = await pgError(
      db().asUser(userId, (tx) =>
        tx.query('update public.cards set key_points = $1::jsonb where id = $2', [
          JSON.stringify([kp('kp_1'), kp('kp_1')]),
          card.id,
        ]),
      ),
    )
    expect(onUpdate).toMatchObject({ code: '23514', constraint: 'cards_key_points_check' })

    const missing = await pgError(
      db().asUser(userId, (tx) =>
        tx.query("insert into public.cards (subject, question, key_points) values ('maths', 'Q?', null)"),
      ),
    )
    expect(missing.code).toBe('23502')
    expect(await db().superuser.query('select public.key_points_valid(null) as ok')).toMatchObject({
      rows: [{ ok: false }],
    })
  })
})

describe('cards and topics', () => {
  it('a card cannot use another user’s topic', async () => {
    const alice = await db().createUser()
    const aliceTopic = await db().asUser(alice, (tx) => topicId(tx, 'physics', 'Momentum'))
    const { userId: bob, card } = await userWithCard(db(), { subject: 'physics' })

    const onInsert = await pgError(db().asUser(bob, (tx) => insertCard(tx, { subject: 'physics', topic_id: aliceTopic })))
    expect(onInsert).toMatchObject({ code: '23503', constraint: 'cards_topic_id_user_id_subject_fkey' })
    const onUpdate = await pgError(
      db().asUser(bob, (tx) => tx.query('update public.cards set topic_id = $1 where id = $2', [aliceTopic, card.id])),
    )
    expect(onUpdate).toMatchObject({ code: '23503', constraint: 'cards_topic_id_user_id_subject_fkey' })
  })

  it('a card cannot use a topic from a different subject', async () => {
    const userId = await db().createUser()
    const error = await pgError(
      db().asUser(userId, async (tx) =>
        insertCard(tx, { subject: 'physics', topic_id: await topicId(tx, 'maths', 'Vectors') }),
      ),
    )
    expect(error).toMatchObject({ code: '23503', constraint: 'cards_topic_id_user_id_subject_fkey' })
  })

  it('a card’s subject cannot change while it has a topic of the old subject', async () => {
    const userId = await db().createUser()
    const card = await db().asUser(userId, async (tx) =>
      insertCard(tx, { subject: 'physics', topic_id: await topicId(tx, 'physics', 'Momentum') }),
    )
    const error = await pgError(
      db().asUser(userId, (tx) => tx.query("update public.cards set subject = 'maths' where id = $1", [card.id])),
    )
    expect(error).toMatchObject({ code: '23503', constraint: 'cards_topic_id_user_id_subject_fkey' })

    // Moving it with a topic of the new subject, or with no topic, is fine.
    await db().asUser(userId, async (tx) => {
      const mathsTopic = await topicId(tx, 'maths', 'Momentum and impulse')
      await tx.query("update public.cards set subject = 'maths', topic_id = $1 where id = $2", [mathsTopic, card.id])
      await tx.query("update public.cards set subject = 'further_maths', topic_id = null where id = $1", [card.id])
    })
    expect(await db().asUser(userId, (tx) => cardById(tx, card.id))).toMatchObject({
      subject: 'further_maths',
      topic_id: null,
    })
  })

  it('a topic’s subject cannot change while cards use it', async () => {
    const userId = await db().createUser()
    const topic = await db().asUser(userId, async (tx) => {
      const id = await topicId(tx, 'physics', 'Momentum')
      await insertCard(tx, { subject: 'physics', topic_id: id })
      return id
    })
    const error = await pgError(
      db().asUser(userId, (tx) => tx.query("update public.topics set subject = 'maths' where id = $1", [topic])),
    )
    expect(error.code).toBe('23503')
  })

  it('deleting a topic keeps its cards and mistakes, with no topic', async () => {
    const userId = await db().createUser()
    const { card, topic, reviewId } = await db().asUser(userId, async (tx) => {
      const topic = await topicId(tx, 'physics', 'Momentum')
      const card = await insertCard(tx, { subject: 'physics', topic_id: topic })
      const { review } = await recordReview(tx, reviewArgs(card, [false, true, true, true]))
      return { card, topic, reviewId: review.id }
    })
    const deleted = await db().asUser(userId, (tx) => tx.query('delete from public.topics where id = $1', [topic]))
    expect(deleted.affectedRows).toBe(1)

    const after = await db().asUser(userId, (tx) => cardById(tx, card.id))
    expect(after).toMatchObject({ id: card.id, topic_id: null, subject: 'physics', question: card.question })
    expect(after?.key_points).toEqual(card.key_points)
    const mistakes = await db().asUser(userId, (tx) =>
      tx.query<{ topic_id: string | null; subject: string }>('select topic_id, subject from public.mistakes where review_id = $1', [reviewId]),
    )
    expect(mistakes.rows).toEqual([{ topic_id: null, subject: 'physics' }])
  })

  it('topic names are unique per user and subject, ignoring case and surrounding spaces', async () => {
    const alice = await db().createUser()
    const bob = await db().createUser()
    for (const name of ['momentum', '  MOMENTUM ']) {
      const error = await pgError(
        db().asUser(alice, (tx) => tx.query("insert into public.topics (subject, name) values ('physics', $1)", [name])),
      )
      expect(error).toMatchObject({ code: '23505', constraint: 'topics_user_subject_name_key' })
    }
    // The same name in another subject, or for another user, is fine.
    await db().asUser(alice, (tx) => tx.query("insert into public.topics (subject, name) values ('maths', 'Momentum')"))
    await db().asUser(bob, (tx) => tx.query("insert into public.topics (subject, name) values ('maths', 'Momentum')"))
  })

  it('rejects malformed topics', async () => {
    const userId = await db().createUser()
    const cases: [string, string, unknown[]][] = [
      ['blank name', "insert into public.topics (subject, name) values ('maths', '   ')", []],
      ['name over 80 characters', "insert into public.topics (subject, name) values ('maths', $1)", ['n'.repeat(81)]],
      ['unit over 40 characters', "insert into public.topics (subject, name, unit) values ('maths', 'Units', $1)", ['u'.repeat(41)]],
      ['unknown subject', "insert into public.topics (subject, name) values ('chemistry', 'Moles')", []],
    ]
    for (const [label, sql, params] of cases) {
      const error = await pgError(db().asUser(userId, (tx) => tx.query(sql, params)))
      expect(error.code, label).toBe('23514')
    }
  })
})

describe('column checks', () => {
  it('rejects malformed cards', async () => {
    const { userId, card } = await userWithCard(db())
    const updates: [string, string][] = [
      ['blank question', "question = '  '"],
      ['question over 4000 characters', `question = repeat('q', 4001)`],
      ['unknown origin', "origin = 'imported'"],
      ['unknown subject', "subject = 'biology'"],
      ['FSRS state 4', 'fsrs_state = 4'],
      ['negative stability', 'stability = -0.1'],
      ['negative reps', 'reps = -1'],
      ['unknown category', "category = 'expert'"],
      ['score over 1', 'last_score = 1.5'],
    ]
    for (const [label, assignment] of updates) {
      const error = await pgError(
        db().asUser(userId, (tx) => tx.query(`update public.cards set ${assignment} where id = $1`, [card.id])),
      )
      expect(error.code, label).toBe('23514')
    }
  })

  it('rejects malformed profiles, and keeps updated_at current', async () => {
    const userId = await db().createUser()
    for (const assignment of ['desired_retention = 0.69', 'desired_retention = 0.98', `display_name = repeat('n', 61)`]) {
      const error = await pgError(db().asUser(userId, (tx) => tx.query(`update public.profiles set ${assignment}`)))
      expect(error.code, assignment).toBe('23514')
    }
    await db().superuser.query("update public.profiles set updated_at = '2000-01-01Z' where id = $1", [userId])
    const { rows } = await db().asUser(userId, (tx) =>
      tx.query<{ display_name: string; desired_retention: string; updated_at: Date }>(
        "update public.profiles set display_name = 'Sam', desired_retention = 0.85 returning display_name, desired_retention, updated_at",
      ),
    )
    const profile = single(rows)
    expect(profile).toMatchObject({ display_name: 'Sam', desired_retention: '0.85' })
    expect(profile.updated_at.getTime()).toBeGreaterThan(Date.parse('2001-01-01Z'))
  })

  it('keeps a card’s updated_at current on every change', async () => {
    const { userId, card } = await userWithCard(db())
    await db().superuser.query("update public.cards set updated_at = '2000-01-01Z' where id = $1", [card.id])
    await db().asUser(userId, (tx) => tx.query("update public.cards set suspended = true where id = $1", [card.id]))
    const after = await db().asUser(userId, (tx) => cardById(tx, card.id))
    expect(ms(after?.updated_at)).toBeGreaterThan(Date.parse('2001-01-01Z'))
    expect(ms(after?.created_at)).toBe(ms(card.created_at))
  })

  it('rejects reviews whose stored score and rating disagree', async () => {
    const { userId, card } = await userWithCard(db())
    const insert = (hit: number, total: number, rating: number, easy = false) =>
      db().asUser(userId, (tx) =>
        tx.query(
          `insert into public.reviews (card_id, grading, results, points_hit, points_total, easy, rating, card_before)
           values ($1, 'self', '[]', $2, $3, $4, $5, '{}')`,
          [card.id, hit, total, easy, rating],
        ),
      )
    for (const [hit, total, rating, easy] of [
      [0, 4, 2, false],
      [2, 4, 3, false],
      [4, 4, 2, false],
      [4, 4, 4, false],
      [3, 4, 4, true],
      [5, 4, 3, false],
      [0, 0, 1, false],
    ] as const) {
      const error = await pgError(insert(hit, total, rating, easy))
      expect(error.code, `${hit}/${total} rated ${rating}${easy ? ' easy' : ''}`).toBe('23514')
    }
    for (const [hit, total, rating, easy] of [
      [0, 4, 1, false],
      [2, 4, 2, false],
      [4, 4, 3, false],
      [4, 4, 4, true],
    ] as const) {
      await insert(hit, total, rating, easy)
    }
  })

  it('rejects malformed mistakes', async () => {
    const userId = await db().createUser()
    const topic = await db().asUser(userId, (tx) => topicId(tx, 'maths', 'Vectors'))
    const cases: [string, string, unknown[]][] = [
      [
        'a topic without a subject',
        "insert into public.mistakes (origin, topic_id, what_went_wrong, fix) values ('manual', $1, 'x', 'y')",
        [topic],
      ],
      ['unknown origin', "insert into public.mistakes (origin, what_went_wrong, fix) values ('import', 'x', 'y')", []],
      [
        'unknown type',
        "insert into public.mistakes (origin, what_went_wrong, fix, mistake_type) values ('manual', 'x', 'y', 'careless')",
        [],
      ],
      ['blank what went wrong', "insert into public.mistakes (origin, what_went_wrong, fix) values ('manual', ' ', 'y')", []],
      ['blank fix', "insert into public.mistakes (origin, what_went_wrong, fix) values ('manual', 'x', '')", []],
    ]
    for (const [label, sql, params] of cases) {
      const error = await pgError(db().asUser(userId, (tx) => tx.query(sql, params)))
      expect(error.code, label).toBe('23514')
    }
    const wrongSubject = await pgError(
      db().asUser(userId, (tx) =>
        tx.query(
          "insert into public.mistakes (origin, subject, topic_id, what_went_wrong, fix) values ('manual', 'physics', $1, 'x', 'y')",
          [topic],
        ),
      ),
    )
    expect(wrongSubject).toMatchObject({ code: '23503', constraint: 'mistakes_topic_id_user_id_subject_fkey' })
  })
})

describe('deleting', () => {
  async function cardWithHistory() {
    const userId = await db().createUser()
    return db().asUser(userId, async (tx) => {
      const topic = await topicId(tx, 'physics', 'Momentum')
      const card = await insertCard(tx, { subject: 'physics', topic_id: topic })
      const first = await recordReview(tx, reviewArgs(card, [true, false, false, true], { p_reviewed_at: '2026-10-01T09:00:00Z' }))
      const second = await recordReview(tx, reviewArgs(card, [true, true, false, true], { p_reviewed_at: '2026-10-02T09:00:00Z' }))
      // A logged past-paper mistake that was turned into this card.
      const manual = await insertManualMistake(tx, { subject: 'physics', topic_id: topic })
      await tx.query('update public.mistakes set flashcard_id = $1 where id = $2', [card.id, manual])
      return { userId, topic, card, reviews: [first.review.id, second.review.id], manual }
    })
  }

  it('a card removes its reviews but keeps its mistakes, unlinked from the card and the reviews', async () => {
    const { userId, topic, card, reviews, manual } = await cardWithHistory()
    const before = await db().asUser(userId, (tx) =>
      tx.query<{ id: string; fix: string }>('select id, fix from public.mistakes order by id'),
    )
    expect(before.rows).toHaveLength(4)

    await db().asUser(userId, (tx) => tx.query('delete from public.cards where id = $1', [card.id]))

    await db().asUser(userId, async (tx) => {
      expect(await count(tx, 'select 1 from public.reviews where id = any($1)', [reviews])).toBe(0)
      const { rows } = await tx.query<{
        id: string
        card_id: string | null
        review_id: string | null
        flashcard_id: string | null
        topic_id: string | null
        fix: string
      }>('select id, card_id, review_id, flashcard_id, topic_id, fix from public.mistakes order by id')
      expect(rows.map(({ id, fix }) => ({ id, fix }))).toEqual(before.rows)
      for (const row of rows) {
        expect(row).toMatchObject({ card_id: null, review_id: null, flashcard_id: null, topic_id: topic })
      }
      expect(rows.find((r) => r.id === manual)).toBeDefined()
    })
  })

  it('a review keeps its mistakes, unlinked from the review', async () => {
    const { userId, card, reviews } = await cardWithHistory()
    await db().asUser(userId, (tx) => tx.query('delete from public.reviews where id = $1', [reviews[0]]))
    const { rows } = await db().asUser(userId, (tx) =>
      tx.query<{ card_id: string | null; review_id: string | null }>(
        "select card_id, review_id from public.mistakes where origin = 'review' order by review_id nulls first",
      ),
    )
    expect(rows).toEqual([
      { card_id: card.id, review_id: null },
      { card_id: card.id, review_id: null },
      { card_id: card.id, review_id: reviews[1] },
    ])
  })

  it('an account removes everything it owns, and nothing of anyone else’s', async () => {
    const doomed = await cardWithHistory()
    const other = await cardWithHistory()
    const tables = ['profiles', 'topics', 'cards', 'reviews', 'mistakes'] as const
    const owned = (table: string, userId: string) =>
      count(db().superuser, `select 1 from public.${table} where ${table === 'profiles' ? 'id' : 'user_id'} = $1`, [userId])
    const otherBefore = await Promise.all(tables.map((table) => owned(table, other.userId)))

    // As GoTrue does when the admin deletes a user from the dashboard.
    const deleted = await db().asAuthAdmin((tx) => tx.query('delete from auth.users where id = $1', [doomed.userId]))
    expect(deleted.affectedRows).toBe(1)

    for (const table of tables) expect(await owned(table, doomed.userId), table).toBe(0)
    expect(await Promise.all(tables.map((table) => owned(table, other.userId)))).toEqual(otherBefore)
  })
})

describe('a card’s key points', () => {
  it('can be edited after reviews without breaking the stored reviews', async () => {
    const { userId, card } = await userWithCard(db())
    const { review } = await db().asUser(userId, (tx) => recordReview(tx, reviewArgs(card, [true, true, false, false])))
    const edited: KeyPoint[] = [...card.key_points.slice(0, 2), { id: 'kp_new', point: 'A new point.', accept: [], reject: [] }]
    await db().asUser(userId, (tx) =>
      tx.query('update public.cards set key_points = $1::jsonb where id = $2', [JSON.stringify(edited), card.id]),
    )
    const stored = await db().asUser(userId, (tx) =>
      tx.query<{ results: unknown[] }>('select results from public.reviews where id = $1', [review.id]),
    )
    expect(single(stored.rows).results).toHaveLength(4)
  })
})
