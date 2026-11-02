// TanStack Query hooks: the only way components read or change data.
// Cache updates after saving live in ./cache, where they are tested. They patch the cache straight
// away and only then refetch, so mutations don't wait for that (`void`): TanStack awaits what
// onSuccess returns, and "Next card" would sit behind a full due-summary refetch.

import { useCallback } from 'react'
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CardRow, TopicRow } from '../lib/database.types'
import type { SubjectCode } from '../lib/types'
import { api } from './index'
import { DEFAULT_REVIEWS_LIMIT } from './api'
import type { CardDraft, CardPatch, NewTopic, ProfilePatch, RecordReviewInput, TopicPatch } from './api'
import {
  applyTopicOrder,
  dueSessionOptions,
  onCardCreated,
  onCardDeleted,
  onCardUpdated,
  onExampleCardsAdded,
  onProfileUpdated,
  onReviewRecorded,
  onTopicDeleted,
  onTopicSaved,
} from './cache'
import { queryKeys } from './keys'

export { createQueryClient } from './cache'

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function useProfile() {
  return useQuery({ queryKey: queryKeys.profile(), queryFn: () => api.getProfile() })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: ProfilePatch) => api.updateProfile(patch),
    onSuccess: (profile) => onProfileUpdated(queryClient, profile),
  })
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

/** All topics (including archived ones), or one subject's, in display order. */
export function useTopics(subject?: SubjectCode) {
  const forSubject = useCallback(
    (topics: TopicRow[]) => topics.filter((topic) => topic.subject === subject),
    [subject],
  )
  return useQuery({
    queryKey: queryKeys.topics(),
    queryFn: () => api.listTopics(),
    select: subject ? forSubject : undefined,
  })
}

export function useCreateTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (topic: NewTopic) => api.createTopic(topic),
    onSuccess: (topic) => {
      void onTopicSaved(queryClient, topic)
    },
  })
}

export function useUpdateTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TopicPatch }) => api.updateTopic(id, patch),
    onSuccess: (topic) => {
      void onTopicSaved(queryClient, topic)
    },
  })
}

export function useDeleteTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteTopic(id),
    onSuccess: (_result, id) => {
      void onTopicDeleted(queryClient, id)
    },
  })
}

/** Reorders one subject's topics; the new order shows immediately and rolls back on failure. */
export function useReorderTopics() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ subject, orderedIds }: { subject: SubjectCode; orderedIds: string[] }) =>
      api.reorderTopics(subject, orderedIds),
    onMutate: async ({ subject, orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.topics() })
      return { previous: applyTopicOrder(queryClient, subject, orderedIds) }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.topics(), context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.topics() })
    },
  })
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** All of the user's cards, including suspended ones, newest first. */
export function useCards() {
  return useQuery({ queryKey: queryKeys.cardList(), queryFn: () => api.listCards() })
}

/**
 * One card (null when it doesn't exist). Shows the copy from the card list straight away when
 * there is one.
 */
export function useCard(id: string | undefined) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.card(id ?? ''),
    queryFn: id ? () => api.getCard(id) : skipToken,
    initialData: () =>
      id
        ? queryClient.getQueryData<CardRow[]>(queryKeys.cardList())?.find((card) => card.id === id)
        : undefined,
    initialDataUpdatedAt: () => queryClient.getQueryState(queryKeys.cardList())?.dataUpdatedAt,
  })
}

export function useCreateCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (draft: CardDraft) => api.createCard(draft),
    onSuccess: (card) => {
      void onCardCreated(queryClient, card)
    },
  })
}

export function useUpdateCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CardPatch }) => api.updateCard(id, patch),
    onSuccess: (card) => {
      void onCardUpdated(queryClient, card)
    },
  })
}

/**
 * Fetches a card as it is now and puts it in the caches, review sessions included, for when it may
 * have changed on another device. Resolves to the card, or null if it no longer exists.
 */
export function useRefreshCard() {
  const queryClient = useQueryClient()
  return useCallback(
    async (id: string) => {
      const card = await api.getCard(id)
      if (card) void onCardUpdated(queryClient, card)
      return card
    },
    [queryClient],
  )
}

export function useDeleteCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteCard(id),
    onSuccess: (_result, id) => {
      void onCardDeleted(queryClient, id)
    },
  })
}

/**
 * A review session's queue: the cards due when the session started, soonest first. A snapshot
 * on purpose (see dueSessionOptions) so the queue never reshuffles mid-session. It is dropped
 * when the last component using it unmounts, so the next visit starts fresh; call `refetch()`
 * to start a new session in place.
 */
export function useDueCards({ subject, limit }: { subject?: SubjectCode; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.dueSession(subject, limit),
    queryFn: () => api.listDueCards({ now: new Date(), subject, limit }),
    ...dueSessionOptions,
  })
}

/** The cards due right now, fetched fresh. Running sessions keep their snapshot (see useDueCards). */
export function useFetchDueCards() {
  return useCallback((subject?: SubjectCode) => api.listDueCards({ now: new Date(), subject }), [])
}

/** Due counts for the home page, kept current as learning cards come due. */
export function useDueSummary() {
  return useQuery({
    queryKey: queryKeys.dueSummary(),
    queryFn: () => api.dueSummary(new Date()),
    refetchInterval: 60_000,
  })
}

/** Adds the example cards (once). Resolves to how many were added. */
export function useAddExampleCards() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.addExampleCards(),
    onSuccess: () => onExampleCardsAdded(queryClient),
  })
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

/**
 * Saves a marked answer (or, with `review_id`, an override of the latest one). The card is
 * updated in cached lists; the running review session is left exactly as it is.
 */
export function useRecordReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RecordReviewInput) => api.recordReview(input),
    onSuccess: (result) => {
      void onReviewRecorded(queryClient, result)
    },
  })
}

/** A card's reviews, newest first. */
export function useCardReviews(cardId: string | undefined, limit: number = DEFAULT_REVIEWS_LIMIT) {
  return useQuery({
    queryKey: queryKeys.cardReviewsPage(cardId ?? '', limit),
    queryFn: cardId ? () => api.listReviewsForCard(cardId, limit) : skipToken,
  })
}
