// Generates supabase/migrations/20261021120100_seed_content.sql from src/data/exampleContent.ts.
//
//   node scripts/generate-seed-sql.ts           write the migration
//   node scripts/generate-seed-sql.ts --check   exit 1 if the committed migration is out of date
//
// The content is checked against the database constraints first (see the init migration), so
// a bad edit fails here with a clear message instead of when the migration is applied.
// Output is deterministic: running the script twice produces the same file.

import { readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import process from 'node:process'
import { DEFAULT_TOPICS, EXAMPLE_CARDS } from '../src/data/exampleContent.ts'
import { SUBJECT_CODES } from '../src/lib/subjects.ts'

const ROOT = resolve(import.meta.dirname, '..')
const OUTPUT = resolve(ROOT, 'supabase/migrations/20261021120100_seed_content.sql')

const EXAMPLE_CARDS_PER_SUBJECT = 3

/** Limits from the check constraints in supabase/migrations/20261021120000_init.sql. */
const LIMITS = {
  topicName: 80,
  unit: 40,
  question: 4000,
  keyPoints: 20,
  keyPointId: 64,
  point: 500,
  alternative: 300,
} as const

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

/** Length in characters as Postgres counts them (code points, not UTF-16 units). */
function charLength(value: string): number {
  return [...value].length
}

// Postgres text can't hold NUL, and other control characters have no place in this content.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b-\u001f\u007f]/

function checkText(problems: string[], where: string, value: string, max: number): void {
  if (value !== value.trim()) problems.push(`${where}: remove the leading or trailing whitespace`)
  const length = charLength(value.trim())
  if (length < 1 || length > max) problems.push(`${where}: must be 1-${max} characters (is ${length})`)
  if (CONTROL_CHARACTERS.test(value)) problems.push(`${where}: contains a control character`)
  // The functions' bodies are dollar-quoted with $$, so the content must not contain it.
  if (value.includes('$$')) problems.push(`${where}: must not contain "$$"`)
}

function validate(): string[] {
  const problems: string[] = []
  const subjects = new Set<string>(SUBJECT_CODES)

  for (const key of Object.keys(DEFAULT_TOPICS)) {
    if (!subjects.has(key)) problems.push(`DEFAULT_TOPICS: unknown subject "${key}"`)
  }

  for (const subject of SUBJECT_CODES) {
    const topics = DEFAULT_TOPICS[subject]
    if (topics.length === 0) problems.push(`DEFAULT_TOPICS.${subject}: needs at least one topic`)
    const seen = new Set<string>()
    topics.forEach((topic, index) => {
      const where = `DEFAULT_TOPICS.${subject}[${index}] "${topic.name}"`
      checkText(problems, `${where} name`, topic.name, LIMITS.topicName)
      // Mirrors the unique index on (user_id, subject, lower(btrim(name))).
      const key = topic.name.trim().toLowerCase()
      if (seen.has(key)) problems.push(`${where}: duplicate topic name in ${subject}`)
      seen.add(key)
      if (topic.unit !== null) checkText(problems, `${where} unit`, topic.unit, LIMITS.unit)
    })
  }

  const keyPointIds = new Set<string>()
  const questions = new Set<string>()
  const cardsPerSubject = new Map<string, number>()

  EXAMPLE_CARDS.forEach((card, index) => {
    const where = `EXAMPLE_CARDS[${index}]`
    if (!subjects.has(card.subject)) {
      problems.push(`${where}: unknown subject "${card.subject}"`)
      return
    }
    cardsPerSubject.set(card.subject, (cardsPerSubject.get(card.subject) ?? 0) + 1)

    if (!DEFAULT_TOPICS[card.subject].some((topic) => topic.name === card.topic)) {
      problems.push(`${where}: topic "${card.topic}" is not a default ${card.subject} topic`)
    }

    checkText(problems, `${where} question`, card.question, LIMITS.question)
    if (questions.has(card.question)) problems.push(`${where}: duplicate question`)
    questions.add(card.question)

    const points = card.key_points
    if (points.length < 1 || points.length > LIMITS.keyPoints) {
      problems.push(`${where}: needs 1-${LIMITS.keyPoints} key points (has ${points.length})`)
    }
    points.forEach((kp, kpIndex) => {
      const kpWhere = `${where}.key_points[${kpIndex}] (${kp.id})`
      checkText(problems, `${kpWhere} id`, kp.id, LIMITS.keyPointId)
      // Ids only need to be unique within a card, but example ids are unique across all cards.
      if (keyPointIds.has(kp.id)) problems.push(`${kpWhere}: duplicate key point id`)
      keyPointIds.add(kp.id)
      checkText(problems, `${kpWhere} point`, kp.point, LIMITS.point)
      kp.accept.forEach((text, i) => checkText(problems, `${kpWhere} accept[${i}]`, text, LIMITS.alternative))
      kp.reject.forEach((text, i) => checkText(problems, `${kpWhere} reject[${i}]`, text, LIMITS.alternative))
    })
  })

  for (const subject of SUBJECT_CODES) {
    const count = cardsPerSubject.get(subject) ?? 0
    if (count !== EXAMPLE_CARDS_PER_SUBJECT) {
      problems.push(`EXAMPLE_CARDS: ${subject} has ${count} cards, expected ${EXAMPLE_CARDS_PER_SUBJECT}`)
    }
  }

  return problems
}

// ---------------------------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------------------------

/**
 * A standard SQL string literal. Quotes are doubled; backslashes are literal because
 * standard_conforming_strings is on (the Postgres default, and Supabase's setting).
 */
function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function sqlNullableString(value: string | null): string {
  return value === null ? 'null' : sqlString(value)
}

/** Each element of a VALUES list on its own line, comma-separated. */
function valuesList(rows: string[], indent: string): string {
  return rows.map((row) => `${indent}${row}`).join(',\n')
}

function topicRows(): string[] {
  return SUBJECT_CODES.flatMap((subject) =>
    DEFAULT_TOPICS[subject].map(
      (topic, position) =>
        `(${sqlString(subject)}, ${sqlString(topic.name)}, ${sqlNullableString(topic.unit)}, ${position})`,
    ),
  )
}

/** One example card as a multi-line VALUES row; key points are a jsonb array, one per line. */
function cardRow(index: number, indent: string): string {
  const card = EXAMPLE_CARDS[index]
  if (!card) throw new Error(`No example card at index ${index}`)
  const inner = `${indent}  `
  const keyPoints = card.key_points
    .map((kp) => `${inner}  ${JSON.stringify({ id: kp.id, point: kp.point, accept: kp.accept, reject: kp.reject })}`)
    .join(',\n')
  return [
    `(`,
    `${inner}${index + 1},`,
    `${inner}${sqlString(card.subject)},`,
    `${inner}${sqlString(card.topic)},`,
    `${inner}${sqlString(card.question)},`,
    `${inner}${sqlString(`[\n${keyPoints}\n${inner}]`)}::jsonb`,
    `${indent})`,
  ].join('\n')
}

function generate(): string {
  const counts = SUBJECT_CODES.map((subject) => `${DEFAULT_TOPICS[subject].length} ${subject}`).join(', ')
  const cardCount = EXAMPLE_CARDS.length
  const cardIndent = '      '
  const cardRows = EXAMPLE_CARDS.map((_, index) => `${cardIndent}${cardRow(index, cardIndent)}`).join(',\n')

  return `-- Redpen: default topic lists and example cards
--
-- GENERATED FILE. Do not edit by hand: the content lives in src/data/exampleContent.ts.
-- Change it there, then run \`node scripts/generate-seed-sql.ts\` to rebuild this migration.
--
--   public.seed_default_topics(uuid)  copies the default topic lists to a user. Called by
--                                     public.handle_new_user() when an account is created.
--   public.add_example_cards()        adds the example cards for the signed-in user, once.

-- ---------------------------------------------------------------------------
-- Default topics (${counts})
-- ---------------------------------------------------------------------------

create or replace function public.seed_default_topics(p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'A user id is required' using errcode = '22004';
  end if;

  -- Idempotent: a topic the user already has (same subject and name) is left as it is.
  insert into public.topics (user_id, subject, name, unit, position)
  select p_user_id, d.subject::public.subject_code, d.name, d.unit, d.position
  from (
    values
${valuesList(topicRows(), '      ')}
  ) as d (subject, name, unit, position)
  on conflict do nothing;
end;
$$;

comment on function public.seed_default_topics(uuid) is
  'Copies the default topic lists to a user. Generated from src/data/exampleContent.ts.';

-- Only handle_new_user() and this migration seed topics; users can never seed them for anyone.
revoke execute on function public.seed_default_topics(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: accounts that already exist get a profile and the default topics.
-- ---------------------------------------------------------------------------

insert into public.profiles (id)
select u.id from auth.users as u
on conflict (id) do nothing;

select public.seed_default_topics(u.id) from auth.users as u;

-- ---------------------------------------------------------------------------
-- Example cards (${cardCount}): added on request, at most once per user.
-- Returns how many cards were added: ${cardCount}, or 0 if the user already has example cards.
-- Runs as the calling user (security invoker), so RLS applies as usual.
-- ---------------------------------------------------------------------------

create or replace function public.add_example_cards()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_inserted integer;
begin
  if v_user_id is null then
    raise exception 'Sign in to add the example cards' using errcode = '42501';
  end if;

  -- Serialise concurrent calls for the same user (a double tap), so the check below holds.
  perform pg_advisory_xact_lock(hashtext('redpen.add_example_cards'), hashtext(v_user_id::text));

  if exists (
    select 1 from public.cards as c
    where c.user_id = v_user_id and c.origin = 'example'
  ) then
    return 0;
  end if;

  insert into public.cards (user_id, subject, topic_id, question, key_points, origin, due, created_at)
  select
    v_user_id,
    e.subject::public.subject_code,
    t.id,
    e.question,
    e.key_points,
    'example',
    -- Distinct timestamps keep the cards in their written order.
    v_now - (${cardCount} - e.ord) * interval '1 millisecond',
    v_now - (${cardCount} - e.ord) * interval '1 millisecond'
  from (
    values
${cardRows}
  ) as e (ord, subject, topic, question, key_points)
  -- The topic is matched by name; it stays null if the user has renamed or deleted it.
  left join public.topics as t
    on t.user_id = v_user_id
    and t.subject = e.subject
    and lower(btrim(t.name)) = lower(btrim(e.topic))
  order by e.ord;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function public.add_example_cards() is
  'Adds the example cards for the signed-in user, once. Generated from src/data/exampleContent.ts.';

revoke execute on function public.add_example_cards() from public, anon;
grant execute on function public.add_example_cards() to authenticated;
`
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

function readIfExists(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function main(): number {
  const problems = validate()
  if (problems.length > 0) {
    console.error(`src/data/exampleContent.ts has ${problems.length} problem(s):`)
    for (const problem of problems) console.error(`  - ${problem}`)
    return 1
  }

  const sql = generate()
  const target = relative(ROOT, OUTPUT).replaceAll('\\', '/')

  if (process.argv.includes('--check')) {
    const current = readIfExists(OUTPUT)
    if (current === null) {
      console.error(`${target} is missing. Run: node scripts/generate-seed-sql.ts`)
      return 1
    }
    // Compare with LF line endings, in case git converted the checked-out file to CRLF.
    if (current.replaceAll('\r\n', '\n') !== sql) {
      console.error(`${target} is out of date. Run: node scripts/generate-seed-sql.ts`)
      return 1
    }
    console.log(`${target} is up to date.`)
    return 0
  }

  writeFileSync(OUTPUT, sql, 'utf8')
  const topicTotal = SUBJECT_CODES.reduce((sum, subject) => sum + DEFAULT_TOPICS[subject].length, 0)
  console.log(`Wrote ${target}: ${topicTotal} default topics, ${EXAMPLE_CARDS.length} example cards.`)
  return 0
}

process.exitCode = main()
