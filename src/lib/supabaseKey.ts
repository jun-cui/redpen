// Which Supabase keys must never reach a browser. Shared by env.ts (runtime) and vite.config.ts
// (build), so it imports nothing and uses only what both have.

/**
 * True for a secret key: the new `sb_secret_` kind, or a legacy JWT with the service_role role.
 * Either one bypasses row-level security, so it must never be built into the public JavaScript.
 */
export function isSecretSupabaseKey(key: string): boolean {
  const value = key.trim()
  if (value.startsWith('sb_secret_')) return true

  const [, payload, ...rest] = value.split('.')
  if (!payload || rest.length !== 1) return false
  try {
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof claims === 'object' && claims !== null && 'role' in claims && claims.role === 'service_role'
  } catch {
    return false
  }
}
