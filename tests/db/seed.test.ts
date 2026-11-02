// The generated seed migration: add_example_cards() and the file's freshness. (The default topic
// lists and seed_default_topics are covered with sign-up in signup.test.ts.)

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { EXAMPLE_CARDS } from '../../src/data/exampleContent.ts'
import type { CardRow } from '../../src/lib/database.types.ts'
import { pgError, setupTestDb } from './harness.ts'
import type { Queryable } from './harness.ts'
import { count, insertCard, mistakesOf, ms, recordReview, reviewArgs, single } from './fixtures.ts'

const db = setupTestDb()

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

async function addExampleCards(q: Queryable): Promise<number> {
  const { rows } = await q.query<{ added: number }>('select public.add_example_cards() as added')
  return single(rows).added
}

interface ExampleCardRow extends CardRow {
  topic_name: string | null
  topic_subject: string | null
}

async function exampleCards(q: Queryable): Promise<ExampleCardRow[]> {
  const { rows } = await q.query<ExampleCardRow>(
    `select c.*, t.name as topic_name, t.subject as topic_subject
     from public.cards as c
     left join public.topics as t on t.id = c.topic_id
     where c.origin = 'example'
     order by c.created_at, c.id`,
  )
  return rows
}

describe('add_example_cards', () => {
  it('adds the twelve example cards once, linked to the user’s own topics', async () => {
    const userId = await db().createUser()
    const started = Date.now()
    expect(await db().asUser(userId, addExampleCards)).toBe(EXAMPLE_CARDS.length)
    expect(EXAMPLE_CARDS).toHaveLength(12)

    const cards = await db().asUser(userId, exampleCards)
    // In the written order, with the content exactly as written (apostrophes, symbols and all).
    expect(cards.map((c) => ({ subject: c.subject, topic: c.topic_name, question: c.question, key_points: c.key_points }))).toEqual(
      EXAMPLE_CARDS.map((e) => ({ subject: e.subject, topic: e.topic, question: e.question, key_points: e.key_points })),
    )
    for (const card of cards) {
      expect(card.topic_id, card.question).not.toBeNull()
      expect(card.topic_subject).toBe(card.subject)
      expect(card).toMatchObject({
        user_id: userId,
        origin: 'example',
        category: 'new',
        fsrs_state: 0,
        reps: 0,
        last_review: null,
        last_score: null,
        suspended: false,
      })
      // Due straight away.
      expect(ms(card.due)).toBeLessThanOrEqual(Date.now())
      expect(ms(card.due)).toBeGreaterThan(started - 60_000)
    }
    // Distinct, increasing timestamps keep the order stable.
    const created = cards.map((c) => ms(c.created_at)!)
    expect([...created].sort((a, b) => a - b)).toEqual(created)
    expect(new Set(created).size).toBe(created.length)
  })

  it('adds nothing the second time, even after some example cards were deleted', async () => {
    const userId = await db().createUser()
    await db().asUser(userId, addExampleCards)
    expect(await db().asUser(userId, addExampleCards)).toBe(0)
    await db().asUser(userId, (tx) =>
      tx.query("delete from public.cards where origin = 'example' and subject = 'physics'"),
    )
    expect(await db().asUser(userId, addExampleCards)).toBe(0)
    expect(await db().asUser(userId, (tx) => count(tx, "select 1 from public.cards where origin = 'example'"))).toBe(9)
  })

  it('does not count the user’s own cards as example cards', async () => {
    const userId = await db().createUser()
    await db().asUser(userId, (tx) => insertCard(tx, { question: EXAMPLE_CARDS[0]!.question }))
    expect(await db().asUser(userId, addExampleCards)).toBe(12)
  })

  it('matches topics ignoring case and spaces, and leaves the topic empty when it was renamed or deleted', async () => {
    const userId = await db().createUser()
    await db().asUser(userId, async (tx) => {
      await tx.query("update public.topics set name = '  data STRUCTURES ' where name = 'Data structures'")
      await tx.query("update public.topics set name = 'Logs and exponentials' where name = 'Hypothesis testing'")
      await tx.query("delete from public.topics where name = 'Matrices'")
    })
    await db().asUser(userId, addExampleCards)
    const cards = await db().asUser(userId, exampleCards)
    const topicOf = (topic: string) => cards[EXAMPLE_CARDS.findIndex((e) => e.topic === topic)]
    expect(topicOf('Data structures')?.topic_name).toBe('  data STRUCTURES ')
    expect(topicOf('Hypothesis testing')?.topic_id).toBeNull()
    expect(topicOf('Matrices')?.topic_id).toBeNull()
    expect(cards.filter((c) => c.topic_id !== null)).toHaveLength(10)
  })

  it('gives each user their own copies, linked only to their own topics', async () => {
    const alice = await db().createUser()
    const bob = await db().createUser()
    await db().asUser(alice, addExampleCards)
    expect(await db().asUser(bob, exampleCards)).toEqual([])
    expect(await db().asUser(bob, addExampleCards)).toBe(12)

    const crossLinked = await count(
      db().superuser,
      `select 1 from public.cards as c join public.topics as t on t.id = c.topic_id where t.user_id <> c.user_id`,
    )
    expect(crossLinked).toBe(0)
    expect(await count(db().superuser, "select 1 from public.cards where origin = 'example' and user_id = $1", [alice])).toBe(12)
    expect(await count(db().superuser, "select 1 from public.cards where origin = 'example' and user_id = $1", [bob])).toBe(12)
  })

  it('needs a signed-in user', async () => {
    const noUser = await pgError(db().asRole('authenticated', { role: 'authenticated' }, addExampleCards))
    expect(noUser).toMatchObject({ code: '42501', message: 'Sign in to add the example cards' })

    const anon = await pgError(db().asAnon(addExampleCards))
    expect(anon.code).toBe('42501')
    expect(anon.message).toMatch(/permission denied for function add_example_cards/)
    expect(await count(db().superuser, 'select 1 from public.cards')).toBe(0)
  })

  it('makes cards that can be reviewed like any other', async () => {
    const userId = await db().createUser()
    await db().asUser(userId, addExampleCards)
    const card = (await db().asUser(userId, exampleCards)).find((c) => c.question.startsWith('State Faraday'))
    expect(card).toBeDefined()
    const { review, card: after } = await db().asUser(userId, (tx) => recordReview(tx, reviewArgs(card!, [true, false])))
    expect(after).toMatchObject({ category: 'learning', last_score: 0.5 })
    const [mistake] = await db().asUser(userId, (tx) => mistakesOf(tx, review.id))
    expect(mistake).toMatchObject({ subject: 'physics', topic_id: card!.topic_id, fix: card!.key_points[1]!.point })
  })
})

describe('the generated seed migration', () => {
  it('is up to date with src/data/exampleContent.ts', () => {
    const result = spawnSync(process.execPath, ['scripts/generate-seed-sql.ts', '--check'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(result.status, `${result.stdout}\n${result.stderr}\nRun: npm run seed:sql`).toBe(0)
  }, 30_000)
})
