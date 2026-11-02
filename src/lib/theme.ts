// Theme preference: follow the system, or force light or dark.
//
// The preference lives in localStorage under THEME_STORAGE_KEY ('light' | 'dark'; absent means
// 'system'). It is applied as data-theme on <html>, which tokens.css reads. index.html runs a tiny
// pre-paint script with the same key so the first frame is already in the right theme; initTheme()
// then takes over, keeps <meta name="theme-color"> in step and follows system changes.

import { useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'redpen.theme'

/** The resolved --color-paper of each theme: browser chrome and the iOS status bar match it. */
export const THEME_COLORS: Readonly<Record<ResolvedTheme, string>> = {
  light: '#f6f3ee',
  dark: '#1a1816',
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

interface ThemeState {
  preference: ThemePreference
  resolved: ResolvedTheme
}

let state: ThemeState = { preference: 'system', resolved: 'light' }
let started = false
let darkQuery: MediaQueryList | null = null
const listeners = new Set<() => void>()

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function writePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Private mode or blocked storage: the choice still applies for this session.
  }
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference
  return darkQuery?.matches ? 'dark' : 'light'
}

function applyToDocument({ preference, resolved }: ThemeState) {
  const root = document.documentElement
  if (preference === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', preference)

  // index.html ships one theme-color meta per colour scheme. A chosen theme overrides both; with
  // 'system' each meta goes back to the paper of its own scheme, so the browser can follow the
  // system setting on its own.
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  if (metas.length === 0) {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = THEME_COLORS[resolved]
    document.head.append(meta)
    return
  }
  metas.forEach((meta) => {
    const own = meta.media ? (meta.media.includes('dark') ? 'dark' : 'light') : resolved
    meta.content = THEME_COLORS[preference === 'system' ? own : resolved]
  })
}

/** Applies a state change without every colour transition on the page running at once. */
function applyWithoutTransitions(next: ThemeState, animate: boolean) {
  const root = document.documentElement
  root.setAttribute('data-theme-switching', '')
  const commit = () => {
    applyToDocument(next)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.removeAttribute('data-theme-switching'))
    })
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (animate && !reduceMotion && typeof document.startViewTransition === 'function') {
    // A short cross-fade, composited by the browser from two snapshots.
    document.startViewTransition(commit)
  } else {
    commit()
  }
}

function update(preference: ThemePreference, animate: boolean) {
  const next: ThemeState = { preference, resolved: resolve(preference) }
  if (next.preference === state.preference && next.resolved === state.resolved) return
  state = next
  applyWithoutTransitions(next, animate)
  listeners.forEach((listener) => listener())
}

/**
 * Reads the saved preference, applies it and starts following system changes.
 * Call once before the first render; safe to call again.
 */
export function initTheme(): void {
  if (started || typeof window === 'undefined') return
  started = true

  darkQuery = window.matchMedia(DARK_QUERY)
  darkQuery.addEventListener('change', () => update(state.preference, false))
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) update(readPreference(), false)
  })

  const preference = readPreference()
  state = { preference, resolved: resolve(preference) }
  applyToDocument(state)
}

export function getThemePreference(): ThemePreference {
  initTheme()
  return state.preference
}

/** Saves and applies a preference. 'system' clears the saved choice. */
export function setThemePreference(preference: ThemePreference): void {
  initTheme()
  writePreference(preference)
  update(preference, true)
}

function subscribe(listener: () => void) {
  initTheme()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): ThemeState {
  return state
}

export interface UseThemeResult {
  preference: ThemePreference
  /** The theme actually showing: the system's when the preference is 'system'. */
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

/** The current theme preference and resolved theme; re-renders when either changes. */
export function useTheme(): UseThemeResult {
  const { preference, resolved } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { preference, resolved, setPreference: setThemePreference }
}
