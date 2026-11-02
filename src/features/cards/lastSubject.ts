// The subject of the last card saved, so a new card starts where the person was working.
// A per-device convenience only: storage can be missing (private mode) and that is fine.

import { isSubjectCode } from '../../lib/subjects'
import type { SubjectCode } from '../../lib/types'

const STORAGE_KEY = 'redpen.lastSubject'

/** The subject of the last card saved on this device, or null. */
export function recallSubject(): SubjectCode | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return isSubjectCode(value) ? value : null
  } catch {
    return null
  }
}

export function rememberSubject(subject: SubjectCode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, subject)
  } catch {
    // Storage unavailable: new cards fall back to the default subject.
  }
}
