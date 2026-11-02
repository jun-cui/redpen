import { useId, type ReactNode, type Ref } from 'react'
import { cx, PenTick, Sheet, type SheetElevation } from '../../components'
import type { KeyPoint, PointResult } from '../../lib/types'
import styles from './MarkSchemePanel.module.css'

export interface MarkSchemePanelProps {
  /** One per key point, in order. The point text comes from `result.point`. */
  results: readonly PointResult[]
  /** The card's key points, for the "Also accept" and "Don't accept" hints (matched by id). */
  keyPoints?: readonly KeyPoint[]
  /** Ticks or unticks a point. Without it the panel is read-only. */
  onToggle?: (keyPointId: string) => void
  /** Ignore toggles for now (e.g. while saving), without dropping focus. */
  disabled?: boolean
  /** Default "Mark your answer". */
  title?: ReactNode
  /** One calm line under the title. Default: how to self-mark. Pass null for none. */
  description?: ReactNode
  /** The title takes focus when the panel appears, so keyboard users carry on from here. */
  headingRef?: Ref<HTMLHeadingElement>
  /** Show the marker's quote and reason under each point (AI marking, Stage 2). */
  showNotes?: boolean
  /** Whether a point's tick should appear finished at once rather than draw (tap to skip). */
  isInstant?: (keyPointId: string) => boolean
  elevation?: SheetElevation
  className?: string
}

const DEFAULT_DESCRIPTION = 'Tick each point you made. Be strict — would an examiner give it?'

/**
 * The mark scheme as a checklist on paper: one row per key point, with a large toggle in the
 * margin that draws a red tick. It is the self-marking UI now and the override UI in Stage 2,
 * where the same results arrive from the AI with a quote and reason per point.
 */
export function MarkSchemePanel({
  results,
  keyPoints,
  onToggle,
  disabled = false,
  title = 'Mark your answer',
  description = DEFAULT_DESCRIPTION,
  headingRef,
  showNotes = false,
  isInstant,
  elevation = 'raised',
  className,
}: MarkSchemePanelProps) {
  const titleId = useId()
  const byId = new Map((keyPoints ?? []).map((keyPoint) => [keyPoint.id, keyPoint]))
  return (
    <Sheet as="section" elevation={elevation} margin aria-labelledby={titleId} className={cx(styles.panel, className)}>
      <header className={styles.header}>
        <h3 id={titleId} ref={headingRef} tabIndex={-1} className={styles.title}>
          {title}
        </h3>
        {description ? <p className={styles.description}>{description}</p> : null}
      </header>
      <ol className={styles.points} role="list">
        {results.map((result, index) => (
          <PointRow
            key={result.key_point_id}
            index={index}
            result={result}
            keyPoint={byId.get(result.key_point_id)}
            onToggle={onToggle}
            disabled={disabled}
            showNotes={showNotes}
            instant={isInstant?.(result.key_point_id) ?? false}
          />
        ))}
      </ol>
    </Sheet>
  )
}

interface PointRowProps {
  index: number
  result: PointResult
  keyPoint: KeyPoint | undefined
  onToggle?: (keyPointId: string) => void
  disabled: boolean
  showNotes: boolean
  instant: boolean
}

function PointRow({ index, result, keyPoint, onToggle, disabled, showNotes, instant }: PointRowProps) {
  const id = useId()
  const textId = `${id}-text`
  const hintsId = `${id}-hints`
  const accept = keyPoint?.accept.filter((text) => text.trim()) ?? []
  const reject = keyPoint?.reject.filter((text) => text.trim()) ?? []
  const hasHints = accept.length > 0 || reject.length > 0

  const mark = (
    <>
      <span className={styles.ring} aria-hidden="true" />
      <PenTick className={styles.tick} size={32} seed={result.key_point_id} drawn={result.hit} instant={instant} />
    </>
  )

  return (
    <li className={cx(styles.point, result.hit && styles.hit, onToggle && styles.interactive)}>
      {onToggle ? (
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={result.hit}
          aria-labelledby={textId}
          aria-describedby={hasHints ? hintsId : undefined}
          aria-disabled={disabled || undefined}
          onClick={() => {
            if (!disabled) onToggle(result.key_point_id)
          }}
        >
          {mark}
        </button>
      ) : (
        <span className={styles.toggle} role="img" aria-label={result.hit ? 'Point earned' : 'Point not earned'}>
          {mark}
        </span>
      )}
      <div className={styles.content}>
        <p id={textId} className={styles.pointText}>
          <span className="visually-hidden">Point {index + 1}: </span>
          {result.point}
        </p>
        {hasHints ? (
          <div id={hintsId} className={styles.hints}>
            {accept.length > 0 ? (
              <p>
                <span className={styles.hintLabel}>Also accept:</span> {accept.join('; ')}
              </p>
            ) : null}
            {reject.length > 0 ? (
              <p>
                <span className={styles.hintLabel}>Don’t accept:</span> {reject.join('; ')}
              </p>
            ) : null}
          </div>
        ) : null}
        {showNotes && (result.quote || result.reason) ? (
          <div className={styles.notes}>
            {result.quote ? <q className={styles.quote}>{result.quote}</q> : null}
            {result.reason ? <p className={cx('hand', styles.reason)}>{result.reason}</p> : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}

export interface MarkSchemeCoverProps {
  /** How many key points the question has. */
  count: number
  className?: string
}

/**
 * The mark scheme before the answer is handed in, face down: how many points there are and where
 * the marking will happen. Used on wide screens, where the marking sits beside the answer.
 */
export function MarkSchemeCover({ count, className }: MarkSchemeCoverProps) {
  const titleId = useId()
  return (
    <Sheet as="section" elevation="flat" margin aria-labelledby={titleId} className={cx(styles.panel, styles.cover, className)}>
      <header className={styles.header}>
        <h3 id={titleId} className={styles.title}>
          Mark scheme
        </h3>
        <p className={styles.description}>
          {count} {count === 1 ? 'point' : 'points'} to make. It opens when you mark your answer.
        </p>
      </header>
      <ol className={styles.points} role="list" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <li key={index} className={styles.point}>
            <span className={styles.toggle}>
              <span className={styles.ring} />
            </span>
            <div className={styles.content}>
              <p className={cx(styles.pointText, styles.coveredText)}>Point {index + 1}</p>
            </div>
          </li>
        ))}
      </ol>
    </Sheet>
  )
}
