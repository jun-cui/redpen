// Row Level Security: a user only ever sees and changes their own rows, and signed-out visitors
// get nothing. Every assertion runs as a client role (asUser / asAnon): the superuser bypasses RLS
// and is only used to arrange data and to check what is really stored.

import { beforeEach, describe, expect, it } from 'vitest'
import type { CardRow } from '../../src/lib/database.types.ts'
import type { TestDb } from './harness.ts'
import { pgError, setupTestDb } from './harness.ts'
import {
  callRecordReview,
  count,
  insertCard,
  insertManualMistake,
  recordReview,
  reviewArgs,
  single,
  topicId,
} from './fixtures.ts'

const db = setupTestDb()

const TABLES = ['profiles', 'topics', 'cards', 'reviews', 'mistakes'] as const
type Table = (typeof TABLES)[number]

const OWNER_COLUMN: Record<Table, string> = {
  profiles: 'id',
  topics: 'user_id',
  cards: 'user_id',
  reviews: 'user_id',
  mistakes: 'user_id',
}

/** A harmless change to a row of each table, used to try to edit someone else's data. */
const EDIT: Record<Table, string> = {
  profiles: "display_name = 'Mallory'",
  topics: "name = name || ' (edited)'",
  cards: "question = 'Hijacked?'",
  reviews: "answer = 'Hijacked'",
  mistakes: "fix = 'Hijacked'",
}

interface World {
  /** Alice owns one of everything. */
  alice: string
  /** Bob is another signed-in user. */
  bob: string
  topic: string
  card: CardRow
  review: string
  mistakes: string[]
}

async function buildWorld(test: TestDb): Promise<World> {
  const alice = await test.createUser('alice@example.test')
  const bob = await test.createUser('bob@example.test')
  return test.asUser(alice, async (tx) => {
    const topic = await topicId(tx, 'physics', 'Momentum')
    const card = await insertCard(tx, { subject: 'physics', topic_id: topic })
    const { review } = await recordReview(tx, reviewArgs(card, [true, false, true, true]))
    await insertManualMistake(tx, { subject: 'physics', topic_id: topic, card_id: card.id })
    const { rows } = await tx.query<{ id: string }>('select id from public.mistakes order by id')
    return { alice, bob, topic, card, review: review.id, mistakes: rows.map((r) => r.id) }
  })
}

/** Everything Alice owns, read with the superuser so RLS can't hide anything. */
async function aliceSnapshot(test: TestDb, alice: string): Promise<Record<Table, unknown[]>> {
  const snapshot = {} as Record<Table, unknown[]>
  for (const table of TABLES) {
    const { rows } = await test.superuser.query(
      `select * from public.${table} where ${OWNER_COLUMN[table]} = $1 order by 1`,
      [alice],
    )
    snapshot[table] = rows
  }
  return snapshot
}

