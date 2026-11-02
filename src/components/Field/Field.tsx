import { CircleAlert } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cx } from '../cx'
import styles from './Field.module.css'

/** Props a Field hands to its control so the label, hint and error are wired up. */
export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

/** Label, hint and error options shared by every form control. */
export interface FieldOwnProps {
  /** Visible label. Required: every control needs a name. */
  label: ReactNode
  /** Help text under the control. Replaced by the error while there is one. */
  hint?: ReactNode
  /** Error message (calm, specific, no exclamation marks). Marks the control invalid. */
  error?: ReactNode
  /** Adds a quiet "Optional" after the label. */
  optional?: boolean
  /** Hide the label visually; screen readers still announce it. */
  hideLabel?: boolean
  /** Content at the end of the label row, e.g. a "Forgot password?" link. */
  labelAside?: ReactNode
}

export interface FieldProps extends FieldOwnProps {
  /** id for the control; generated when omitted. */
  id?: string
  className?: string
  /** Renders the control, spreading the given props onto it. */
  children: (control: FieldControlProps) => ReactNode
}

/** Joins aria-describedby ids, skipping empty ones. */
export function describedBy(...ids: Array<string | undefined>): string | undefined {
  const joined = ids.filter(Boolean).join(' ')
  return joined || undefined
}

/**
 * Lays out a label, a control, and a hint or error, and wires them together with htmlFor,
 * aria-describedby and aria-invalid. Use it directly for custom controls:
 *
 * <Field label="Topic" error={error}>{(control) => <TopicPicker {...control} />}</Field>
 */
export function Field({ label, hint, error, optional, hideLabel, labelAside, id, className, children }: FieldProps) {
  const generated = useId()
  const controlId = id ?? `field${generated}`
  const hasError = error !== undefined && error !== null && error !== false && error !== ''
  const messageId = `${controlId}-message`
  const showHint = !hasError && hint !== undefined && hint !== null

  return (
    <div className={cx(styles.field, className)}>
      <div className={styles.labelRow}>
        <label htmlFor={controlId} className={cx(styles.label, hideLabel && 'visually-hidden')}>
          {label}
          {optional ? <span className={styles.optional}>Optional</span> : null}
        </label>
        {labelAside ? <span className={styles.labelAside}>{labelAside}</span> : null}
      </div>
      {children({
        id: controlId,
        'aria-describedby': hasError || showHint ? messageId : undefined,
        'aria-invalid': hasError ? true : undefined,
      })}
      {hasError ? (
        <p id={messageId} className={styles.error}>
          <CircleAlert aria-hidden="true" strokeWidth={2} />
          <span>{error}</span>
        </p>
      ) : showHint ? (
        <p id={messageId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
