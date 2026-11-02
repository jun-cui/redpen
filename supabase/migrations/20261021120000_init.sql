-- Redpen: initial schema
-- Tables: profiles, topics, cards, reviews, mistakes.
-- Every table has Row Level Security: a user can only ever see and change their own rows.
-- Everything here works on the Supabase free tier (plain Postgres, RLS, plpgsql functions).

-- ---------------------------------------------------------------------------
-- Shared types and helpers
-- ---------------------------------------------------------------------------

create domain public.subject_code as text
  check (value in ('maths', 'further_maths', 'physics', 'computer_science'));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- A card's mark scheme: a JSON array of key points, each
--   { "id": "kp_ab12", "point": "...", "accept": ["..."], "reject": ["..."] }
-- ids are unique within the card so marking results and overrides can refer to them.
create or replace function public.key_points_valid(kp jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  el jsonb;
  seen text[] := '{}';
begin
  if kp is null or jsonb_typeof(kp) is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(kp) < 1 or jsonb_array_length(kp) > 20 then
    return false;
  end if;

  for el in select value from jsonb_array_elements(kp) loop
    if jsonb_typeof(el) is distinct from 'object' then
      return false;
    end if;
    if jsonb_typeof(el -> 'id') is distinct from 'string'
       or char_length(el ->> 'id') not between 1 and 64
       or (el ->> 'id') = any (seen) then
      return false;
    end if;
    seen := seen || (el ->> 'id');

    if jsonb_typeof(el -> 'point') is distinct from 'string'
       or char_length(btrim(el ->> 'point')) not between 1 and 500 then
      return false;
    end if;

    if jsonb_typeof(coalesce(el -> 'accept', '[]'::jsonb)) is distinct from 'array'
       or jsonb_typeof(coalesce(el -> 'reject', '[]'::jsonb)) is distinct from 'array' then
      return false;
    end if;
    if exists (
      select 1
      from jsonb_array_elements(coalesce(el -> 'accept', '[]'::jsonb) || coalesce(el -> 'reject', '[]'::jsonb)) as a(value)
      where jsonb_typeof(a.value) is distinct from 'string'
         or char_length(a.value #>> '{}') > 300
    ) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per user, created automatically on sign-up / invite
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  desired_retention numeric(3, 2) not null default 0.90
    check (desired_retention between 0.70 and 0.97),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- topics: the fixed, user-editable topic list for each subject
-- ---------------------------------------------------------------------------

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject public.subject_code not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  unit text check (unit is null or char_length(unit) <= 40),
  position integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  -- Lets cards and mistakes reference a topic of the same user and subject.
  unique (id, user_id, subject)
);

create unique index topics_user_subject_name_key
  on public.topics (user_id, subject, lower(btrim(name)));
create index topics_user_subject_position_idx
  on public.topics (user_id, subject, position);

-- ---------------------------------------------------------------------------
-- cards: a flashcard plus its FSRS scheduling state
-- ---------------------------------------------------------------------------

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject public.subject_code not null,
  topic_id uuid,
  question text not null check (char_length(btrim(question)) between 1 and 4000),
  key_points jsonb not null check (public.key_points_valid(key_points)),
  origin text not null default 'manual'
    check (origin in ('manual', 'generated', 'mistake', 'example')),
  suspended boolean not null default false,

  -- FSRS state, mirroring ts-fsrs's Card (state: 0 New, 1 Learning, 2 Review, 3 Relearning)
  fsrs_state smallint not null default 0 check (fsrs_state between 0 and 3),
  due timestamptz not null default now(),
  stability double precision not null default 0 check (stability >= 0),
  difficulty double precision not null default 0 check (difficulty >= 0),
  elapsed_days integer not null default 0 check (elapsed_days >= 0),
  scheduled_days integer not null default 0 check (scheduled_days >= 0),
  learning_steps integer not null default 0 check (learning_steps >= 0),
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  last_review timestamptz,

  -- Derived after every review by record_review()
  category text not null default 'new'
    check (category in ('new', 'learning', 'weak', 'mastered')),
  last_score real check (last_score is null or last_score between 0 and 1),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, user_id),
  foreign key (topic_id, user_id, subject)
    references public.topics (id, user_id, subject)
    on delete set null (topic_id)
);

