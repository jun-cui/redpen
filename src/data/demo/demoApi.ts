// The Api implemented entirely in the browser, for local development without Supabase.
// Only ever loaded through the dynamic import in ../index.ts, which production builds drop.

import { DEFAULT_REVIEWS_LIMIT } from '../api'
import type { Api } from '../api'
import { newUuid } from '../../lib/ids'
import {
  normalizeCardDraft,
  normalizeCardPatch,
  normalizeNewTopic,
  normalizeProfilePatch,
  normalizeTopicPatch,
  topicPositionUpdates,
} from '../normalize'
import { recordReviewArgs } from '../recordReviewArgs'
import { summarizeDue } from '../summary'
import {
  checkCard,
  checkProfile,
  checkTopic,
  DemoDbError,
  insertExampleCards,
  isDemoState,
  newCardRow,
  recordReview,
  reviewsNewestFirst,
  seedState,
} from './db'
import type { DemoState } from './db'
import { browserStorage } from './storage'
import type { StorageLike } from './storage'

export const DEMO_STORAGE_KEY = 'redpen.demo.v1'

export interface DemoApiOptions {
  /** Defaults to localStorage; falls back to memory when storage is missing or blocked. */
  storage?: StorageLike | null
  /** Simulated latency range in ms, so loading states are visible. [0, 0] disables it. */
  latencyMs?: readonly [min: number, max: number]
  /** Seed the example cards on first use (topics are always seeded). Defaults to true. */
  exampleCards?: boolean
  now?: () => Date
}

