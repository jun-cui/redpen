# Redpen architecture

Redpen is a React + Vite + TypeScript PWA backed by Supabase (Postgres, Auth, Edge Functions).
This document is the map of the codebase: where things live and the contracts between modules.
Setting the app up for the first time? Start with [README.md](../README.md) and the tick-list in
[SETUP-CHECKLIST.md](SETUP-CHECKLIST.md).

## Stack

| Concern | Choice |
| --- | --- |
| UI | React 19, react-router 7 in data mode (`createBrowserRouter` + `<RouterProvider>`, lazy routes; enables `useBlocker` for unsaved-changes guards) |
| Data fetching | TanStack Query 5 (`@tanstack/react-query`) |
| Animation | Motion 12 (`import { motion, AnimatePresence } from 'motion/react'`) |
| Icons | `lucide-react` only |
| Styling | CSS Modules (`Component.module.css`) + global tokens in `src/styles/tokens.css` |
| Fonts | Self-hosted via Fontsource: Fraunces (serif), Inter (sans), Caveat (hand), Literata (Greek fallback) |
| Backend | Supabase: Postgres with RLS, email/password Auth (invite-only), Edge Functions (Stage 2+) |
| Scheduling | FSRS via `ts-fsrs` 5, computed in the browser, stored by the `record_review` RPC |
| PWA | `vite-plugin-pwa` (Workbox, prompt-to-update) |
| Hosting | Cloudflare Pages (static `dist/`) |

TypeScript is strict with `noUncheckedIndexedAccess` and `erasableSyntaxOnly` (no TS `enum`s or
parameter properties in our code; library enums like ts-fsrs `Rating` are fine to use).

## Folder structure

```
src/
  main.tsx                 entry: fonts, global CSS, theme init, <App/>
  App.tsx                  providers + routes
  styles/
    tokens.css             design tokens (colours, type, spacing, radii, shadows, motion, layout)
    base.css               reset, element defaults, utility classes
    fonts.ts               Fontsource imports
  lib/                     framework-free logic (unit-tested)
    env.ts                 isSupabaseConfigured, isDemoMode, hasSecretKey
    supabaseKey.ts         isSecretSupabaseKey(): shared with vite.config.ts, which refuses to build with a secret key
    scroll.ts              smoothScrollIntoView(): smooth unless the user prefers reduced motion
    supabase.ts            typed Supabase client
    database.types.ts      hand-maintained DB types
    types.ts               domain types (KeyPoint, PointResult, FsrsSnapshot, ...)
    subjects.ts            the four subjects
    fsrs.ts                ts-fsrs wrapper: rating from score, scheduling, interval labels
    scoring.ts             score from per-point results
    category.ts            new/learning/weak/mastered (mirrors SQL compute_card_category)
    ids.ts                 key point ids
    errors.ts              friendlyError(): user-facing error copy
    motion.ts              spring presets + variants
    theme.ts               theme preference (system/light/dark)
  data/                    data access
    api.ts                 Api interface (what the app needs from a backend)
    supabaseApi.ts         Api implemented with Supabase
    demo/                  Api implemented in the browser for demo mode (dev only)
    index.ts               exports `api` (picks supabase or demo)
    keys.ts                TanStack Query keys
    hooks.ts               useTopics, useCards, useDueCards, useRecordReview, ...
    exampleContent.ts      default topic lists + example cards (source of truth for the seed SQL)
  auth/                    AuthProvider, useAuth, route guards
  components/              design system (one folder or file per component, CSS Modules)
  hooks/                   shared React hooks (useKeyboardInset, useMediaQuery, ...)
  features/
    auth/                  login, forgot password, set password, email link handler
    shell/                 AppShell: sidebar (desktop) / tab bar (mobile), page transitions
    home/                  HomePage
    cards/                 CardsPage (list), CardEditorPage (create/edit)
    topics/                TopicsPage, topic picker
    review/                ReviewPage and the marking UI
    settings/              SettingsPage
  pwa/                     service worker registration hook
  dev/                     dev-only pages (styleguide), excluded from production
supabase/
  migrations/              SQL, applied in filename order
  functions/               Edge Functions (Stage 2+)
  templates/               copy-paste email templates (Invite user, Reset password)
public/                    icons, _headers, static files
tests/db/                  SQL tests run against PGlite (Postgres in WASM)
```

## Routes

| Path | Page | Notes |
| --- | --- | --- |
| `/login` | LoginPage | public |
| `/forgot-password` | ForgotPasswordPage | public |
| `/auth/confirm` | AuthConfirmPage | public; handles `?token_hash=&type=invite\|recovery&next=` email links |
| `/set-password` | SetPasswordPage | needs a session (from an invite or recovery link) |
| `/` | HomePage | |
| `/review` | ReviewPage | full-screen focus mode (no nav); optional `?subject=physics` |
| `/cards` | CardsPage | |
| `/cards/new` | CardEditorPage | optional `?subject=` |
| `/cards/:cardId` | CardEditorPage | edit |
| `/settings` | SettingsPage | |
| `/settings/topics` | TopicsPage | optional `?subject=` |
| `/dev/styleguide` | StyleguidePage | dev builds only |

Stage 4 adds `/mistakes` and dashboard content on `/`.

Page components are named exports: `HomePage` from `src/features/home/HomePage.tsx`,
`CardsPage` and `CardEditorPage` from `src/features/cards/`, `TopicsPage` from
`src/features/topics/TopicsPage.tsx`, `ReviewPage` from `src/features/review/ReviewPage.tsx`,
`SettingsPage` from `src/features/settings/SettingsPage.tsx`, `StyleguidePage` from
`src/dev/StyleguidePage.tsx`. Routes lazy-load them.