describe('another signed-in user', () => {
  let world: World
  beforeEach(async () => {
    world = await buildWorld(db())
  })

  it('sees none of the other user’s rows, only their own', async () => {
    for (const table of TABLES) {
      const owner = OWNER_COLUMN[table]
      const visible = await db().asUser(world.bob, async (tx) => {
        const { rows } = await tx.query<{ owner: string }>(`select ${owner} as owner from public.${table}`)
        return rows.map((r) => r.owner)
      })
      expect(visible.filter((id) => id !== world.bob), table).toEqual([])
    }
    // Even when asking for the rows by id.
    await db().asUser(world.bob, async (tx) => {
      expect(await count(tx, 'select 1 from public.cards where id = $1', [world.card.id])).toBe(0)
      expect(await count(tx, 'select 1 from public.reviews where id = $1', [world.review])).toBe(0)
      expect(await count(tx, 'select 1 from public.topics where id = $1', [world.topic])).toBe(0)
      expect(await count(tx, 'select 1 from public.mistakes where id = any($1)', [world.mistakes])).toBe(0)
      expect(await count(tx, 'select 1 from public.profiles where id = $1', [world.alice])).toBe(0)
    })
  })

  it('cannot update or delete the other user’s rows: nothing matches and nothing changes', async () => {
    const before = await aliceSnapshot(db(), world.alice)
    for (const table of TABLES) {
      const owner = OWNER_COLUMN[table]
      const updated = await db().asUser(world.bob, (tx) =>
        tx.query(`update public.${table} set ${EDIT[table]} where ${owner} = $1`, [world.alice]),
      )
      expect(updated.affectedRows, `update ${table}`).toBe(0)
    }
    for (const table of ['mistakes', 'reviews', 'cards', 'topics'] as const) {
      const deleted = await db().asUser(world.bob, (tx) =>
        tx.query(`delete from public.${table} where user_id = $1`, [world.alice]),
      )
      expect(deleted.affectedRows, `delete ${table}`).toBe(0)
    }
    expect(await aliceSnapshot(db(), world.alice)).toEqual(before)
  })

  it('cannot insert rows that belong to the other user', async () => {
    const attempts: Record<Exclude<Table, 'profiles'>, [string, unknown[]]> = {
      topics: ["insert into public.topics (user_id, subject, name) values ($1, 'maths', 'Planted topic')", [world.alice]],
      cards: [
        `insert into public.cards (user_id, subject, question, key_points)
         values ($1, 'maths', 'Planted?', '[{"id":"kp_1","point":"x","accept":[],"reject":[]}]')`,
        [world.alice],
      ],
      reviews: [
        `insert into public.reviews (user_id, card_id, grading, results, points_hit, points_total, rating, card_before)
         values ($1, $2, 'self', '[]', 1, 1, 3, '{}')`,
        [world.alice, world.card.id],
      ],
      mistakes: [
        "insert into public.mistakes (user_id, origin, what_went_wrong, fix) values ($1, 'manual', 'Planted', 'Planted')",
        [world.alice],
      ],
    }
    for (const [table, [sql, params]] of Object.entries(attempts)) {
      const error = await pgError(db().asUser(world.bob, (tx) => tx.query(sql, params)))
      expect(error.code, table).toBe('42501')
      expect(error.message, table).toMatch(/row-level security/)
    }
    // Profiles can't be inserted by clients at all.
    const profile = await pgError(
      db().asUser(world.bob, (tx) => tx.query('insert into public.profiles (id) values ($1)', [world.alice])),
    )
    expect(profile.code).toBe('42501')
  })

  it('cannot hand their own rows over to the other user', async () => {
    const bobCard = await db().asUser(world.bob, (tx) => insertCard(tx))
    const cases: [string, string, unknown[]][] = [
      ['topics', "update public.topics set user_id = $1 where name = 'Momentum'", [world.alice]],
      ['cards', 'update public.cards set user_id = $1 where id = $2', [world.alice, bobCard.id]],
      ['profiles', 'update public.profiles set id = $1', [world.alice]],
    ]
    for (const [table, sql, params] of cases) {
      const error = await pgError(db().asUser(world.bob, (tx) => tx.query(sql, params)))
      expect(error.code, table).toBe('42501')
    }
  })

  it('cannot point their own rows at the other user’s topic, card or review', async () => {
    const bobCard = await db().asUser(world.bob, (tx) => insertCard(tx, { subject: 'physics' }))
    const cases: [string, string, unknown[]][] = [
      ['card → topic', 'update public.cards set topic_id = $1 where id = $2', [world.topic, bobCard.id]],
      [
        'review → card',
        `insert into public.reviews (card_id, grading, results, points_hit, points_total, rating, card_before)
         values ($1, 'self', '[]', 1, 1, 3, '{}')`,
        [world.card.id],
      ],
      [
        'mistake → topic',
        "insert into public.mistakes (origin, subject, topic_id, what_went_wrong, fix) values ('manual', 'physics', $1, 'x', 'y')",
        [world.topic],
      ],
      [
        'mistake → card',
        "insert into public.mistakes (origin, card_id, what_went_wrong, fix) values ('manual', $1, 'x', 'y')",
        [world.card.id],
      ],
      [
        'mistake → review',
        "insert into public.mistakes (origin, review_id, what_went_wrong, fix) values ('manual', $1, 'x', 'y')",
        [world.review],
      ],
      [
        'mistake → flashcard',
        "insert into public.mistakes (origin, flashcard_id, what_went_wrong, fix) values ('manual', $1, 'x', 'y')",
        [world.card.id],
      ],
    ]
    for (const [label, sql, params] of cases) {
      const error = await pgError(db().asUser(world.bob, (tx) => tx.query(sql, params)))
      expect(error.code, label).toBe('23503')
    }
  })

  it('cannot review, amend or inspect the other user’s cards through the functions', async () => {
    const before = await aliceSnapshot(db(), world.alice)

    const review = await pgError(
      db().asUser(world.bob, (tx) => callRecordReview(tx, { ...reviewArgs(world.card, [true, true, true, true]) })),
    )
    expect(review.code).toBe('P0002')

    const bobCard = await db().asUser(world.bob, (tx) => insertCard(tx))
    const amend = await pgError(
      db().asUser(world.bob, (tx) =>
        recordReview(tx, reviewArgs(bobCard, [true, true, true, true], { p_review_id: world.review })),
      ),
    )
    expect(amend.code).toBe('P0002')

    // compute_card_category only sees the caller's own reviews: nothing leaks.
    const category = await db().asUser(world.bob, async (tx) =>
      single((await tx.query<{ c: string }>('select public.compute_card_category($1) as c', [world.card.id])).rows).c,
    )
    expect(category).toBe('new')

    expect(await aliceSnapshot(db(), world.alice)).toEqual(before)
  })
})

