import { describe, expect, it } from 'vitest'
import { isSupabaseConfigured } from '../lib/env'
import { api } from './index'
import { supabaseApi } from './supabaseApi'

// Production builds never contain the demo: `npx vite build` and search dist/ for "redpen.demo".
describe('api', () => {
  it.skipIf(isSupabaseConfigured)('runs in the browser during development without Supabase settings', async () => {
    expect(import.meta.env.DEV).toBe(true)
    expect(api).not.toBe(supabaseApi)
    const [topics, profile] = await Promise.all([api.listTopics(), api.getProfile()])
    expect(topics.length).toBeGreaterThan(0)
    expect(profile.desired_retention).toBe(0.9)
  })

  it.runIf(isSupabaseConfigured)('uses Supabase once it is configured', () => {
    expect(api).toBe(supabaseApi)
  })
})
