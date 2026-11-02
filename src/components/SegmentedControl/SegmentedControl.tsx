import { motion } from 'motion/react'
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { springs } from '../../lib/motion'
import { cx } from '../cx'
import styles from './SegmentedControl.module.css'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Optional icon before the label. */
  icon?: ReactNode
  /** Accessible name when the visible label is an icon or abbreviation. */
  ariaLabel?: string
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name for the group, e.g. "Theme". */
  label: string
  /** Height of the control and of each option's hit area. md: 48px (default); sm: 44px. */
  size?: 'sm' | 'md'
  /** Stretch to the container width with equal segments. */
  fullWidth?: boolean
  className?: string
}

/**
 * A row of mutually exclusive options (radiogroup semantics). Arrow keys move and select,
 * Home/End jump to the ends; the paper indicator slides between options.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  fullWidth = false,
  className,
}: SegmentedControlProps<T>) {
  const indicatorId = `segment-${useId()}`
  const buttons = useRef(new Map<T, HTMLButtonElement>())
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  )

  const select = (index: number) => {
    const option = options[(index + options.length) % options.length]
    if (!option) return
    onChange(option.value)
    buttons.current.get(option.value)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: selectedIndex + 1,
      ArrowDown: selectedIndex + 1,
      ArrowLeft: selectedIndex - 1,
      ArrowUp: selectedIndex - 1,
      Home: 0,
      End: options.length - 1,
    }
    const next = keys[event.key]
    if (next === undefined) return
    event.preventDefault()
    select(next)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(styles.group, styles[size], fullWidth && styles.full, className)}
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => {
        const checked = index === selectedIndex
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) buttons.current.set(option.value, node)
              else buttons.current.delete(option.value)
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            tabIndex={checked ? 0 : -1}
            className={styles.option}
            onClick={() => onChange(option.value)}
          >
            {checked ? <motion.span layoutId={indicatorId} className={styles.indicator} transition={springs.ui} /> : null}
            <span className={styles.content}>
              {option.icon}
              <span className={styles.text}>{option.label}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
