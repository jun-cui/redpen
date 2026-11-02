import { CircleAlert } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/authContext'
import { Button, Dialog, PasswordField, useToast } from '../../components'
import { friendlyError } from '../../lib/errors'
import { PASSWORD_MIN_LENGTH } from '../auth/validation'
import styles from './Settings.module.css'

interface FieldErrors {
  password?: string
  confirm?: string
}

export interface ChangePasswordDialogProps {
  open: boolean
  onClose: () => void
  /** The signed-in email, offered to password managers alongside the new password. */
  email: string | null
}

/**
 * New password and confirmation for the signed-in user. Mount it with a fresh `key` each time it
 * opens so the fields start empty.
 */
export function ChangePasswordDialog({ open, onClose, email }: ChangePasswordDialogProps) {
  const { updatePassword } = useAuth()
  const toast = useToast()
  const formId = useId()
  const passwordInput = useRef<HTMLInputElement>(null)
  const confirmInput = useRef<HTMLInputElement>(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const close = () => {
    if (!saving) onClose()
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    const next: FieldErrors = {}
    if (password.length < PASSWORD_MIN_LENGTH) {
      next.password = password ? `Use at least ${PASSWORD_MIN_LENGTH} characters.` : 'Enter a new password.'
    }
    if (!confirm) next.confirm = 'Type the new password again.'
    else if (confirm !== password) next.confirm = 'The passwords don’t match.'

    setErrors(next)
    setFormError(null)
    if (next.password) {
      passwordInput.current?.focus()
      return
    }
    if (next.confirm) {
      confirmInput.current?.focus()
      return
    }

    setSaving(true)
    try {
      await updatePassword(password)
      toast.show({ message: 'Password changed' })
      onClose()
    } catch (error) {
      setFormError(friendlyError(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!saving}
      title="Change password"
      description="Choose a new password for signing in to Redpen."
      initialFocus={passwordInput}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={saving}>
            Change password
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.passwordForm} onSubmit={submit} noValidate>
        {/* Lets password managers file the new password under the right account. */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={email ?? ''}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className="visually-hidden"
        />
        <PasswordField
          ref={passwordInput}
          label="New password"
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            if (errors.password) setErrors((current) => ({ ...current, password: undefined }))
          }}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          error={errors.password}
          disabled={saving}
        />
        <PasswordField
          ref={confirmInput}
          label="Confirm new password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => {
            setConfirm(event.target.value)
            if (errors.confirm) setErrors((current) => ({ ...current, confirm: undefined }))
          }}
          error={errors.confirm}
          disabled={saving}
        />
        {formError ? (
          <p className={styles.formError} role="alert">
            <CircleAlert aria-hidden="true" strokeWidth={2} />
            <span>{formError}</span>
          </p>
        ) : null}
      </form>
    </Dialog>
  )
}
