import type { SubjectCode } from './types'

export interface SubjectInfo {
  code: SubjectCode
  /** Full name, e.g. "Further Maths". */
  name: string
  /** Two-letter mark used on badges, e.g. "FM". */
  short: string
}

export const SUBJECTS: readonly SubjectInfo[] = [
  { code: 'maths', name: 'Maths', short: 'Ma' },
  { code: 'further_maths', name: 'Further Maths', short: 'FM' },
  { code: 'physics', name: 'Physics', short: 'Ph' },
  { code: 'computer_science', name: 'Computer Science', short: 'CS' },
]

export const SUBJECT_CODES: readonly SubjectCode[] = SUBJECTS.map((s) => s.code)

export function subjectInfo(code: SubjectCode): SubjectInfo {
  const info = SUBJECTS.find((s) => s.code === code)
  if (!info) throw new Error(`Unknown subject: ${code}`)
  return info
}

export function isSubjectCode(value: unknown): value is SubjectCode {
  return typeof value === 'string' && (SUBJECT_CODES as readonly string[]).includes(value)
}