## Data model (see `supabase/migrations`)

- `profiles` — one per user (display name, FSRS desired retention).
- `topics` — per user, per subject; seeded from defaults on sign-up; user-editable; `archived` hides from pickers.
- `cards` — question, `key_points` jsonb (`[{id, point, accept[], reject[]}]`), FSRS state columns, `category`, `last_score`.
- `reviews` — every marked answer: per-point `results`, `corrections`, `missing`, score, rating, and `card_before` (FSRS state before) so an override can reschedule.
- `mistakes` — the mistake log. Missed key points are logged automatically by `record_review`.

Every table has RLS: `user_id = auth.uid()`. `user_id` defaults to `auth.uid()`, so inserts never send it.

`src/lib/database.types.ts` is maintained by hand. Keep its row shapes as `type` aliases, not
`interface`s: supabase-js needs each row to be assignable to `Record<string, unknown>`, and with
interfaces every typed query silently collapses to `never`.

Supabase no longer exposes new tables to the Data API automatically (2026), so every new table or
function needs explicit `grant`s in its migration, plus an update to `tests/db/schema.test.ts`, which pins
the exact set of client-callable functions, policies and triggers.

`supabase/migrations/*_seed_content.sql` is generated from `src/data/exampleContent.ts`:
run `npm run seed:sql` after editing the content (`npm run seed:check` fails if it is stale).

### Saving a review: `record_review` RPC

The browser computes the next FSRS state with ts-fsrs and calls
`supabase.rpc('record_review', {...})`. In one transaction the database:
1. computes the score from `p_results[].hit` and rejects a rating that doesn't match
   (0 = Again 1, some = Hard 2, all = Good 3, all + easy = Easy 4),
2. inserts the review (or, with `p_review_id`, amends the card's most recent review: overrides),
3. writes the FSRS state to the card,
4. rebuilds the mistake-log rows for that review (one per missed point),
5. recomputes the card's category.

To override after saving: take `review.card_before`, re-run ts-fsrs with the new rating at
`review.reviewed_at`, and call `record_review` again with `p_review_id`.

A new review can also carry `p_id`, its id chosen when the answer is handed in: sent again (a
retry after a lost response) it returns the saved review with the card and changes nothing. And
`p_expected_reps`, the card's `reps` the client scheduled from: if the card has moved on (reviewed
on another device), nothing is written and the call fails with SQLSTATE `PT409` (HTTP 409).
Results that don't match the card's key points fail the same way. The review screen then fetches
the card again and either retries once or asks the student to check their ticks. Never raise
`40001` from a function: PostgREST 14 retries it endlessly.

### Scheduling and the review session

FSRS runs with one 10-minute learning step (`src/lib/fsrs.ts`): on a new card, full marks
schedules the card in days, while a miss (10 min) or a partial answer (15 min) brings it back
the same day. Within a session (`src/features/review/queue.ts`), a card due again within 20
minutes stays in the session but is only shown once it is due (a minute's grace); if only such
cards are left, the session ends and the summary says when they come back.

## Conventions

- **Styling**: CSS Modules next to the component. Only use tokens (`var(--space-2)`,
  `var(--color-ink-2)`, ...); no raw hex colours or px spacing outside tokens.css (1px hairlines are fine).
  Red (`--color-red*`) only for marking, brand, primary actions and errors.
- **Motion**: movement animates only `transform`, `opacity` and SVG stroke
  (`pathLength`/`stroke-dashoffset`); a raised shadow fades in on a pseudo-element's opacity.
  Brief (at most about 150ms) colour transitions for a control's hover/press/checked state are
  allowed. Use the spring presets from `src/lib/motion.ts`. `<MotionConfig reducedMotion="user">`
  wraps the app, but Motion only makes transforms instant there: anything with an exit transform
  must switch to the opacity-only sets (`cardFadeVariants`, `pageFadeVariants`, `fadeVariants`)
  under `useReducedMotion()`, and pen strokes fade instead of drawing. JS smooth scrolling goes
  through `smoothScrollIntoView` (`src/lib/scroll.ts`).
- **Tap targets**: interactive elements are at least 44 x 44 px.
- **Text inputs**: font-size at least 16px (prevents iOS zoom).
- **Errors**: show `friendlyError(error)` copy, never raw exception text.
- **Loading**: skeletons that match the final layout, not spinners, for page content.
- **Data**: components use hooks from `src/data/hooks.ts`; never call `supabase` directly from a component.
- **Accessibility**: semantic elements, labelled controls, visible focus (`:focus-visible` uses `--focus-ring`),
  WCAG AA contrast (tokens are chosen to pass).
- **Copy**: calm, plain British English ("colour", "revise"). No exclamation marks in errors.
- **Scrolling**: pages never scroll the window on mount. The shell scrolls to the top on a new
  navigation and restores the position on back/forward (`history.scrollRestoration` is `manual`).
  The shell's `<main>` and the focus layout clip horizontal overflow so sliding transitions can't
  widen the page. While the offline strip shows it sets the root's `scroll-padding-top` to its
  height, and the review's docked actions set `scroll-padding-bottom`, so `scrollIntoView` lands
  clear of both; a scroll target computed by hand must allow for them too.
- **Column layouts**: the desktop sidebar takes 248px, so a "wide" page in a 1024px window is only
  about 700px. Split content into columns with container queries on the content itself, not
  window breakpoints.
- **Navigation**: tabs and sidebar items come from `NAV_ITEMS` in `src/features/shell/navItems.ts`
  (Stage 4 appends Mistakes). `useInShell()` tells a component whether it is inside the app shell.
