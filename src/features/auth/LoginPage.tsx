import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../../auth/authContext'
import { Button, PasswordField, TextField } from '../../components'
import { useDocumentTitle } from '../../hooks'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { isDemoMode } from '../../lib/env'
import { friendlyError } from '../../lib/errors'
import { AuthNotice, AuthPanel } from './AuthPanel'
import { emailError, emailFromState, useAutoFocusField } from './validation'
import styles from './auth.module.css'

interface LoginErrors {
  email?: string
  password?: string
  form?: string
}

/** Email and password sign-in. There is no sign-up: accounts are by invitation. */
export function LoginPage() {
  useDocumentTitle('Sign in')
  const { signIn, linkError, clearLinkError } = useAuth()
  const online = useOnlineStatus()
  const location = useLocation()
  const autoFocus = useAutoFocusField()
  const [email, setEmail] = useState(() => emailFromState(location.state))
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    const found: LoginErrors = {
      email: emailError(email),
      password: password ? undefined : 'Enter your password.',
    }
    if (found.email || found.password) {
      setErrors(found)
      ;(found.email ? emailRef : passwordRef).current?.focus()
      return
    }

    setErrors({})
    clearLinkError()
    setSubmitting(true)
    try {
      await signIn(email, password)
      // Signed in: the PublicOnly guard takes the person on into the app.
    } catch (error) {
      setErrors({ form: friendlyError(error) })
      setSubmitting(false)
      passwordRef.current?.select()
    }
  }

  return (
    <AuthPanel
      title="Sign in"
      description="Welcome back. Your cards are waiting where you left them."
      footer={<p>Redpen is invite-only. Ask whoever runs it to invite you.</p>}
    >
      {linkError ? <AuthNotice onDismiss={clearLinkError}>{linkError}</AuthNotice> : null}
      {online ? null : (
        <AuthNotice tone="info">You’re offline. Connect to the internet to sign in.</AuthNotice>
      )}
      {import.meta.env.DEV && isDemoMode ? (
        <AuthNotice tone="info">Demo mode: any email and password will do. Cards stay in this browser.</AuthNotice>
      ) : null}

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
          autoFocus={autoFocus && !email}
          value={email}
          error={errors.email}
          onChange={(event) => {
            setEmail(event.target.value)
            if (errors.email || errors.form) setErrors((current) => ({ ...current, email: undefined, form: undefined }))
          }}
        />
        <PasswordField
          ref={passwordRef}
          label="Password"
          name="password"
          autoComplete="current-password"
          autoFocus={autoFocus && Boolean(email)}
          value={password}
          error={errors.password}
          labelAside={
            <Link to="/forgot-password" state={{ email: email.trim() }} className={styles.asideLink}>
              Forgot password?
            </Link>
          }
          onChange={(event) => {
            setPassword(event.target.value)
            if (errors.password || errors.form) setErrors((current) => ({ ...current, password: undefined, form: undefined }))
          }}
        />

        {errors.form ? <AuthNotice>{errors.form}</AuthNotice> : null}

        <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
          Sign in
        </Button>
      </form>
    </AuthPanel>
  )
}
