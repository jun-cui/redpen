import type { ReactNode, Ref } from 'react'
import { Select } from '../../components'
import { friendlyError } from '../../lib/errors'
import type { SubjectCode } from '../../lib/types'
import styles from './TopicSelect.module.css'
import { topicLabel, useActiveTopics } from './topicUtils'

/** The select's value for "No topic" (only offered when the subject has no topics). */
const NO_TOPIC = '__none__'

export interface TopicSelectProps {
  /** Topics of this subject are offered. Changing it should clear `value`. */
  subject: SubjectCode
  /** The chosen topic id, or null for none. */
  value: string | null
  onChange: (topicId: string | null) => void
  /** Validation message, e.g. "Choose a topic." */
  error?: ReactNode
  /** Visible label. Default "Topic". */
  label?: ReactNode
  /** Help under the select. A default explains an empty subject. */
  hint?: ReactNode
  /** Content at the end of the label row, e.g. a "Manage topics" link. */
  labelAside?: ReactNode
  hideLabel?: boolean
  id?: string
  ref?: Ref<HTMLSelectElement>
  onBlur?: () => void
  disabled?: boolean
  className?: string
}

/**
 * A native picker of one subject's topics: not archived, in the user's order. "No topic" is
 * offered only when the subject has no topics at all. An archived topic that is already chosen
 * (an older card) stays visible so the value is never silently lost. If the topics can't be
 * loaded, the select says so and offers to try again.
 */
export function TopicSelect({
  subject,
  value,
  onChange,
  error,
  label = 'Topic',
  hint,
  labelAside,
  hideLabel,
  id,
  ref,
  onBlur,
  disabled,
  className,
}: TopicSelectProps) {
  const { active, all, isPending, error: loadError, refetch, isFetching } = useActiveTopics(subject)

  if (isPending) {
    return (
      <Select
        label={label}
        labelAside={labelAside}
        hideLabel={hideLabel}
        id={id}
        ref={ref}
        className={className}
        placeholder="Loading topics…"
        value=""
        onChange={() => {}}
        disabled
        aria-busy="true"
      />
    )
  }

  // A failed refresh keeps the topics already shown; only a first load that failed blocks the picker.
  const failed = all === undefined && loadError !== null
  const current = value ? all?.find((topic) => topic.id === value) : undefined
  const archivedCurrent = current?.archived ? current : undefined
  const noTopics = !failed && active.length === 0
  const selectValue = current ? current.id : noTopics ? NO_TOPIC : ''
  const message = failed ? `The topics didn’t load. ${friendlyError(loadError)}` : error
  const help =
    hint ??
    (!noTopics
      ? undefined
      : all && all.length > 0
        ? 'Every topic in this subject is archived, so the card is filed without one.'
        : 'This subject has no topics yet, so the card is filed without one.')
  const aside = failed ? (
    <span className={styles.aside}>
      {labelAside}
      <button type="button" className={styles.retry} onClick={() => void refetch()} disabled={isFetching}>
        {isFetching ? 'Trying…' : 'Try again'}
      </button>
    </span>
  ) : (
    labelAside
  )

  return (
    <Select
      label={label}
      labelAside={aside}
      hideLabel={hideLabel}
      hint={help}
      error={message}
      id={id}
      ref={ref}
      className={className}
      placeholder={noTopics ? undefined : failed ? 'Topics unavailable' : 'Choose a topic'}
      value={selectValue}
      disabled={disabled || failed}
      onBlur={onBlur}
      onChange={(event) => {
        const next = event.target.value
        onChange(next === '' || next === NO_TOPIC ? null : next)
      }}
    >
      {noTopics ? <option value={NO_TOPIC}>No topic</option> : null}
      {active.map((topic) => (
        <option key={topic.id} value={topic.id}>
          {topicLabel(topic)}
        </option>
      ))}
      {archivedCurrent ? <option value={archivedCurrent.id}>{`${topicLabel(archivedCurrent)} – archived`}</option> : null}
    </Select>
  )
}
