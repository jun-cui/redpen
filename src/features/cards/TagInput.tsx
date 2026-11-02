import { X } from 'lucide-react'
import { useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react'
import { cx, describedBy, Field } from '../../components'
import { LIMITS } from './editorModel'
import styles from './TagInput.module.css'

export interface TagInputProps {
  label: ReactNode
  /** Plain-text name for announcements and remove buttons, e.g. "Also accept". */
  name: string
  tags: readonly string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  hint?: ReactNode
  /** Longest tag in characters. Default 300 (the database limit). */
  maxLength?: number
  className?: string
}

const sameTag = (a: string, b: string) => a.localeCompare(b, 'en-GB', { sensitivity: 'accent' }) === 0

/**
 * A list of short answers typed one at a time: Enter adds what's typed, Backspace in the empty box
 * removes the last one, and each has its own remove button. Whatever is still in the box when it
 * loses focus is added too, so nothing typed is lost on save. Commas don't separate anything,
 * because mark-scheme wordings contain them ("F = ma, where F is the resultant force"); text
 * pasted over several lines adds one answer per line.
 */
export function TagInput({ label, name, tags, onChange, placeholder, hint, maxLength = LIMITS.tag, className }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const input = useRef<HTMLInputElement>(null)

  /** Adds each value that is non-empty and not already listed. */
  const add = (values: string[]) => {
    const next = [...tags]
    const added: string[] = []
    for (const raw of values) {
      const value = raw.trim().slice(0, maxLength)
      if (!value) continue
      if (next.some((tag) => sameTag(tag, value))) {
        setAnnouncement(`“${value}” is already listed.`)
        continue
      }
      next.push(value)
      added.push(value)
    }
    if (added.length > 0) {
      onChange(next)
      setAnnouncement(added.length === 1 ? `Added “${added[0]}” to ${name}.` : `Added ${added.length} to ${name}.`)
    }
  }

  const commitDraft = () => {
    if (draft.trim()) add([draft])
    setDraft('')
  }

  const remove = (index: number, refocus: boolean) => {
    const tag = tags[index]
    if (tag === undefined) return
    onChange(tags.filter((_, i) => i !== index))
    setAnnouncement(`Removed “${tag}” from ${name}.`)
    if (refocus) input.current?.focus()
  }

  // A single line pastes as usual. The input would drop the line breaks of anything longer, so
  // that is split here, keeping whatever was already in the box either side of the caret.
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text')
    if (!/[\r\n]/.test(text)) return
    event.preventDefault()
    const { selectionStart, selectionEnd } = event.currentTarget
    const before = draft.slice(0, selectionStart ?? draft.length)
    const after = draft.slice(selectionEnd ?? draft.length)
    add(`${before}${text}${after}`.split(/\r?\n|\r/))
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // Cmd/Ctrl+Enter saves the card: keep what's typed, and let the form handle the shortcut.
      if (event.metaKey || event.ctrlKey) {
        commitDraft()
        return
      }
      event.preventDefault()
      commitDraft()
      return
    }
    if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      event.preventDefault()
      remove(tags.length - 1, false)
    }
  }

  return (
    <Field label={label} hint={hint} className={className}>
      {(control) => (
        <div
          className={styles.box}
          onPointerDown={(event) => {
            // Tapping the empty part of the box focuses the text field.
            if (event.target === event.currentTarget) {
              event.preventDefault()
              input.current?.focus()
            }
          }}
        >
          {tags.length > 0 ? (
            <ul role="list" className={styles.tags} aria-label={name}>
              {tags.map((tag, index) => (
                <li key={`${index}-${tag}`} className={styles.tag}>
                  <span className={styles.text}>{tag}</span>
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`Remove “${tag}”`}
                    title="Remove"
                    onClick={() => remove(index, true)}
                  >
                    <X aria-hidden="true" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <input
            {...control}
            ref={input}
            className={cx(styles.input)}
            value={draft}
            maxLength={maxLength}
            placeholder={tags.length > 0 ? 'Add another' : placeholder}
            autoComplete="off"
            autoCapitalize="off"
            enterKeyHint="done"
            aria-describedby={describedBy(control['aria-describedby'])}
            onChange={(event) => setDraft(event.target.value)}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
            onBlur={commitDraft}
          />
          <span className="visually-hidden" role="status" aria-live="polite">
            {announcement}
          </span>
        </div>
      )}
    </Field>
  )
}
