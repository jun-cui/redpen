// Test harness for the SQL in supabase/migrations, run against PGlite (Postgres compiled to
// WASM, in-process). Each database gets Supabase-like stubs first, then every migration in
// filename order, exactly as `supabase db push` or the SQL editor would run them.
//
// Fidelity notes:
// - PGlite 0.5 is Postgres 18; Supabase runs 15 or 17. The migrations use nothing newer than 15.
// - PGlite has a single session and the bootstrap user is a superuser. Supabase runs migrations
//   as `postgres`, which is NOT a superuser there, so migrations here run as `migrator`: an
//   ordinary role with the grants Supabase gives `postgres`. It owns every object they create,
//   which keeps SECURITY DEFINER functions and table-owner behaviour realistic.
// - Clients are simulated the way PostgREST does it: inside a transaction,
//   set_config('role', ..., true) (the same as SET LOCAL ROLE) plus the JWT claims. Superusers
//   and table owners bypass RLS, so every access-rule assertion must go through asUser / asAnon /
//   asRole. GoTrue's own writes to auth.users go through asAuthAdmin.
// - Each test gets a clone of a migrated template database (per test file), so tests are
//   isolated without paying for the migrations every time.
// - Concurrency (e.g. add_example_cards' advisory lock) can't be exercised: one session only.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeEach } from 'vitest'
import { PGlite, type PGliteInterface, type Transaction } from '@electric-sql/pglite'

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))

/** Hook timeout for creating a database: compiling the WASM can be slow on a busy machine. */
export const DB_TIMEOUT_MS = 60_000

/** Roles a client can act as. */
export type ClientRole = 'anon' | 'authenticated' | 'service_role' | 'supabase_auth_admin'

/** Anything that runs SQL: the superuser connection or a client transaction. */
export type Queryable = Pick<Transaction, 'query' | 'exec'>

// Mirrors supabase/postgres (roles, default privileges) and the auth schema as far as the
// migrations rely on it. auth.uid() is Supabase's definition verbatim.
const SUPABASE_STUBS = `
  do $$ begin
    execute format('alter database %I set timezone to %L', current_database(), 'UTC');
  end $$;
  set timezone to 'UTC';

  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  -- GoTrue's role: it writes auth.users and has no privileges in public.
  create role supabase_auth_admin nologin noinherit;
  -- Stands in for Supabase's postgres role, which runs migrations but is not a superuser.
  create role migrator nologin createrole bypassrls;

  grant usage, create on schema public to migrator;
  grant usage on schema public to anon, authenticated, service_role;

  -- Supabase grants everything on new objects in public to the API roles; migrations
  -- revoke what they don't want exposed.
  alter default privileges for role migrator in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges for role migrator in schema public
    grant all on sequences to anon, authenticated, service_role;
  alter default privileges for role migrator in schema public
    grant all on functions to anon, authenticated, service_role;

  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid
  language sql stable
  as $fn$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $fn$;

  grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin, migrator;
  grant execute on function auth.uid() to anon, authenticated, service_role, migrator;
  grant select, insert, update, delete on auth.users to supabase_auth_admin;
  grant select, references, trigger on auth.users to migrator;
`

/** Migration file names in the order they are applied. */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

export interface CreateDbOptions {
  /** Runs as the superuser after the stubs, before the first migration. */
  beforeMigrations?: (superuser: PGliteInterface) => Promise<void>
}

/**
 * Runs one migration file as `migrator`. The file goes in a single simple-query message, so it
 * is one implicit transaction: all or nothing, like the SQL editor and `supabase db push`.
 */
export async function applyMigration(superuser: PGliteInterface, file: string): Promise<void> {
  const sql = readFileSync(`${MIGRATIONS_DIR}${file}`, 'utf8')
  try {
    await superuser.exec(`set role migrator;\n${sql}\n;reset role;`)
  } catch (error) {
    // The failed transaction already undid `set role`; this is belt and braces.
    await superuser.exec('reset role')
    throw new Error(`Migration ${file} failed: ${describeError(error)}`, { cause: error })
  }
}

async function migratedDatabase(options: CreateDbOptions = {}): Promise<PGliteInterface> {
  const pg = new PGlite()
  await pg.exec(SUPABASE_STUBS)
  await options.beforeMigrations?.(pg)
  for (const file of migrationFiles()) await applyMigration(pg, file)
  return pg
}

