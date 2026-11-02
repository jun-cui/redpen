import { useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  Page,
  PageHeader,
  Sheet,
  Skeleton,
  SkeletonText,
} from '../../components'
import { useCard } from '../../data/hooks'
import { useDocumentTitle } from '../../hooks'
import type { CardRow } from '../../lib/database.types'
import { friendlyError } from '../../lib/errors'
import { isSubjectCode } from '../../lib/subjects'
import type { SubjectCode } from '../../lib/types'
import { CardEditor } from './CardEditor'
import styles from './CardEditorPage.module.css'
import { readReturnTo } from './editorModel'
import { recallSubject } from './lastSubject'

const DEFAULT_SUBJECT: SubjectCode = 'maths'

/** /cards/new (optional ?subject=) and /cards/:cardId: write a card, or edit one. */
export function CardEditorPage() {
  const { cardId } = useParams()
  return cardId ? <EditCard key={cardId} cardId={cardId} /> : <NewCard />
}

function NewCard() {
  useDocumentTitle('New card')
  const [params] = useSearchParams()
  const requested = params.get('subject')
  // Read once: the form owns the subject from here on.
  const [initialSubject] = useState<SubjectCode>(() =>
    isSubjectCode(requested) ? requested : (recallSubject() ?? DEFAULT_SUBJECT),
  )
  return <CardEditor initialSubject={initialSubject} />
}

function EditCard({ cardId }: { cardId: string }) {
  useDocumentTitle('Edit card')
  const location = useLocation()
  const backTo = readReturnTo(location.state) ?? '/cards'
  const query = useCard(cardId)
  // While a delete is saving, the card leaves the cache before the page navigates away; keep
  // showing it until then rather than flashing "not found".
  const [deleting, setDeleting] = useState<CardRow | null>(null)
  const card = deleting ?? query.data

  if (card) {
    return <CardEditor card={card} initialSubject={card.subject} onDeletingChange={(busy) => setDeleting(busy ? card : null)} />
  }

  const header = <PageHeader back={{ to: backTo, label: 'Cards' }} title="Edit card" />

  if (query.isError) {
    return (
      <Page width="wide">
        {header}
        <ErrorState
          title="This card didn’t load"
          message={friendlyError(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </Page>
    )
  }

  if (query.data === null) {
    return (
      <Page width="wide">
        {header}
        <Sheet padding="lg" className={styles.missing}>
          <EmptyState
            illustration="torn"
            title="This card isn’t in your box"
            actions={
              <ButtonLink to="/cards" variant="primary">
                Back to your cards
              </ButtonLink>
            }
          >
            It may have been deleted, perhaps on another device, or the link is incomplete.
          </EmptyState>
        </Sheet>
      </Page>
    )
  }

  return <EditorSkeleton backTo={backTo} />
}

/** The editor's shape while an existing card loads. */
function EditorSkeleton({ backTo }: { backTo: string }) {
  return (
    <Page width="wide">
      <PageHeader back={{ to: backTo, label: 'Cards' }} title="Edit card" />
      <div className={styles.skeleton} aria-busy="true">
        <span className="visually-hidden">Loading the card</span>
        <div className={styles.skeletonForm}>
          <div className={styles.skeletonField}>
            <Skeleton width={56} height={14} />
            <Skeleton height={48} radius="sm" />
          </div>
          <div className={styles.skeletonField}>
            <Skeleton width={40} height={14} />
            <Skeleton height={48} radius="sm" />
          </div>
          <div className={styles.skeletonField}>
            <Skeleton width={64} height={14} />
            <div className={styles.skeletonQuestion}>
              <SkeletonText size="question" lines={2} lastLineWidth="60%" />
            </div>
          </div>
          <div className={styles.skeletonField}>
            <Skeleton width={72} height={14} />
            {[0, 1].map((index) => (
              <Sheet key={index} elevation="flat" padding="sm" className={styles.skeletonPoint}>
                <Skeleton width={16} height={22} />
                <Skeleton height={64} radius="sm" />
                <span className={styles.skeletonTags}>
                  <Skeleton height={48} radius="sm" />
                  <Skeleton height={48} radius="sm" />
                </span>
              </Sheet>
            ))}
          </div>
        </div>
        <div className={styles.skeletonSide}>
          <Sheet elevation="flat" padding="md" className={styles.skeletonAside}>
            <Skeleton width={72} height={12} />
            <Skeleton width="70%" height={24} />
            <span className={styles.skeletonFacts}>
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={44} />
            </span>
          </Sheet>
        </div>
      </div>
    </Page>
  )
}
