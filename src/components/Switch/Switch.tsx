import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import { cx } from '../cx'
import styles from './Switch.module.css'

export interface SwitchProps extends Omit<ComponentPropsWithRef<'button'>, 'onChange' | 'children' | 'value'> {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Visible label; the whole row toggles the switch. */
  label: ReactNode
  /** Extra explanation under the label. */
  description?: ReactNode
  /** Hide the label visually (screen readers still announce it). */
  hideLabel?: boolean
}

/** An on/off setting (role="switch"), laid out as a full-width row: label left, switch right. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  hideLabel = false,
  disabled,
  className,
  id,
  ...rest
}: SwitchProps) {
  const generated = useId()
  const switchId = id ?? `switch${generated}`
  const labelId = `${switchId}-label`
  const descriptionId = description ? `${switchId}-description` : undefined

  return (
    <label className={cx(styles.row, disabled && styles.disabled, className)} htmlFor={switchId}>
      <span className={cx(styles.text, hideLabel && 'visually-hidden')}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className={styles.description}>
            {description}
          </span>
        ) : null}
      </span>
      <button
        {...rest}
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        disabled={disabled}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.track} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
      </button>
    </label>
  )
}
