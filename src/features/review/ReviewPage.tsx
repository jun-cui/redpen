import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react'
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useBlocker, useNavigate, useSearchParams, type Blocker, type BlockerFunction } from 'react-router'
import { ConfirmDialog, ErrorState, Page, useToast } from '../../components'
import type { RecordReviewResult } from '../../data/api'
import { useDueSummary } from '../../data/hooks'
import { useDocumentTitle, useIsDesktop, useMediaQuery, useOnlineStatus } from '../../hooks'
import { friendlyError } from '../../lib/errors'
import { cardFadeVariants, cardSwapVariants, fades, type Direction } from '../../lib/motion'
import { isSubjectCode, subjectInfo } from '../../lib/subjects'
import type { SubjectCode } from '../../lib/types'
import { OfflineBanner } from '../shell/OfflineBanner'
import { ChangeMarksDialog } from './ChangeMarksDialog'
import { dueNowCount, nextReviewLabel } from './copy'
import { NothingDue } from './NothingDue'
import type { QueueEntry } from './queue'
import { ReviewCard } from './ReviewCard'
import { ReviewSkeleton } from './ReviewSkeleton'
import { ReviewTopBar } from './ReviewTopBar'
import { SessionSummary } from './SessionSummary'
import { useReviewSession } from './useReviewSession'
import styles from './ReviewPage.module.css'

/**
 * /review (optional ?subject=): full-screen focus mode. One card at a time: answer, mark, move
 * on. The session is a snapshot of the cards due when it started; a card FSRS brings back within
 * minutes comes round again once it is due, if the session is still going.
 */
export function ReviewPage() {
  const [params] = useSearchParams()
  const raw = params.get('subject')
  const subject = isSubjectCode(raw) ? raw : undefined
  // A different subject is a different session.
  return <ReviewSession key={subject ?? 'all'} subject={subject} />
}

