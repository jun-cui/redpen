import { ChevronDown } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  ConfirmDialog,
  cx,
  EmptyState,
  ErrorState,
  Page,
  PageHeader,
  SegmentedControl,
  Sheet,
  Skeleton,
  useToast,
} from '../../components'
import { useCards, useCreateTopic, useDeleteTopic, useReorderTopics, useTopics, useUpdateTopic } from '../../data/hooks'
import { useDocumentTitle, useIsTabletUp } from '../../hooks'
import type { TopicRow } from '../../lib/database.types'
import { friendlyError } from '../../lib/errors'
import { isSubjectCode, subjectInfo } from '../../lib/subjects'
import type { SubjectCode } from '../../lib/types'
import { subjectSegments, useSubjectLabelStyle } from './subjectSegments'
import { TopicForm, type TopicFormValues } from './TopicForm'
import { ActiveTopicRow, ArchivedTopicRow } from './TopicRows'
import styles from './TopicsPage.module.css'
import { byPosition, cardCountLabel, countCardsByTopic, duplicateTopicMessage, findDuplicateTopic } from './topicUtils'

/** /settings/topics: each subject's topic list, in the order pickers show it. */
export function TopicsPage() {
  useDocumentTitle('Topics')
  const [params, setParams] = useSearchParams()
  const requested = params.get('subject')
  const subject: SubjectCode = isSubjectCode(requested) ? requested : 'maths'
  const short = !useIsTabletUp()
  const switcherRef = useRef<HTMLDivElement>(null)
  const subjectLabels = useSubjectLabelStyle(switcherRef, 4, 'md')

  const chooseSubject = (next: SubjectCode) => {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current)
        updated.set('subject', next)
        return updated
      },
      { replace: true },
    )
  }

  return (
    <Page width="wide">
      <PageHeader
        back={{ to: '/settings', label: 'Settings' }}
        title="Topics"
        description="Cards are filed under these, and the topic picker lists them in this order."
      />
      <div ref={switcherRef} className={styles.switcher}>
        <SegmentedControl
          label="Subject"
          options={subjectSegments(subjectLabels)}
          value={subject}
          onChange={chooseSubject}
          fullWidth={short}
        />
      </div>
      <SubjectTopics key={subject} subject={subject} />
    </Page>
  )
}

/** Moves focus once React has painted the change that removed or replaced the focused control. */
function focusSoon(target: () => HTMLElement | null | undefined) {
  requestAnimationFrame(() => target()?.focus({ preventScroll: false }))
}

