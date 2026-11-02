// Dev-only living styleguide (/dev/styleguide): every design-system component, pen mark and token
// in both themes. Not shipped in production builds.

import { ArrowRight, Plus, RotateCcw, Search, Settings, Star, Trash2, X } from 'lucide-react'
import { MotionConfig } from 'motion/react'
import { useState, type ReactNode } from 'react'
import {
  Badge,
  BrandMark,
  Button,
  ButtonLink,
  CategoryBadge,
  Chip,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  IconProvider,
  Page,
  PageHeader,
  PasswordField,
  PenCircle,
  PenCross,
  PenNote,
  PenStrike,
  PenTick,
  PenUnderline,
  ProgressBar,
  ScoreMark,
  SegmentedControl,
  Select,
  Sheet,
  Skeleton,
  SkeletonText,
  Spinner,
  Stat,
  SubjectBadge,
  Switch,
  TextArea,
  TextField,
  ThemeSwitch,
  ToastProvider,
  useToast,
  Wordmark,
} from '../components'
import { penTiming } from '../lib/motion'
import { SUBJECTS } from '../lib/subjects'
import type { CardCategory, SubjectCode } from '../lib/types'
import styles from './StyleguidePage.module.css'

const SECTIONS = [
  ['brand', 'Brand'],
  ['colour', 'Colour'],
  ['type', 'Type'],
  ['space', 'Space and depth'],
  ['buttons', 'Buttons'],
  ['forms', 'Forms'],
  ['badges', 'Badges'],
  ['paper', 'Paper'],
  ['pen', 'Pen marks'],
  ['feedback', 'Feedback'],
  ['stats', 'Stats'],
] as const

export function StyleguidePage() {
  return (
    <MotionConfig reducedMotion="user">
      <IconProvider>
        <ToastProvider>
          <Page width="wide">
            <PageHeader
              eyebrow="Development"
              title="Styleguide"
              description="Every piece of the Redpen design system in one place. Switch themes to check both papers."
              actions={<ThemeSwitch size="sm" />}
            />
            <div className={styles.layout}>
              <nav className={styles.nav} aria-label="Styleguide sections">
                {SECTIONS.map(([id, title]) => (
                  <a key={id} href={`#${id}`} className={styles.navLink}>
                    {title}
                  </a>
                ))}
              </nav>
              <div className={styles.sections}>
                <BrandSection />
                <ColourSection />
                <TypeSection />
                <SpaceSection />
                <ButtonsSection />
                <FormsSection />
                <BadgesSection />
                <PaperSection />
                <PenSection />
                <FeedbackSection />
                <StatsSection />
              </div>
            </div>
          </Page>
        </ToastProvider>
      </IconProvider>
    </MotionConfig>
  )
}