function ReviewSession({ subject }: { subject?: SubjectCode }) {
  const subjectName = subject ? subjectInfo(subject).name : null
  useDocumentTitle(subjectName ? `${subjectName} review` : 'Review')

  const session = useReviewSession(subject)
  const dueSummary = useDueSummary()
  const navigate = useNavigate()
  const toast = useToast()
  const isDesktop = useIsDesktop()
  const finePointer = useMediaQuery('(pointer: fine)')
  const reduceMotion = useReducedMotion() ?? false
  const online = useOnlineStatus()
  const stage = useRef<HTMLDivElement>(null)
  const { status, current, progress } = session

  // ---- Leaving with an answer in progress asks first ----

  const [unsavedKey, setUnsavedKey] = useState<string | null>(null)
  const onUnsavedChange = useCallback((key: string, unsaved: boolean) => {
    setUnsavedKey((previous) => (unsaved ? key : previous === key ? null : previous))
  }, [])
  const unsaved = current !== null && unsavedKey === current.entry.key

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => unsaved && currentLocation.pathname !== nextLocation.pathname,
    [unsaved],
  )
  const blocker = useBlocker(shouldBlock)

  useEffect(() => {
    if (!unsaved) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Older Safari only prompts when returnValue is set.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [unsaved])

  // ---- Saving and changing marks ----

  const [amendingKey, setAmendingKey] = useState<string | null>(null)
  const amending = amendingKey ? (session.records.find((record) => record.key === amendingKey) ?? null) : null
  // Due counts are only trusted once refreshed after the latest save (for "Keep going"). Saving
  // doesn't wait for that refresh, so until it lands they may still count the card just saved.
  const [lastSavedAt, setLastSavedAt] = useState(0)
  // The answer just saved, while the top bar offers to change its marks.
  const [justSaved, setJustSaved] = useState<string | null>(null)

  const onSaved = (entry: QueueEntry, result: RecordReviewResult, markedAt: Date) => {
    const finishing = session.lastQueued
    const record = session.complete(entry, result, markedAt)
    setLastSavedAt(Date.now())
    // The summary lists every card with its own "Change marks", so the last card needs no notice.
    setJustSaved(finishing ? null : record.key)
  }

  // Where focus goes when Change marks closes and the notice that opened it has gone: back into
  // the card on screen, where it went when the card arrived.
  const cardFocusTarget = () => {
    const view = stage.current?.querySelector(':scope > :not([data-motion-pop-id])')
    const textarea = finePointer ? view?.querySelector('textarea') : null
    return textarea ?? view?.querySelector<HTMLElement>('h1[tabindex], h2[tabindex]') ?? null
  }

  const onMarksChanged = (recordKey: string, result: RecordReviewResult) => {
    session.amend(recordKey, result)
    setAmendingKey(null)
    toast.show({ message: `Marks updated. ${nextReviewLabel(result.card.due, new Date())}.` })
  }

  const keepGoing = async () => {
    const error = await session.restart()
    if (error) toast.show({ message: friendlyError(error), tone: 'error' })
  }

  const moreDue =
    dueSummary.data && dueSummary.dataUpdatedAt >= lastSavedAt ? dueNowCount(dueSummary.data, subject) : 0

  // ---- One view at a time: the card on screen, the summary, or a state ----

  // Each new card (or state) starts at the top of the page. On desktop the next card comes in
  // while the marked one leaves on top of it, so the page goes to the top before it paints. On
  // phones the marked card leaves from where the student was reading (usually its mark scheme)
  // and the page goes to the top once it has gone, before the next card comes in.
  const viewKey = status === 'active' && current ? current.entry.key : status
  const toTop = () => {
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const onViewChange = useEffectEvent(() => {
    if (isDesktop) toTop()
  })
  useLayoutEffect(() => {
    onViewChange()
  }, [viewKey])

  // Cards move along like a pile of paper; the first card and the states fade in. With reduced
  // motion they only fade. On phones the next card waits for the marked one, so that one just
  // fades, quickly, where it is.
  const direction: Direction = progress.completed > 0 ? 1 : 0
  const swapVariants = reduceMotion ? cardFadeVariants : cardSwapVariants
  const viewVariants: Variants = isDesktop ? swapVariants : { ...swapVariants, exit: { opacity: 0, transition: fades.fast } }

  let view: ReactNode
  if (status === 'active' && current) {
    view = (
      <ReviewCard
        entry={current.entry}
        card={current.card}
        number={current.number}
        topicName={session.topicName(current.card.topic_id)}
        retention={session.retention}
        lastQueued={session.lastQueued}
        onSaved={onSaved}
        onSkip={session.skip}
        onUnsavedChange={onUnsavedChange}
      />
    )
  } else if (status === 'finished') {
    view = (
      <SessionSummary
        records={session.records}
        subject={subject}
        moreDue={moreDue}
        held={session.held}
        onKeepGoing={() => void keepGoing()}
        keepingGoing={session.restarting}
        onChangeMarks={setAmendingKey}
      />
    )
  } else if (status === 'empty') {
    view = (
      <div className={styles.state}>
        <NothingDue subject={subject} onRecheck={session.retry} />
      </div>
    )
  } else if (status === 'error') {
    view = (
      <div className={styles.state}>
        <ErrorState
          title="Your cards didn’t load"
          message={friendlyError(session.error)}
          onRetry={session.retry}
          retrying={session.retrying}
        />
      </div>
    )
  } else {
    view = <ReviewSkeleton />
  }

  return (
    <>
      <OfflineBanner />
      <Page as="main" width="wide" className={styles.page} data-offline={online ? undefined : ''}>
        <ReviewTopBar
          onClose={() => void navigate('/')}
          subjectName={subjectName}
          progress={status === 'active' || status === 'finished' ? progress : null}
          saved={
            justSaved
              ? {
                  key: justSaved,
                  onChangeMarks: () => {
                    setAmendingKey(justSaved)
                    setJustSaved(null)
                  },
                  onDone: () => setJustSaved(null),
                }
              : null
          }
        />
        <div ref={stage} className={styles.stage}>
          <AnimatePresence
            mode={isDesktop ? 'popLayout' : 'wait'}
            initial={false}
            custom={direction}
            onExitComplete={isDesktop ? undefined : toTop}
          >
            <motion.div
              key={viewKey}
              className={styles.view}
              custom={direction}
              variants={viewVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {view}
            </motion.div>
          </AnimatePresence>
        </div>
      </Page>

      <ChangeMarksDialog
        record={amending}
        retention={session.retention}
        onClose={() => setAmendingKey(null)}
        onChanged={onMarksChanged}
        returnFocus={cardFocusTarget}
      />
      <LeaveSessionDialog blocker={blocker} />
    </>
  )
}

/** "Leave this session?" for a blocked navigation while an answer is in progress. */
function LeaveSessionDialog({ blocker }: { blocker: Blocker }) {
  // After Leave the dialog closes too; that close must not cancel the navigation.
  const proceeding = useRef(false)
  useEffect(() => {
    if (blocker.state === 'blocked') proceeding.current = false
  }, [blocker.state])

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onClose={() => {
        if (!proceeding.current) blocker.reset?.()
      }}
      onConfirm={() => {
        proceeding.current = true
        blocker.proceed?.()
      }}
      title="Leave this session?"
      confirmLabel="Leave"
      cancelLabel="Stay"
      destructive
    >
      Your current answer won’t be saved. Cards you’ve already marked are kept.
    </ConfirmDialog>
  )
}
