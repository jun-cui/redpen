import { AuthSessionMissingError, PostgrestError } from '@supabase/supabase-js'
import { isUuid } from '../lib/ids'
import { supabase } from '../lib/supabase'
import { DEFAULT_REVIEWS_LIMIT } from './api'
import type { Api } from './api'
import {
  normalizeCardDraft,
  normalizeCardPatch,
  normalizeNewTopic,
  normalizeProfilePatch,
  normalizeTopicPatch,
  topicPositionUpdates,
} from './normalize'
import { recordReviewArgs } from './recordReviewArgs'
import { summarizeDue } from './summary'

/** Supabase caps rows per request (1000 by default), so long lists are fetched in pages. */
const PAGE_SIZE = 1000

type ErrorLike = Pick<PostgrestError, 'message' | 'details' | 'hint' | 'code'>

/** Rethrows a PostgREST error as a PostgrestError (it can arrive as a plain object). */
function raise(error: ErrorLike): never {
  throw error instanceof Error ? error : new PostgrestError(error)
}

async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: ErrorLike | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) raise(error)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) return rows
  }
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const id = data.session?.user.id
  if (!id) throw new AuthSessionMissingError()
  return id
}

export const supabaseApi: Api = {
  async getProfile() {
    const userId = await currentUserId()
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (error) raise(error)
    return data
  },

  async updateProfile(patch) {
    const userId = await currentUserId()
    const { data, error } = await supabase
      .from('profiles')
      .update(normalizeProfilePatch(patch))
      .eq('id', userId)
      .select()
      .single()
    if (error) raise(error)
    return data
  },

  async listTopics() {
    return fetchAllPages((from, to) =>
      supabase
        .from('topics')
        .select('*')
        .order('subject')
        .order('position')
        .order('name')
        .order('id')
        .range(from, to),
    )
  },

  async createTopic(topic) {
    const values = normalizeNewTopic(topic)
    const { data: last, error: lastError } = await supabase
      .from('topics')
      .select('position')
      .eq('subject', values.subject)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastError) raise(lastError)

    const { data, error } = await supabase
      .from('topics')
      .insert({ ...values, position: last ? last.position + 1 : 0 })
      .select()
      .single()
    if (error) raise(error)
    return data
  },

  async updateTopic(id, patch) {
    const update = normalizeTopicPatch(patch)
    const query =
      Object.keys(update).length > 0
        ? supabase.from('topics').update(update).eq('id', id).select().single()
        : supabase.from('topics').select('*').eq('id', id).single()
    const { data, error } = await query
    if (error) raise(error)
    return data
  },

  async deleteTopic(id) {
    const { error } = await supabase.from('topics').delete().eq('id', id)
    if (error) raise(error)
  },

  async reorderTopics(subject, orderedIds) {
    const { data: current, error } = await supabase
      .from('topics')
      .select('id, position, name')
      .eq('subject', subject)
    if (error) raise(error)

    const updates = topicPositionUpdates(current, orderedIds)
    const results = await Promise.all(
      updates.map(({ id, position }) => supabase.from('topics').update({ position }).eq('id', id)),
    )
    const failed = results.find((result) => result.error)
    if (failed?.error) raise(failed.error)
  },

  async listCards() {
    return fetchAllPages((from, to) =>
      supabase
        .from('cards')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to),
    )
  },

  async getCard(id) {
    // A malformed id (say, from a hand-typed URL) can't match a card; Postgres would reject it.
    if (!isUuid(id)) return null
    const { data, error } = await supabase.from('cards').select('*').eq('id', id).maybeSingle()
    if (error) raise(error)
    return data
  },

  async createCard(draft) {
    const { data, error } = await supabase
      .from('cards')
      .insert(normalizeCardDraft(draft))
      .select()
      .single()
    if (error) raise(error)
    return data
  },

  async updateCard(id, patch) {
    const update = normalizeCardPatch(patch)
    const query =
      Object.keys(update).length > 0
        ? supabase.from('cards').update(update).eq('id', id).select().single()
        : supabase.from('cards').select('*').eq('id', id).single()
    const { data, error } = await query
    if (error) raise(error)
    return data
  },

  async deleteCard(id) {
    const { error } = await supabase.from('cards').delete().eq('id', id)
    if (error) raise(error)
  },

  async listDueCards({ now, subject, limit }) {
    const dueCards = () => {
      const query = supabase
        .from('cards')
        .select('*')
        .eq('suspended', false)
        .lte('due', now.toISOString())
        .order('due')
        .order('id')
      return subject ? query.eq('subject', subject) : query
    }

    if (limit !== undefined && limit <= PAGE_SIZE) {
      const { data, error } = await dueCards().limit(Math.max(0, limit))
      if (error) raise(error)
      return data
    }
    const rows = await fetchAllPages((from, to) => dueCards().range(from, to))
    return limit !== undefined ? rows.slice(0, limit) : rows
  },

  async dueSummary(now) {
    const cards = await fetchAllPages((from, to) =>
      supabase.from('cards').select('subject, due, suspended, category').order('id').range(from, to),
    )
    return summarizeDue(cards, now)
  },

  async addExampleCards() {
    const { data, error } = await supabase.rpc('add_example_cards')
    if (error) raise(error)
    return data
  },

  async recordReview(input) {
    const { data, error } = await supabase.rpc('record_review', recordReviewArgs(input))
    if (error) raise(error)
    return data
  },

  async listReviewsForCard(cardId, limit = DEFAULT_REVIEWS_LIMIT) {
    if (!isUuid(cardId)) return []
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('card_id', cardId)
      .order('reviewed_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)
    if (error) raise(error)
    return data
  },
}
