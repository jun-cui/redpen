import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Ellipsis, Pencil, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useId } from 'react'
import { Button, cx, IconButton } from '../../components'
import type { TopicRow } from '../../lib/database.types'
import { springs } from '../../lib/motion'
import { TopicForm, type TopicFormValues } from './TopicForm'
import styles from './TopicsPage.module.css'
import { cardCountLabel } from './topicUtils'

function TopicMeta({ topic, count }: { topic: TopicRow; count: number | undefined }) {
  const parts = [topic.unit, count === undefined ? null : count === 0 ? 'No cards' : cardCountLabel(count)].filter(Boolean)
  if (parts.length === 0) return null
  return <span className={styles.meta}>{parts.join(' · ')}</span>
}

export interface ActiveTopicRowProps {
  topic: TopicRow
  /** Cards filed under it; undefined while cards load. */
  count: number | undefined
  index: number
  total: number
  /** Changes only when the order changes, so typing never triggers layout animation. */
  layoutKey: string
  expanded: boolean
  editing: boolean
  highlight: boolean
  onToggleExpanded: () => void
  onStartRename: () => void
  onCancelRename: () => void
  onRename: (values: TopicFormValues) => Promise<unknown>
  validateName: (name: string) => string | null
  onMove: (direction: -1 | 1) => void
  onArchive: () => void
  onDelete: () => void
  moreRef: (node: HTMLButtonElement | null) => void
}

/** One topic: name, unit and card count, move buttons, and a fold-out row of actions. */
export function ActiveTopicRow({
  topic,
  count,
  index,
  total,
  layoutKey,
  expanded,
  editing,
  highlight,
  onToggleExpanded,
  onStartRename,
  onCancelRename,
  onRename,
  validateName,
  onMove,
  onArchive,
  onDelete,
  moreRef,
}: ActiveTopicRowProps) {
  const panelId = useId()
  const first = index === 0
  const last = index === total - 1

  return (
    <motion.li
      layout="position"
      layoutDependency={layoutKey}
      transition={{ layout: springs.ui }}
      className={cx(styles.row, highlight && styles.highlight)}
    >
      {editing ? (
        <TopicForm
          mode="rename"
          initialName={topic.name}
          initialUnit={topic.unit}
          validateName={validateName}
          onSubmit={onRename}
          onCancel={onCancelRename}
          autoFocus
        />
      ) : (
        <>
          <div className={styles.rowMain}>
            <div className={styles.rowText}>
              <span className={styles.name}>{topic.name}</span>
              <TopicMeta topic={topic} count={count} />
            </div>
            <div className={styles.rowActions}>
              <IconButton
                label={`Move ${topic.name} up`}
                icon={<ArrowUp />}
                size="sm"
                className={styles.move}
                aria-disabled={first || undefined}
                onClick={() => {
                  if (!first) onMove(-1)
                }}
              />
              <IconButton
                label={`Move ${topic.name} down`}
                icon={<ArrowDown />}
                size="sm"
                className={styles.move}
                aria-disabled={last || undefined}
                onClick={() => {
                  if (!last) onMove(1)
                }}
              />
              <IconButton
                ref={moreRef}
                label={`More for ${topic.name}`}
                icon={<Ellipsis />}
                size="sm"
                selected={expanded}
                aria-expanded={expanded}
                aria-controls={expanded ? panelId : undefined}
                onClick={onToggleExpanded}
              />
            </div>
          </div>
          {expanded ? (
            <motion.div
              id={panelId}
              className={styles.panel}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springs.ui}
            >
              <Button size="sm" variant="ghost" leadingIcon={<Pencil />} onClick={onStartRename}>
                Rename
              </Button>
              <Button size="sm" variant="ghost" leadingIcon={<Archive />} onClick={onArchive}>
                Archive
              </Button>
              <Button size="sm" variant="ghost" leadingIcon={<Trash2 />} className={styles.deleteButton} onClick={onDelete}>
                Delete
              </Button>
            </motion.div>
          ) : null}
        </>
      )}
    </motion.li>
  )
}

export interface ArchivedTopicRowProps {
  topic: TopicRow
  count: number | undefined
  onRestore: () => void
  onDelete: () => void
  restoreRef: (node: HTMLButtonElement | null) => void
}

/** An archived topic: hidden from pickers, kept for the cards already filed under it. */
export function ArchivedTopicRow({ topic, count, onRestore, onDelete, restoreRef }: ArchivedTopicRowProps) {
  return (
    <li className={cx(styles.row, styles.archivedRow)}>
      <div className={styles.rowMain}>
        <div className={styles.rowText}>
          <span className={styles.name}>{topic.name}</span>
          <TopicMeta topic={topic} count={count} />
        </div>
        <div className={styles.rowActions}>
          <IconButton ref={restoreRef} label={`Restore ${topic.name}`} icon={<ArchiveRestore />} size="sm" onClick={onRestore} />
          <IconButton label={`Delete ${topic.name}`} icon={<Trash2 />} size="sm" onClick={onDelete} />
        </div>
      </div>
    </li>
  )
}
