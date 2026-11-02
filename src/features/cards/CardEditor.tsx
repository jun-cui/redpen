import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  Button,
  ConfirmDialog,
  Page,
  PageHeader,
  SegmentedControl,
  TextArea,
  useToast,
} from '../../components'
import { useCreateCard, useDeleteCard, useUpdateCard } from '../../data/hooks'
import { useIsDesktop } from '../../hooks'
import type { CardRow } from '../../lib/database.types'
import { friendlyError } from '../../lib/errors'
import { fades, springs } from '../../lib/motion'
import { smoothScrollIntoView } from '../../lib/scroll'
import type { KeyPoint, SubjectCode } from '../../lib/types'
import { subjectSegments, useSubjectLabelStyle } from '../topics/subjectSegments'
import { TopicSelect } from '../topics/TopicSelect'
import { useActiveTopics } from '../topics/topicUtils'
import { ReviewHistory, ScheduleFacts } from './CardHistory'
import styles from './CardEditor.module.css'
import { CardPreview } from './CardPreview'
import {
  blankForm,
  blankPoint,
  COUNTER_FROM,
  errorOrder,
  formFromCard,
  isDirty,
  LIMITS,
  readReturnTo,
  toDraft,
  validateForm,
  type CardForm,
  type FieldKey,
  type FormErrors,
} from './editorModel'
import { KeyPointsEditor } from './KeyPointsEditor'
import { rememberSubject } from './lastSubject'
import { DiscardChangesDialog, useUnsavedChangesGuard } from './useUnsavedChangesGuard'
import { useNow } from './useNow'

export interface CardEditorProps {
  /** The card being edited; omitted for a new card. */
  card?: CardRow
  /** Subject for a new card. */
  initialSubject: SubjectCode
  /**
   * Called with true when a delete starts saving and false if it fails, so the page can keep
   * showing the card while it leaves the cache (it navigates away once the delete is saved).
   */
  onDeletingChange?: (deleting: boolean) => void
}

type SaveMode = 'close' | 'another'

const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const charCount = (text: string) => [...text].length

/**
 * The card form: subject, topic, question and mark scheme, with a live preview beside it on
 * desktop. Editing an existing card adds its schedule, review history and delete.
 */