describe('a signed-in role without a user id', () => {
  it('sees nothing and can add nothing', async () => {
    const world = await buildWorld(db())
    await db().asRole('authenticated', { role: 'authenticated' }, async (tx) => {
      for (const table of TABLES) expect(await count(tx, `select 1 from public.${table}`), table).toBe(0)
    })
    const error = await pgError(
      db().asRole('authenticated', { role: 'authenticated' }, (tx) =>
        tx.query("insert into public.topics (subject, name) values ('maths', 'Orphan')"),
      ),
    )
    // user_id defaults to auth.uid(), which is null here.
    expect(['23502', '42501']).toContain(error.code)
    expect(await count(db().superuser, 'select 1 from public.cards where user_id = $1', [world.alice])).toBe(1)
  })
})

describe('signed-out visitors (anon)', () => {
  it('cannot read, add, change or delete anything', async () => {
    const world = await buildWorld(db())
    const before = await aliceSnapshot(db(), world.alice)
    for (const table of TABLES) {
      const statements = [
        `select * from public.${table}`,
        `update public.${table} set ${EDIT[table]}`,
        `delete from public.${table}`,
        `truncate public.${table} cascade`,
      ]
      for (const sql of statements) {
        const error = await pgError(db().asAnon((tx) => tx.query(sql)))
        expect(error.code, sql).toBe('42501')
      }
    }
    const inserts = [
      "insert into public.topics (user_id, subject, name) values ($1, 'maths', 'x')",
      "insert into public.mistakes (user_id, origin, what_went_wrong, fix) values ($1, 'manual', 'x', 'y')",
      'insert into public.profiles (id) values ($1)',
    ]
    for (const sql of inserts) {
      const error = await pgError(db().asAnon((tx) => tx.query(sql, [world.alice])))
      expect(error.code, sql).toBe('42501')
    }
    expect(await aliceSnapshot(db(), world.alice)).toEqual(before)
  })

  it('cannot call any of the app’s functions', async () => {
    const world = await buildWorld(db())
    const calls = [
      ['select public.add_example_cards()', []],
      ['select public.compute_card_category($1)', [world.card.id]],
      ['select public.key_points_valid($1::jsonb)', ['[]']],
      ['select public.seed_default_topics($1)', [world.alice]],
      [
        `select public.record_review(p_card_id => $1, p_results => '[]', p_card_after => '{}', p_rating => 1::smallint)`,
        [world.card.id],
      ],
    ] as const
    for (const [sql, params] of calls) {
      const error = await pgError(db().asAnon((tx) => tx.query(sql, [...params])))
      expect(error.code, sql).toBe('42501')
    }
  })
})

describe('a signed-in user', () => {
  it('can read, change and delete their own rows', async () => {
    const world = await buildWorld(db())
    await db().asUser(world.alice, async (tx) => {
      for (const table of TABLES) {
        expect(await count(tx, `select 1 from public.${table}`), table).toBeGreaterThan(0)
        const updated = await tx.query(`update public.${table} set ${EDIT[table]}`)
        expect(updated.affectedRows, table).toBeGreaterThan(0)
      }
      const deleted = await tx.query('delete from public.cards where id = $1', [world.card.id])
      expect(deleted.affectedRows).toBe(1)
    })
  })
})
