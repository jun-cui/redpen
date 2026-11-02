// TanStack Query keys. Review sessions live under their own root, apart from `cards`, so
// invalidating cards after a review never reshuffles the queue being worked through.

import type { SubjectCode } from '../lib/types'

export const queryKeys = {
  all: ['redpen'] as const,
  profile: () => ['redpen', 'profile'] as const,
  topics: () => ['redpen', 'topics'] as const,
  /** Prefix of every card query below. */
  cards: () => ['redpen', 'cards'] as const,
  cardList: () => ['redpen', 'cards', 'list'] as const,
  card: (id: string) => ['redpen', 'cards', 'detail', id] as const,
  /** Prefix of every review-session snapshot. */
  dueSessions: () => ['redpen', 'due-session'] as const,
  dueSession: (subject?: SubjectCode, limit?: number) =>
    ['redpen', 'due-session', { subject: subject ?? null, limit: limit ?? null }] as const,
  dueSummary: () => ['redpen', 'due-summary'] as const,
  /** Prefix of every review-history query. */
  reviews: () => ['redpen', 'reviews'] as const,
  /** Prefix of one card's review-history queries (one per limit). */
  cardReviews: (cardId: string) => ['redpen', 'reviews', cardId] as const,
  cardReviewsPage: (cardId: string, limit: number) => ['redpen', 'reviews', cardId, limit] as const,
}
