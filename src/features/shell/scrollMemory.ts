// Scroll positions per history entry (react-router location.key), so back and forward land where
// the reader left off. Kept in sessionStorage too, so a reload of the tab keeps them.

const STORAGE_KEY = 'redpen.scroll'
const MAX_ENTRIES = 60

let positions: Map<string, number> | null = null

function load(): Map<string, number> {
  if (positions) return positions
  positions = new Map()
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'number') {
          positions.set(entry[0], entry[1])
        }
      }
    }
  } catch {
    // Nothing saved, or storage is blocked.
  }
  window.addEventListener('pagehide', persist)
  return positions
}

function persist() {
  if (!positions) return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...positions]))
  } catch {
    // Storage full or blocked: positions still work for this page view.
  }
}

/** The saved scroll position for a history entry, or 0. */
export function savedScroll(locationKey: string): number {
  return load().get(locationKey) ?? 0
}

export function rememberScroll(locationKey: string, top: number): void {
  const map = load()
  map.delete(locationKey)
  map.set(locationKey, Math.max(0, Math.round(top)))
  // Oldest first (insertion order): forget the oldest entries.
  while (map.size > MAX_ENTRIES) {
    const oldest = map.keys().next().value
    if (oldest === undefined) break
    map.delete(oldest)
  }
}

export function scrollWindowTo(top: number): void {
  window.scrollTo({ top, left: 0, behavior: 'instant' })
}
