// New accounts: handle_new_user() gives every user a profile and the default topic lists, whether
// the account is created by GoTrue (an invite) or existed before the migrations (the backfill).

import { describe, expect, it } from 'vitest'
import { DEFAULT_TOPICS } from '../../src/data/exampleContent.ts'
import type { SubjectCode } from '../../src/lib/types.ts'
import { createTestDb, DB_TIMEOUT_MS, pgError, setupTestDb } from './harness.ts'
import type { Queryable } from './harness.ts'
import { count, single } from './fixtures.ts'

const db = setupTestDb()

const SUBJECTS = Object.keys(DEFAULT_TOPICS) as SubjectCode[]

interface StoredTopic {
  subject: SubjectCode
  name: string
  unit: string | null
  position: number
  archived: boolean
}

async function topicsOf(q: Queryable, userId: string): Promise<StoredTopic[]> {
  const { rows } = await q.query<StoredTopic>(
    `select subject, name, unit, position, archived from public.topics
     where user_id = $1 order by subject, position`,
    [userId],
  )
  return rows
}

/** The topics every new user should have: DEFAULT_TOPICS, positioned in written order. */
function expectedTopics(): StoredTopic[] {
  return [...SUBJECTS]
    .sort()
    .flatMap((subject) =>
      DEFAULT_TOPICS[subject].map((topic, position) => ({
        subject,
        name: topic.name,
        unit: topic.unit,
        position,
        archived: false,
      })),
    )
}

describe('a new user', () => {
  it('gets a profile with the default settings', async () => {
    const userId = await db().createUser()
    const profile = await db().asUser(userId, async (tx) =>
      single((await tx.query<{ id: string; display_name: string | null; desired_retention: string }>(
        'select id, display_name, desired_retention from public.profiles',
      )).rows),
    )
    expect(profile).toEqual({ id: userId, display_name: null, desired_retention: '0.90' })
  })

  it('gets every default topic, per subject, in the written order', async () => {
    const userId = await db().createUser()
    const topics = await db().asUser(userId, (tx) => topicsOf(tx, userId))
    expect(topics).toEqual(expectedTopics())
    for (const subject of SUBJECTS) {
      expect(topics.filter((t) => t.subject === subject), subject).toHaveLength(DEFAULT_TOPICS[subject].length)
    }
  })

  it('is set up the same way when GoTrue (supabase_auth_admin) creates the account, as for an invite', async () => {
    const userId = await db().asAuthAdmin(async (tx) =>
      single((await tx.query<{ id: string }>(
        "insert into auth.users (id, email) values (gen_random_uuid(), 'invited@example.test') returning id",
      )).rows).id,
    )
    expect(await count(db().superuser, 'select 1 from public.profiles where id = $1', [userId])).toBe(1)
    expect(await topicsOf(db().superuser, userId)).toEqual(expectedTopics())
  })

  it('does not disturb other users’ profiles or topics', async () => {
    const first = await db().createUser()
    await db().superuser.query("update public.topics set name = 'Mechanics: forces' where user_id = $1 and name = 'Motion and forces'", [first])
    await db().createUser()
    expect(await count(db().superuser, 'select 1 from public.topics where user_id = $1', [first])).toBe(expectedTopics().length)
    expect(await count(db().superuser, "select 1 from public.topics where user_id = $1 and name = 'Mechanics: forces'", [first])).toBe(1)
  })
})

describe('seed_default_topics', () => {
  it('is idempotent: running it again adds nothing, even after a topic is re-cased or re-spaced', async () => {
    const userId = await db().createUser()
    await db().superuser.query("update public.topics set name = '  vectors ' where user_id = $1 and name = 'Vectors'", [userId])
    await db().superuser.query('select public.seed_default_topics($1)', [userId])
    await db().superuser.query('select public.seed_default_topics($1)', [userId])
    expect(await count(db().superuser, 'select 1 from public.topics where user_id = $1', [userId])).toBe(expectedTopics().length)
  })

  it('restores a default topic the user deleted, and leaves their own topics alone', async () => {
    const userId = await db().createUser()
    await db().asUser(userId, async (tx) => {
      await tx.query("delete from public.topics where name = 'Capacitors'")
      await tx.query("insert into public.topics (subject, name) values ('physics', 'My own topic')")
    })
    await db().superuser.query('select public.seed_default_topics($1)', [userId])
    const names = (await topicsOf(db().superuser, userId)).filter((t) => t.subject === 'physics').map((t) => t.name)
    expect(names).toContain('Capacitors')
    expect(names).toContain('My own topic')
  })

  it('rejects a null user id', async () => {
    const error = await pgError(db().superuser.query('select public.seed_default_topics(null)'))
    expect(error.code).toBe('22004')
  })

  it('cannot be called by signed-in users (even for themselves) or by visitors', async () => {
    const userId = await db().createUser()
    const asUser = await pgError(db().asUser(userId, (tx) => tx.query('select public.seed_default_topics($1)', [userId])))
    expect(asUser.code).toBe('42501')
    const asAnon = await pgError(db().asAnon((tx) => tx.query('select public.seed_default_topics($1)', [userId])))
    expect(asAnon.code).toBe('42501')
  })
})

describe('the seed migration’s backfill', () => {
  it(
    'gives accounts created before the migrations a profile and the default topics',
    async () => {
      const early = '6f1c2a4e-0d3b-4c5a-9e8f-7a6b5c4d3e2f'
      const test = await createTestDb({
        beforeMigrations: async (superuser) => {
          await superuser.query("insert into auth.users (id, email) values ($1, 'early@example.test')", [early])
        },
      })
      try {
        expect(await count(test.superuser, 'select 1 from public.profiles where id = $1', [early])).toBe(1)
        expect(await topicsOf(test.superuser, early)).toEqual(expectedTopics())
        // And the trigger still works for accounts created afterwards.
        const later = await test.createUser()
        expect(await topicsOf(test.superuser, later)).toEqual(expectedTopics())
      } finally {
        await test.close()
      }
    },
    DB_TIMEOUT_MS,
  )
})
