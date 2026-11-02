import { Plus } from 'lucide-react'
import { useId, useState, type FormEvent, type KeyboardEvent, type Ref } from 'react'
import { Button, cx, TextField } from '../../components'
import { friendlyError } from '../../lib/errors'
import styles from './TopicForm.module.css'
import { TOPIC_NAME_MAX, TOPIC_UNIT_MAX } from './topicUtils'

export interface TopicFormValues {
  name: string
  unit: string | null
}

export interface TopicFormProps {
  /** add: the "Add topic" row (clears itself after saving); rename: inline edit of a row. */
  mode: 'add' | 'rename'
  initialName?: string
  initialUnit?: string | null
  /** Returns a message when the name can't be used (empty, already taken), or null. */
  validateName: (name: string) => string | null
  /** Saves the topic. A rejection is shown under the name, keeping what was typed. */
  onSubmit: (values: TopicFormValues) => Promise<unknown>
  /** Rename only: leave the edit (Cancel or Escape). */
  onCancel?: () => void
  nameRef?: Ref<HTMLInputElement>
  autoFocus?: boolean
  className?: string
}

/** Name and optional unit for a topic: Enter saves, Escape cancels. */
export function TopicForm({
  mode,
  initialName = '',
  initialUnit = null,
  validateName,
  onSubmit,
  onCancel,
  nameRef,
  autoFocus = false,
  className,
}: TopicFormProps) {
  const [name, setName] = useState(initialName)
  const [unit, setUnit] = useState(initialUnit ?? '')
  const [error, setError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [pending, setPending] = useState(false)
  const nameId = useId()
  const isAdd = mode === 'add'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    setAttempted(true)
    const problem = validateName(name)
    if (problem) {
      setError(problem)
      document.getElementById(nameId)?.focus()
      return
    }
    setPending(true)
    try {
      await onSubmit({ name: name.trim(), unit: unit.trim() || null })
      if (isAdd) {
        setName('')
        setUnit('')
        setAttempted(false)
        setError(null)
        document.getElementById(nameId)?.focus()
      }
    } catch (failure) {
      setError(friendlyError(failure))
      document.getElementById(nameId)?.focus()
    } finally {
      setPending(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    if (onCancel) {
      onCancel()
    } else {
      setName('')
      setUnit('')
      setError(null)
      setAttempted(false)
    }
  }

  return (
    <form
      className={cx(styles.form, isAdd ? styles.add : styles.rename, className)}
      onSubmit={submit}
      onKeyDown={onKeyDown}
      noValidate
      aria-label={isAdd ? 'Add a topic' : `Rename ${initialName}`}
    >
      <TextField
        id={nameId}
        ref={nameRef}
        label={isAdd ? 'New topic' : 'Topic name'}
        placeholder={isAdd ? 'e.g. Circular motion' : undefined}
        value={name}
        maxLength={TOPIC_NAME_MAX}
        autoComplete="off"
        autoCapitalize="sentences"
        enterKeyHint="done"
        // Focus moves here on purpose: the person just asked to rename this topic.
        autoFocus={autoFocus}
        error={error ?? undefined}
        onChange={(event) => {
          setName(event.target.value)
          if (attempted) setError(validateName(event.target.value))
          else if (error) setError(null)
        }}
        className={styles.name}
      />
      <TextField
        label="Unit"
        optional
        placeholder={isAdd ? 'e.g. M2' : undefined}
        value={unit}
        maxLength={TOPIC_UNIT_MAX}
        autoComplete="off"
        autoCapitalize="characters"
        enterKeyHint="done"
        onChange={(event) => setUnit(event.target.value)}
        className={styles.unit}
      />
      <div className={styles.actions}>
        {isAdd ? (
          <Button type="submit" size="sm" leadingIcon={<Plus />} loading={pending}>
            Add topic
          </Button>
        ) : (
          <>
            <Button type="submit" size="sm" variant="primary" loading={pending}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </form>
  )
}
