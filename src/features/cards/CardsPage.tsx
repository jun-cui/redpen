import { PenLine, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { motion, type Variants } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import {
  Button,
  ButtonLink,
  Chip,
  cx,
  EmptyState,
  ErrorState,
  IconButton,
  Page,
  PageHeader,
  SegmentedControl,
  Select,
  Sheet,
  Skeleton,
  SkeletonText,
  TextField,
  useToast,
} from '../../components'
import { useAddExampleCards, useCards, useTopics } from '../../data/hooks'
import { useDocumentTitle, useMediaQuery } from '../../hooks'
import { CATEGORY_LABELS } from '../../lib/category'
import type { CardRow } from '../../lib/database.types'
import { friendlyError } from '../../lib/errors'
import { fades, springs } from '../../lib/motion'
import type { CardCategory, SubjectCode } from '../../lib/types'
import { subjectSegments, useSubjectLabelStyle } from '../topics/subjectSegments'
import { byPosition, cardCountLabel } from '../topics/topicUtils'
import { CardListItem } from './CardListItem'
import {
  FILTER_CATEGORIES,
  hasActiveFilters,
  matchesBaseFilters,
  matchesCategory,
  NO_TOPIC,
  readFilters,
  searchableText,
  searchTerms,
  SORT_OPTIONS,
  sortCards,
  writeFilters,
  type CardFilters,
  type SortKey,
} from './cardFilters'
import styles from './CardsPage.module.css'
import type { EditorLocationState } from './editorModel'
import { useNow } from './useNow'

const SEARCH_DELAY_MS = 180
const WIDE_CONTROLS_QUERY = '(min-width: 768px)'

type SubjectFilter = SubjectCode | 'all'

/** Each card rises in on the first load only, a few at a time; later filter changes are instant. */
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (index: number) => {
    const delay = Math.min(index, 10) * 0.035
    return {
      opacity: 1,
      y: 0,
      transition: { y: { ...springs.gentle, delay }, opacity: { ...fades.base, delay } },
    }
  },
}