function Section({ id, title, note, aside, children }: { id: string; title: string; note?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 id={`${id}-title`} className={styles.sectionTitle}>
            {title}
          </h2>
          {note ? <p className={styles.sectionNote}>{note}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Subhead({ children }: { children: ReactNode }) {
  return <h3 className={styles.subhead}>{children}</h3>
}

function ReplayButton({ onReplay }: { onReplay: () => void }) {
  return (
    <Button size="sm" variant="ghost" leadingIcon={<RotateCcw />} onClick={onReplay}>
      Replay
    </Button>
  )
}

// ---------------------------------------------------------------------------

function BrandSection() {
  const [run, setRun] = useState(0)
  return (
    <Section id="brand" title="Brand" note="A red pen tick on good paper." aside={<ReplayButton onReplay={() => setRun((n) => n + 1)} />}>
      <div className={styles.row} key={run}>
        <BrandMark size={24} />
        <BrandMark size={32} />
        <BrandMark size={48} animated />
        <BrandMark size={64} tile animated delay={0.2} />
        <BrandMark size={96} tile title="Redpen" animated delay={0.35} />
      </div>
      <div className={styles.row} key={`w${run}`}>
        <Wordmark size="sm" />
        <Wordmark size="md" />
        <Wordmark size="lg" animated />
      </div>
    </Section>
  )
}

const COLOUR_GROUPS: Array<[string, string[]]> = [
  ['Paper', ['paper', 'paper-raised', 'paper-sunken']],
  ['Ink', ['ink', 'ink-2', 'ink-3']],
  ['Lines', ['rule', 'rule-strong', 'control-border', 'margin-line']],
  ['Red pen', ['red', 'red-strong', 'red-fill', 'red-fill-hover', 'red-tint', 'red-tint-strong']],
]

function ColourSection() {
  return (
    <Section id="colour" title="Colour" note="Red is the only strong colour. It means marking, the brand, a primary action or an error.">
      {COLOUR_GROUPS.map(([group, names]) => (
        <div key={group}>
          <Subhead>{group}</Subhead>
          <div className={styles.swatches}>
            {names.map((name) => {
              const isInk = group === 'Ink' || name === 'red' || name === 'red-strong'
              return (
                <div key={name} className={styles.swatch}>
                  <div
                    className={styles.chip}
                    style={
                      isInk
                        ? { color: `var(--color-${name})`, backgroundColor: 'var(--color-paper-raised)' }
                        : {
                            backgroundColor: `var(--color-${name})`,
                            color: name.startsWith('red-fill') ? 'var(--color-on-red)' : 'var(--color-ink)',
                          }
                    }
                  >
                    {isInk || name.startsWith('red-fill') ? 'Aa' : null}
                  </div>
                  <span className={styles.swatchName}>--color-{name}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </Section>
  )
}

function TypeSection() {
  const rows: Array<[string, ReactNode]> = [
    ['Display · serif 48', <span className={styles.display}>Marked in red</span>],
    ['Title · serif 36', <span className={styles.serif} style={{ fontSize: 'var(--text-3xl)' }}>Today’s review</span>],
    ['Heading · serif 28', <span className={styles.serif} style={{ fontSize: 'var(--text-2xl)' }}>Weakest topics</span>],
    ['Subhead · serif 22', <span className={styles.serif} style={{ fontSize: 'var(--text-xl)' }}>Waves and particles</span>],
    [
      'Question · serif 22–28',
      <span className={styles.question}>
        Define the de Broglie wavelength λ of a particle, and state how it depends on the momentum p.
      </span>,
    ],
    ['Greek fallback', <span className={styles.question}>λ, Ω, μ, θ, Δx, ε₀, ∑, √2 and x² in Fraunces with Literata</span>],
    ['Body · sans 16', <span>Type your answer, then mark each key point as hit or missed. We schedule the card from your score.</span>],
    ['Small · sans 14', <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)' }}>Next review in 3 days</span>],
    ['Eyebrow · sans 12', <span className={styles.subhead} style={{ margin: 0 }}>Physics · Quantum</span>],
    ['Hand · Caveat 26', <span className="hand">constant velocity, not just speed</span>],
  ]
  return (
    <Section id="type" title="Type" note="Fraunces for headings and questions, Inter for the interface, Caveat for the examiner’s hand.">
      <Sheet padding="md">
        {rows.map(([label, sample]) => (
          <div key={label} className={styles.typeRow}>
            <span className={styles.caption}>{label}</span>
            {sample}
          </div>
        ))}
      </Sheet>
    </Section>
  )
}

function SpaceSection() {
  const spaces = ['half', '1', '2', '3', '4', '5', '6', '8', '10']
  return (
    <Section id="space" title="Space and depth" note="An 8px grid. Paper has crisp 6px corners and soft, layered shadows.">
      <div className={styles.grid2}>
        <div className={styles.stack} style={{ gap: 'var(--space-1)' }}>
          <Subhead>Spacing</Subhead>
          {spaces.map((space) => (
            <div key={space} className={styles.spaceRow}>
              <span className={`${styles.caption} ${styles.spaceLabel}`}>--space-{space}</span>
              <span className={styles.spaceBar} style={{ width: `var(--space-${space})` }} />
            </div>
          ))}
        </div>
        <div className={styles.stack}>
          <div>
            <Subhead>Radii</Subhead>
            <div className={styles.row}>
              {['xs', 'sheet', 'sm', 'md', 'lg'].map((radius) => (
                <span key={radius} className={styles.tile} style={{ borderRadius: `var(--radius-${radius})`, boxShadow: 'var(--sheet-edge), var(--shadow-xs)' }}>
                  {radius}
                </span>
              ))}
            </div>
          </div>
          <div>
            <Subhead>Shadows</Subhead>
            <div className={styles.row}>
              {['xs', 'sheet', 'lifted'].map((shadow) => (
                <span key={shadow} className={styles.tile} style={{ borderRadius: 'var(--radius-sheet)', boxShadow: `var(--sheet-edge), var(--shadow-${shadow})` }}>
                  {shadow}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

function ButtonsSection() {
  const [loading, setLoading] = useState(false)
  const [starred, setStarred] = useState(false)
  const startLoading = () => {
    setLoading(true)
    window.setTimeout(() => setLoading(false), 1600)
  }
  return (
    <Section id="buttons" title="Buttons" note="One red primary action per screen. Secondary is ink on paper. Every button is at least 44px tall.">
      <div>
        <Subhead>Variants</Subhead>
        <div className={styles.row}>
          <Button variant="primary">Start review</Button>
          <Button>Edit card</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="danger" leadingIcon={<Trash2 />}>
            Delete card
          </Button>
        </div>
      </div>
      <div>
        <Subhead>Sizes and icons</Subhead>
        <div className={styles.row}>
          <Button variant="primary" size="sm" leadingIcon={<Plus />}>
            New card
          </Button>
          <Button variant="primary" leadingIcon={<Plus />}>
            New card
          </Button>
          <Button variant="primary" size="lg" trailingIcon={<ArrowRight />}>
            Start review
          </Button>
          <Button size="sm" trailingIcon={<ArrowRight />}>
            See all
          </Button>
        </div>
      </div>
      <div>
        <Subhead>States</Subhead>
        <div className={styles.row}>
          <Button variant="primary" loading={loading} onClick={startLoading}>
            Save card
          </Button>
          <Button loading={loading} onClick={startLoading}>
            Save draft
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </div>
      <div className={styles.grid2}>
        <div>
          <Subhead>Full width</Subhead>
          <div className={styles.stack} style={{ gap: 'var(--space-1)' }}>
            <Button variant="primary" fullWidth>
              Check my answer
            </Button>
            <ButtonLink to="/dev/styleguide#buttons" fullWidth>
              A link styled as a button
            </ButtonLink>
          </div>
        </div>
        <div>
          <Subhead>Icon buttons</Subhead>
          <div className={styles.row}>
            <IconButton label="Search" icon={<Search />} />
            <IconButton label="Settings" icon={<Settings />} variant="secondary" />
            <IconButton label="Add card" icon={<Plus />} variant="primary" />
            <IconButton label="Close" icon={<X />} size="sm" />
            <IconButton
              label="Favourite"
              icon={<Star />}
              selected={starred}
              aria-pressed={starred}
              onClick={() => setStarred((v) => !v)}
            />
          </div>
        </div>
      </div>
    </Section>
  )
}

function FormsSection() {
  const [answer, setAnswer] = useState('')
  const [subject, setSubject] = useState<SubjectCode | ''>('')
  const [easy, setEasy] = useState(true)
  const [reminders, setReminders] = useState(false)
  const [view, setView] = useState<'due' | 'all' | 'weak'>('due')
  const [filters, setFilters] = useState<SubjectCode[]>(['physics'])
  const toggleFilter = (code: SubjectCode) =>
    setFilters((list) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]))

  return (
    <Section id="forms" title="Forms" note="Labels above controls, 16px text so iOS never zooms, errors in calm red with an icon.">
      <div className={styles.grid2}>
        <div className={styles.stack}>
          <TextField label="Email" type="email" autoComplete="email" placeholder="you@example.com" hint="We only use it to sign you in." />
          <TextField label="Display name" defaultValue="Sam" error="Use 2 to 40 characters." />
          <PasswordField label="Password" autoComplete="current-password" labelAside={<a href="#forms">Forgot password?</a>} />
          <Select label="Subject" placeholder="Choose a subject" value={subject} onChange={(e) => setSubject(e.target.value as SubjectCode)}>
            {SUBJECTS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.stack}>
          <TextArea
            label="Your answer"
            autoGrow
            maxRows={8}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Write it as you would in the exam"
            hint="Grows as you type."
          />
          <TextField label="Topic notes" optional placeholder="Anything to remember" />
          <div>
            <Switch checked={easy} onChange={setEasy} label="Offer “That was easy”" description="Shown after full marks, to space the card out further." />
            <Switch checked={reminders} onChange={setReminders} label="Daily reminder" />
          </div>
        </div>
      </div>
      <div className={styles.grid2}>
        <div>
          <Subhead>Segmented control</Subhead>
          <SegmentedControl
            label="Cards to show"
            value={view}
            onChange={setView}
            fullWidth
            options={[
              { value: 'due', label: 'Due' },
              { value: 'all', label: 'All' },
              { value: 'weak', label: 'Weak' },
            ]}
          />
        </div>
        <div>
          <Subhead>Filter chips</Subhead>
          <div className={styles.row} style={{ gap: 'var(--space-1)' }}>
            {SUBJECTS.map((s, index) => (
              <Chip key={s.code} selected={filters.includes(s.code)} onClick={() => toggleFilter(s.code)} count={[12, 7, 18, 4][index]}>
                {s.name}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

function BadgesSection() {
  const categories: CardCategory[] = ['new', 'learning', 'weak', 'mastered']
  return (
    <Section id="badges" title="Badges" note="Categories are told apart by ink tone, outline and glyph. Only Weak is in red, like a margin note.">
      <div>
        <Subhead>Card categories</Subhead>
        <div className={styles.row} style={{ gap: 'var(--space-1)' }}>
          {categories.map((category) => (
            <CategoryBadge key={category} category={category} />
          ))}
        </div>
      </div>
      <div>
        <Subhead>Subjects</Subhead>
        <div className={styles.row}>
          {SUBJECTS.map((s) => (
            <SubjectBadge key={s.code} subject={s.code} />
          ))}
        </div>
        <div className={styles.row} style={{ marginTop: 'var(--space-2)', gap: 'var(--space-1)' }}>
          {SUBJECTS.map((s) => (
            <SubjectBadge key={s.code} subject={s.code} compact />
          ))}
        </div>
      </div>
      <div>
        <Subhead>Badge tones</Subhead>
        <div className={styles.row} style={{ gap: 'var(--space-1)' }}>
          <Badge>Due today</Badge>
          <Badge tone="outline">Example</Badge>
          <Badge tone="ink">AI marked</Badge>
          <Badge tone="red">2 missed</Badge>
        </div>
      </div>
    </Section>
  )
}

function PaperSection() {
  return (
    <Section id="paper" title="Paper" note="Sheets are the surfaces everything sits on. Ruled sheets with a red margin are for answers.">
      <div className={styles.grid3}>
        <Sheet elevation="flat">
          <p className={styles.caption}>flat</p>
          <p>For list rows and quiet panels.</p>
        </Sheet>
        <Sheet>
          <p className={styles.caption}>raised</p>
          <p>The default sheet for content.</p>
        </Sheet>
        <Sheet elevation="lifted">
          <p className={styles.caption}>lifted</p>
          <p>The card in focus, and dialogs.</p>
        </Sheet>
      </div>
      <div className={styles.grid2}>
        <Sheet ruled margin padding="lg">
          <p className={styles.answer}>
            Electrons show diffraction when passed through a thin crystal, so they behave as waves. The spacing of the rings
            gives the wavelength, which matches h/p.
          </p>
        </Sheet>
        <Sheet as="article" interactive padding="md" tabIndex={0}>
          <p className={styles.caption}>interactive</p>
          <p className={styles.questionText} style={{ marginBottom: 0 }}>
            State what is meant by the work function of a metal.
          </p>
        </Sheet>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------

function PenSection() {
  const [run, setRun] = useState(0)
  const replay = () => setRun((n) => n + 1)
  return (
    <Section
      id="pen"
      title="Pen marks"
      note="Seeded, hand-drawn strokes with pen pressure. The same seed always draws the same mark. With reduced motion they fade in instead."
      aside={<ReplayButton onReplay={replay} />}
    >
      <div className={styles.markGrid} key={run}>
        <div className={styles.markCell}>
          <div className={styles.row} style={{ gap: 'var(--space-1)' }}>
            <PenTick seed="kp_a" />
            <PenTick seed="kp_b" delay={0.15} />
            <PenTick seed="kp_c" delay={0.3} />
          </div>
          <span className={styles.caption}>PenTick</span>
        </div>
        <div className={styles.markCell}>
          <div className={styles.row} style={{ gap: 'var(--space-1)' }}>
            <PenCross seed="x_a" />
            <PenCross seed="x_b" delay={0.2} />
          </div>
          <span className={styles.caption}>PenCross</span>
        </div>
        <div className={styles.markCell}>
          <span className={styles.struck}>
            speed in a line
            <PenStrike seed="strike-demo" />
          </span>
          <span className={styles.caption}>PenStrike</span>
        </div>
        <div className={styles.markCell}>
          <span className={styles.struck}>
            resultant force
            <PenUnderline seed="underline-demo" />
          </span>
          <span className={styles.caption}>PenUnderline</span>
        </div>
        <div className={styles.markCell}>
          <PenCircle seed="ring" width={72} height={52} />
          <span className={styles.caption}>PenCircle</span>
        </div>
        <div className={styles.markCell}>
          <ScoreMark score={3} total={4} />
          <span className={styles.caption}>ScoreMark</span>
        </div>
        <div className={styles.markCell}>
          <ScoreMark score={11} total={12} size="lg" seed="big" />
          <span className={styles.caption}>ScoreMark lg</span>
        </div>
        <div className={styles.markCell}>
          <PenNote>not just speed</PenNote>
          <span className={styles.caption}>PenNote</span>
        </div>
      </div>
      <MarkedAnswer key={`answer-${run}`} />
    </Section>
  )
}

const MARK_ORDER = ['strike', 'note', 'tick', 'tick', 'cross', 'missing', 'score'] as const

/** A preview of Stage 2 marking: the whole sequence finishes within ~1.5s; tap to skip. */
function MarkedAnswer() {
  const [instant, setInstant] = useState(false)
  const [strike, note, tickA, tickB, cross, missing, score] = penTiming(MARK_ORDER, { start: 0.3 })
  const slot = (s: typeof strike) => (s ? { delay: s.delay, duration: s.duration, instant } : { instant })

  return (
    <div>
      <Subhead>A marked answer (tap the sheet to skip)</Subhead>
      <Sheet ruled margin padding="lg" elevation="lifted" className={styles.markedSheet} onClick={() => setInstant(true)}>
        <p className={styles.questionText}>State Newton’s first law of motion.</p>
        <p className={styles.answer}>
          An object stays at rest or keeps moving at a constant{' '}
          <span className={styles.target}>
            speed
            <PenStrike seed="demo-strike" {...slot(strike)} />
          </span>
          <PenNote className={styles.inlineNote} {...slot(note)}>
            velocity
          </PenNote>{' '}
          unless a resultant force acts on it.
        </p>
        <ol className={styles.points} role="list">
          <li className={styles.point}>
            <span className={styles.pointMark}>
              <PenTick seed="kp1" label="Point earned" {...slot(tickA)} />
            </span>
            Stays at rest or moves with constant velocity
          </li>
          <li className={styles.point}>
            <span className={styles.pointMark}>
              <PenTick seed="kp2" label="Point earned" {...slot(tickB)} />
            </span>
            Unless acted on by a resultant force
          </li>
          <li className={styles.point}>
            <span className={styles.pointMark}>
              <PenCross seed="kp3" size={24} label="Point missed" {...slot(cross)} />
            </span>
            Constant velocity means constant speed in a straight line
            <PenNote as="span" className={styles.missing} {...slot(missing)}>
              constant speed in a straight line
            </PenNote>
          </li>
        </ol>
        <div className={styles.scoreRow}>
          <ScoreMark score={2} total={3} seed="demo-score" {...slot(score)} />
        </div>
      </Sheet>
    </div>
  )
}

// ---------------------------------------------------------------------------

function FeedbackSection() {
  const toast = useToast()
  const [progress, setProgress] = useState(3)
  const [retrying, setRetrying] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [topicName, setTopicName] = useState('Waves')

  const retry = () => {
    setRetrying(true)
    window.setTimeout(() => setRetrying(false), 1200)
  }

  return (
    <Section id="feedback" title="Feedback" note="Skeletons for loading content, friendly empty and error states, toasts for quick confirmations.">
      <div className={styles.grid2}>
        <div>
          <Subhead>Skeleton</Subhead>
          <Sheet aria-busy="true">
            <span className="visually-hidden">Loading</span>
            <div className={styles.skeletonCard}>
              <Skeleton width={96} height={22} radius="xs" />
              <SkeletonText size="question" lines={2} lastLineWidth="45%" />
              <SkeletonText lines={3} />
            </div>
          </Sheet>
        </div>
        <div className={styles.stack}>
          <div>
            <Subhead>Spinner</Subhead>
            <div className={styles.row}>
              <Spinner size="sm" />
              <Spinner />
              <Spinner size="lg" label="Loading" />
            </div>
          </div>
          <div>
            <Subhead>Progress</Subhead>
            <div className={styles.stack} style={{ gap: 'var(--space-2)' }}>
              <ProgressBar value={progress} max={12} label="Review progress" valueText={`${progress} of 12 cards`} />
              <ProgressBar value={progress} max={12} label="Review progress" tone="red" thickness="thick" />
              <div className={styles.row}>
                <Button size="sm" onClick={() => setProgress((p) => Math.max(p - 1, 0))}>
                  Back
                </Button>
                <Button size="sm" onClick={() => setProgress((p) => Math.min(p + 1, 12))}>
                  Next card
                </Button>
                <span className={styles.caption}>{progress} of 12</span>
              </div>
            </div>
          </div>
          <div>
            <Subhead>Toasts, dialogs</Subhead>
            <div className={styles.row} style={{ gap: 'var(--space-1)' }}>
              <Button size="sm" onClick={() => toast.show({ message: 'Card saved' })}>
                Toast
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  toast.show({
                    message: 'Marked as missed',
                    action: { label: 'Undo', onClick: () => toast.show({ message: 'Changed back' }) },
                  })
                }
              >
                With action
              </Button>
              <Button size="sm" onClick={() => toast.show({ message: 'We couldn’t save that. Try again.', tone: 'error' })}>
                Error
              </Button>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                Dialog
              </Button>
              <Button size="sm" variant="danger" onClick={() => setConfirmOpen(true)}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.grid2}>
        <Sheet padding="sm">
          <EmptyState illustration="done" title="All caught up" compact actions={<Button variant="primary">Review anyway</Button>}>
            Nothing is due until tomorrow. Come back then, or practise your weakest topic.
          </EmptyState>
        </Sheet>
        <Sheet padding="sm">
          <EmptyState illustration="sheets" title="No cards yet" compact actions={<Button variant="primary" leadingIcon={<Plus />}>New card</Button>}>
            Write your first card from a mark scheme you trust.
          </EmptyState>
        </Sheet>
        <Sheet padding="sm">
          <EmptyState illustration="log" title="No mistakes logged" compact>
            Missed points appear here after each review, with the wording that earns the mark.
          </EmptyState>
        </Sheet>
        <Sheet padding="sm">
          <EmptyState illustration="search" title="No matching cards" compact>
            Try another topic, or clear the filters.
          </EmptyState>
        </Sheet>
        <Sheet padding="sm">
          <ErrorState compact onRetry={retry} retrying={retrying} />
        </Sheet>
        <Sheet padding="sm">
          <EmptyState icon={<Settings />} title="Using an icon" compact>
            When no illustration fits, a single Lucide icon in a soft disc.
          </EmptyState>
        </Sheet>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Rename topic"
        description="Cards in this topic keep their reviews."
        footer={
          <>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setDialogOpen(false)
                toast.show({ message: `Renamed to ${topicName}` })
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <TextField label="Topic name" value={topicName} onChange={(e) => setTopicName(e.target.value)} className={styles.dialogField} />
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() =>
          new Promise<void>((resolve) => {
            window.setTimeout(() => {
              toast.show({ message: 'Card deleted', action: { label: 'Undo', onClick: () => {} } })
              resolve()
            }, 900)
          })
        }
        title="Delete this card?"
        confirmLabel="Delete card"
        destructive
      >
        Its reviews and logged mistakes go too. This can’t be undone.
      </ConfirmDialog>
    </Section>
  )
}

function StatsSection() {
  return (
    <Section id="stats" title="Stats" note="Large serif figures for the home page. Red only when something needs doing now.">
      <Sheet padding="lg">
        <div className={styles.statsRow}>
          <Stat value={12} label="Due today" accent size="lg" />
          <Stat value={148} label="Cards" hint="36 mastered" />
          <Stat value="82%" label="Last 7 days" hint="Average mark" />
        </div>
      </Sheet>
    </Section>
  )
}
