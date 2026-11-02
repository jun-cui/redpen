import { ArrowLeft } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { useAuth } from '../../auth/authContext'
import { Button, ButtonLink, PenTick, TextField } from '../../components'
import { useDocumentTitle } from '../../hooks'
import { friendlyError } from '../../lib/errors'
import { AuthNotice, AuthPanel } from './AuthPanel'
import { emailError, emailFromState, useAutoFocusField } from './validation'
import styles from './auth.module.css'

/** Asks for a reset link. Answers the same way whether or not the address has an account. */
export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth()
  const location = useLocation()
  const autoFocus = useAutoFocusField()
  const [email, setEmail] = useState(() => emailFromState(location.state))
  const [fieldError, setFieldError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  useDocumentTitle(sentTo ? 'Check your email' : 'Reset your password')

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending) return
    const problem = emailError(email)
    if (problem) {
      setFieldError(problem)
      emailRef.current?.focus()
      return
    }
    setFieldError(undefined)
    setFormError(undefined)
    setSending(true)
    try {
      await sendPasswordReset(email)
      setSentTo(email.trim())
    } catch (error) {
      setFormError(friendlyError(error))
    } finally {
      setSending(false)
    }
  }

  if (sentTo) {
    return (
      <AuthPanel
        art={<PenTick size={40} seed={sentTo} />}
        title="Check your email"
        description={
          <>
            <p>
              If there’s an account for that address, a reset link is on its way. The link works once and expires
              after a while, so use the newest email.
            </p>
            <p className={styles.sentTo}>
              Sent to <strong>{sentTo}</strong>
            </p>
          </>
        }
        footer={<p>Nothing after a few minutes? Check your spam folder, then try again.</p>}
      >
        <div className={styles.actions}>
          <ButtonLink to="/login" state={{ email: sentTo }} variant="secondary" size="lg" fullWidth leadingIcon={<ArrowLeft />}>
            Back to sign in
          </ButtonLink>
          <Button variant="ghost" fullWidth onClick={() => setSentTo(null)}>
            Use a different address
          </Button>
        </div>
      </AuthPanel>
    )
  }

  return (
    <AuthPanel
      title="Reset your password"
      description="Enter the email address you use for Redpen and we’ll send you a link to choose a new password."
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <TextField
          ref={emailRef}
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={email}
          error={fieldError}
          onChange={(event) => {
            setEmail(event.target.value)
            if (fieldError) setFieldError(undefined)
            if (formError) setFormError(undefined)
          }}
        />

        {formError ? <AuthNotice>{formError}</AuthNotice> : null}

        <div className={styles.actions}>
          <Button type="submit" variant="primary" size="lg" fullWidth loading={sending}>
            Send reset link
          </Button>
          <ButtonLink to="/login" state={{ email: email.trim() }} variant="ghost" fullWidth leadingIcon={<ArrowLeft />}>
            Back to sign in
          </ButtonLink>
        </div>
      </form>
    </AuthPanel>
  )
}
