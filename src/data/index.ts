import { isSupabaseConfigured } from '../lib/env'
import type { Api } from './api'
import { supabaseApi } from './supabaseApi'

export type * from './api'

// Every Api method, checked by the compiler, so the deferred wrapper below can forward them.
const API_METHODS = {
  getProfile: true,
  updateProfile: true,
  listTopics: true,
  createTopic: true,
  updateTopic: true,
  deleteTopic: true,
  reorderTopics: true,
  listCards: true,
  getCard: true,
  createCard: true,
  updateCard: true,
  deleteCard: true,
  listDueCards: true,
  dueSummary: true,
  addExampleCards: true,
  recordReview: true,
  listReviewsForCard: true,
} satisfies Record<keyof Api, true>

/** An Api whose implementation is imported the first time a method is called. */
function deferred(load: () => Promise<Api>): Api {
  let loading: Promise<Api> | undefined
  const methods: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
  for (const name of Object.keys(API_METHODS) as (keyof Api)[]) {
    methods[name] = async (...args) => {
      const impl = await (loading ??= load())
      const method = impl[name] as (...args: unknown[]) => Promise<unknown>
      return method.apply(impl, args)
    }
  }
  return methods as unknown as Api
}

/**
 * The app's backend. Demo mode (a dev server without Supabase settings) swaps in the
 * in-browser implementation. `import.meta.env.DEV` is a build-time constant, so production
 * builds drop this branch and the demo module along with it.
 */
export const api: Api =
  import.meta.env.DEV && !isSupabaseConfigured
    ? deferred(() => import('./demo/demoApi').then((module) => module.demoApi))
    : supabaseApi
