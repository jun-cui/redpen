// The auth contract the rest of the app codes against. AuthProvider (./AuthProvider.tsx)
// supplies the value; components read it with useAuth().

import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut'

/** Why a signed-in user must choose a password before carrying on. */
export type PasswordSetupReason = 'invite' | 'recovery'

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  session: Session | null
  /** Set after following an invite or password-reset link, until a new password is saved. */
  passwordSetup: PasswordSetupReason | null
  /** Friendly message for a failed email link (e.g. expired), shown on the login page. */
  linkError: string | null
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  /** Emails a reset link. Resolves the same way whether or not the account exists. */
  sendPasswordReset(email: string): Promise<void>
  /** Sets a new password for the signed-in user and clears passwordSetup. */
  updatePassword(password: string): Promise<void>
  /** Verifies an emailed token_hash link (/auth/confirm) and signs the user in. */
  verifyEmailLink(tokenHash: string, type: PasswordSetupReason): Promise<void>
  clearLinkError(): void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth() must be used inside <AuthProvider>')
  return value
}
