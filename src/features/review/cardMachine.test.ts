import { describe, expect, it } from 'vitest'
import { newCardSnapshot } from '../../lib/fsrs'
import type { KeyPoint } from '../../lib/types'
import { cardReducer, hasUnsavedWork, initialCardState, type CardAction, type CardState } from './cardMachine'
import { selfMarking } from './marking'
import { KEY_POINTS } from './testFixtures'

const AT = Date.parse('2026-10-23T10:00:00.000Z')
const BEFORE = newCardSnapshot(new Date(AT))
const REVIEW_ID = '00000000-0000-4000-8000-00000000cafe'

function run(...actions: CardAction[]): CardState {
  return actions.reduce(cardReducer, initialCardState())
}

const submit: CardAction = { type: 'submit', at: AT, before: BEFORE, reviewId: REVIEW_ID }
const marked: CardAction = { type: 'marked', marking: selfMarking(KEY_POINTS), grading: 'self' }

describe('cardReducer', () => {
  it('starts answering with nothing typed', () => {
    expect(initialCardState()).toMatchObject({ phase: 'answering', answer: '', marking: null, markedAt: null })
  })

  it('keeps what is typed while answering', () => {
    expect(run({ type: 'answer', answer: 'Drag' }).answer).toBe('Drag')
  })

  it('hands the answer in at one moment, with the card state at that moment', () => {
    const state = run({ type: 'answer', answer: 'Drag' }, submit)
    expect(state).toMatchObject({ phase: 'marking', answer: 'Drag', markedAt: AT, before: BEFORE })
  })

  it('chooses the review id at hand-in and keeps it through failed saves', () => {
    expect(initialCardState().reviewId).toBeNull()
    const state = run(submit, marked, { type: 'save' }, { type: 'saveFailed' }, { type: 'save' })
    expect(state.reviewId).toBe(REVIEW_ID)
  })

  it("records an empty answer for \"I don't know\"", () => {
    const state = run({ type: 'answer', answer: 'half a thought' }, { ...submit, answer: '' }, marked)
    expect(state).toMatchObject({ phase: 'marked', answer: '' })
    expect(state.marking?.results.every((r) => !r.hit)).toBe(true)
  })

  it('goes to self-grading with every point unticked', () => {
    const state = run(submit, marked)
    expect(state.phase).toBe('marked')
    expect(state.grading).toBe('self')
    expect(state.marking?.results.map((r) => r.hit)).toEqual([false, false, false])
  })

  it('takes AI results (Stage 2) in the same shape', () => {
    const marking = selfMarking(KEY_POINTS)
    marking.results = marking.results.map((r) => ({ ...r, hit: true, ai_hit: true, reason: 'Stated clearly' }))
    const state = run(submit, { type: 'marked', marking, grading: 'ai' })
    expect(state).toMatchObject({ phase: 'marked', grading: 'ai' })
    expect(state.marking?.results[0]?.reason).toBe('Stated clearly')
  })

  it('ignores typing once the answer is handed in', () => {
    expect(run(submit, marked, { type: 'answer', answer: 'changed' }).answer).toBe('')
  })

  it('ticks and unticks points while marked', () => {
    let state = run(submit, marked, { type: 'toggle', keyPointId: 'kp_b' })
    expect(state.marking?.results.map((r) => r.hit)).toEqual([false, true, false])
    state = cardReducer(state, { type: 'setPoint', keyPointId: 'kp_b', hit: false })
    expect(state.marking?.results.map((r) => r.hit)).toEqual([false, false, false])
  })

  it('only allows easy with full marks, and drops it when a tick is taken away', () => {
    let state = run(submit, marked, { type: 'easy', easy: true })
    expect(state.easy).toBe(false)
    state = [
      { type: 'toggle', keyPointId: 'kp_a' },
      { type: 'toggle', keyPointId: 'kp_b' },
      { type: 'toggle', keyPointId: 'kp_c' },
      { type: 'easy', easy: true },
    ].reduce((s, a) => cardReducer(s, a as CardAction), state)
    expect(state.easy).toBe(true)
    state = cardReducer(state, { type: 'toggle', keyPointId: 'kp_c' })
    expect(state.easy).toBe(false)
    state = cardReducer(state, { type: 'toggle', keyPointId: 'kp_c' })
    expect(state.easy).toBe(false)
  })

  it('saves once: a second save while saving is ignored', () => {
    const saving = run(submit, marked, { type: 'save' })
    expect(saving.phase).toBe('saving')
    expect(cardReducer(saving, { type: 'save' })).toBe(saving)
  })

  it('freezes the marks while saving', () => {
    const saving = run(submit, marked, { type: 'save' })
    expect(cardReducer(saving, { type: 'toggle', keyPointId: 'kp_a' })).toBe(saving)
    expect(cardReducer(saving, { type: 'easy', easy: true })).toBe(saving)
  })

  it('goes back to marked with the ticks intact when saving fails', () => {
    const state = run(submit, marked, { type: 'toggle', keyPointId: 'kp_a' }, { type: 'save' }, { type: 'saveFailed' })
    expect(state.phase).toBe('marked')
    expect(state.marking?.results.map((r) => r.hit)).toEqual([true, false, false])
  })

  it('ends saved', () => {
    expect(run(submit, marked, { type: 'save' }, { type: 'saved' }).phase).toBe('saved')
  })

  it('ignores actions out of order', () => {
    const answering = initialCardState()
    expect(cardReducer(answering, marked)).toBe(answering)
    expect(cardReducer(answering, { type: 'save' })).toBe(answering)
    expect(cardReducer(answering, { type: 'saved' })).toBe(answering)
    expect(cardReducer(answering, { type: 'toggle', keyPointId: 'kp_a' })).toBe(answering)
    const markedState = run(submit, marked)
    expect(cardReducer(markedState, submit)).toBe(markedState)
    expect(cardReducer(markedState, { type: 'saveFailed' })).toBe(markedState)
  })

  describe('when saving finds the key points changed', () => {
    const LATER = AT + 60_000
    const FRESH = { ...BEFORE, reps: 3, last_review: new Date(AT + 30_000).toISOString() }
    const ADDED = { id: 'kp_d', point: 'A point added on another device', accept: [], reject: [] }
    const changed = (keyPoints: readonly KeyPoint[]): CardAction => ({ type: 'cardChanged', at: LATER, before: FRESH, keyPoints })
    const ticked: CardAction[] = [submit, marked, { type: 'toggle', keyPointId: 'kp_a' }, { type: 'toggle', keyPointId: 'kp_b' }]

    it('goes back to marked against the fresh state, at the new time', () => {
      const state = run(...ticked, { type: 'save' }, changed(KEY_POINTS))
      expect(state).toMatchObject({ phase: 'marked', markedAt: LATER, before: FRESH })
    })

    it('keeps the ticks for points that still exist, with the new points unticked', () => {
      const state = run(...ticked, { type: 'save' }, changed([KEY_POINTS[1]!, KEY_POINTS[2]!, ADDED]))
      expect(state.marking?.results.map((r) => [r.key_point_id, r.hit])).toEqual([
        ['kp_b', true],
        ['kp_c', false],
        ['kp_d', false],
      ])
    })

    it('keeps the answer and the review id', () => {
      const state = run({ type: 'answer', answer: 'Drag' }, ...ticked, { type: 'save' }, changed(KEY_POINTS))
      expect(state).toMatchObject({ answer: 'Drag', reviewId: REVIEW_ID })
    })

    it('can be marked and saved again', () => {
      let state = run(...ticked, { type: 'save' }, changed([...KEY_POINTS, ADDED]))
      state = cardReducer(state, { type: 'toggle', keyPointId: 'kp_d' })
      expect(state.marking?.results.map((r) => r.hit)).toEqual([true, true, false, true])
      state = cardReducer(state, { type: 'save' })
      expect(cardReducer(state, { type: 'saved' }).phase).toBe('saved')
    })

    it('drops "easy" when the new points mean full marks is gone', () => {
      const allTicked: CardAction[] = [
        ...ticked,
        { type: 'toggle', keyPointId: 'kp_c' },
        { type: 'easy', easy: true },
        { type: 'save' },
      ]
      expect(run(...allTicked, changed(KEY_POINTS)).easy).toBe(true)
      expect(run(...allTicked, changed([...KEY_POINTS, ADDED])).easy).toBe(false)
    })

    it('only applies while saving', () => {
      const markedState = run(...ticked)
      expect(cardReducer(markedState, changed(KEY_POINTS))).toBe(markedState)
      const saved = run(...ticked, { type: 'save' }, { type: 'saved' })
      expect(cardReducer(saved, changed(KEY_POINTS))).toBe(saved)
    })
  })
})

describe('hasUnsavedWork', () => {
  it('is false for an empty or blank answer', () => {
    expect(hasUnsavedWork(initialCardState())).toBe(false)
    expect(hasUnsavedWork(initialCardState('   \n'))).toBe(false)
  })

  it('is true while typing, marking or saving', () => {
    expect(hasUnsavedWork(initialCardState('Drag'))).toBe(true)
    expect(hasUnsavedWork(run(submit, marked))).toBe(true)
    expect(hasUnsavedWork(run(submit, marked, { type: 'save' }))).toBe(true)
  })

  it('is false once saved', () => {
    expect(hasUnsavedWork(run(submit, marked, { type: 'save' }, { type: 'saved' }))).toBe(false)
  })
})