create index cards_user_due_idx on public.cards (user_id, due) where not suspended;
create index cards_user_category_idx on public.cards (user_id, category);
create index cards_user_subject_topic_idx on public.cards (user_id, subject, topic_id);
create index cards_topic_idx on public.cards (topic_id);

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reviews: one row per answer marked (self-graded or AI-marked)
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null,
  reviewed_at timestamptz not null default now(),
  answer text not null default '' check (char_length(answer) <= 5000),
  grading text not null check (grading in ('self', 'ai', 'ai_fallback')),
  -- Per key point: { key_point_id, point, hit, quote, reason, ai_hit, overridden }
  results jsonb not null check (jsonb_typeof(results) = 'array'),
  -- [{ exact_substring, correction }] from AI marking
  corrections jsonb not null default '[]'::jsonb check (jsonb_typeof(corrections) = 'array'),
  -- [text] points the student should add, from AI marking
  missing jsonb not null default '[]'::jsonb check (jsonb_typeof(missing) = 'array'),
  points_hit smallint not null,
  points_total smallint not null,
  easy boolean not null default false,
  -- FSRS rating: 1 Again, 2 Hard, 3 Good, 4 Easy. Always derived from the score.
  rating smallint not null check (rating between 1 and 4),
  -- The card's FSRS state just before this review, so an override can reschedule from it.
  card_before jsonb not null,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  amended_at timestamptz,

  unique (id, user_id),
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete cascade,
  check (points_total >= 1 and points_hit between 0 and points_total),
  check (not easy or points_hit = points_total),
  check (rating = case
    when points_hit = 0 then 1
    when points_hit < points_total then 2
    when easy then 4
    else 3
  end)
);

create index reviews_card_reviewed_idx on public.reviews (card_id, reviewed_at desc, id desc);
create index reviews_user_reviewed_idx on public.reviews (user_id, reviewed_at desc);

-- ---------------------------------------------------------------------------
-- mistakes: the mistake log (auto-logged missed key points + pasted past-paper mistakes)
-- ---------------------------------------------------------------------------

create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  origin text not null check (origin in ('review', 'manual')),
  subject public.subject_code,
  topic_id uuid,
  card_id uuid,
  review_id uuid,
  key_point_id text,
  source text check (source is null or char_length(source) <= 200),
  what_went_wrong text not null check (char_length(btrim(what_went_wrong)) between 1 and 2000),
  fix text not null check (char_length(btrim(fix)) between 1 and 2000),
  mistake_type text check (mistake_type in ('slip', 'method', 'knowledge', 'wording')),
  raw_text text check (raw_text is null or char_length(raw_text) <= 8000),
  -- The flashcard made from this mistake, if any
  flashcard_id uuid,

  check (topic_id is null or subject is not null),
  foreign key (topic_id, user_id, subject)
    references public.topics (id, user_id, subject)
    on delete set null (topic_id),
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete set null (card_id),
  foreign key (review_id, user_id) references public.reviews (id, user_id) on delete set null (review_id),
  foreign key (flashcard_id, user_id) references public.cards (id, user_id) on delete set null (flashcard_id)
);

