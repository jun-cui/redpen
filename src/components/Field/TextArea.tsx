import { useCallback, useLayoutEffect, useRef, type ComponentPropsWithRef, type Ref } from 'react'
import { cx } from '../cx'
import { describedBy, Field, type FieldOwnProps } from './Field'
import styles from './Field.module.css'

export interface TextAreaProps extends ComponentPropsWithRef<'textarea'>, FieldOwnProps {
  /** Grow with the content instead of scrolling. */
  autoGrow?: boolean
  /** With autoGrow, stop growing (and scroll) after this many lines. */
  maxRows?: number
  /** Class for the outer field (label + control + message). */
  className?: string
  /** Class for the <textarea> itself. */
  textareaClassName?: string
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}

/** A labelled multi-line input (16px+ text). With autoGrow it fits its content. */
export function TextArea({
  label,
  hint,
  error,
  optional,
  hideLabel,
  labelAside,
  autoGrow = false,
  maxRows,
  rows = 3,
  id,
  ref,
  className,
  textareaClassName,
  disabled,
  value,
  onInput,
  'aria-describedby': ariaDescribedBy,
  ...textareaProps
}: TextAreaProps) {
  const element = useRef<HTMLTextAreaElement | null>(null)

  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      element.current = node
      assignRef(ref, node)
    },
    [ref],
  )

  const fit = useCallback(() => {
    const node = element.current
    if (!node || !autoGrow) return
    const style = window.getComputedStyle(node)
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.65
    const max = maxRows ? line * maxRows + padding + border : Infinity
    node.style.height = 'auto'
    const wanted = node.scrollHeight + border
    node.style.height = `${Math.min(wanted, max)}px`
    // Past maxRows the box stops growing and scrolls instead.
    node.style.overflowY = wanted > max ? 'auto' : 'hidden'
  }, [autoGrow, maxRows])

  // Controlled value changes (including programmatic resets) refit before paint.
  useLayoutEffect(() => {
    fit()
  }, [fit, value])

  const handleInput: TextAreaProps['onInput'] = (event) => {
    fit()
    onInput?.(event)
  }

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
            styles.textareaControl,
            control['aria-invalid'] && styles.invalid,
            disabled && styles.disabled,
          )}
        >
          <textarea
            {...textareaProps}
            {...control}
            ref={setRefs}
            rows={rows}
            value={value}
            disabled={disabled}
            onInput={handleInput}
            aria-describedby={describedBy(control['aria-describedby'], ariaDescribedBy)}
            className={cx(styles.input, styles.textarea, autoGrow && styles.autoGrow, textareaClassName)}
          />
        </div>
      )}
    </Field>
  )
}
