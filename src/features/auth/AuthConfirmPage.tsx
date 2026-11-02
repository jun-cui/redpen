import { ArrowLeft, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/authContext'
import type { PasswordSetupReason } from '../../auth/authContext'
import { Button, ButtonLink, Spinner } from '../../components'
import { useDocumentTitle } from '../../hooks'
import { friendlyError, OFFLINE_MESSAGE } from '../../lib/errors'
import { AuthPanel } from './AuthPanel'
import styles from './auth.module.css'

/** One verification per link, even if the page remounts: a token_hash can only be used once. */
const verifications = new Map<string, Promise<void>>()

const COPY: Record<PasswordSetupReason, { title: string; description: string; action: string }> = {
  invite: {
    title: 'Welcome to Redpen',
    description: 'Accept your invitation, then you’ll choose a password for your account.',
    action: 'Accept invitation',
  },
  recovery: {
    title: 'Reset your password',
    description: 'Confirm it’s you, then you’ll choose a new password.',
    action: 'Reset my password',
  },
}

function linkType(value: string | null): PasswordSetupReason | null {
  return value === 'invite' || value === 'recovery' ? value : null
}

interface LinkProblem {
  message: string
  /** The link may be fine: the check itself couldn't reach the server. */
  retryable: boolean
}

/**
 * /auth/confirm?token_hash=...&type=invite|recovery&next=...: the landing page for email
 * templates that use a token hash. The link is verified (which signs the person in) only when
 * they press the button: email scanners open links too, some of them running scripts, and would
 * otherwise use it up. Then on to choosing a password.
 */
export function AuthConfirmPage() {
  const { verifyEmailLink } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tokenHash = searchParams.get('token_hash')
  const type = linkType(searchParams.get('type'))
  const next = searchParams.get('next')
  const [verifying, setVerifying] = useState(false)
  const [problem, setProblem] = useState<LinkProblem | null>(null)
  useDocumentTitle(problem || !tokenHash || !type ? 'Link problem' : verifying ? 'Checking your link' : COPY[type].title)

  const verify = () => {
    if (!tokenHash || !type) return
    setProblem(null)
    setVerifying(true)
    let verification = verifications.get(tokenHash)
    if (!verification) {
      verification = verifyEmailLink(tokenHash, type)
      verifications.set(tokenHash, verification)
    }
    verification.then(
      () => navigate('/set-password', { replace: true, state: { next } }),
      (reason: unknown) => {
        const message = friendlyError(reason)
        setProblem({ message, retryable: message === OFFLINE_MESSAGE })
        setVerifying(false)
      },
    )
  }

  const retry = () => {
    if (tokenHash) verifications.delete(tokenHash)
    verify()
  }

  if (problem?.retryable) {
    return (
      <AuthPanel title="Couldn’t check your link" description={problem.message}>
        <div className={styles.actions}>
          <Button variant="primary" size="lg" fullWidth leadingIcon={<RotateCcw />} onClick={retry}>
            Try again
          </Button>
          <ButtonLink to="/login" variant="ghost" fullWidth leadingIcon={<ArrowLeft />}>
            Back to sign in
          </ButtonLink>
        </div>
      </AuthPanel>
    )
  }

  if (!tokenHash || !type || problem) {
    return (
      <AuthPanel
        title="That link didn’t work"
        description={
          problem?.message ??
          'The link is incomplete. Open it straight from the email again, or ask whoever runs Redpen for a new one.'
        }
      >
        <div className={styles.actions}>
          <ButtonLink to="/login" variant="primary" size="lg" fullWidth leadingIcon={<ArrowLeft />}>
            Back to sign in
          </ButtonLink>
          {/* A reset email works for invited accounts too, so it is a way in either way. */}
          <ButtonLink to="/forgot-password" variant="ghost" fullWidth>
            {type === 'invite' ? 'Email me a link to set a password' : 'Send me a new reset link'}
          </ButtonLink>
        </div>
      </AuthPanel>
    )
  }

  if (verifying) {
    return (
      <AuthPanel title="Checking your link" description="This only takes a moment.">
        <div className={styles.progress} role="status">
          <Spinner size="md" />
          <span>{type === 'invite' ? 'Accepting your invitation…' : 'Confirming it’s you…'}</span>
        </div>
      </AuthPanel>
    )
  }

  return (
    <AuthPanel title={COPY[type].title} description={COPY[type].description}>
      <div className={styles.actions}>
        <Button variant="primary" size="lg" fullWidth onClick={verify}>
          {COPY[type].action}
        </Button>
      </div>
    </AuthPanel>
  )
}
