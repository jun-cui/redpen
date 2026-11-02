// Hand-drawn pen geometry.
//
// Every mark is built from a centre line (the path the pen travels) and an ink shape: the centre
// line thickened with a pressure curve, so strokes start light, swell, and tail off like a real
// fibre-tip pen. Components reveal the ink by drawing the centre line into an SVG mask with
// pathLength, so the mark appears in pen order while keeping its varied width.
//
// All jitter comes from a PRNG seeded with a string, so the same seed always produces the same
// mark: a key point's tick looks identical on every re-render and every visit.

export type Point = readonly [number, number]

/** Pen pressure along a stroke: t runs 0..1 along its length; 1 is full width. */
export type Pressure = (t: number) => number

export interface InkStroke {
  /** Centre line the pen travels, in drawing order. The reveal mask draws along it. */
  centre: string
  /** Filled outlines that make up the ink. A stroke with a sharp turn is split into parts. */
  ink: string[]
  /** Width of the reveal stroke: just wide enough to uncover all of the ink. */
  revealWidth: number
  /** Length of the centre line in viewBox units, used to share time between strokes. */
  length: number
}

export interface PenGeometry {
  /** viewBox width and height. */
  width: number
  height: number
  /** Strokes in the order they are drawn, with a pen lift between them. */
  strokes: InkStroke[]
}

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

/** 32-bit FNV-1a hash of a string. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Deterministic PRNG (mulberry32) seeded from a string: returns numbers in [0, 1). */
export function seededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 1
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform jitter in [-amount, amount], scaled by `scale` (0 gives a perfectly regular mark). */
function jitterer(random: () => number, scale = 1) {
  return (amount: number) => (random() * 2 - 1) * amount * scale
}

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]]
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]]
const mul = (a: Point, k: number): Point => [a[0] * k, a[1] * k]
const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const distance = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1])

function unit(v: Point): Point {
  const length = Math.hypot(v[0], v[1]) || 1
  return [v[0] / length, v[1] / length]
}

/** The normal to a direction: 90° clockwise on screen (SVG's y axis points down). */
const normal = (v: Point): Point => [-v[1], v[0]]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const smoothstep = (x: number) => {
  const t = clamp(x, 0, 1)
  return t * t * (3 - 2 * t)
}

function at(points: readonly Point[], index: number): Point {
  const point = points[clamp(index, 0, points.length - 1)]
  if (!point) throw new Error('Empty point list')
  return point
}

/** Rounds to 2 decimal places and drops trailing zeros, keeping path data compact. */
function fmt(n: number): string {
  return String(Math.round(n * 100) / 100)
}

const pt = (p: Point) => `${fmt(p[0])} ${fmt(p[1])}`

// ---------------------------------------------------------------------------
// Curves
// ---------------------------------------------------------------------------

function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]
}

/** Points along a cubic Bézier, both ends included. */
function sampleCubic(p0: Point, p1: Point, p2: Point, p3: Point, segments: number): Point[] {
  const points: Point[] = []
  for (let i = 0; i <= segments; i++) points.push(cubicPoint(p0, p1, p2, p3, i / segments))
  return points
}

/** Catmull-Rom control points for the segment from points[i] to points[i + 1]. */
function catmullRomControls(points: readonly Point[], i: number): [Point, Point] {
  const p0 = at(points, i - 1)
  const p1 = at(points, i)
  const p2 = at(points, i + 1)
  const p3 = at(points, i + 2)
  return [add(p1, mul(sub(p2, p0), 1 / 6)), sub(p2, mul(sub(p3, p1), 1 / 6))]
}

/** A smooth curve through knots, sampled densely (Catmull-Rom spline). */
function sampleSpline(knots: readonly Point[], perSegment: number): Point[] {
  const points: Point[] = [at(knots, 0)]
  for (let i = 0; i < knots.length - 1; i++) {
    const [c1, c2] = catmullRomControls(knots, i)
    const segment = sampleCubic(at(knots, i), c1, c2, at(knots, i + 1), perSegment)
    points.push(...segment.slice(1))
  }
  return points
}

