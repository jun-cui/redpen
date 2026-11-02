import type { RefObject } from 'react'
import type { SegmentedOption } from '../../components'
import { useElementSize } from '../../hooks'
import { SUBJECTS } from '../../lib/subjects'
import type { SubjectCode } from '../../lib/types'

/** full: "Further Maths"; short: "FM"; tiny: also "Phys", for five segments on a narrow phone. */
export type SubjectLabelStyle = 'full' | 'short' | 'tiny'

const LABELS: Record<Exclude<SubjectLabelStyle, 'full'>, Record<SubjectCode, string>> = {
  short: { maths: 'Maths', further_maths: 'FM', physics: 'Physics', computer_science: 'CS' },
  tiny: { maths: 'Maths', further_maths: 'FM', physics: 'Phys', computer_science: 'CS' },
}

/**
 * SegmentedControl options for the four subjects. Abbreviated labels keep the full name as
 * the accessible name.
 */
export function subjectSegments(style: SubjectLabelStyle): SegmentedOption<SubjectCode>[] {
  return SUBJECTS.map((subject) => {
    const label = style === 'full' ? subject.name : LABELS[style][subject.code]
    return {
      value: subject.code,
      label,
      ariaLabel: label === subject.name ? undefined : subject.name,
    }
  })
}

/**
 * Widest label of each style in px at the control's 14px medium Inter, rounded up (measured:
 * "Computer Science" 123.8, "Physics" 51.9, "Maths" 41.5).
 */
const WIDEST_LABEL_PX: Record<SubjectLabelStyle, number> = { full: 124, short: 52, tiny: 42 }

/**
 * The longest labels that fit `segments` equal segments across `width` px without truncating
 * (SegmentedControl: 4px padding and gaps; 16px side padding per segment at md, 8px at sm).
 * Narrower than that it settles for tiny, and SegmentedControl gives "Maths" a little more than
 * an equal share of the width so the label stays whole.
 */
export function subjectLabelStyle(width: number, segments: number, size: 'sm' | 'md'): SubjectLabelStyle {
  const padding = size === 'sm' ? 16 : 32
  const fits = (style: SubjectLabelStyle) =>
    segments * (WIDEST_LABEL_PX[style] + padding) + (segments - 1) * 4 + 8 <= width
  return fits('full') ? 'full' : fits('short') ? 'short' : 'tiny'
}

/** subjectLabelStyle for the width of `container` (an element as wide as the control may be). */
export function useSubjectLabelStyle(
  container: RefObject<HTMLElement | null>,
  segments: number,
  size: 'sm' | 'md',
): SubjectLabelStyle {
  const box = useElementSize(container)
  return box ? subjectLabelStyle(box.width, segments, size) : 'short'
}
