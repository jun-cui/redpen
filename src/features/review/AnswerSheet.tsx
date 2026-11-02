import { useCallback, useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { cx, Sheet } from '../../components'
import type { Correction, PointResult } from '../../lib/types'
import { MAX_ANSWER_LENGTH } from './marking'
import styles from './AnswerSheet.module.css'

/**
 * What the examiner writes on the answer (Stage 2: AI marking). Accepted now so the review screen
 * can pass marking results through unchanged; Stage 1 draws none of it.
 */
export interface AnswerAnnotations {
  /** Per-point results: ticks go in the margin beside where each point is made. */
  results?: readonly PointResult[]
  /** Phrases struck through, with the red correction written beside them. */
  corrections?: readonly Correction[]
  /** Points the answer left out, written in red at the end. */
  missing?: readonly string[]
}

export interface AnswerInputOptions {
  onChange: (value: string) => void
  /** Cmd/Ctrl + Enter. */
  onSubmit: () => void
  onFocus?: () => void
  /** Called after the box grows or shrinks to fit a new line. */
  onResize?: () => void
  textareaRef?: Ref<HTMLTextAreaElement>
  disabled?: boolean
}

export interface AnswerSheetProps {
  /** The student's answer. Line breaks are kept. */
  answer: string
  /** While answering: the sheet becomes the answer box (a ruled textarea). */
  input?: AnswerInputOptions
  /** The examiner's marks on the answer (Stage 2). Not drawn yet. */
  annotations?: AnswerAnnotations
  /** The circled score, written in the margin on the top line. */
  score?: ReactNode
  /** Heading on the top line. Default "Your answer". */
  label?: string
  className?: string
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}

/**
 * The answer on ruled exam paper with a red margin rule. While answering it is the writing box;
 * afterwards the same text stays on the same lines, so marking happens on the answer itself.
 * The margin column holds the examiner's marks: the circled score now, ticks in Stage 2.
 */
export function AnswerSheet({ answer, input, score, label = 'Your answer', className }: AnswerSheetProps) {
  const labelId = useId()
  return (
    <Sheet
      as="section"
      ruled
      margin
      aria-labelledby={labelId}
      className={cx(styles.sheet, input && styles.writing, className)}
    >
      <div className={styles.head}>
        {score ? <div className={styles.score}>{score}</div> : null}
        <h3 id={labelId} className={styles.label}>
          {label}
        </h3>
      </div>
      {input ? (
        <AnswerInput value={answer} labelId={labelId} {...input} />
      ) : answer.trim() ? (
        <p className={styles.text}>{answer}</p>
      ) : (
        <p className={cx(styles.text, styles.empty)}>No answer written.</p>
      )}
    </Sheet>
  )
}

function AnswerInput({
  value,
  labelId,
  onChange,
  onSubmit,
  onFocus,
  onResize,
  textareaRef,
  disabled,
}: AnswerInputOptions & { value: string; labelId: string }) {
  const element = useRef<HTMLTextAreaElement | null>(null)
  const height = useRef(0)

  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      element.current = node
      assignRef(textareaRef, node)
    },
    [textareaRef],
  )

  // Grow with the text a whole ruled line at a time, so the writing always sits on the rules.
  const fit = useCallback(() => {
    const node = element.current
    if (!node) return
    const line = parseFloat(window.getComputedStyle(node).lineHeight) || 32
    node.style.height = 'auto'
    const next = Math.ceil(node.scrollHeight / line) * line
    node.style.height = `${next}px`
    if (next !== height.current) {
      height.current = next
      onResize?.()
    }
  }, [onResize])

  useLayoutEffect(() => {
    fit()
  }, [fit, value])

  useEffect(() => {
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [fit])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <textarea
      ref={setRefs}
      className={styles.input}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      disabled={disabled}
      aria-labelledby={labelId}
      placeholder="Write your answer as you would in the exam"
      rows={4}
      maxLength={MAX_ANSWER_LENGTH}
      autoComplete="off"
      autoCorrect="on"
      autoCapitalize="sentences"
      spellCheck
    />
  )
}
