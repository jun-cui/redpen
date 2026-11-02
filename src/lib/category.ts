// Card categories, mirroring SQL public.compute_card_category (supabase/migrations):
//   new      : never reviewed
//   mastered : full marks on each of the last 3 reviews and an FSRS interval over 21 days
//   weak     : last mark under 50%, or rated Again 2+ times in the last 5 reviews
//   learning : everything in between
// Mastered is checked before weak: three perfect answers in a row outweigh older lapses.

import type { ReviewRow } from './database.types'
import type { CardCategory } from './types'

export type CategoryReview = Pick<ReviewRow, 'points_hit' | 'points_total'> & { rating: number }

export const MASTERED_MIN_INTERVAL_DAYS = 21

export const CATEGORY_ORDER: readonly CardCategory[] = ['new', 'weak', 'learning', 'mastered']

export const CATEGORY_LABELS: Record<CardCategory, string> = {
  new: 'New',
  weak: 'Weak',
  learning: 'Learning',
  mastered: 'Mastered',
}

/**
 * @param recentReviewsNewestFirst the card's reviews ordered by reviewed_at desc, id desc
 *   (only the first 5 are considered)
 * @param scheduledDays the card's FSRS scheduled_days after its latest review
 */
export function computeCategory(
  recentReviewsNewestFirst: readonly CategoryReview[],
  scheduledDays: number,
): CardCategory {
  const recent = recentReviewsNewestFirst.slice(0, 5)
  const latest = recent[0]
  if (!latest) return 'new'

  const lastThree = recent.slice(0, 3)
  const fullMarksOnLastThree =
    lastThree.length === 3 && lastThree.every((r) => r.points_hit === r.points_total)
  if (fullMarksOnLastThree && (scheduledDays || 0) > MASTERED_MIN_INTERVAL_DAYS) return 'mastered'

  const latestFraction = latest.points_total > 0 ? latest.points_hit / latest.points_total : 0
  const agains = recent.filter((r) => r.rating === 1).length
  if (latestFraction < 0.5 || agains >= 2) return 'weak'

  return 'learning'
}