export interface JwtClaims {
  sub?: string
  role: string
}

export class TestDb {
  /**
   * The superuser connection. It bypasses RLS and every privilege check: use it to arrange
   * data and to inspect what was stored, never to assert an access rule.
   */
  readonly superuser: PGliteInterface
  private userCount = 0

  constructor(superuser: PGliteInterface) {
    this.superuser = superuser
  }

  /** Inserts an auth.users row (firing on_auth_user_created) and returns its id. */
  async createUser(email?: string): Promise<string> {
    this.userCount += 1
    const { rows } = await this.superuser.query<{ id: string }>(
      'insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id',
      [email ?? `user${this.userCount}@example.test`],
    )
    const id = rows[0]?.id
    if (!id) throw new Error('auth.users insert returned no id')
    return id
  }

  /** Runs `fn` in a transaction as a signed-in user, as PostgREST would for their JWT. */
  asUser<T>(userId: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.asRole('authenticated', { sub: userId, role: 'authenticated' }, fn)
  }

  /** Runs `fn` in a transaction as a signed-out visitor (the anon key, no session). */
  asAnon<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.asRole('anon', { role: 'anon' }, fn)
  }

  /** Runs `fn` as GoTrue does when it creates, updates or deletes accounts. */
  asAuthAdmin<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.asRole('supabase_auth_admin', null, fn)
  }

  /**
   * Runs `fn` in a transaction as `role` with the given JWT claims (null: none), then rolls
   * the role and claims back. The transaction commits if `fn` resolves.
   */
  asRole<T>(role: ClientRole, claims: JwtClaims | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.superuser.transaction(async (tx) => {
      await tx.query(
        `select set_config('role', $1, true),
                set_config('request.jwt.claims', $2, true),
                set_config('request.jwt.claim.sub', $3, true)`,
        [role, claims ? JSON.stringify(claims) : '', claims?.sub ?? ''],
      )
      return fn(tx)
    })
  }

  async close(): Promise<void> {
    if (!this.superuser.closed) await this.superuser.close()
  }
}

/** A new database with the stubs and every migration applied (about a second). */
export async function createTestDb(options: CreateDbOptions = {}): Promise<TestDb> {
  return new TestDb(await migratedDatabase(options))
}

let template: Promise<PGliteInterface> | undefined

/** A copy of a migrated template database: much faster than migrating a new one. */
export async function freshTestDb(): Promise<TestDb> {
  template ??= migratedDatabase()
  return new TestDb(await (await template).clone())
}

async function closeTemplate(): Promise<void> {
  const pending = template
  template = undefined
  if (pending) await (await pending).close()
}

/**
 * Gives every test in the calling file (or describe block) its own freshly migrated database.
 * Call at the top level of a test file; read the database inside a test with `db()`.
 */
export function setupTestDb(): () => TestDb {
  let current: TestDb | undefined
  beforeEach(async () => {
    current = await freshTestDb()
  }, DB_TIMEOUT_MS)
  afterEach(async () => {
    await current?.close()
    current = undefined
  })
  afterAll(closeTemplate)
  return () => {
    if (!current) throw new Error('setupTestDb(): the database is only available inside a test')
    return current
  }
}

/** The fields of a Postgres error the tests assert on. */
export interface PgError {
  /** SQLSTATE, e.g. '42501' (insufficient privilege) or '23514' (check violation). */
  code: string
  message: string
  detail?: string
  constraint?: string
  table?: string
}

function isPgError(error: unknown): error is Error & PgError {
  if (!(error instanceof Error)) return false
  const code: unknown = (error as { code?: unknown }).code
  return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)
}

function describeError(error: unknown): string {
  if (isPgError(error)) return `${error.code} ${error.message}`
  return error instanceof Error ? error.message : String(error)
}

/**
 * Awaits `operation`, which must fail with a Postgres error, and returns that error.
 * Fails the test if it succeeds or throws something that isn't a database error.
 */
export async function pgError(operation: Promise<unknown>): Promise<PgError> {
  let result: unknown
  try {
    result = await operation
  } catch (error) {
    if (isPgError(error)) return error
    throw error
  }
  throw new Error(`Expected a database error, but the operation succeeded: ${JSON.stringify(result)}`)
}
