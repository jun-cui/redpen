// Build-time configuration. Both values are public by design (RLS protects the data).

import { isSecretSupabaseKey } from './supabaseKey'

export const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? ''
export const supabaseKey: string =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/**
 * The key is a secret one. `vite build` refuses this (vite.config.ts), so it can only get here on
 * a dev server: the app shows the setup page instead of starting, and never uses the key.
 */
export const hasSecretKey = isSecretSupabaseKey(supabaseKey)

export const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseKey.length > 0 && !hasSecretKey

/**
 * Demo mode: local development without a Supabase project. Data lives in the browser
 * (localStorage) and a fake user is signed in. Never active in production builds.
 */
export const isDemoMode = import.meta.env.DEV && !isSupabaseConfigured && !hasSecretKey