export interface DemoApi extends Api {
  /** Forget everything and start again from the seed data. */
  reset(): Promise<void>
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function notFound(what: string): DemoDbError {
  return new DemoDbError('PGRST116', 'JSON object requested, multiple (or no) rows returned', `${what} not found`)
}

export function createDemoApi(options: DemoApiOptions = {}): DemoApi {
  let storage = options.storage === undefined ? browserStorage() : options.storage
  const [minLatency, maxLatency] = options.latencyMs ?? [150, 350]
  const exampleCards = options.exampleCards ?? true
  const now = options.now ?? (() => new Date())
  let memory: DemoState | null = null

  function delay(): Promise<void> {
    if (maxLatency <= 0) return Promise.resolve()
    const ms = minLatency + Math.random() * (maxLatency - minLatency)
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function read(): DemoState {
    if (storage) {
      try {
        const raw = storage.getItem(DEMO_STORAGE_KEY)
        const parsed: unknown = raw === null ? null : JSON.parse(raw)
        if (isDemoState(parsed)) return parsed
      } catch {
        // Unreadable or corrupt: start again from the seed below.
      }
    } else if (memory) {
      return structuredClone(memory)
    }
    const seeded = seedState(now(), { exampleCards })
    write(seeded)
    return structuredClone(seeded)
  }

  function write(state: DemoState): void {
    memory = structuredClone(state)
    if (!storage) return
    try {
      storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Full or blocked: keep going in memory for the rest of the session.
      storage = null
    }
  }

  /** Runs `fn` against a fresh copy of the data and saves it only if `fn` succeeds. */
  async function transact<T>(fn: (state: DemoState, now: Date) => T): Promise<T> {
    await delay()
    const state = read()
    const result = fn(state, now())
    write(state)
    return structuredClone(result)
  }

  async function select<T>(fn: (state: DemoState, now: Date) => T): Promise<T> {
    await delay()
    return structuredClone(fn(read(), now()))
  }

  function findCard(state: DemoState, id: string) {
    const card = state.cards.find((c) => c.id === id)
    if (!card) throw notFound('Card')
    return card
  }

  function findTopic(state: DemoState, id: string) {
    const topic = state.topics.find((t) => t.id === id)
    if (!topic) throw notFound('Topic')
    return topic
  }

  return {
    getProfile: () => select((state) => state.profile),

    updateProfile: (patch) =>
      transact((state, at) => {
        const profile = { ...state.profile, ...normalizeProfilePatch(patch), updated_at: at.toISOString() }
        checkProfile(profile)
        state.profile = profile
        return profile
      }),

    listTopics: () =>
      select((state) =>
        [...state.topics].sort(
          (a, b) =>
            compareText(a.subject, b.subject) ||
            a.position - b.position ||
            a.name.localeCompare(b.name) ||
            compareText(a.id, b.id),
        ),
      ),

    createTopic: (input) =>
      transact((state, at) => {
        const values = normalizeNewTopic(input)
        const positions = state.topics.filter((t) => t.subject === values.subject).map((t) => t.position)
        const topic = {
          id: newUuid(),
          user_id: state.profile.id,
          ...values,
          position: positions.length > 0 ? Math.max(...positions) + 1 : 0,
          archived: false,
          created_at: at.toISOString(),
        }
        checkTopic(state, topic)
        state.topics.push(topic)
        return topic
      }),

    updateTopic: (id, patch) =>
      transact((state) => {
        const topic = findTopic(state, id)
        const updated = { ...topic, ...normalizeTopicPatch(patch) }
        checkTopic(state, updated)
        Object.assign(topic, updated)
        return topic
      }),

    deleteTopic: (id) =>
      transact((state) => {
        // ON DELETE SET NULL (topic_id) on cards and mistakes
        state.topics = state.topics.filter((t) => t.id !== id)
        for (const card of state.cards) if (card.topic_id === id) card.topic_id = null
        for (const mistake of state.mistakes) if (mistake.topic_id === id) mistake.topic_id = null
      }),

    reorderTopics: (subject, orderedIds) =>
      transact((state) => {
        const topics = state.topics.filter((t) => t.subject === subject)
        for (const { id, position } of topicPositionUpdates(topics, orderedIds)) {
          const topic = topics.find((t) => t.id === id)
          if (topic) topic.position = position
        }
      }),

    listCards: () =>
      select((state) =>
        [...state.cards].sort(
          (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || compareText(b.id, a.id),
        ),
      ),

    getCard: (id) => select((state) => state.cards.find((c) => c.id === id) ?? null),

    createCard: (draft) =>
      transact((state, at) => {
        const card = newCardRow(normalizeCardDraft(draft), at.toISOString())
        checkCard(state, card)
        state.cards.push(card)
        return card
      }),

    updateCard: (id, patch) =>
      transact((state, at) => {
        const card = findCard(state, id)
        const update = normalizeCardPatch(patch)
        if (Object.keys(update).length === 0) return card
        const updated = { ...card, ...update, updated_at: at.toISOString() }
        checkCard(state, updated)
        Object.assign(card, updated)
        return card
      }),

    deleteCard: (id) =>
      transact((state) => {
        // Reviews cascade; mistakes keep their text but lose the links.
        const reviewIds = new Set(state.reviews.filter((r) => r.card_id === id).map((r) => r.id))
        state.cards = state.cards.filter((c) => c.id !== id)
        state.reviews = state.reviews.filter((r) => r.card_id !== id)
        for (const mistake of state.mistakes) {
          if (mistake.card_id === id) mistake.card_id = null
          if (mistake.flashcard_id === id) mistake.flashcard_id = null
          if (mistake.review_id !== null && reviewIds.has(mistake.review_id)) mistake.review_id = null
        }
      }),

    listDueCards: ({ now: at, subject, limit }) =>
      select((state) => {
        const cutoff = at.getTime()
        const due = state.cards
          .filter((c) => !c.suspended && Date.parse(c.due) <= cutoff)
          .filter((c) => subject === undefined || c.subject === subject)
          .sort((a, b) => Date.parse(a.due) - Date.parse(b.due) || compareText(a.id, b.id))
        return limit === undefined ? due : due.slice(0, Math.max(0, limit))
      }),

    dueSummary: (at) => select((state) => summarizeDue(state.cards, at)),

    addExampleCards: () => transact((state, at) => insertExampleCards(state, at)),

    // Through the same argument mapping as supabaseApi, so both backends see identical calls.
    recordReview: (input) => transact((state, at) => recordReview(state, recordReviewArgs(input), at)),

    listReviewsForCard: (cardId, limit = DEFAULT_REVIEWS_LIMIT) =>
      select((state) => reviewsNewestFirst(state, cardId).slice(0, limit)),

    async reset() {
      await delay()
      try {
        storage?.removeItem(DEMO_STORAGE_KEY)
      } catch {
        // Nothing to clear.
      }
      memory = null
    },
  }
}

export const demoApi: DemoApi = createDemoApi()