/** /cards: the card library, filtered from the URL so a view can be shared or returned to. */
export function CardsPage() {
  useDocumentTitle('Cards')
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readFilters(params), [params])
  const cardsQuery = useCards()
  const topicsQuery = useTopics()
  const now = useNow()
  const controlsRef = useRef<HTMLDivElement>(null)
  const subjectLabels = useSubjectLabelStyle(controlsRef, 5, 'sm')
  const wideControls = useMediaQuery(WIDE_CONTROLS_QUERY)

  // The search box updates the URL shortly after typing stops. When the URL changes some other
  // way (back/forward, Clear filters), the box follows it.
  const [query, setQuery] = useState(filters.q)
  const [syncedQuery, setSyncedQuery] = useState(filters.q)
  if (filters.q !== syncedQuery) {
    setSyncedQuery(filters.q)
    setQuery(filters.q)
  }

  useEffect(() => {
    // Blank text isn't written to the URL; don't let that bounce back and clear a typed space.
    if (query === filters.q || (!query.trim() && !filters.q)) return
    const timer = window.setTimeout(() => {
      setSyncedQuery(query)
      setParams((current) => writeFilters({ ...readFilters(current), q: query }), { replace: true })
    }, SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [query, filters.q, setParams])

  const update = (patch: Partial<CardFilters>) => {
    setParams((current) => writeFilters({ ...readFilters(current), ...patch }), { replace: true })
  }

  const clearFilters = () => {
    setQuery('')
    setSyncedQuery('')
    setParams((current) => writeFilters({ q: '', subject: null, categories: [], topic: null, sort: readFilters(current).sort }), {
      replace: true,
    })
  }

  // Cards rise in on the first list of this visit only; filtering and sorting then show at once.
  const [introDone, setIntroDone] = useState(false)

  const [filtersOpen, setFiltersOpen] = useState(() => filters.categories.length > 0 || filters.topic !== null || filters.sort !== 'due')

  const cards = cardsQuery.data
  const topics = topicsQuery.data
  const topicNames = useMemo(() => new Map((topics ?? []).map((topic) => [topic.id, topic.name])), [topics])
  const searchText = useMemo(() => new Map((cards ?? []).map((card) => [card.id, searchableText(card)])), [cards])

  // A topic that no longer exists (deleted elsewhere) stops filtering rather than hiding everything.
  const effective = useMemo<CardFilters>(() => {
    const knownTopic = !filters.topic || filters.topic === NO_TOPIC || !topics || topicNames.has(filters.topic)
    return knownTopic ? filters : { ...filters, topic: null }
  }, [filters, topics, topicNames])

  const base = useMemo(() => {
    const context = { text: searchText, terms: searchTerms(effective.q) }
    return (cards ?? []).filter((card) => matchesBaseFilters(card, effective, context))
  }, [cards, effective, searchText])

  const categoryCounts = useMemo(() => {
    const counts: Record<CardCategory, number> = { new: 0, learning: 0, weak: 0, mastered: 0 }
    for (const card of base) counts[card.category] += 1
    return counts
  }, [base])

  const results = useMemo(
    () => sortCards(base.filter((card) => matchesCategory(card, effective.categories)), effective.sort),
    [base, effective],
  )

  // Topic choices for the chosen subject: its topics in order, archived ones only while cards use them.
  const topicChoices = useMemo(() => {
    if (!effective.subject) return []
    const subjectCards = (cards ?? []).filter((card) => card.subject === effective.subject)
    const used = new Set(subjectCards.map((card) => card.topic_id))
    return (topics ?? [])
      .filter((topic) => topic.subject === effective.subject && (!topic.archived || used.has(topic.id)))
      .sort(byPosition)
  }, [cards, topics, effective.subject])
  const hasUnfiled = (cards ?? []).some((card) => card.subject === effective.subject && card.topic_id === null)

  const linkState: EditorLocationState = { returnTo: `${location.pathname}${location.search}` }
  const newCardHref = effective.subject ? `/cards/new?subject=${effective.subject}` : '/cards/new'
  const filtered = hasActiveFilters(effective)
  const panelFilterCount = effective.categories.length + (effective.topic ? 1 : 0) + (effective.sort !== 'due' ? 1 : 0)
  const showPanel = wideControls || filtersOpen
  const isEmptyBox = cards !== undefined && cards.length === 0

  const header = (
    <PageHeader
      title="Cards"
      description={
        // The count, quietly; an empty box says so below instead of "0 cards".
        cards ? (
          cards.length > 0 ? cardCountLabel(cards.length) : undefined
        ) : cardsQuery.isPending ? (
          <Skeleton width={72} height="1em" />
        ) : undefined
      }
      actions={
        <ButtonLink to={newCardHref} state={linkState} variant="primary" leadingIcon={<Plus />}>
          New card
        </ButtonLink>
      }
    />
  )

  if (cardsQuery.isError) {
    return (
      <Page width="wide">
        {header}
        <ErrorState
          title="Your cards didn’t load"
          message={friendlyError(cardsQuery.error)}
          onRetry={() => void cardsQuery.refetch()}
          retrying={cardsQuery.isFetching}
        />
      </Page>
    )
  }

  if (isEmptyBox) {
    return (
      <Page width="wide">
        {header}
        <EmptyBox newCardHref={newCardHref} linkState={linkState} />
      </Page>
    )
  }

  return (
    <Page width="wide">
      {header}

      <div ref={controlsRef} className={styles.controls} role="search" aria-label="Find cards">
        <div className={styles.searchRow}>
          <TextField
            label="Search cards"
            hideLabel
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Search questions and points"
            leading={<Search />}
            trailing={
              query ? (
                <IconButton label="Clear search" icon={<X />} size="sm" onClick={() => setQuery('')} />
              ) : undefined
            }
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query) {
                event.preventDefault()
                setQuery('')
              }
            }}
            className={styles.search}
          />
          {wideControls ? (
            <SortSelect value={effective.sort} onChange={(sort) => update({ sort })} className={styles.sortWide} />
          ) : (
            <span className={styles.filterToggle}>
              <IconButton
                label={filtersOpen ? 'Hide filters' : 'Show filters'}
                icon={<SlidersHorizontal />}
                variant="secondary"
                selected={filtersOpen}
                aria-expanded={filtersOpen}
                aria-controls="card-filters"
                onClick={() => setFiltersOpen((open) => !open)}
              />
              {panelFilterCount > 0 && !filtersOpen ? (
                <span className={styles.filterCount} aria-hidden="true">
                  {panelFilterCount}
                </span>
              ) : null}
            </span>
          )}
        </div>

        <div className={styles.subjectRow}>
          <SegmentedControl<SubjectFilter>
            label="Subject"
            size="sm"
            fullWidth={!wideControls}
            options={[{ value: 'all', label: 'All' }, ...subjectSegments(subjectLabels)]}
            value={effective.subject ?? 'all'}
            onChange={(value) => update({ subject: value === 'all' ? null : value, topic: null })}
            className={styles.subjects}
          />
          {effective.subject && wideControls ? (
            <TopicFilter
              value={effective.topic}
              topics={topicChoices}
              hasUnfiled={hasUnfiled}
              onChange={(topic) => update({ topic })}
              className={styles.topicWide}
            />
          ) : null}
        </div>

        {showPanel ? (
          <motion.div
            id="card-filters"
            className={styles.panel}
            initial={wideControls ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springs.ui}
          >
            <div className={styles.chips} role="group" aria-label="Category">
              {FILTER_CATEGORIES.map((category) => {
                const selected = effective.categories.includes(category)
                return (
                  <Chip
                    key={category}
                    selected={selected}
                    count={cards ? categoryCounts[category] : undefined}
                    onClick={() =>
                      update({
                        categories: selected
                          ? effective.categories.filter((c) => c !== category)
                          : [...effective.categories, category],
                      })
                    }
                  >
                    {CATEGORY_LABELS[category]}
                  </Chip>
                )
              })}
            </div>
            {!wideControls ? (
              <div className={styles.panelSelects}>
                {effective.subject ? (
                  <TopicFilter
                    value={effective.topic}
                    topics={topicChoices}
                    hasUnfiled={hasUnfiled}
                    onChange={(topic) => update({ topic })}
                  />
                ) : null}
                <SortSelect value={effective.sort} onChange={(sort) => update({ sort })} />
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </div>

      {cards === undefined ? (
        <ListSkeleton />
      ) : (
        <>
          <div className={styles.resultsBar} aria-live="polite">
            {filtered && results.length > 0 ? (
              <>
                <span>
                  {results.length === cards.length
                    ? `Showing all ${cards.length}`
                    : `Showing ${results.length} of ${cards.length}`}
                </span>
                <Button size="sm" variant="ghost" leadingIcon={<X />} onClick={clearFilters} className={styles.clear}>
                  Clear filters
                </Button>
              </>
            ) : filtered ? (
              // The empty state below says so on screen; this tells screen readers as the filters change.
              <span className="visually-hidden">No cards match</span>
            ) : null}
          </div>
          {results.length === 0 ? (
            <EmptyState
              illustration="search"
              title="No cards match"
              actions={
                <Button onClick={clearFilters} leadingIcon={<X />}>
                  Clear filters
                </Button>
              }
            >
              Try a different search, or clear the filters to see your whole box.
            </EmptyState>
          ) : (
            <CardGrid
              cards={results}
              topicNames={topicNames}
              now={now}
              linkState={linkState}
              animateIn={!introDone}
              onIntroDone={() => setIntroDone(true)}
            />
          )}
        </>
      )}
    </Page>
  )
}

function CardGrid({
  cards,
  topicNames,
  now,
  linkState,
  animateIn,
  onIntroDone,
}: {
  cards: CardRow[]
  topicNames: ReadonlyMap<string, string>
  now: Date
  linkState: EditorLocationState
  /** Rise in, a few at a time (the first list shown on this visit only). */
  animateIn: boolean
  onIntroDone: () => void
}) {
  return (
    <motion.ul
      role="list"
      className={styles.grid}
      initial={animateIn ? 'hidden' : false}
      animate="visible"
      onAnimationComplete={animateIn ? onIntroDone : undefined}
    >
      {cards.map((card, index) => (
        <motion.li key={card.id} custom={index} variants={itemVariants} className={styles.item}>
          <CardListItem
            card={card}
            topicName={card.topic_id ? (topicNames.get(card.topic_id) ?? null) : null}
            now={now}
            linkState={linkState}
          />
        </motion.li>
      ))}
    </motion.ul>
  )
}

function SortSelect({ value, onChange, className }: { value: SortKey; onChange: (sort: SortKey) => void; className?: string }) {
  return (
    <Select
      label="Sort by"
      hideLabel
      value={value}
      onChange={(event) => onChange(event.target.value as SortKey)}
      className={className}
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  )
}

function TopicFilter({
  value,
  topics,
  hasUnfiled,
  onChange,
  className,
}: {
  value: string | null
  topics: readonly { id: string; name: string; archived: boolean }[]
  hasUnfiled: boolean
  onChange: (topic: string | null) => void
  className?: string
}) {
  return (
    <Select
      label="Topic"
      hideLabel
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || null)}
      className={className}
    >
      <option value="">All topics</option>
      {topics.map((topic) => (
        <option key={topic.id} value={topic.id}>
          {topic.archived ? `${topic.name} – archived` : topic.name}
        </option>
      ))}
      {hasUnfiled || value === NO_TOPIC ? <option value={NO_TOPIC}>No topic</option> : null}
    </Select>
  )
}

