// How saved changes update the TanStack Query cache. Kept apart from the hooks (and React) so
// the rules can be tested against a real QueryClient.
//
// Review sessions (queryKeys.dueSession) are snapshots of the cards due when the session
// started. Nothing here refetches one that has cards in it, so the queue never reshuffles
// mid-session; an empty one (the "all caught up" screen) is refreshed so new cards show up.
//
// Each helper patches the cache synchronously, then resolves once its refetches finish. The
// mutations in ./hooks don't wait for that; tests do.

import { QueryClient } from '@tanstack/react-query'
import type { CardRow, ProfileRow, ReviewRow, TopicRow } from '../lib/database.types'
import type { SubjectCode } from '../lib/types'
import type { RecordReviewResult } from './api'
import { queryKeys } from './keys'
import { topicPositionUpdates } from './normalize'

/**
 * networkMode 'always': without a connection, requests fail straight away with the friendly
 * "you seem to be offline" copy rather than pausing behind an endless skeleton. Errored
 * queries refetch by themselves when the connection comes back.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, networkMode: 'always' },
      mutations: { retry: 0, networkMode: 'always' },
    },
  })
}

/**
 * Options for a review session's queue: never stale, never refetched on focus or reconnect,
 * and dropped as soon as nothing uses it, so the next session starts from fresh data.
 */
export const dueSessionOptions = {
  staleTime: Infinity,
  gcTime: 0,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Topics in display order: subject, position, name (as the Api lists them). */
export function sortTopics(topics: readonly TopicRow[]): TopicRow[] {
  return [...topics].sort(
    (a, b) =>
      (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0) ||
      a.position - b.position ||
      a.name.localeCompare(b.name),
  )
}

function replaceById<T extends { id: string }>(rows: T[] | undefined, row: T): T[] | undefined {
  return rows?.map((existing) => (existing.id === row.id ? row : existing))
}

function removeById<T extends { id: string }>(rows: T[] | undefined, id: string): T[] | undefined {
  return rows?.filter((existing) => existing.id !== id)
}

/** Puts a saved card into the cached list and its detail, and optionally into sessions. */
function storeCard(queryClient: QueryClient, card: CardRow, options: { inSessions: boolean }) {
  queryClient.setQueryData<CardRow[]>(queryKeys.cardList(), (cards) => replaceById(cards, card))
  queryClient.setQueryData<CardRow | null>(queryKeys.card(card.id), card)
  if (options.inSessions) {
    queryClient.setQueriesData<CardRow[]>({ queryKey: queryKeys.dueSessions() }, (cards) =>
      replaceById(cards, card),
    )
  }
}

function refreshEmptySessions(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.dueSessions(),
    predicate: (query) => (query.state.data as CardRow[] | undefined)?.length === 0,
  })
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function onProfileUpdated(queryClient: QueryClient, profile: ProfileRow): void {
  queryClient.setQueryData<ProfileRow>(queryKeys.profile(), profile)
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

export function onTopicSaved(queryClient: QueryClient, topic: TopicRow): Promise<void> {
  queryClient.setQueryData<TopicRow[]>(queryKeys.topics(), (topics) => {
    if (!topics) return topics
    const exists = topics.some((t) => t.id === topic.id)
    return sortTopics(exists ? (replaceById(topics, topic) ?? []) : [...topics, topic])
  })
  return queryClient.invalidateQueries({ queryKey: queryKeys.topics() })
}

export async function onTopicDeleted(queryClient: QueryClient, id: string): Promise<void> {
  queryClient.setQueryData<TopicRow[]>(queryKeys.topics(), (topics) => removeById(topics, id))
  // The database moves the topic's cards to "no topic".
  const detach = (cards: CardRow[] | undefined) =>
    cards?.map((card) => (card.topic_id === id ? { ...card, topic_id: null } : card))
  queryClient.setQueryData<CardRow[]>(queryKeys.cardList(), detach)
  queryClient.setQueriesData<CardRow[]>({ queryKey: queryKeys.dueSessions() }, detach)
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.topics() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.cards() }),
  ])
}

/**
 * Shows a subject's new topic order straight away. Returns the topics as they were, to put
 * back if saving fails.
 */
export function applyTopicOrder(
  queryClient: QueryClient,
  subject: SubjectCode,
  orderedIds: readonly string[],
): TopicRow[] | undefined {
  const previous = queryClient.getQueryData<TopicRow[]>(queryKeys.topics())
  if (!previous) return previous
  const positions = new Map(
    topicPositionUpdates(
      previous.filter((topic) => topic.subject === subject),
      orderedIds,
    ).map(({ id, position }) => [id, position]),
  )
  queryClient.setQueryData<TopicRow[]>(
    queryKeys.topics(),
    sortTopics(
      previous.map((topic) => {
        const position = positions.get(topic.id)
        return position === undefined ? topic : { ...topic, position }
      }),
    ),
  )
  return previous
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export async function onCardCreated(queryClient: QueryClient, card: CardRow): Promise<void> {
  queryClient.setQueryData<CardRow[]>(queryKeys.cardList(), (cards) => (cards ? [card, ...cards] : cards))
  queryClient.setQueryData<CardRow | null>(queryKeys.card(card.id), card)
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.cardList(), refetchType: 'none' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dueSummary() }),
    refreshEmptySessions(queryClient),
  ])
}

export async function onCardUpdated(queryClient: QueryClient, card: CardRow): Promise<void> {
  // Updated in place in review sessions too: same position in the queue, fresh content.
  storeCard(queryClient, card, { inSessions: true })
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.cardList(), refetchType: 'none' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dueSummary() }),
  ])
}

export async function onCardDeleted(queryClient: QueryClient, id: string): Promise<void> {
  queryClient.setQueryData<CardRow[]>(queryKeys.cardList(), (cards) => removeById(cards, id))
  queryClient.setQueriesData<CardRow[]>({ queryKey: queryKeys.dueSessions() }, (cards) =>
    removeById(cards, id),
  )
  queryClient.removeQueries({ queryKey: queryKeys.card(id) })
  queryClient.removeQueries({ queryKey: queryKeys.cardReviews(id) })
  await queryClient.invalidateQueries({ queryKey: queryKeys.dueSummary() })
}

export async function onExampleCardsAdded(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.cards() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dueSummary() }),
    refreshEmptySessions(queryClient),
  ])
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

/**
 * A saved review (or override): the card is updated in cached lists and its review history,
 * the due counts are refreshed, and running review sessions are left exactly as they are.
 */
export async function onReviewRecorded(
  queryClient: QueryClient,
  { review, card }: RecordReviewResult,
): Promise<void> {
  storeCard(queryClient, card, { inSessions: false })
  queryClient.setQueriesData<ReviewRow[]>({ queryKey: queryKeys.cardReviews(card.id) }, (reviews) =>
    reviews ? [review, ...(removeById(reviews, review.id) ?? [])] : reviews,
  )
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.dueSummary() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.cards() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.cardReviews(card.id), refetchType: 'none' }),
  ])
}
