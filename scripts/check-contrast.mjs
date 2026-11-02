#!/usr/bin/env node
// Verifies WCAG 2.2 contrast for the colour tokens in src/styles/tokens.css, in both themes.
// Usage: node scripts/check-contrast.mjs   (exits 1 if any pair fails)
//
// Tokens are parsed from the light `:root { ... }` block and the `:root[data-theme='dark']` block.
// The dark block inside `@media (prefers-color-scheme: dark)` must match the data-theme block,
// which this script also checks so the two copies can never drift apart.
// Translucent colours (rgb(... / a)) are composited over the background they are paired with.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const tokensPath = fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url))
const css = readFileSync(tokensPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const TEXT = 4.5
const LARGE_OR_UI = 3

// [foreground, background, minimum ratio, what it is used for]
const PAIRS = [
  ['ink', 'paper', TEXT, 'body text'],
  ['ink', 'paper-raised', TEXT, 'body text on sheets'],
  ['ink', 'paper-sunken', TEXT, 'text in wells and inputs'],
  ['ink-2', 'paper', TEXT, 'secondary text'],
  ['ink-2', 'paper-raised', TEXT, 'secondary text on sheets'],
  ['ink-2', 'paper-sunken', TEXT, 'secondary text in wells'],
  ['ink-3', 'paper', TEXT, 'tertiary text, placeholders'],
  ['ink-3', 'paper-raised', TEXT, 'tertiary text on sheets'],
  ['ink-3', 'paper-sunken', TEXT, 'placeholders in input fills'],
  ['ink-inverse', 'ink', TEXT, 'selected chips, mastered badge'],
  ['red', 'paper', TEXT, 'red text, errors, marks'],
  ['red', 'paper-raised', TEXT, 'red text and marks on sheets'],
  ['red', 'paper-sunken', TEXT, 'error text in wells'],
  ['red', ['red-tint', 'paper-raised'], TEXT, 'red text on a red tint'],
  ['ink', ['red-tint', 'paper-raised'], TEXT, 'selected rows'],
  ['on-red', 'red-fill', TEXT, 'primary button label'],
  ['on-red', 'red-fill-hover', TEXT, 'primary button label, hovered'],
  ['red-fill', 'paper', LARGE_OR_UI, 'primary button edge'],
  ['red-fill', 'paper-raised', LARGE_OR_UI, 'primary button edge on sheets'],
  ['control-border', 'paper', LARGE_OR_UI, 'input and control outlines'],
  ['control-border', 'paper-raised', LARGE_OR_UI, 'input outlines on sheets'],
  ['control-border', 'paper-sunken', LARGE_OR_UI, 'outlines against wells'],
  ['focus', 'paper', LARGE_OR_UI, 'focus ring'],
  ['focus', 'paper-raised', LARGE_OR_UI, 'focus ring on sheets'],
]

function block(selectorPattern) {
  const match = css.match(selectorPattern)
  if (!match) throw new Error(`Could not find ${selectorPattern} in tokens.css`)
  return match[1]
}

function colourTokens(body) {
  const tokens = {}
  for (const m of body.matchAll(/--color-([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens[m[1]] = m[2].trim()
  }
  return tokens
}

/** Parses #rgb, #rrggbb or rgb(r g b / a) into [r, g, b, a] with r,g,b in 0..255. */
function parseColour(value) {
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) h = [...h].map((c) => c + c).join('')
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1)
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/i)
  if (rgb) {
    let alpha = rgb[4] === undefined ? 1 : parseFloat(rgb[4])
    if (rgb[4]?.endsWith('%')) alpha /= 100
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), alpha]
  }
  return null
}

function resolve(tokens, name, seen = new Set()) {
  const raw = tokens[name]
  if (raw === undefined) throw new Error(`Missing token --color-${name}`)
  const ref = raw.match(/^var\(--color-([a-z0-9-]+)\)$/)
  if (ref) {
    if (seen.has(name)) throw new Error(`Circular token --color-${name}`)
    seen.add(name)
    return resolve(tokens, ref[1], seen)
  }
  const colour = parseColour(raw)
  if (!colour) throw new Error(`Cannot parse --color-${name}: ${raw}`)
  return colour
}

function over([r, g, b, a], [br, bg, bb]) {
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1]
}

/** Resolves a background: a token name, or [overlay, base] to composite a tint onto a surface. */
function background(tokens, spec) {
  if (Array.isArray(spec)) {
    const [overlay, base] = spec
    return over(resolve(tokens, overlay), background(tokens, base))
  }
  const colour = resolve(tokens, spec)
  if (colour[3] < 1) throw new Error(`Background --color-${spec} must be opaque`)
  return colour
}

function luminance([r, g, b]) {
  const channel = (c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const label = (spec) => (Array.isArray(spec) ? `${spec[0]} over ${spec[1]}` : spec)

const themes = {
  light: colourTokens(block(/(?:^|\n):root\s*\{([\s\S]*?)\n\}/)),
  dark: colourTokens(block(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/)),
}

let failures = 0

const mediaDark = colourTokens(block(/:root:not\(\[data-theme='light'\]\)\s*\{([\s\S]*?)\n {2}\}/))
for (const [name, value] of Object.entries(themes.dark)) {
  if (mediaDark[name] !== value) {
    failures++
    console.log(`  FAIL  dark tokens differ: --color-${name} is ${mediaDark[name]} in the media query, ${value} in [data-theme='dark']`)
  }
}

for (const [theme, tokens] of Object.entries(themes)) {
  // Dark tokens only override some values; inherit the rest from light.
  const merged = theme === 'light' ? tokens : { ...themes.light, ...tokens }
  console.log(`\n${theme}`)
  for (const [fg, bg, min, use] of PAIRS) {
    const back = background(merged, bg)
    const fore = over(resolve(merged, fg), back)
    const r = ratio(fore, back)
    const ok = r >= min
    if (!ok) failures++
    const name = `${fg} on ${label(bg)}`.padEnd(38)
    console.log(`  ${ok ? 'pass' : 'FAIL'}  ${name} ${r.toFixed(2).padStart(5)} : 1  (needs ${min})  ${use}`)
  }
}

if (failures > 0) {
  console.log(`\n${failures} contrast check${failures === 1 ? '' : 's'} failed.`)
  process.exit(1)
}
console.log('\nAll contrast checks pass.')
