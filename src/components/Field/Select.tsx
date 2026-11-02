import { ChevronDown } from 'lucide-react'
import type { ComponentPropsWithRef } from 'react'
import { cx } from '../cx'
import { describedBy, Field, type FieldOwnProps } from './Field'
import styles from './Field.module.css'

export interface SelectProps extends Omit<ComponentPropsWithRef<'select'>, 'size' | 'multiple'>, FieldOwnProps {
  /** Shown as a disabled first option while nothing is chosen (value ""). */
  placeholder?: string
  /** Class for the outer field (label + control + message). */
  className?: string
  /** Class for the <select> itself. */
  selectClassName?: string
}

/** A labelled native select (the platform picker on phones), styled to match the text fields. */
export function Select({
  label,
  hint,
  error,
  optional,
  hideLabel,
  labelAside,
  placeholder,
  id,
  className,
  selectClassName,
  disabled,
  children,
  'aria-describedby': ariaDescribedBy,
  ...selectProps
}: SelectProps) {
  const showingPlaceholder = placeholder !== undefined && (selectProps.value ?? selectProps.defaultValue ?? '') === ''
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      hideLabel={hideLabel}
      labelAside={labelAside}
      id={id}
      className={className}
    >
      {(control) => (
        <div className={cx(styles.control, control['aria-invalid'] && styles.invalid, disabled && styles.disabled)}>
          <select
            {...selectProps}
            {...control}
            disabled={disabled}
            aria-describedby={describedBy(control['aria-describedby'], ariaDescribedBy)}
            className={cx(styles.input, styles.select, showingPlaceholder && styles.placeholder, selectClassName)}
          >
            {placeholder !== undefined ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {children}
          </select>
          <ChevronDown className={styles.chevron} aria-hidden="true" strokeWidth={1.75} />
        </div>
      )}
    </Field>
  )
}
