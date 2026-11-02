import { ArrowRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { Button, Chip, cx, ScoreMark, useToast } from '../../components'
import type { RecordReviewResult } from '../../data/api'
import { useElementSize, useIsDesktop, useKeyboardInset, useMediaQuery } from '../../hooks'
import type { CardRow } from '../../lib/database.types'
import { friendlyError } from '../../lib/errors'
import { fades, PEN_DURATIONS, PEN_GAP, springs } from '../../lib/motion'
import { smoothScrollIntoView } from '../../lib/scroll'
import { AnswerSheet } from './AnswerSheet'
import { nextReviewLabel, pointsLabel } from './copy'
import { MarkSchemeCover, MarkSchemePanel } from './MarkSchemePanel'
import { QuestionSheet } from './QuestionSheet'
import type { QueueEntry } from './queue'
import { useCardMarking, type CardMarking } from './useCardMarking'
import { useMarkClock } from './useMarkClock'
import styles from './ReviewCard.module.css'

export interface ReviewCardProps {
  entry: QueueEntry
  card: CardRow
  /** The card's number in the session. */
  number: number
  topicName: string | null
  retention: number
  /** Nothing else is ready to follow this card, so the button reads "Finish". */
  lastQueued: boolean
  onSaved: (entry: QueueEntry, result: RecordReviewResult, markedAt: Date) => void
  /** Move on without saving (the card was deleted elsewhere, or changed and is being left). */
  onSkip: (entry: QueueEntry) => void
  /** Whether leaving now would lose work on this card (typed text or unsaved marks). */
  onUnsavedChange: (entryKey: string, unsaved: boolean) => void
}

/** Seconds after marking before the score is first written: the mark scheme settles first. */
const FIRST_SCORE_DELAY = 0.35
/** Space kept between the Mark button and the on-screen keyboard. */
const KEYBOARD_GAP = 16
/** Space kept between the mark scheme's first point and the docked actions, once marked. */
const DOCK_GAP = 8

function isMissingCard(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P0002'
}

const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/**
 * One card in a review session: the question, the answer sheet, and the mark scheme. Answering
 * and marking happen in place: when the answer is handed in, the text stays on its lines and the
 * mark scheme slides in beside it (desktop) or below it (phone).
 */
export function ReviewCard({
  entry,
  card,
  number,
  topicName,
  retention,
  lastQueued,
  onSaved,
  onSkip,
  onUnsavedChange,
}: ReviewCardProps) {
  const toast = useToast()
  const isDesktop = useIsDesktop()
  const finePointer = useMediaQuery('(pointer: fine)')
  const keyboard = useKeyboardInset()
  const clock = useMarkClock()
  const headingId = useId()

  const questionRef = useRef<HTMLHeadingElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const answerColumnRef = useRef<HTMLDivElement>(null)
  const answerActionsRef = useRef<HTMLDivElement>(null)
  const markColumnRef = useRef<HTMLDivElement>(null)
  const schemeRef = useRef<HTMLDivElement>(null)
  const schemeHeadingRef = useRef<HTMLHeadingElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const errorToast = useRef<string | null>(null)

  // Pen timing for the marks on this card (see useMarkClock).
  const [scoreDraw, setScoreDraw] = useState({ stamp: 0, delay: FIRST_SCORE_DELAY })
  const [tickStamps, setTickStamps] = useState<Record<string, number>>({})

  const marking = useCardMarking({
    card,
    retention,
    onSaved: (result, markedAt) => {
      if (errorToast.current) toast.dismiss(errorToast.current)
      onSaved(entry, result, markedAt)
    },
    onSaveFailed: (error) => {
      errorToast.current = toast.show({
        message: friendlyError(error),
        tone: 'error',
        action: isMissingCard(error) ? { label: 'Skip card', onClick: () => onSkip(entry) } : undefined,
      })
    },
    onCardChanged: () => {
      errorToast.current = toast.show({
        message: 'This card was changed on another device. Check your ticks, then carry on.',
        action: { label: 'Skip card', onClick: () => onSkip(entry) },
      })
    },
  })
  const { phase } = marking
  const answering = phase === 'answering' || phase === 'marking'
  const hasText = marking.answer.trim().length > 0

  useEffect(() => {
    onUnsavedChange(entry.key, marking.unsaved)
  }, [entry.key, marking.unsaved, onUnsavedChange])

  // A new card: on desktop, straight into the answer box. On touch screens the keyboard would
  // jump the layout, so the question takes focus instead (screen readers announce it).
  const focused = useRef(false)
  useEffect(() => {
    if (focused.current) return
    focused.current = true
    if (finePointer) textareaRef.current?.focus({ preventScroll: true })
    else questionRef.current?.focus({ preventScroll: true })
  }, [finePointer])

  // iOS keeps the layout viewport full height under the keyboard, so make sure the line being
  // written and the Mark button sit above it. Only while writing at the end of the answer: when
  // editing further up, the browser keeps the caret in view itself and jumping would lose it.
  const revealAboveKeyboard = useCallback(() => {
    const actions = answerActionsRef.current
    const textarea = textareaRef.current
    if (!actions || !textarea || document.activeElement !== textarea) return
    if (textarea.selectionEnd < textarea.value.length) return
    actions.scrollIntoView({ block: 'nearest' })
    const viewport = window.visualViewport
    if (!viewport) return
    const overlap = actions.getBoundingClientRect().bottom + KEYBOARD_GAP - (viewport.offsetTop + viewport.height)
    if (overlap > 0) window.scrollBy({ top: overlap })
  }, [])

  const onKeyboardChange = useEffectEvent(() => {
    if (keyboard.open && answering) revealAboveKeyboard()
  })
  useEffect(() => {
    onKeyboardChange()
  }, [keyboard.inset])

  // Once marked: move focus to the mark scheme. On phones, when the scheme starts low on the
  // screen, scroll the answer to the top, so the answer, the score being written in its margin
  // and the first points are in view together. A long answer goes further up, only until the
  // first point's wording clears the docked actions.
  const revealed = useRef(false)
  useEffect(() => {
    if (phase !== 'marked' || revealed.current) return
    revealed.current = true
    schemeHeadingRef.current?.focus({ preventScroll: true })
    if (isDesktop) return
    const frame = requestAnimationFrame(() => {
      const answer = answerColumnRef.current
      const column = markColumnRef.current
      const scheme = schemeRef.current
      const point = scheme?.querySelector('li p')
      if (!answer || !column || !scheme || !point) return
      // Measured on the columns, which don't move: the scheme inside is still sliding in.
      const columnTop = column.getBoundingClientRect().top
      // With the keyboard up, iOS may have panned the visible area down the page.
      const panned = window.visualViewport?.offsetTop ?? 0
      if (columnTop - panned <= window.innerHeight * 0.55) return
      // Where the column's top should land on screen: where the answer sits at its CSS scroll
      // margin (status bar included), or higher for a long answer, so the first point's wording
      // clears the dock. The point is measured from the scheme's top, which slides with it.
      const answerTop = answer.getBoundingClientRect().top
      const toAnswer = columnTop - answerTop + parseFloat(getComputedStyle(answer).scrollMarginTop)
      const pointBottom = point.getBoundingClientRect().bottom - scheme.getBoundingClientRect().top
      const dockTop = window.innerHeight - (dockRef.current?.offsetHeight ?? 0)
      // Offline, the strip at the top is the page's scroll padding, and the scroll lands below it.
      const strip = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
      const top = Math.max(0, Math.min(toAnswer, dockTop - DOCK_GAP - pointBottom - strip))
      // Only ever further down the page.
      if (strip + top >= columnTop) return
      column.style.scrollMarginTop = `${top}px`
      smoothScrollIntoView(column, { block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [phase, isDesktop])

  const save = () => {
    // A save under way can't be skipped: the toast offering that goes first.
    if (errorToast.current) toast.dismiss(errorToast.current)
    void marking.save()
  }

  const handIn = (giveUp = false) => {
    if (!answering || (!giveUp && !hasText)) return
    textareaRef.current?.blur()
    setScoreDraw({ stamp: clock.stamp(FIRST_SCORE_DELAY + PEN_DURATIONS.score), delay: FIRST_SCORE_DELAY })
    marking.submit({ giveUp })
  }

  const toggle = (keyPointId: string) => {
    const result = marking.results.find((r) => r.key_point_id === keyPointId)
    if (!result || phase !== 'marked') return
    // A new tick draws first and the score is rewritten after it; taking a tick away rewrites
    // the score straight away.
    const ticking = !result.hit
    const scoreDelay = ticking ? PEN_DURATIONS.tick + PEN_GAP : PEN_GAP
    const stamp = clock.stamp(scoreDelay + PEN_DURATIONS.score)
    if (ticking) setTickStamps((stamps) => ({ ...stamps, [keyPointId]: stamp }))
    setScoreDraw({ stamp, delay: scoreDelay })
    marking.toggle(keyPointId)
  }

  // Cmd/Ctrl + Enter moves on once marked (while typing, the answer box uses it to mark).
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey) || event.defaultPrevented) return
    if (document.querySelector('[role="dialog"]')) return
    event.preventDefault()
    save()
  })
  useEffect(() => {
    if (phase !== 'marked') return
    const listener = (event: KeyboardEvent) => onShortcut(event)
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [phase])

  // The circled score, written in the answer's margin; on phones again, smaller, beside the
  // points in the docked actions, where the student is looking as they tick.
  const scoreMark = (size: 'sm' | 'md') => (
    <ScoreMark
      key={scoreDraw.stamp}
      size={size}
      score={marking.score.hit}
      total={marking.score.total}
      seed={`${card.id}-${marking.score.hit}`}
      delay={scoreDraw.delay}
      instant={clock.isInstant(scoreDraw.stamp)}
    />
  )
  const score = answering ? undefined : scoreMark('md')

  const actions = answering ? null : (
    <MarkedActions
      marking={marking}
      onNext={save}
      finish={lastQueued}
      docked={!isDesktop}
      score={isDesktop ? undefined : scoreMark('sm')}
      shortcut={finePointer}
      dockRef={dockRef}
    />
  )

  return (
    <article
      className={cx(styles.card, !answering && styles.marked)}
      aria-labelledby={headingId}
      onPointerDownCapture={answering ? undefined : clock.skip}
    >
      <QuestionSheet
        question={card.question}
        subject={card.subject}
        topicName={topicName}
        marks={card.key_points.length}
        number={number}
        headingId={headingId}
        headingRef={questionRef}
      />

      <div className={styles.columns}>
        <div ref={answerColumnRef} className={styles.answerColumn}>
          <AnswerSheet
            answer={marking.answer}
            score={score}
            input={
              answering
                ? {
                    onChange: marking.setAnswer,
                    onSubmit: () => handIn(),
                    // Touch only: on desktop there is no keyboard to clear, and the page stays put.
                    onFocus: finePointer ? undefined : () => requestAnimationFrame(revealAboveKeyboard),
                    onResize: () => {
                      if (keyboard.open) requestAnimationFrame(revealAboveKeyboard)
                    },
                    textareaRef,
                  }
                : undefined
            }
          />
          <AnimatePresence initial={false} mode="popLayout">
            {answering ? (
              <motion.div
                key="answer-actions"
                ref={answerActionsRef}
                className={styles.answerActions}
                exit={{ opacity: 0, transition: fades.fast }}
              >
                <Button
                  variant="primary"
                  size="lg"
                  disabled={!hasText}
                  onClick={() => handIn()}
                  aria-keyshortcuts="Meta+Enter Control+Enter"
                >
                  Mark my answer
                </Button>
                <Button variant="ghost" size="lg" onClick={() => handIn(true)}>
                  I don’t know
                </Button>
                {finePointer ? (
                  <p className={styles.shortcut} aria-hidden="true">
                    <kbd>{isApple ? '⌘' : 'Ctrl'}</kbd>
                    <kbd>Enter</kbd>
                    <span className={styles.shortcutText}>to mark</span>
                  </p>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
          {/* Desktop: Next takes the Mark button's place, under the answer it belongs to. */}
          {isDesktop ? actions : null}
        </div>

        <div ref={markColumnRef} className={styles.markColumn}>
          <AnimatePresence initial={false} mode="popLayout">
            {answering ? (
              isDesktop ? (
                <motion.div key="cover" exit={{ opacity: 0, transition: fades.fast }}>
                  <MarkSchemeCover count={card.key_points.length} />
                </motion.div>
              ) : null
            ) : (
              <motion.div
                key="scheme"
                ref={schemeRef}
                className={styles.scheme}
                initial={{ opacity: 0, x: isDesktop ? 24 : 0, y: isDesktop ? 0 : 24 }}
                animate={{ opacity: 1, x: 0, y: 0, transition: { ...springs.gentle, opacity: fades.base } }}
              >
                <MarkSchemePanel
                  results={marking.results}
                  keyPoints={card.key_points}
                  onToggle={toggle}
                  disabled={phase !== 'marked'}
                  headingRef={schemeHeadingRef}
                  description={
                    hasText ? undefined : 'This is what an examiner looks for. Read it through, then move on.'
                  }
                  isInstant={(id) => clock.isInstant(tickStamps[id] ?? 0)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {isDesktop ? null : actions}
    </article>
  )
}

interface MarkedActionsProps {
  marking: CardMarking
  onNext: () => void
  finish: boolean
  /** Phones: pinned to the bottom of the screen while the card is in view. */
  docked: boolean
  /** A small copy of the circled score, drawn beside the points line. */
  score?: ReactNode
  /** Show the Ctrl/⌘ + Enter shortcut beside Next (fine pointers, where there's room). */
  shortcut: boolean
  dockRef: RefObject<HTMLDivElement | null>
}

/** The score, the consequence for the schedule, "That was easy" and the way on. */
function MarkedActions({ marking, onNext, finish, docked, score: scoreMark, shortcut, dockRef }: MarkedActionsProps) {
  const size = useElementSize(dockRef)
  const { score, nextDue, markedAt, phase } = marking

  // While docked, toasts (portalled to <body>) sit above the bar instead of covering Next, and a
  // point reached with Tab scrolls clear of it. Once saved the card is on its way out.
  const dockHeight = docked && phase !== 'saved' ? Math.round(size?.height ?? 0) : 0
  useLayoutEffect(() => {
    if (!dockHeight) return
    const body = document.body
    const root = document.documentElement
    body.style.setProperty('--toast-bottom', `calc(${dockHeight}px + var(--space-1))`)
    root.style.scrollPaddingBottom = `${dockHeight}px`
    return () => {
      body.style.removeProperty('--toast-bottom')
      root.style.removeProperty('scroll-padding-bottom')
    }
  }, [dockHeight])

  return (
    <motion.div
      ref={dockRef}
      className={cx(styles.dock, docked && styles.docked)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { ...springs.gentle, opacity: fades.base, delay: 0.05 } }}
    >
      <AnimatePresence initial={false}>
        {marking.fullMarks ? (
          <motion.div
            key="easy"
            className={styles.easy}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1, transition: { ...springs.ui, opacity: fades.fast } }}
            exit={{ opacity: 0, scale: 0.94, transition: fades.fast }}
          >
            <Chip selected={marking.easy} onClick={() => marking.setEasy(!marking.easy)} disabled={phase !== 'marked'}>
              That was easy
            </Chip>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className={styles.result}>
        {/* Outside the live region: the line beside it already says the score. */}
        {scoreMark ? (
          <span className={styles.dockScore} aria-hidden="true">
            {scoreMark}
          </span>
        ) : null}
        <div className={styles.status} aria-live="polite" aria-atomic="true">
          <p className={cx(styles.scoreLine, 'tabular-nums')}>{pointsLabel(score.hit, score.total)}</p>
          {nextDue && markedAt ? <p className={styles.dueLine}>{nextReviewLabel(nextDue, markedAt)}</p> : null}
        </div>
      </div>
      <div className={styles.go}>
        {shortcut ? (
          <p className={cx(styles.shortcut, styles.nextShortcut)} aria-hidden="true">
            <kbd>{isApple ? '⌘' : 'Ctrl'}</kbd>
            <kbd>Enter</kbd>
          </p>
        ) : null}
        <Button
          variant="primary"
          size="lg"
          className={styles.next}
          loading={phase === 'saving'}
          disabled={phase === 'saved'}
          trailingIcon={finish ? undefined : <ArrowRight />}
          aria-keyshortcuts="Meta+Enter Control+Enter"
          onClick={onNext}
        >
          {finish ? 'Finish' : 'Next card'}
        </Button>
      </div>
    </motion.div>
  )
}