/** SVG cubic segments (no leading M) for a smooth curve through the points. */
function smoothSegments(points: readonly Point[]): string {
  let d = ''
  for (let i = 0; i < points.length - 1; i++) {
    const [c1, c2] = catmullRomControls(points, i)
    d += `C${pt(c1)} ${pt(c2)} ${pt(at(points, i + 1))}`
  }
  return d
}

function polylineLength(points: readonly Point[]): number {
  let length = 0
  for (let i = 1; i < points.length; i++) length += distance(at(points, i - 1), at(points, i))
  return length
}

// ---------------------------------------------------------------------------
// Ink
// ---------------------------------------------------------------------------

/**
 * Pen pressure that starts at `from`, swells to full width at `peak` (0..1 along the stroke)
 * and tails off to `to`. A slow wobble stands in for uneven ink flow.
 */
export function swell(from: number, peak: number, to: number, wobble = 0, phase = 0): Pressure {
  return (t) => {
    const base =
      t <= peak
        ? from + (1 - from) * smoothstep(peak > 0 ? t / peak : 1)
        : 1 + (to - 1) * smoothstep(peak < 1 ? (t - peak) / (1 - peak) : 1)
    return base * (1 + wobble * Math.sin(phase + t * 9))
  }
}

/** The filled shape of one stroke: the centre line offset either side by the pressure width. */
function inkOutline(points: readonly Point[], width: number, pressure: Pressure): string {
  const total = polylineLength(points) || 1
  const left: Point[] = []
  const right: Point[] = []
  const widths: number[] = []
  let travelled = 0

  for (let i = 0; i < points.length; i++) {
    if (i > 0) travelled += distance(at(points, i - 1), at(points, i))
    const p = at(points, i)
    const tangent = unit(sub(at(points, i + 1), at(points, i - 1)))
    const half = (width * Math.max(pressure(travelled / total), 0.05)) / 2
    const n = mul(normal(tangent), half)
    left.push(add(p, n))
    right.push(sub(p, n))
    widths.push(half)
  }

  const endRadius = fmt(widths[widths.length - 1] ?? 0.5)
  const startRadius = fmt(widths[0] ?? 0.5)
  const back = [...right].reverse()
  // Round caps: half circles from one side to the other, around the tip.
  return (
    `M${pt(at(left, 0))}${smoothSegments(left)}` +
    `A${endRadius} ${endRadius} 0 0 0 ${pt(at(back, 0))}` +
    `${smoothSegments(back)}` +
    `A${startRadius} ${startRadius} 0 0 0 ${pt(at(left, 0))}Z`
  )
}

/**
 * One continuous pen stroke made of parts that meet end to start. Each part gets its own ink
 * outline (so sharp turns such as a tick's vertex stay crisp), while the centre line runs
 * through all of them for the reveal.
 */
function inkStroke(parts: readonly (readonly Point[])[], width: number, pressures: readonly Pressure[]): InkStroke {
  let centre = ''
  let length = 0
  let peak = 0
  const ink: string[] = []

  parts.forEach((points, index) => {
    const pressure = pressures[index] ?? pressures[0] ?? (() => 1)
    centre += index === 0 ? `M${pt(at(points, 0))}${smoothSegments(points)}` : smoothSegments(points)
    length += polylineLength(points)
    ink.push(inkOutline(points, width, pressure))
    for (let i = 0; i <= 20; i++) peak = Math.max(peak, pressure(i / 20))
  })

  return { centre, ink, length, revealWidth: width * peak * 1.25 + 0.8 }
}

