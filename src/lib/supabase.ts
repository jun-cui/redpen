import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from './env'

// Without configuration the client is created against a placeholder project so that importing
// this module never throws. Nothing calls it in that case: the app shows a setup screen (or
// runs in demo mode during local development).
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'sb_publishable_placeholder'

export const supabase = createClient<Database>(
  isSupabaseConfigured ? supabaseUrl : PLACEHOLDER_URL,
  isSupabaseConfigured ? supabaseKey : PLACEHOLDER_KEY,
  {
    auth: {
      // Implicit flow on purpose: invite and recovery links generated from the Supabase
      // dashboard carry tokens in the URL fragment and cannot complete a PKCE exchange.
      flowType: 'implicit',
      // src/auth/captureAuthRedirect.ts reads those tokens instead: this client would read them
      // from the query string too, and would leave them in the browser's history.
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'redpen.auth',
    },
  },
)

export type TypedSupabaseClient = typeof supabase