function EmptyBox({ newCardHref, linkState }: { newCardHref: string; linkState: EditorLocationState }) {
  const toast = useToast()
  const addExamples = useAddExampleCards()
  const add = () => {
    addExamples.mutate(undefined, {
      onSuccess: (added) =>
        toast.show({
          message: added > 0 ? `Added ${added} example cards` : 'The example cards are already in your box',
        }),
      onError: (error) => toast.show({ message: friendlyError(error), tone: 'error' }),
    })
  }
  return (
    <Sheet padding="lg" className={styles.emptyBox}>
      <EmptyState
        illustration="sheets"
        title="Your card box is empty"
        actions={
          <>
            <ButtonLink to={newCardHref} state={linkState} variant="primary" leadingIcon={<PenLine />}>
              Write a card
            </ButtonLink>
            <Button onClick={add} loading={addExamples.isPending}>
              Add 12 example cards
            </Button>
          </>
        }
      >
        Write a card from a mark scheme you trust, or start with twelve examples across your four subjects. You can
        edit or delete them later.
      </EmptyState>
    </Sheet>
  )
}

function ListSkeleton() {
  return (
    <div aria-busy="true">
      <span className="visually-hidden">Loading cards</span>
      <ul role="list" className={styles.grid}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <li key={index} className={styles.item}>
            <Sheet padding="none" className={cx(styles.skeletonCard)}>
              <span className={styles.skeletonEyebrow}>
                <Skeleton width={28} height={22} />
                <Skeleton width="40%" height={14} />
              </span>
              <span className={styles.skeletonBody}>
                <SkeletonText size="question" lines={index % 2 === 0 ? 2 : 3} lastLineWidth="55%" />
              </span>
              <span className={styles.skeletonFooter}>
                <Skeleton width={80} height={24} />
                <Skeleton width={56} height={14} />
                <Skeleton width={72} height={14} className={styles.skeletonDue} />
              </span>
            </Sheet>
          </li>
        ))}
      </ul>
    </div>
  )
}