/** A gently bowed line from a to b: a cubic whose controls sit `bow` units off the straight line. */
function bowedLine(a: Point, b: Point, bow: number, segments: number): Point[] {
  const n = normal(unit(sub(b, a)))
  return sampleCubic(a, add(lerp(a, b, 0.33), mul(n, bow)), add(lerp(a, b, 0.7), mul(n, bow * 0.8)), b, segments)
}

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

export interface MarkOptions {
  /** 0 = perfectly regular, 1 = natural hand (default). */
  jitter?: number
  /** Peak stroke width in viewBox units. */
  weight?: number
}

/**
 * A tick in a 32 x 32 box: a short, light down-stroke into the vertex, then a long confident
 * sweep up to the right that bows out slightly and tails off as the pen flicks away.
 */
export function tickGeometry(seed: string, { jitter = 1, weight = 2.7 }: MarkOptions = {}): PenGeometry {
  const random = seededRandom(`tick:${seed}`)
  const j = jitterer(random, jitter)

  const start: Point = [5.5 + j(1), 16.5 + j(1.6)]
  const vertex: Point = [12.5 + j(0.9), 25 + j(0.7)]
  const end: Point = [27.6 + j(1.1), 5 + j(1.8)]

  // The short leg bows out towards the lower left; the long leg towards the lower right.
  const short = bowedLine(start, vertex, 0.5 + j(0.35), 10)
  const long = bowedLine(vertex, end, 1.4 + j(0.6), 18)

  const stroke = inkStroke([short, long], weight, [
    swell(0.42, 1, 1),
    swell(1, 0.18, 0.26, 0.04, random() * 6),
  ])
  return { width: 32, height: 32, strokes: [stroke] }
}

/** A cross in a 28 x 28 box: two quick strokes, top-left to bottom-right, then top-right to bottom-left. */
export function crossGeometry(seed: string, { jitter = 1, weight = 2.5 }: MarkOptions = {}): PenGeometry {
  const random = seededRandom(`cross:${seed}`)
  const j = jitterer(random, jitter)

  const first = bowedLine([6.5 + j(1), 6.5 + j(1.2)], [21.5 + j(1.2), 21.5 + j(1)], 0.6 + j(0.5), 14)
  const second = bowedLine([21 + j(1.2), 6 + j(1)], [7 + j(1), 22 + j(1.2)], j(0.7), 14)

  return {
    width: 28,
    height: 28,
    strokes: [
      inkStroke([first], weight, [swell(0.55, 0.3, 0.45)]),
      inkStroke([second], weight, [swell(0.6, 0.25, 0.4)]),
    ],
  }
}

/**
 * A strike-through across a `width` x `height` box (in px), drawn left to right: it rises a
 * little as a right hand does, with a faint waver along long lines.
 */
export function strikeGeometry(seed: string, width: number, height: number, { jitter = 1, weight }: MarkOptions = {}): PenGeometry {
  const random = seededRandom(`strike:${seed}:${Math.round(width)}`)
  const j = jitterer(random, jitter)
  const w = Math.max(width, 8)
  const h = Math.max(height, 6)
  const thickness = weight ?? clamp(h * 0.12, 1.7, 2.4)

  const x0 = 1.5 + Math.abs(j(1.5))
  const x1 = w - 1.5 - Math.abs(j(1.5))
  const rise = Math.min(w * 0.025, h * 0.2) * (0.6 + random() * 0.6)
  const y0 = h * 0.56 + j(h * 0.04)
  const y1 = y0 - rise

  const segments = clamp(Math.round(w / 56), 1, 12)
  const knots: Point[] = []
  for (let i = 0; i <= segments; i++) {
    const inner = i > 0 && i < segments
    const t = i / segments
    knots.push([x0 + (x1 - x0) * t + (inner ? j(4) : 0), y0 + (y1 - y0) * t + (inner ? j(Math.min(0.8, h * 0.06)) : 0)])
  }
  const points = sampleSpline(knots, segments === 1 ? 16 : 8)
  const lead = clamp(14 / (x1 - x0), 0.05, 0.3)

  return {
    width: w,
    height: h,
    strokes: [inkStroke([points], thickness, [swell(0.7, lead, 0.55, 0.05, random() * 6)])],
  }
}

