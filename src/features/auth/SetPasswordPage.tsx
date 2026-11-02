import { Check } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../auth/authContext'
import type { PasswordSetupReason } from '../../auth/authContext'
import { navigateOrHome, safeNextPath } from '../../auth/authFlow'
import { Button, ButtonLink, PasswordField, useToast } from '../../components'
import { useDocumentTitle } from '../../hooks'
import { friendlyError } from '../../lib/errors'
import { AuthNotice, AuthPanel } from './AuthPanel'
import { PASSWORD_MIN_LENGTH, useAutoFocusField } from './validation'
import styles from './auth.module.css'

interface Copy {
  title: string
  description: (email: string | undefined) => string
}

const COPY: Record<PasswordSetupReason | 'change', Copy> = {
  invite: {
    title: 'Choose a password',
    description: (email) =>
      `Welcome to Redpen. Choose a password to finish setting up your account${email ? ` for ${email}` : ''}. You’ll use it to sign in on any device.`,
  },
  recovery: {
    title: 'Set a new password',
    description: (email) =>
      `Choose a new password${email ? ` for ${email}` : ''}. You’ll stay signed in on this device.`,
  },
  change: {
    title: 'Change your password',
    description: (email) => `Choose a new password${email ? ` for ${email}` : ''}.`,
  },
}

function nextFromState(state: unknown): string | null {
  if (typeof state === 'object' && state !== null && 'next' in state) {
    const { next } = state as { next: unknown }
    return typeof next === 'string' ? safeNextPath(next) : null
  }
  return null
}

function lengthHint(password: string) {
  if (!password) return `At least ${PASSWORD_MIN_LENGTH} characters.`
  const remaining = PASSWORD_MIN_LENGTH - [...password].length
  if (remaining > 0) return `${remaining} more character${remaining === 1 ? '' : 's'} to go.`
  return (
    <span className={styles.hintOk}>
      <Check aria-hidden="true" className={styles.inlineIcon} />
      Long enough.
    </span>
  )
}

/**
 * Choose a password after following an invite or reset link (the guards send people here until
 * they do), or change it from settings.
 */
export function SetPasswordPage() {
  const { passwordSetup, user, updatePassword, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const autoFocus = useAutoFocusField()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordError, setPasswordError] = useState<string>()
  const [confirmError, setConfirmError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  /** Saving clears passwordSetup; keep the screen's wording steady until it has gone. */
  const [savedReason, setSavedReason] = useState<PasswordSetupReason | null | undefined>(undefined)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  const reason = savedReason === undefined ? passwordSetup : savedReason
  const copy = COPY[reason ?? 'change']
  useDocumentTitle(copy.title)
  const email = user?.email

  const checkConfirm = (value: string) =>
    value && value !== password ? 'Those passwords don’t match. Type the same one in both boxes.' : undefined

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const tooShort = [...password].length < PASSWORD_MIN_LENGTH
    const nextPasswordError = !password
      ? 'Choose a password.'
      : tooShort
        ? `Use at least ${PASSWORD_MIN_LENGTH} characters.`
        : undefined
    const nextConfirmError = !confirm ? 'Type the password again to confirm it.' : checkConfirm(confirm)
    if (nextPasswordError || nextConfirmError) {
      setPasswordError(nextPasswordError)
      setConfirmError(nextConfirmError)
      ;(nextPasswordError ? passwordRef : confirmRef).current?.focus()
      return
    }

    setFormError(undefined)
    setSaving(true)
    setSavedReason(passwordSetup)
    try {
      await updatePassword(password)
      toast.show({ message: 'Password saved' })
      await navigateOrHome(navigate, nextFromState(location.state) ?? '/')
    } catch (error) {
      setSavedReason(undefined)
      setSaving(false)
      setFormError(friendlyError(error))
    }
  }

  const onSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      setSigningOut(false)
      setFormError(friendlyError(error))
    }
  }

  return (
    <AuthPanel
      title={copy.title}
      description={copy.description(email)}
      footer={
        reason ? (
          <p>
            Not you?{' '}
            <button type="button" className={styles.textButton} onClick={onSignOut} disabled={signingOut}>
              Sign out
            </button>
          </p>
        ) : null
      }
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {/* Lets password managers save the new password against the right account. */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={email ?? ''}
          readOnly
          hidden
        />
        <PasswordField
          ref={passwordRef}
          label="New password"
          name="new-password"
          autoComplete="new-password"
          autoFocus={autoFocus}
          value={password}
          hint={lengthHint(password)}
          error={passwordError}
          onChange={(event) => {
            setPassword(event.target.value)
            if (passwordError) setPasswordError(undefined)
            if (formError) setFormError(undefined)
            if (confirmError && confirm === event.target.value) setConfirmError(undefined)
          }}
        />
        <PasswordField
          ref={confirmRef}
          label="Confirm new password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          error={confirmError}
          onChange={(event) => {
            setConfirm(event.target.value)
            if (confirmError) setConfirmError(undefined)
            if (formError) setFormError(undefined)
          }}
          onBlur={() => setConfirmError(checkConfirm(confirm))}
        />

        {formError ? <AuthNotice>{formError}</AuthNotice> : null}

        <div className={styles.actions}>
          <Button type="submit" variant="primary" size="lg" fullWidth loading={saving}>
            Save password
          </Button>
          {reason ? null : (
            <ButtonLink to="/settings" variant="ghost" fullWidth>
              Cancel
            </ButtonLink>
          )}
        </div>
      </form>
    </AuthPanel>
  )
}
