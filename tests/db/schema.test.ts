// What the migrations leave in the catalog: tables, Row Level Security, policies, privileges,
// triggers and function hygiene. Behaviour is tested in the other files; this one makes sure
// nothing is exposed by accident, including by a future migration.

import { describe, expect, it } from 'vitest'
import { applyMigration, migrationFiles, setupTestDb } from './harness.ts'
import { count, single } from './fixtures.ts'

const db = setupTestDb()

const TABLES = ['cards', 'mistakes', 'profiles', 'reviews', 'topics'] as const
type Table = (typeof TABLES)[number]

// MAINTAIN (Postgres 17+, as on Supabase) includes LOCK TABLE; PGlite runs Postgres 18.
const ALL_TABLE_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] as const

/** What a signed-in user may do to each table; RLS then limits it to their own rows. */
const AUTHENTICATED_PRIVILEGES: Record<Table, readonly string[]> = {
  // Profiles are created by handle_new_user() and removed with the account.
  profiles: ['SELECT', 'UPDATE'],
  topics: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  cards: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  reviews: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  mistakes: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
}

/** Functions a signed-in client may call (directly, or through a CHECK constraint). */
const CLIENT_FUNCTIONS = ['add_example_cards', 'compute_card_category', 'key_points_valid', 'record_review']

interface FunctionInfo {
  name: string
  args: string
  security_definer: boolean
  config: string[] | null
  volatility: 'i' | 's' | 'v'
  anon: boolean
  authenticated: boolean
}

async function publicFunctions(): Promise<FunctionInfo[]> {
  const { rows } = await db().superuser.query<FunctionInfo>(
    `select p.proname as name,
            pg_get_function_identity_arguments(p.oid) as args,
            p.prosecdef as security_definer,
            p.proconfig as config,
            p.provolatile as volatility,
            has_function_privilege('anon', p.oid, 'execute') as anon,
            has_function_privilege('authenticated', p.oid, 'execute') as authenticated
     from pg_proc as p
     where p.pronamespace = 'public'::regnamespace
     order by p.proname`,
  )
  return rows
}

function fn(functions: FunctionInfo[], name: string): FunctionInfo {
  const found = functions.filter((f) => f.name === name)
  if (found.length !== 1) throw new Error(`Expected one function named ${name}, found ${found.length}`)
  return found[0]!
}

describe('migrations', () => {
  it('are timestamped files, applied in filename order, starting with the initial schema', () => {
    const files = migrationFiles()
    expect(files[0]).toBe('20261021120000_init.sql')
    expect(files).toContain('20261021120100_seed_content.sql')
    for (const file of files) expect(file).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/)
    const versions = files.map((file) => file.slice(0, 14))
    expect(new Set(versions).size).toBe(versions.length)
  })

  it('leave exactly the five app tables in public, each with Row Level Security on', async () => {
    const { rows } = await db().superuser.query<{ name: string; rls: boolean }>(
      `select c.relname as name, c.relrowsecurity as rls
       from pg_class as c
       where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
       order by c.relname`,
    )
    expect(rows.map((r) => r.name)).toEqual([...TABLES])
    for (const row of rows) expect(row.rls, `RLS on ${row.name}`).toBe(true)
  })

  it('create no views, sequences or materialized views a client could read around RLS', async () => {
    expect(
      await count(
        db().superuser,
        `select 1 from pg_class where relnamespace = 'public'::regnamespace and relkind in ('v', 'm', 'S', 'f')`,
      ),
    ).toBe(0)
  })

  it('can re-run the generated seed migration (e.g. pasted again into the SQL editor) without changes', async () => {
    const userId = await db().createUser()
    const topicsBefore = await count(db().superuser, 'select 1 from public.topics where user_id = $1', [userId])
    const seedFile = migrationFiles().find((file) => file.endsWith('_seed_content.sql'))
    expect(seedFile).toBeDefined()

    await applyMigration(db().superuser, seedFile!)

    expect(await count(db().superuser, 'select 1 from public.topics where user_id = $1', [userId])).toBe(topicsBefore)
    expect(await count(db().superuser, 'select 1 from public.profiles where id = $1', [userId])).toBe(1)
    const functions = await publicFunctions()
    expect(fn(functions, 'seed_default_topics').authenticated).toBe(false)
    expect(fn(functions, 'add_example_cards').anon).toBe(false)
  })
})

describe('policies', () => {
  interface PolicyRow {
    table: string
    name: string
    cmd: string
    roles: string[]
    permissive: string
    qual: string | null
    with_check: string | null
  }

  async function policies(): Promise<PolicyRow[]> {
    const { rows } = await db().superuser.query<PolicyRow>(
      `select tablename as table, policyname as name, cmd, roles, permissive, qual, with_check
       from pg_policies where schemaname = 'public' order by tablename, cmd`,
    )
    return rows
  }

  it('give every table policies for exactly the commands its grants allow', async () => {
    const rows = await policies()
    for (const table of TABLES) {
      const commands = rows.filter((p) => p.table === table).map((p) => p.cmd).sort()
      expect(commands, table).toEqual([...AUTHENTICATED_PRIVILEGES[table]].sort())
    }
  })

  it('apply only to signed-in users and only to their own rows', async () => {
    // (select auth.uid()) is evaluated once per statement, not once per row (Supabase's
    // auth_rls_initplan lint).
    const ownRow = /^\(\( SELECT auth\.uid\(\) AS uid\) = (user_id|id)\)$/
    for (const policy of await policies()) {
      const label = `${policy.table}: ${policy.name}`
      expect(policy.roles, label).toEqual(['authenticated'])
      expect(policy.permissive, label).toBe('PERMISSIVE')
      const ownerColumn = policy.table === 'profiles' ? 'id' : 'user_id'
      if (policy.cmd !== 'INSERT') {
        expect(policy.qual, label).toMatch(ownRow)
        expect(policy.qual, label).toContain(`= ${ownerColumn})`)
      }
      if (policy.cmd === 'INSERT' || policy.cmd === 'UPDATE') {
        expect(policy.with_check, label).toMatch(ownRow)
        expect(policy.with_check, label).toContain(`= ${ownerColumn})`)
      }
    }
  })
})

