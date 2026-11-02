import { describe, expect, it } from 'vitest'
import {
  normalizeCardDraft,
  normalizeCardPatch,
  normalizeKeyPoints,
  normalizeProfilePatch,
  normalizeTopicPatch,
  topicPositionUpdates,
} from './normalize'

describe('normalizeKeyPoints', () => {
  it('trims wording, drops blank alternatives and points without wording', () => {
    expect(
      normalizeKeyPoints([
        { id: 'kp_a', point: '  Energy is conserved ', accept: [' conserved ', '', '  ', 'conserved'], reject: [' created '] },
        { id: 'kp_b', point: '   ', accept: ['x'], reject: [] },
      ]),
    ).toEqual([{ id: 'kp_a', point: 'Energy is conserved', accept: ['conserved'], reject: ['created'] }])
  })
})

describe('card input', () => {
  it('trims the question and defaults the origin', () => {
    expect(
      normalizeCardDraft({
        subject: 'physics',
        topic_id: null,
        question: '  State Hooke’s law.\n',
        key_points: [{ id: 'kp_a', point: 'Extension is proportional to force', accept: [], reject: [] }],
      }),
    ).toEqual({
      subject: 'physics',
      topic_id: null,
      question: 'State Hooke’s law.',
      key_points: [{ id: 'kp_a', point: 'Extension is proportional to force', accept: [], reject: [] }],
      origin: 'manual',
    })
  })

  it('only includes the fields a patch sets', () => {
    expect(normalizeCardPatch({ suspended: true })).toEqual({ suspended: true })
    expect(normalizeCardPatch({ question: ' Q ', topic_id: null })).toEqual({ question: 'Q', topic_id: null })
    expect(normalizeCardPatch({})).toEqual({})
  })
})

describe('topic and profile input', () => {
  it('clears blank optional text', () => {
    expect(normalizeTopicPatch({ name: ' Waves ', unit: '  ' })).toEqual({ name: 'Waves', unit: null })
    expect(normalizeProfilePatch({ display_name: '   ' })).toEqual({ display_name: null })
  })

  it('rounds retention to two decimal places', () => {
    expect(normalizeProfilePatch({ desired_retention: 0.8549 })).toEqual({ desired_retention: 0.85 })
  })
})

describe('topicPositionUpdates', () => {
  const topics = [
    { id: 'a', position: 0, name: 'Alpha' },
    { id: 'b', position: 1, name: 'Beta' },
    { id: 'c', position: 2, name: 'Gamma' },
    { id: 'd', position: 3, name: 'Delta' },
  ]

  it('returns only the topics that move', () => {
    expect(topicPositionUpdates(topics, ['a', 'c', 'b', 'd'])).toEqual([
      { id: 'c', position: 1 },
      { id: 'b', position: 2 },
    ])
    expect(topicPositionUpdates(topics, ['a', 'b', 'c', 'd'])).toEqual([])
  })

  it('keeps unlisted topics after the listed ones, in their order', () => {
    expect(topicPositionUpdates(topics, ['d', 'b'])).toEqual([
      { id: 'd', position: 0 },
      { id: 'a', position: 2 },
      { id: 'c', position: 3 },
    ])
  })

  it('ignores unknown and repeated ids', () => {
    expect(topicPositionUpdates(topics, ['zzz', 'b', 'b', 'a'])).toEqual([
      { id: 'b', position: 0 },
      { id: 'a', position: 1 },
    ])
  })
})