export function CardEditor({ card, initialSubject, onDeletingChange }: CardEditorProps) {
  const isNew = card === undefined
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = readReturnTo(location.state)
  const toast = useToast()
  const isDesktop = useIsDesktop()
  const now = useNow()
  const previewId = useId()

  const createCard = useCreateCard()
  const updateCard = useUpdateCard()
  const pauseCard = useUpdateCard()
  const deleteCard = useDeleteCard()

  const [baseline, setBaseline] = useState<CardForm>(() => (card ? formFromCard(card) : blankForm(initialSubject)))
  const [form, setForm] = useState<CardForm>(baseline)
  const [touched, setTouched] = useState<ReadonlySet<FieldKey>>(() => new Set())
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState<SaveMode | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingSuspended, setPendingSuspended] = useState<boolean | null>(null)

  const topicRef = useRef<HTMLSelectElement>(null)
  const questionRef = useRef<HTMLTextAreaElement>(null)
  const addPointRef = useRef<HTMLButtonElement>(null)
  const pointRefs = useRef(new Map<string, HTMLTextAreaElement>())
  const subjectFieldRef = useRef<HTMLDivElement>(null)
  const subjectLabels = useSubjectLabelStyle(subjectFieldRef, 4, 'md')

  // Topics: required unless the subject is known to have none.
  const topics = useActiveTopics(form.subject)
  const topicRequired = !(topics.isSuccess && topics.active.length === 0)
  const savedTopicId = card?.topic_id ?? null
  const validTopicIds = useMemo(() => {
    const ids = new Set(topics.active.map((topic) => topic.id))
    // An existing card may keep the archived topic it already has.
    if (savedTopicId && topics.all?.some((topic) => topic.id === savedTopicId)) ids.add(savedTopicId)
    return ids
  }, [topics.active, topics.all, savedTopicId])
  // undefined while the topics load, so the preview doesn't flash "No topic" for a filed card.
  const topicName = form.topicId
    ? topics.all
      ? (topics.all.find((topic) => topic.id === form.topicId)?.name ?? null)
      : undefined
    : null

  const errors = validateForm(form, { topicRequired, validTopicIds })
  const visibleErrors: FormErrors = submitted
    ? errors
    : Object.fromEntries(Object.entries(errors).filter(([key]) => touched.has(key as FieldKey)))
  const dirty = isDirty(form, baseline, isNew)
  const { blocker, allowNavigation } = useUnsavedChangesGuard(dirty)

  const touch = (key: FieldKey) =>
    setTouched((current) => (current.has(key) ? current : new Set(current).add(key)))

  const leave = () => {
    if (returnTo) navigate(-1)
    else navigate('/cards', { replace: true })
  }

  const focusField = (key: FieldKey) => {
    const element =
      key === 'topic'
        ? topicRef.current
        : key === 'question'
          ? questionRef.current
          : key === 'points'
            ? addPointRef.current
            : pointRefs.current.get(key.slice('point:'.length))
    if (!element) return
    element.focus({ preventScroll: true })
    smoothScrollIntoView(element, { block: 'center' })
  }

  const save = async (mode: SaveMode) => {
    if (saving) return
    setSubmitted(true)
    const firstInvalid = errorOrder(form).find((key) => errors[key])
    if (firstInvalid) {
      focusField(firstInvalid)
      return
    }
    if (!isNew && !dirty) {
      allowNavigation()
      leave()
      return
    }

    setSaving(mode)
    const draft = toDraft(form)
    try {
      if (isNew) await createCard.mutateAsync(draft)
      else await updateCard.mutateAsync({ id: card.id, patch: draft })
    } catch (error) {
      // Everything typed stays in the form; the person can try again.
      toast.show({ message: friendlyError(error), tone: 'error' })
      setSaving(null)
      return
    }

    rememberSubject(form.subject)
    toast.show({ message: 'Card saved' })
    if (mode === 'another') {
      const next = blankForm(form.subject, form.topicId)
      setBaseline(next)
      setForm(next)
      setTouched(new Set())
      setSubmitted(false)
      setSaving(null)
      requestAnimationFrame(() => {
        const question = questionRef.current
        if (!question) return
        question.focus({ preventScroll: true })
        smoothScrollIntoView(question, { block: 'center' })
      })
      return
    }
    allowNavigation()
    leave()
  }

  // Cmd/Ctrl+Enter saves from anywhere in the form. The submit waits a frame so a tag still
  // being typed is added first (TagInput adds it on the same key press).
  const onFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    const formElement = event.currentTarget
    requestAnimationFrame(() => formElement.requestSubmit())
  }

  const changeSubject = (subject: SubjectCode) => {
    if (subject === form.subject) return
    setForm((current) => ({ ...current, subject, topicId: null }))
  }

  const setPoints = (update: (points: KeyPoint[]) => KeyPoint[]) =>
    setForm((current) => ({ ...current, points: update(current.points) }))

  const suspended = card ? (pendingSuspended ?? card.suspended) : false
  const setSuspended = (next: boolean) => {
    if (!card) return
    setPendingSuspended(next)
    pauseCard
      .mutateAsync({ id: card.id, patch: { suspended: next } })
      .then(() => toast.show({ message: next ? 'Reviews paused for this card' : 'Reviews resumed for this card' }))
      .catch((error: unknown) => toast.show({ message: friendlyError(error), tone: 'error' }))
      .finally(() => setPendingSuspended(null))
  }

  const confirmDelete = async () => {
    if (!card) return
    onDeletingChange?.(true)
    try {
      await deleteCard.mutateAsync(card.id)
    } catch (error) {
      onDeletingChange?.(false)
      toast.show({ message: friendlyError(error), tone: 'error' })
      throw error
    }
    toast.show({ message: 'Card deleted' })
    allowNavigation()
    leave()
  }

  const questionCount = charCount(form.question)
  const preview = (
    <CardPreview subject={form.subject} topicName={topicName} question={form.question} points={form.points} />
  )

  return (
    <Page width="wide">
      <PageHeader back={{ to: returnTo ?? '/cards', label: 'Cards' }} title={isNew ? 'New card' : 'Edit card'} />

      <div className={isNew ? styles.layoutNew : styles.layoutEdit}>
        <form className={styles.form} noValidate onSubmit={(event) => {
          event.preventDefault()
          void save('close')
        }} onKeyDown={onFormKeyDown} aria-label={isNew ? 'New card' : 'Edit card'}>
          <div className={styles.filing}>
            <div ref={subjectFieldRef} className={styles.subjectField}>
              <span className={styles.fieldLabel} aria-hidden="true">
                Subject
              </span>
              <SegmentedControl
                label="Subject"
                options={subjectSegments(subjectLabels)}
                value={form.subject}
                onChange={changeSubject}
                fullWidth
              />
            </div>

            <TopicSelect
              ref={topicRef}
              subject={form.subject}
              value={form.topicId}
              onChange={(topicId) => {
                setForm((current) => ({ ...current, topicId }))
                touch('topic')
              }}
              onBlur={() => touch('topic')}
              error={visibleErrors.topic}
              labelAside={
                <Link to={`/settings/topics?subject=${form.subject}`} className={styles.manageLink}>
                  Manage topics
                </Link>
              }
            />
          </div>

          <TextArea
            ref={questionRef}
            label="Question"
            autoGrow
            rows={3}
            maxRows={14}
            placeholder="e.g. State Newton’s first law of motion."
            hint="A recall question: define, state, describe or explain."
            value={form.question}
            error={visibleErrors.question}
            labelAside={
              questionCount >= COUNTER_FROM.question ? (
                <span className={questionCount > LIMITS.question ? styles.countOver : styles.count}>
                  {questionCount.toLocaleString('en-GB')} / {LIMITS.question.toLocaleString('en-GB')}
                </span>
              ) : undefined
            }
            onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))}
            onBlur={() => touch('question')}
            textareaClassName={styles.questionInput}
          />

          <KeyPointsEditor
            points={form.points}
            onChange={setPoints}
            errors={visibleErrors}
            onBlurPoint={(id) => touch(`point:${id}`)}
            registerPoint={(id, node) => {
              if (node) pointRefs.current.set(id, node)
              else pointRefs.current.delete(id)
            }}
            addButtonRef={addPointRef}
            newPoint={blankPoint}
          />

          {!isDesktop ? (
            <div className={styles.previewDisclosure}>
              <Button
                variant="ghost"
                leadingIcon={previewOpen ? <EyeOff /> : <Eye />}
                aria-expanded={previewOpen}
                aria-controls={previewOpen ? previewId : undefined}
                onClick={() => setPreviewOpen((open) => !open)}
                className={styles.previewToggle}
              >
                {previewOpen ? 'Hide preview' : 'Preview'}
              </Button>
              <AnimatePresence initial={false}>
                {previewOpen ? (
                  <motion.div
                    id={previewId}
                    key="preview"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { y: springs.gentle, opacity: fades.base } }}
                    exit={{ opacity: 0, transition: fades.fast }}
                  >
                    {preview}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}

          <div className={styles.actions}>
            <Button
              type="submit"
              variant="primary"
              loading={saving === 'close'}
              disabled={saving === 'another'}
              className={styles.primaryAction}
            >
              Save card
            </Button>
            {isNew ? (
              <Button
                onClick={() => void save('another')}
                loading={saving === 'another'}
                disabled={saving === 'close'}
              >
                Save and add another
              </Button>
            ) : null}
            <Button variant="ghost" onClick={leave} disabled={saving !== null}>
              Cancel
            </Button>
            {isDesktop ? (
              <span className={styles.shortcut}>
                <kbd>{isApple ? '⌘' : 'Ctrl'}</kbd>
                <kbd>Enter</kbd> to save
              </span>
            ) : null}
          </div>
        </form>

        {card || isDesktop ? (
          <div className={styles.side}>
            {card ? (
              <ScheduleFacts card={card} now={now} suspended={suspended} onSuspendedChange={setSuspended} />
            ) : null}
            {isDesktop ? (
              <section aria-labelledby={`${previewId}-title`} className={styles.previewPanel}>
                <h2 id={`${previewId}-title`} className={styles.sideTitle}>
                  Preview
                </h2>
                {preview}
              </section>
            ) : null}
          </div>
        ) : null}

        {card ? (
          <>
            <ReviewHistory cardId={card.id} now={now} className={styles.history} />
            <div className={styles.danger}>
              <Button variant="danger" leadingIcon={<Trash2 />} onClick={() => setDeleteOpen(true)}>
                Delete card
              </Button>
            </div>
          </>
        ) : null}
      </div>

      <DiscardChangesDialog blocker={blocker} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Delete this card?"
        confirmLabel="Delete card"
        destructive
      >
        Its review history goes with it. Points you missed stay in your mistake log. This can’t be undone.
      </ConfirmDialog>
    </Page>
  )
}