function SubjectTopics({ subject }: { subject: SubjectCode }) {
  const toast = useToast()
  const topicsQuery = useTopics(subject)
  const cardsQuery = useCards()
  const createTopic = useCreateTopic()
  const updateTopic = useUpdateTopic()
  const deleteTopic = useDeleteTopic()
  const reorderTopics = useReorderTopics()

  /** Archive and restore show at once; the saved value replaces this when the request settles. */
  const [archivedOverrides, setArchivedOverrides] = useState<Record<string, boolean>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addedId, setAddedId] = useState<string | null>(null)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TopicRow | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const moreButtons = useRef(new Map<string, HTMLButtonElement>())
  const restoreButtons = useRef(new Map<string, HTMLButtonElement>())
  const addName = useRef<HTMLInputElement>(null)
  const archivedToggle = useRef<HTMLButtonElement>(null)

  const counts = useMemo(() => (cardsQuery.data ? countCardsByTopic(cardsQuery.data) : undefined), [cardsQuery.data])
  const allTopics = useMemo(() => topicsQuery.data ?? [], [topicsQuery.data])
  const topics = useMemo(
    () =>
      allTopics
        .map((topic) => {
          const override = archivedOverrides[topic.id]
          return override === undefined ? topic : { ...topic, archived: override }
        })
        .sort(byPosition),
    [allTopics, archivedOverrides],
  )
  const active = topics.filter((topic) => !topic.archived)
  const archived = topics.filter((topic) => topic.archived)
  const layoutKey = active.map((topic) => topic.id).join(',')
  const subjectName = subjectInfo(subject).name

  if (topicsQuery.isPending) return <TopicsSkeleton />
  if (topicsQuery.isError) {
    return (
      <ErrorState
        title="Your topics didn’t load"
        message={friendlyError(topicsQuery.error)}
        onRetry={() => void topicsQuery.refetch()}
        retrying={topicsQuery.isFetching}
      />
    )
  }

  const countOf = (topic: TopicRow) => (counts ? (counts.get(topic.id) ?? 0) : undefined)

  const nameValidator = (exceptId?: string) => (name: string) => {
    if (!name.trim()) return 'Give the topic a name.'
    const duplicate = findDuplicateTopic(allTopics, subject, name, exceptId)
    return duplicate ? duplicateTopicMessage(duplicate) : null
  }

  const showError = (error: unknown) => toast.show({ message: friendlyError(error), tone: 'error' })

  /** Where focus goes when the row at `index` of `list` leaves it. */
  const focusAfterLeaving = (list: TopicRow[], index: number, kind: 'active' | 'archived') => {
    const neighbour = list[index + 1] ?? list[index - 1]
    focusSoon(() => {
      if (kind === 'active') return (neighbour && moreButtons.current.get(neighbour.id)) || addName.current
      return (neighbour && restoreButtons.current.get(neighbour.id)) || archivedToggle.current
    })
  }

  const move = (topic: TopicRow, direction: -1 | 1) => {
    const orderedIds = active.map((t) => t.id)
    const from = orderedIds.indexOf(topic.id)
    const to = from + direction
    const other = orderedIds[to]
    if (from < 0 || other === undefined) return
    orderedIds[to] = topic.id
    orderedIds[from] = other
    setAnnouncement(`${topic.name} moved to position ${to + 1} of ${orderedIds.length}.`)
    reorderTopics.mutate({ subject, orderedIds }, { onError: showError })
  }

  const setArchived = (topic: TopicRow, value: boolean) => {
    setArchivedOverrides((current) => ({ ...current, [topic.id]: value }))
    setExpandedId(null)
    updateTopic
      .mutateAsync({ id: topic.id, patch: { archived: value } })
      .then(() => {
        if (value) {
          toast.show({
            message: `Archived “${topic.name}”`,
            action: { label: 'Undo', onClick: () => setArchived(topic, false) },
          })
        } else {
          toast.show({ message: `Restored “${topic.name}”` })
        }
      })
      .catch(showError)
      .finally(() =>
        setArchivedOverrides((current) => {
          const next = { ...current }
          delete next[topic.id]
          return next
        }),
      )
  }

  const archive = (topic: TopicRow) => {
    focusAfterLeaving(active, active.indexOf(topic), 'active')
    setArchived(topic, true)
  }

  const restore = (topic: TopicRow) => {
    focusAfterLeaving(archived, archived.indexOf(topic), 'archived')
    setArchived(topic, false)
  }

  const rename = async (topic: TopicRow, values: TopicFormValues) => {
    await updateTopic.mutateAsync({ id: topic.id, patch: { name: values.name, unit: values.unit } })
    setEditingId(null)
    setAnnouncement(`Saved ${values.name}.`)
    focusSoon(() => moreButtons.current.get(topic.id))
  }

  const add = async (values: TopicFormValues) => {
    const topic = await createTopic.mutateAsync({ subject, name: values.name, unit: values.unit })
    setAddedId(topic.id)
    setAnnouncement(`Added ${topic.name}.`)
  }

  const askToDelete = (topic: TopicRow) => {
    setExpandedId(null)
    setDeleteTarget(topic)
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    const list = target.archived ? archived : active
    const index = list.findIndex((topic) => topic.id === target.id)
    try {
      await deleteTopic.mutateAsync(target.id)
    } catch (error) {
      showError(error)
      throw error
    }
    toast.show({ message: `Deleted “${target.name}”` })
    focusAfterLeaving(list, index, target.archived ? 'archived' : 'active')
  }

  const closeDelete = () => {
    setDeleteOpen(false)
    // Cancelled: back to the row the question came from (its own button has gone).
    const target = deleteTarget
    if (target && allTopics.some((topic) => topic.id === target.id)) {
      focusSoon(() =>
        target.archived ? restoreButtons.current.get(target.id) : moreButtons.current.get(target.id),
      )
    }
  }

  const deleteCount = deleteTarget ? (counts?.get(deleteTarget.id) ?? 0) : 0

  return (
    <div className={styles.content}>
      <span className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>

      <Sheet padding="none" className={styles.sheet}>
        <h2 className="visually-hidden">{subjectName} topics</h2>
        {topics.length === 0 ? (
          <EmptyState illustration="sheets" title="No topics yet" compact headingLevel="h3" className={styles.empty}>
            Add the topics you study in {subjectName}. Cards are filed under them, and the topic picker lists them in
            this order.
          </EmptyState>
        ) : active.length === 0 ? (
          <p className={styles.note}>Every {subjectName} topic is archived. Restore one, or add a new topic below.</p>
        ) : (
          <ol role="list" className={styles.list} aria-label={`${subjectName} topics`}>
            {active.map((topic, index) => (
              <ActiveTopicRow
                key={topic.id}
                topic={topic}
                count={countOf(topic)}
                index={index}
                total={active.length}
                layoutKey={layoutKey}
                expanded={expandedId === topic.id}
                editing={editingId === topic.id}
                highlight={addedId === topic.id}
                onToggleExpanded={() => setExpandedId((current) => (current === topic.id ? null : topic.id))}
                onStartRename={() => {
                  setExpandedId(null)
                  setEditingId(topic.id)
                }}
                onCancelRename={() => {
                  setEditingId(null)
                  focusSoon(() => moreButtons.current.get(topic.id))
                }}
                onRename={(values) => rename(topic, values)}
                validateName={nameValidator(topic.id)}
                onMove={(direction) => move(topic, direction)}
                onArchive={() => archive(topic)}
                onDelete={() => askToDelete(topic)}
                moreRef={(node) => {
                  if (node) moreButtons.current.set(topic.id, node)
                  else moreButtons.current.delete(topic.id)
                }}
              />
            ))}
          </ol>
        )}
        <div className={styles.addRow}>
          <TopicForm mode="add" validateName={nameValidator()} onSubmit={add} nameRef={addName} />
        </div>
      </Sheet>

      {archived.length > 0 ? (
        <section className={styles.archived} aria-label={`Archived ${subjectName} topics`}>
          <button
            ref={archivedToggle}
            type="button"
            className={styles.disclosure}
            aria-expanded={archivedOpen}
            onClick={() => setArchivedOpen((open) => !open)}
          >
            <ChevronDown aria-hidden="true" className={cx(styles.chevron, archivedOpen && styles.chevronOpen)} />
            <span>Archived</span>
            <span className={styles.disclosureCount}>{archived.length}</span>
          </button>
          {archivedOpen ? (
            <>
              <p className={styles.archivedNote}>
                Archived topics are hidden from the topic picker. Cards filed under them keep their topic.
              </p>
              <Sheet padding="none" elevation="flat" className={styles.sheet}>
                <ul role="list" className={styles.list}>
                  {archived.map((topic) => (
                    <ArchivedTopicRow
                      key={topic.id}
                      topic={topic}
                      count={countOf(topic)}
                      onRestore={() => restore(topic)}
                      onDelete={() => askToDelete(topic)}
                      restoreRef={(node) => {
                        if (node) restoreButtons.current.set(topic.id, node)
                        else restoreButtons.current.delete(topic.id)
                      }}
                    />
                  ))}
                </ul>
              </Sheet>
            </>
          ) : null}
        </section>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onClose={closeDelete}
        onConfirm={confirmDelete}
        title={deleteTarget ? `Delete “${deleteTarget.name}”?` : 'Delete topic?'}
        confirmLabel="Delete topic"
        destructive
      >
        {deleteCount === 0
          ? 'No cards are filed under it. This can’t be undone.'
          : deleteCount === 1
            ? '1 card will have no topic. It keeps its reviews, and you can file it again from the card editor.'
            : `${cardCountLabel(deleteCount)} will have no topic. They keep their reviews, and you can file them again from the card editor.`}
      </ConfirmDialog>
    </div>
  )
}

function TopicsSkeleton() {
  return (
    <div className={styles.content} aria-busy="true">
      <span className="visually-hidden">Loading topics</span>
      <Sheet padding="none" className={styles.sheet}>
        <div className={styles.list}>
          {[62, 48, 70, 40, 56, 66].map((width, index) => (
            <div key={index} className={cx(styles.row, styles.skeletonRow)}>
              <div className={styles.rowText}>
                <Skeleton width={`${width}%`} height={18} />
                <Skeleton width={72} height={14} />
              </div>
              <Skeleton width={120} height={32} radius="pill" />
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  )
}
