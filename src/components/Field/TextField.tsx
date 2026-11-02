import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentPropsWithRef, type ReactNode } from 'react'
import { IconButton } from '../Button/IconButton'
import { cx } from '../cx'
import { describedBy, Field, type FieldOwnProps } from './Field'
import styles from './Field.module.css'

export interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'size'>, FieldOwnProps {
  /** Icon inside the field, before the text. */
  leading?: ReactNode
  /** Content inside the field, after the text (e.g. an IconButton). */
  trailing?: ReactNode
  /** Class for the outer field (label + control + message). */
  className?: string
  /** Class for the <input> itself. */
  inputClassName?: string
}

/** A labelled single-line text input (16px text, 48px tall). */
export function TextField({
  label,
  hint,
  error,
  optional,
  hideLabel,
  labelAside,
  leading,
  trailing,
  id,
  className,
  inputClassName,
  disabled,
  'aria-describedby': ariaDescribedBy,
  ...inputProps
}: TextFieldProps) {
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
        <div
          className={cx(
            styles.control,
            control['aria-invalid'] && styles.invalid,
            disabled && styles.disabled,
            leading !== undefined && styles.hasLeading,
            trailing !== undefined && styles.hasTrailing,
          )}
        >
          {leading !== undefined ? (
            <span className={styles.leading} aria-hidden="true">
              {leading}
            </span>
          ) : null}
          <input
            {...inputProps}
            {...control}
            aria-describedby={describedBy(control['aria-describedby'], ariaDescribedBy)}
            disabled={disabled}
            className={cx(styles.input, inputClassName)}
          />
          {trailing !== undefined ? <span className={styles.trailing}>{trailing}</span> : null}
        </div>
      )}
    </Field>
  )
}

export type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'trailing'>

/** A password input with a show/hide toggle. Pass autoComplete ("current-password" or "new-password"). */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <IconButton
          size="sm"
          label={visible ? 'Hide password' : 'Show password'}
          icon={visible ? <EyeOff /> : <Eye />}
          onClick={() => setVisible((v) => !v)}
          disabled={props.disabled}
        />
      }
    />
  )
}