/**
 * An underline beneath text in a `width` x `height` box (in px): it sags very slightly and lifts
 * at the end where the pen leaves the paper.
 */
export function underlineGeometry(seed: string, width: number, height: number, { jitter = 1, weight }: MarkOptions = {}): PenGeometry {
  const random = seededRandom(`underline:${seed}:${Math.round(width)}`)
  const j = jitterer(random, jitter)
  const w = Math.max(width, 8)
  const h = Math.max(height, 6)
  const thickness = weight ?? clamp(h * 0.18, 1.6, 2.2)

  const x0 = 1.5 + Math.abs(j(1))
  const x1 = w - 1.5 - Math.abs(j(1))
  const base = h * 0.55 + j(h * 0.05)
  const sag = Math.min(1.2, w * 0.01) * (0.5 + random())
  const lift = Math.min(h * 0.3, 3) * (0.6 + random() * 0.6)

  const segments = clamp(Math.round(w / 64), 2, 10)
  const knots: Point[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const inner = i > 0 && i < segments
    const y = base + Math.sin(Math.PI * t) * sag - smoothstep((t - 0.82) / 0.18) * lift
    knots.push([x0 + (x1 - x0) * t + (inner ? j(3) : 0), y + (inner ? j(0.4) : 0)])
  }
  const points = sampleSpline(knots, 8)
  const lead = clamp(12 / (x1 - x0), 0.05, 0.3)

  return {
    width: w,
    height: h,
    strokes: [inkStroke([points], thickness, [swell(0.65, lead, 0.3, 0.04, random() * 6)])],
  }
}

/**
 * An imperfect ring inside a `width` x `height` box (in px), the way an examiner circles a
 * mark: begins just right of the top, runs anticlockwise, drifts slightly as it goes round and
 * overshoots its start, finishing just outside where it began.
 */
export function circleGeometry(seed: string, width: number, height: number, { jitter = 1, weight }: MarkOptions = {}): PenGeometry {
  const random = seededRandom(`circle:${seed}`)
  const j = jitterer(random, jitter)
  const thickness = weight ?? clamp(Math.min(width, height) * 0.045, 1.8, 2.8)

  const rx0 = width / 2
  const ry0 = height / 2
  const pad = thickness + Math.max(rx0, ry0) * 0.08
  const rx = rx0 - pad
  const ry = ry0 - pad

  const tilt = -0.1 + j(0.06)
  const start = -Math.PI / 2 + 0.5 + j(0.25)
  const sweep = Math.PI * 2 + 0.55 + j(0.15)
  const drift: Point = [0.8 + j(0.6), -0.8 + j(0.6)]
  const growth = 0.06 + j(0.02)
  const phaseA = random() * Math.PI * 2
  const phaseB = random() * Math.PI * 2
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)

  const points: Point[] = []
  const steps = 72
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const angle = start - t * sweep
    const wobble = 1 + 0.025 * Math.sin(2 * angle + phaseA) * jitter + 0.012 * Math.sin(3 * angle + phaseB) * jitter
    const k = (1 - growth / 2 + growth * t) * wobble
    const x = Math.cos(angle) * rx * k
    const y = Math.sin(angle) * ry * k
    points.push([rx0 + x * cos - y * sin + drift[0] * t, ry0 + x * sin + y * cos + drift[1] * t])
  }

  return {
    width,
    height,
    strokes: [inkStroke([points], thickness, [swell(0.4, 0.14, 0.3, 0.05, phaseA)])],
  }
}

/** The Redpen logo tick: the same hand, with no jitter and a slightly bolder nib. */
export const BRAND_TICK: PenGeometry = tickGeometry('redpen', { jitter: 0, weight: 3.2 })
