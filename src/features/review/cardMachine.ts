// One card's journey through a review, as a reducer (tested in cardMachine.test.ts):
//
//   answering ──submit──▶ marking ──marked──▶ marked ──save──▶ saving ──saved──▶ saved
//                                               ▲                 │
//                                               └─saveFailed──────┤
//                                               └─cardChanged─────┘
//
// Stage 1 self-grades, so 'marking' lasts no time at all: submit and marked are dispatched
// together. Stage 2 calls the AI marker while in 'marking' and dispatches `marked` with the AI's
// results (grading 'ai'), or with blank self-grading if the AI fails (grading 'ai_fallback').
// Actions that don't fit the current phase are ignored, so a double tap can't save twice.
//
// `cardChanged` is the way back when saving found the card's key points changed on another
// device: the student checks their ticks against the new mark scheme and saves again.

import type { Grading, FsrsSnapshot, KeyPoint } from '../../lib/types'
import { effectiveEasy, rebuildMarking, setPoint, togglePoint, type Marking } from './marking'

export type CardPhase = 'answering' | 'marking' | 'marked' | 'saving' | 'saved'

export interface CardState {
  phase: CardPhase
  answer: string
  /**
   * When the answer was handed in (ms since the epoch): the one "now" used for the next-due
   * preview, the schedule and reviewed_at, so what is shown is exactly what is saved.
   */
  markedAt: number | null
  /** The card's FSRS state when the answer was handed in. */
  before: FsrsSnapshot | null
  /** The review's id, chosen at hand-in, so every retry of this answer can only save it once. */
  reviewId: string | null
  marking: Marking | null
  grading: Grading
  /** The student's "that was easy" tap. Only offered, and only counted, with full marks. */
  easy: boolean
}

export type CardAction =
  | { type: 'answer'; answer: string }
  /** Hands the answer in. `answer` replaces what was typed (an "I don't know" gives ''). */
  | { type: 'submit'; at: number; before: FsrsSnapshot; reviewId: string; answer?: string }
  | { type: 'marked'; marking: Marking; grading: Grading }
  | { type: 'toggle'; keyPointId: string }
  | { type: 'setPoint'; keyPointId: string; hit: boolean }
  | { type: 'easy'; easy: boolean }
  | { type: 'save' }
  | { type: 'saveFailed' }
  /** Saving found new key points: mark against them, from the card's state at `at`. */
  | { type: 'cardChanged'; at: number; before: FsrsSnapshot; keyPoints: readonly KeyPoint[] }
  | { type: 'saved' }

export function initialCardState(answer = ''): CardState {
  return {
    phase: 'answering',
    answer,
    markedAt: null,
    before: null,
    reviewId: null,
    marking: null,
    grading: 'self',
    easy: false,
  }
}

function withResults(state: CardState, results: Marking['results']): CardState {
  if (!state.marking) return state
  // Taking a tick away from full marks also takes away "easy", so it never comes back unasked.
  return { ...state, marking: { ...state.marking, results }, easy: effectiveEasy(results, state.easy) }
}

export function cardReducer(state: CardState, action: CardAction): CardState {
  switch (action.type) {
    case 'answer':
      return state.phase === 'answering' ? { ...state, answer: action.answer } : state

    case 'submit':
      if (state.phase !== 'answering') return state
      return {
        ...state,
        phase: 'marking',
        answer: action.answer ?? state.answer,
        markedAt: action.at,
        before: action.before,
        reviewId: action.reviewId,
      }

    case 'marked':
      if (state.phase !== 'marking') return state
      return { ...state, phase: 'marked', marking: action.marking, grading: action.grading, easy: false }

    case 'toggle':
      if (state.phase !== 'marked' || !state.marking) return state
      return withResults(state, togglePoint(state.marking.results, action.keyPointId))

    case 'setPoint':
      if (state.phase !== 'marked' || !state.marking) return state
      return withResults(state, setPoint(state.marking.results, action.keyPointId, action.hit))

    case 'easy':
      if (state.phase !== 'marked' || !state.marking) return state
      return { ...state, easy: effectiveEasy(state.marking.results, action.easy) }

    case 'save':
      return state.phase === 'marked' ? { ...state, phase: 'saving' } : state

    case 'saveFailed':
      return state.phase === 'saving' ? { ...state, phase: 'marked' } : state

    case 'cardChanged': {
      if (state.phase !== 'saving' || !state.marking) return state
      const marking = rebuildMarking(state.marking, action.keyPoints)
      return {
        ...state,
        phase: 'marked',
        markedAt: action.at,
        before: action.before,
        marking,
        easy: effectiveEasy(marking.results, state.easy),
      }
    }

    case 'saved':
      return state.phase === 'saving' ? { ...state, phase: 'saved' } : state
  }
}

/** Whether leaving now would lose work: typed text, or marks not saved yet. */
export function hasUnsavedWork(state: CardState): boolean {
  if (state.phase === 'answering') return state.answer.trim().length > 0
  return state.phase !== 'saved'
}
