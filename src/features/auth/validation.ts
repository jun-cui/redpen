import { useMediaQuery } from '../../hooks'

/** Redpen asks for this many characters; README Step 6 sets Supabase's minimum password length to match (its default is 6). */
export const PASSWORD_MIN_LENGTH = 8

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** An error message for the email field, or undefined when it looks fine. */
export function emailError(email: string): string | undefined {
  const value = email.trim()
  if (!value) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(value)) return 'Enter a full email address, like name@example.com.'
  return undefined
}

/** The address someone typed on one auth screen, carried to the next in router state. */
export function emailFromState(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'email' in state) {
    const { email } = state as { email: unknown }
    if (typeof email === 'string') return email
  }
  return ''
}

/**
 * Focus the first field straight away only with a mouse or trackpad: on a phone it would throw
 * up the keyboard over the screen before the person has read it.
 */
export function useAutoFocusField(): boolean {
  return useMediaQuery('(pointer: fine)')
}