create index mistakes_user_created_idx on public.mistakes (user_id, created_at desc);
create index mistakes_review_idx on public.mistakes (review_id);
create index mistakes_card_idx on public.mistakes (card_id);
create index mistakes_topic_idx on public.mistakes (topic_id);
create index mistakes_flashcard_idx on public.mistakes (flashcard_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.cards enable row level security;
alter table public.reviews enable row level security;
alter table public.mistakes enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can read their own topics"
  on public.topics for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can add their own topics"
  on public.topics for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own topics"
  on public.topics for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own topics"
  on public.topics for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own cards"
  on public.cards for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can add their own cards"
  on public.cards for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own cards"
  on public.cards for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own cards"
  on public.cards for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own reviews"
  on public.reviews for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can add their own reviews"
  on public.reviews for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own reviews"
  on public.reviews for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own reviews"
  on public.reviews for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own mistakes"
  on public.mistakes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can add their own mistakes"
  on public.mistakes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own mistakes"
  on public.mistakes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own mistakes"
  on public.mistakes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Supabase's default privileges give anon and authenticated every privilege on new tables,
-- including TRUNCATE, which ignores RLS. Start from nothing and grant only what the app uses:
-- signed-out visitors (the anon role) get nothing at all, and profiles are created by
-- handle_new_user(), never by the client.
revoke all on public.profiles, public.topics, public.cards, public.reviews, public.mistakes
  from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.topics, public.cards, public.reviews, public.mistakes to authenticated;

-- Functions are executable by PUBLIC (and, on Supabase, by anon) by default.
-- key_points_valid() runs inside the cards CHECK constraint as the inserting user, so
-- authenticated keeps it; trigger functions need no EXECUTE privilege to fire.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.key_points_valid(jsonb) from public, anon;
grant execute on function public.key_points_valid(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Card category: new / learning / weak / mastered
--   new      : never reviewed
--   mastered : full marks on each of the last 3 reviews and an FSRS interval over 21 days
--   weak     : last mark under 50%, or rated Again 2+ times in the last 5 reviews
--   learning : everything in between
-- Mastered is checked first: three perfect answers in a row outweigh older lapses.
-- ---------------------------------------------------------------------------

create or replace function public.compute_card_category(p_card_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  with recent as (
    select r.points_hit, r.points_total, r.rating,
           row_number() over (order by r.reviewed_at desc, r.id desc) as rn
    from public.reviews r
    where r.card_id = p_card_id
    order by r.reviewed_at desc, r.id desc
    limit 5
  )
  select case
    when not exists (select 1 from recent) then 'new'
    when (select count(*) from recent where rn <= 3 and points_hit = points_total) = 3
         and coalesce((select c.scheduled_days from public.cards c where c.id = p_card_id), 0) > 21
      then 'mastered'
    when (select points_hit::numeric / points_total from recent where rn = 1) < 0.5
         or (select count(*) from recent where rating = 1) >= 2
      then 'weak'
    else 'learning'
  end;
$$;

-- ---------------------------------------------------------------------------
-- record_review: save one marked answer atomically.
--   * inserts the review (or amends the card's latest review when p_review_id is given),
--   * stores the FSRS state the client computed with ts-fsrs,
--   * re-logs a mistake for every missed key point,
--   * recomputes the card's category.
-- The score is always computed here from the per-point hits, never trusted from the client:
-- there must be exactly one result per key point (the card's key points for a new review, the
-- reviewed points for an override, as the card may have been edited since), and the rating
-- must match the score: 0 points = Again, some = Hard, all = Good, all + easy = Easy.
-- Runs as the calling user (security invoker), so RLS still applies to every statement.
--
-- A new review (p_review_id is null) can also carry:
--   * p_id: its id, chosen by the client. Sent again, it returns the saved review with the
--     current card and changes nothing, so a retry after a lost response can't count twice.
--     This comes before every other check: the card may have moved on since.
--   * p_expected_reps: the reps the client scheduled from. If the card has moved on, nothing is
--     written and the client schedules again from the card as it is now.
-- A card that changed under the client (other reps, other key points) raises PT409, which
-- PostgREST returns as HTTP 409 with that code. Never raise 40001 here: PostgREST 14 takes it
-- for a serialization failure and retries the transaction endlessly (fixed in PostgREST 16).
-- ---------------------------------------------------------------------------

create or replace function public.record_review(
  p_card_id uuid,
  p_results jsonb,
  p_card_after jsonb,
  p_rating smallint,
  p_easy boolean default false,
  p_answer text default '',
  p_grading text default 'self',
  p_corrections jsonb default '[]'::jsonb,
  p_missing jsonb default '[]'::jsonb,
  p_reviewed_at timestamptz default null,
  p_duration_ms integer default null,
  p_review_id uuid default null,
  p_id uuid default null,
  p_expected_reps integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_card public.cards;
  v_review public.reviews;
  v_point_ids text[];
  v_total integer;
  v_hit integer;
  v_easy boolean;
  v_expected smallint;
begin
  select * into v_card from public.cards where id = p_card_id for update;
  if not found then
    raise exception 'Card not found' using errcode = 'P0002';
  end if;

  if p_review_id is null then
    if p_id is not null then
      select * into v_review from public.reviews where id = p_id and card_id = p_card_id;
      if found then
        return jsonb_build_object('review', to_jsonb(v_review), 'card', to_jsonb(v_card));
      end if;
    end if;
    if p_expected_reps is not null and p_expected_reps is distinct from v_card.reps then
      raise exception 'Card changed since it was shown' using errcode = 'PT409';
    end if;
  end if;

  if p_results is null or jsonb_typeof(p_results) is distinct from 'array'
     or jsonb_array_length(p_results) = 0 then
    raise exception 'Results must be a non-empty array' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_results) as r(value)
    where jsonb_typeof(r.value) is distinct from 'object'
       or jsonb_typeof(r.value -> 'hit') is distinct from 'boolean'
       or jsonb_typeof(r.value -> 'key_point_id') is distinct from 'string'
  ) then
    raise exception 'Each result needs a key_point_id and a boolean hit' using errcode = '22023';
  end if;
  if p_card_after is null or jsonb_typeof(p_card_after) is distinct from 'object'
     or p_card_after ->> 'due' is null then
    raise exception 'Missing scheduling state' using errcode = '22023';
  end if;

  if p_review_id is not null then
    select * into v_review
    from public.reviews
    where id = p_review_id and card_id = p_card_id
    for update;
    if not found then
      raise exception 'Review not found' using errcode = 'P0002';
    end if;
    if exists (
      select 1 from public.reviews r
      where r.card_id = p_card_id
        and (r.reviewed_at, r.id) > (v_review.reviewed_at, v_review.id)
    ) then
      raise exception 'Only the most recent review of a card can be changed' using errcode = '55000';
    end if;
  end if;

  -- Exactly one result per key point, so a missing, repeated or unknown point can't change
  -- the score. Compared as sorted lists of ids. For a new review a mismatch means the card's
  -- key points changed under the client; the reviewed points of an override never change.
  v_point_ids := case
    when p_review_id is null then
      array(select k.value ->> 'id' from jsonb_array_elements(v_card.key_points) as k(value) order by 1)
    else
      array(select r.value ->> 'key_point_id' from jsonb_array_elements(v_review.results) as r(value) order by 1)
  end;
  if array(
    select r.value ->> 'key_point_id' from jsonb_array_elements(p_results) as r(value) order by 1
  ) is distinct from v_point_ids then
    raise exception 'Results must mark each of the card''s key points exactly once'
      using errcode = case when p_review_id is null then 'PT409' else '22023' end;
  end if;

  v_total := jsonb_array_length(p_results);
  select count(*) into v_hit
  from jsonb_array_elements(p_results) as r(value)
  where r.value -> 'hit' = 'true'::jsonb;

  v_easy := coalesce(p_easy, false) and v_hit = v_total;
  v_expected := case
    when v_hit = 0 then 1
    when v_hit < v_total then 2
    when v_easy then 4
    else 3
  end;
  if p_rating is distinct from v_expected then
    raise exception 'Rating % does not match a score of %/%', p_rating, v_hit, v_total
      using errcode = '22023';
  end if;

  if p_review_id is null then
    insert into public.reviews (
      id, user_id, card_id, reviewed_at, answer, grading, results, corrections, missing,
      points_hit, points_total, easy, rating, card_before, duration_ms
    ) values (
      coalesce(p_id, gen_random_uuid()),
      v_card.user_id, v_card.id, coalesce(p_reviewed_at, now()), coalesce(p_answer, ''),
      coalesce(p_grading, 'self'), p_results, coalesce(p_corrections, '[]'::jsonb),
      coalesce(p_missing, '[]'::jsonb), v_hit, v_total, v_easy, v_expected,
      jsonb_build_object(
        'state', v_card.fsrs_state,
        'due', v_card.due,
        'stability', v_card.stability,
        'difficulty', v_card.difficulty,
        'elapsed_days', v_card.elapsed_days,
        'scheduled_days', v_card.scheduled_days,
        'learning_steps', v_card.learning_steps,
        'reps', v_card.reps,
        'lapses', v_card.lapses,
        'last_review', v_card.last_review
      ),
      p_duration_ms
    )
    returning * into v_review;
  else
    update public.reviews set
      results = p_results,
      corrections = coalesce(p_corrections, corrections),
      missing = coalesce(p_missing, missing),
      points_hit = v_hit,
      points_total = v_total,
      easy = v_easy,
      rating = v_expected,
      amended_at = now()
    where id = v_review.id
    returning * into v_review;
  end if;

  update public.cards set
    fsrs_state = (p_card_after ->> 'state')::smallint,
    due = (p_card_after ->> 'due')::timestamptz,
    stability = (p_card_after ->> 'stability')::double precision,
    difficulty = (p_card_after ->> 'difficulty')::double precision,
    elapsed_days = coalesce((p_card_after ->> 'elapsed_days')::integer, 0),
    scheduled_days = coalesce((p_card_after ->> 'scheduled_days')::integer, 0),
    learning_steps = coalesce((p_card_after ->> 'learning_steps')::integer, 0),
    reps = (p_card_after ->> 'reps')::integer,
    lapses = (p_card_after ->> 'lapses')::integer,
    last_review = (p_card_after ->> 'last_review')::timestamptz,
    last_score = v_hit::real / v_total
  where id = v_card.id;

  -- Mistake log: one entry per missed key point, rebuilt whenever the review changes.
  delete from public.mistakes where review_id = v_review.id;
  insert into public.mistakes (
    user_id, origin, subject, topic_id, card_id, review_id, key_point_id,
    source, what_went_wrong, fix, mistake_type
  )
  select
    v_card.user_id,
    'review',
    v_card.subject,
    v_card.topic_id,
    v_card.id,
    v_review.id,
    r.value ->> 'key_point_id',
    'Flashcard review',
    left(coalesce(
      nullif(btrim(r.value ->> 'reason'), ''),
      'Missed: ' || coalesce(nullif(btrim(kp.value ->> 'point'), ''), nullif(btrim(r.value ->> 'point'), ''), 'a key point')
    ), 2000),
    left(coalesce(
      nullif(btrim(kp.value ->> 'point'), ''),
      nullif(btrim(r.value ->> 'point'), ''),
      'See the mark scheme for this card.'
    ), 2000),
    -- Said something relevant but not precise enough = wording; said nothing = knowledge.
    case when nullif(btrim(r.value ->> 'quote'), '') is not null then 'wording' else 'knowledge' end
  from jsonb_array_elements(p_results) as r(value)
  left join lateral (
    select k.value
    from jsonb_array_elements(v_card.key_points) as k(value)
    where k.value ->> 'id' = r.value ->> 'key_point_id'
    limit 1
  ) as kp on true
  where r.value -> 'hit' = 'false'::jsonb;

  update public.cards
  set category = public.compute_card_category(v_card.id)
  where id = v_card.id
  returning * into v_card;

  return jsonb_build_object('review', to_jsonb(v_review), 'card', to_jsonb(v_card));
end;
$$;

revoke execute on function public.record_review(uuid, jsonb, jsonb, smallint, boolean, text, text, jsonb, jsonb, timestamptz, integer, uuid, uuid, integer) from public, anon;
grant execute on function public.record_review(uuid, jsonb, jsonb, smallint, boolean, text, text, jsonb, jsonb, timestamptz, integer, uuid, uuid, integer) to authenticated;
revoke execute on function public.compute_card_category(uuid) from public, anon;
grant execute on function public.compute_card_category(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- New users: create a profile and copy in the default topic lists.
-- public.seed_default_topics(uuid) is defined in the next migration.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  perform public.seed_default_topics(new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
