/**
 * scrollIntoView with a smooth scroll, or a plain jump for people who ask for less motion.
 * Use it for any scroll started from JS: base.css only covers CSS scroll-behavior, and an explicit
 * behavior: 'smooth' ignores that. Reads the setting each time, so it needs no hook.
 */
export function smoothScrollIntoView(element: Element, options: ScrollIntoViewOptions = {}): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ ...options, behavior: reduced ? 'auto' : 'smooth' })
}
