import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState, type Ref } from 'react'
import { Button, IconButton, TextArea, useToast } from '../../components'
import { fades, springs } from '../../lib/motion'
import type { KeyPoint } from '../../lib/types'
import { marksLabel } from './cardFilters'
import { COUNTER_FROM, LIMITS, type FormErrors } from './editorModel'
import styles from './KeyPointsEditor.module.css'
import { TagInput } from './TagInput'

export interface KeyPointsEditorProps {
  points: readonly KeyPoint[]
  /** Functional update, so undo and quick edits never act on a stale list. */
  onChange: (update: (points: KeyPoint[]) => KeyPoint[]) => void
  /** Errors to show now (already filtered to touched fields, or all after a save attempt). */
  errors: FormErrors
  onBlurPoint: (id: string) => void
  /** Registers each point's textarea so the editor can focus the first invalid one. */
  registerPoint: (id: string, node: HTMLTextAreaElement | null) => void
  addButtonRef?: Ref<HTMLButtonElement>
  newPoint: () => KeyPoint
}

const charCount = (text: string) => [...text].length

/** The mark scheme: numbered points, each with wordings to accept and to reject. */
export function KeyPointsEditor({
  points,
  onChange,
  errors,
  onBlurPoint,
  registerPoint,
  addButtonRef,
  newPoint,
}: KeyPointsEditorProps) {
  const toast = useToast()
  const headingId = useId()
  const hintId = useId()
  const [announcement, setAnnouncement] = useState('')
  const orderKey = points.map((kp) => kp.id).join(',')
  const full = points.length >= LIMITS.points

  const focusPoint = (id: string | undefined, fallback?: () => void) => {
    requestAnimationFrame(() => {
      const node = id ? document.querySelector<HTMLTextAreaElement>(`[data-point-id="${id}"]`) : null
      if (node) node.focus()
      else fallback?.()
    })
  }

  const update = (id: string, patch: Partial<KeyPoint>) =>
    onChange((list) => list.map((kp) => (kp.id === id ? { ...kp, ...patch } : kp)))

  const add = () => {
    if (full) return
    const point = newPoint()
    onChange((list) => [...list, point])
    setAnnouncement(`Key point ${points.length + 1} added.`)
    focusPoint(point.id)
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= points.length) return
    onChange((list) => {
      const next = [...list]
      const [moved] = next.splice(index, 1)
      if (moved) next.splice(target, 0, moved)
      return next
    })
    setAnnouncement(`Key point moved to position ${target + 1} of ${points.length}.`)
  }

  const remove = (index: number) => {
    const removed = points[index]
    if (!removed) return
    onChange((list) => list.filter((kp) => kp.id !== removed.id))
    const neighbour = points[index + 1] ?? points[index - 1]
    focusPoint(neighbour?.id, () => document.querySelector<HTMLButtonElement>(`[data-add-point="${headingId}"]`)?.focus())

    const isBlank = !removed.point.trim() && removed.accept.length === 0 && removed.reject.length === 0
    if (isBlank) {
      setAnnouncement(`Key point ${index + 1} removed.`)
      return
    }
    toast.show({
      message: `Key point ${index + 1} removed`,
      action: {
        label: 'Undo',
        onClick: () => {
          onChange((list) => {
            if (list.some((kp) => kp.id === removed.id)) return list
            const next = [...list]
            next.splice(Math.min(index, next.length), 0, removed)
            return next
          })
          focusPoint(removed.id)
        },
      },
    })
  }

  return (
    <fieldset className={styles.fieldset} aria-describedby={hintId}>
      <legend id={headingId} className={styles.legend}>
        <span className={styles.legendText}>Key points</span>
        <span className={styles.tally}>{marksLabel(points.length)}</span>
      </legend>
      <p id={hintId} className={styles.hint}>
        One mark each. Write them as a mark scheme would: short, specific, one idea per point.
      </p>

      <span className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>

      <ol role="list" className={styles.list}>
        <AnimatePresence initial={false} mode="popLayout">
          {points.map((kp, index) => {
            const error = errors[`point:${kp.id}`]
            const count = charCount(kp.point)
            const first = index === 0
            const last = index === points.length - 1
            return (
              <motion.li
                key={kp.id}
                layout="position"
                layoutDependency={orderKey}
                className={styles.item}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, transition: fades.fast }}
                transition={{ layout: springs.ui, y: springs.gentle, opacity: fades.base }}
              >
                <div className={styles.itemHeader}>
                  <span className={styles.number} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className={styles.itemActions}>
                    <IconButton
                      label={`Move key point ${index + 1} up`}
                      icon={<ArrowUp />}
                      size="sm"
                      className={styles.move}
                      aria-disabled={first || undefined}
                      onClick={() => move(index, -1)}
                    />
                    <IconButton
                      label={`Move key point ${index + 1} down`}
                      icon={<ArrowDown />}
                      size="sm"
                      className={styles.move}
                      aria-disabled={last || undefined}
                      onClick={() => move(index, 1)}
                    />
                    <IconButton
                      label={`Remove key point ${index + 1}`}
                      icon={<Trash2 />}
                      size="sm"
                      onClick={() => remove(index)}
                    />
                  </span>
                </div>
                <TextArea
                  label={`Key point ${index + 1}`}
                  hideLabel
                  autoGrow
                  rows={2}
                  maxRows={12}
                  placeholder="The point, as the mark scheme puts it"
                  value={kp.point}
                  error={error}
                  hint={count >= COUNTER_FROM.point ? `${count} of ${LIMITS.point} characters` : undefined}
                  data-point-id={kp.id}
                  ref={(node) => registerPoint(kp.id, node)}
                  onChange={(event) => update(kp.id, { point: event.target.value })}
                  onBlur={() => onBlurPoint(kp.id)}
                  textareaClassName={styles.pointText}
                />
                <div className={styles.tags}>
                  <TagInput
                    label="Also accept"
                    name={`also accept for key point ${index + 1}`}
                    tags={kp.accept}
                    placeholder="Another wording that earns it"
                    hint="Press Enter to add each wording."
                    onChange={(accept) => update(kp.id, { accept })}
                  />
                  <TagInput
                    label="Don’t accept"
                    name={`don’t accept for key point ${index + 1}`}
                    tags={kp.reject}
                    placeholder="An answer that doesn’t"
                    onChange={(reject) => update(kp.id, { reject })}
                  />
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ol>

      {errors.points ? (
        <p className={styles.listError} role="alert">
          {errors.points}
        </p>
      ) : null}

      <div className={styles.addRow}>
        <Button
          ref={addButtonRef}
          leadingIcon={<Plus />}
          onClick={add}
          disabled={full}
          data-add-point={headingId}
        >
          Add key point
        </Button>
        {full ? <span className={styles.addNote}>{LIMITS.points} is the most a card can hold.</span> : null}
      </div>
    </fieldset>
  )
}
