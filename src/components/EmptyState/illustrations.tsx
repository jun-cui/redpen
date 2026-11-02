import { PenStrike } from '../pen/PenStrike'
import { PenTick } from '../pen/PenTick'
import styles from './EmptyState.module.css'

export type IllustrationName = 'sheets' | 'done' | 'log' | 'search' | 'torn'

const RULES = [36, 46, 56, 66, 76]

/** Lines of handwriting on the log sheet: [y, x1, x2] per word. */
const WRITING: ReadonlyArray<readonly [number, number, number]> = [
  [30, 57, 79],
  [30, 83, 95],
  [42, 57, 71],
  [42, 75, 95],
  [54, 57, 89],
  [66, 57, 75],
  [66, 79, 93],
  [78, 57, 83],
]

/** The torn edge, shared by the sheet and the scrap below it. */
const TEAR = 'L96 75L88 69L80 74L72 68L64 74L56 69L48 75L40 70'

/** A sheet of ruled paper, slightly turned, as drawn in the empty-state illustrations. */
function PaperSheet({ turn = 3, margin = false, rules = RULES }: { turn?: number; margin?: boolean; rules?: readonly number[] }) {
  return (
    <g transform={`rotate(${turn} 72 54)`}>
      <rect className={styles.paper} x="40" y="12" width="64" height="84" rx="3" />
      {margin ? <line className={styles.margin} x1="52" y1="12" x2="52" y2="96" /> : null}
      {rules.map((y) => (
        <line key={y} className={styles.rule} x1={margin ? 56 : 48} y1={y} x2="96" y2={y} />
      ))}
    </g>
  )
}

/** Small line drawings for empty states: paper in ink, one mark in red pen. */
export function Illustration({ name }: { name: IllustrationName }) {
  return (
    <span className={styles.artFrame}>
      <svg className={styles.illustration} viewBox="0 0 136 104" aria-hidden="true" focusable="false">
        {name === 'sheets' ? (
          <>
            <rect className={styles.paperBack} x="34" y="10" width="64" height="84" rx="3" transform="rotate(-7 66 52)" />
            <PaperSheet />
          </>
        ) : null}
        {name === 'done' ? <PaperSheet turn={-2} rules={[66, 76]} /> : null}
        {name === 'log' ? (
          <g transform="rotate(2 72 54)">
            <PaperSheet turn={0} margin rules={[]} />
            {WRITING.map(([y, x1, x2]) => (
              <line key={`${y}-${x1}`} className={styles.writing} x1={x1} y1={y} x2={x2} y2={y} />
            ))}
          </g>
        ) : null}
        {name === 'torn' ? (
          <>
            <g transform="rotate(-3 72 54)">
              <path className={styles.paper} d={`M43 12H101A3 3 0 0 1 104 15V70${TEAR}V15A3 3 0 0 1 43 12Z`} />
              {[30, 40, 50, 60].map((y) => (
                <line key={y} className={styles.rule} x1="48" y1={y} x2="96" y2={y} />
              ))}
            </g>
            <g transform="translate(4 9) rotate(5 72 84)">
              <path className={styles.paper} d={`M104 70${TEAR}V83A3 3 0 0 0 43 86H101A3 3 0 0 0 104 83Z`} />
            </g>
          </>
        ) : null}
        {name === 'search' ? (
          <>
            <PaperSheet turn={-3} rules={[36, 46, 56]} />
            <circle className={styles.line} cx="88" cy="70" r="13" />
            <path className={styles.line} d="M97.5 79.5 108 90" />
          </>
        ) : null}
      </svg>
      {name === 'done' ? (
        <PenTick size={48} seed="caught-up" delay={0.25} className={styles.accent} style={{ left: 46, top: 14 }} />
      ) : null}
      {name === 'log' ? (
        <span className={styles.accent} style={{ left: 54, top: 46 }}>
          <PenStrike width={38} height={14} weight={2.4} seed="log" delay={0.25} />
        </span>
      ) : null}
    </span>
  )
}
