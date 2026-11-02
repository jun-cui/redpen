import type { ComponentPropsWithRef, MouseEvent, ReactNode } from 'react'
import { cx } from '../cx'
import { Spinner } from '../Spinner/Spinner'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

/** Visual options shared by Button and ButtonLink. */
export interface ButtonStyleProps {
  /** primary = red fill (the one main action), secondary = ink outline (default), ghost, danger. */
  variant?: ButtonVariant
  /** sm 44px, md 48px (default), lg 56px tall. */
  size?: ButtonSize
  /** Icon before the label, e.g. <Plus />. Sized to the text. */
  leadingIcon?: ReactNode
  /** Icon after the label, e.g. <ArrowRight />. */
  trailingIcon?: ReactNode
  /** Stretch to the container's width. */
  fullWidth?: boolean
}

/** Class names for a button-styled element (for wrapping other components). */
export function buttonClassName({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  loading = false,
  className,
}: Pick<ButtonStyleProps, 'variant' | 'size' | 'fullWidth'> & { loading?: boolean; className?: string }): string {
  return cx(styles.button, styles[variant], styles[size], fullWidth && styles.full, loading && styles.loading, className)
}

/** The inside of a button: icons either side of a label that truncates rather than wraps. */
export function ButtonContent({
  leadingIcon,
  trailingIcon,
  children,
}: Pick<ButtonStyleProps, 'leadingIcon' | 'trailingIcon'> & { children?: ReactNode }) {
  return (
    <span className={styles.content}>
      {leadingIcon ? (
        <span className={styles.icon} aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      {children !== undefined && children !== null ? <span className={styles.label}>{children}</span> : null}
      {trailingIcon ? (
        <span className={styles.icon} aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}
    </span>
  )
}

export interface ButtonProps extends ComponentPropsWithRef<'button'>, ButtonStyleProps {
  /** Shows a spinner, sets aria-busy and ignores clicks, keeping the button's size and focus. */
  loading?: boolean
}

/**
 * A button. Defaults to the secondary (ink outline) style so red is always a deliberate choice:
 * use variant="primary" for the single main action on a screen.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  loading = false,
  type = 'button',
  className,
  children,
  onClick,
  'aria-disabled': ariaDisabled,
  ...rest
}: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Loading buttons stay focusable (disabling would drop focus) but must not act twice;
    // cancelling the click also cancels a form submit.
    if (loading) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, fullWidth, loading, className })}
      aria-busy={loading || undefined}
      aria-disabled={loading || ariaDisabled || undefined}
      onClick={handleClick}
      {...rest}
    >
      <ButtonContent leadingIcon={leadingIcon} trailingIcon={trailingIcon}>
        {children}
      </ButtonContent>
      {loading ? (
        <span className={styles.spinner}>
          <Spinner size={size === 'lg' ? 'md' : 'sm'} />
        </span>
      ) : null}
    </button>
  )
}
