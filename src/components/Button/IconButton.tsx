import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cx } from '../cx'
import styles from './IconButton.module.css'

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children' | 'aria-label'> {
  /** What the button does ("Close", "Show password"). Becomes the accessible name and tooltip. */
  label: string
  /** A Lucide icon element, e.g. <X />. */
  icon: ReactNode
  /** ghost (default), secondary (outlined disc), primary (red disc). */
  variant?: 'ghost' | 'secondary' | 'primary'
  /** md shows a 40px disc, sm a 32px one; both keep a 44px hit area. */
  size?: 'sm' | 'md'
  /** Pressed/active look, for toggles. Pair with aria-pressed. */
  selected?: boolean
}

/** A round icon-only button with a 44 x 44 hit area. */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  selected = false,
  type = 'button',
  title,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cx(styles.iconButton, styles[variant], styles[size], selected && styles.selected, className)}
      {...rest}
    >
      {icon}
    </button>
  )
}