describe('table privileges', () => {
  async function privilegesOf(role: string, table: Table): Promise<string[]> {
    const granted: string[] = []
    for (const privilege of ALL_TABLE_PRIVILEGES) {
      const { rows } = await db().superuser.query<{ ok: boolean }>(
        'select has_table_privilege($1, $2, $3) as ok',
        [role, `public.${table}`, privilege],
      )
      if (single(rows).ok) granted.push(privilege)
    }
    return granted
  }

  it('give signed-out visitors (anon) nothing at all', async () => {
    for (const table of TABLES) expect(await privilegesOf('anon', table), table).toEqual([])
  })

  it('give signed-in users only what the app needs (no TRUNCATE, which ignores RLS)', async () => {
    for (const table of TABLES) {
      expect(await privilegesOf('authenticated', table), table).toEqual(AUTHENTICATED_PRIVILEGES[table])
    }
  })

  it('give GoTrue (supabase_auth_admin) nothing in public: sign-up works through handle_new_user()', async () => {
    for (const table of TABLES) expect(await privilegesOf('supabase_auth_admin', table), table).toEqual([])
  })
})

describe('functions', () => {
  it('all have a fixed, empty search_path (Supabase lint: function_search_path_mutable)', async () => {
    const functions = await publicFunctions()
    expect(functions.length).toBeGreaterThan(0)
    for (const f of functions) expect(f.config, `${f.name}(${f.args})`).toEqual(['search_path=""'])
  })

  it('cannot be called by signed-out visitors', async () => {
    for (const f of await publicFunctions()) expect(f.anon, `${f.name}(${f.args})`).toBe(false)
  })

  it('can be called by signed-in users only when the app needs them', async () => {
    const callable = (await publicFunctions()).filter((f) => f.authenticated).map((f) => f.name)
    expect(callable).toEqual(CLIENT_FUNCTIONS)
  })

  it('run as the caller, except handle_new_user, which must write profiles and topics for GoTrue', async () => {
    const functions = await publicFunctions()
    expect(functions.filter((f) => f.security_definer).map((f) => f.name)).toEqual(['handle_new_user'])
    // Supabase lints 0028/0029: a SECURITY DEFINER function must not be callable by clients.
    for (const f of functions.filter((f) => f.security_definer)) {
      expect({ name: f.name, anon: f.anon, authenticated: f.authenticated }).toEqual({
        name: f.name,
        anon: false,
        authenticated: false,
      })
    }
    for (const name of ['record_review', 'compute_card_category', 'add_example_cards', 'seed_default_topics']) {
      expect(fn(functions, name).security_definer, name).toBe(false)
    }
  })

  it('declare a volatility that matches what they do', async () => {
    const functions = await publicFunctions()
    expect(fn(functions, 'key_points_valid').volatility).toBe('i')
    expect(fn(functions, 'compute_card_category').volatility).toBe('s')
    expect(fn(functions, 'record_review').volatility).toBe('v')
    expect(fn(functions, 'add_example_cards').volatility).toBe('v')
  })

  it('keep record_review’s signature, which supabase.rpc() calls by argument name', async () => {
    expect(fn(await publicFunctions(), 'record_review').args).toBe(
      'p_card_id uuid, p_results jsonb, p_card_after jsonb, p_rating smallint, p_easy boolean, ' +
        'p_answer text, p_grading text, p_corrections jsonb, p_missing jsonb, ' +
        'p_reviewed_at timestamp with time zone, p_duration_ms integer, p_review_id uuid, ' +
        'p_id uuid, p_expected_reps integer',
    )
  })
})

describe('triggers', () => {
  it('create a profile and topics after each new auth.users row, and keep updated_at current', async () => {
    const { rows } = await db().superuser.query<{ name: string; definition: string }>(
      `select t.tgname as name, pg_get_triggerdef(t.oid) as definition
       from pg_trigger as t
       where not t.tgisinternal
       order by t.tgname`,
    )
    expect(rows.map((r) => r.name)).toEqual(['cards_set_updated_at', 'on_auth_user_created', 'profiles_set_updated_at'])
    const definition = (name: string) => rows.find((r) => r.name === name)?.definition
    expect(definition('on_auth_user_created')).toMatch(
      /AFTER INSERT ON auth\.users FOR EACH ROW EXECUTE FUNCTION (public\.)?handle_new_user\(\)$/,
    )
    expect(definition('cards_set_updated_at')).toMatch(
      /BEFORE UPDATE ON public\.cards FOR EACH ROW EXECUTE FUNCTION (public\.)?set_updated_at\(\)$/,
    )
    expect(definition('profiles_set_updated_at')).toMatch(
      /BEFORE UPDATE ON public\.profiles FOR EACH ROW EXECUTE FUNCTION (public\.)?set_updated_at\(\)$/,
    )
  })
})
