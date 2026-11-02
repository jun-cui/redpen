import type { ComponentPropsWithRef } from 'react'
import { cx } from '../cx'
import styles from './Sheet.module.css'

export type SheetElevation = 'flat' | 'raised' | 'lifted'
export type SheetPadding = 'none' | 'sm' | 'md' | 'lg'

export interface SheetStyleProps {
  /** flat for lists, raised (default) for content, lifted for the card in focus and dialogs. */
  elevation?: SheetElevation
  /** sm 16px, md 24px (32px from 600px, default), lg 32-48px, or none. */
  padding?: SheetPadding
  /** Faint ruled lines like lined paper. Text inside uses line-height var(--sheet-line). */
  ruled?: boolean
  /** The red margin rule of an exam answer sheet, with a free margin column on the left. */
  margin?: boolean
  /** Hover lift and press feedback, for a sheet that is itself clickable. */
  interactive?: boolean
  className?: string
}

export interface SheetProps extends ComponentPropsWithRef<'div'>, SheetStyleProps {
  /** Element to render. Default div. */
  as?: 'div' | 'section' | 'article' | 'aside' | 'li' | 'form'
}

/** Class names for the paper look on another element (e.g. a react-router Link). */
export function sheetClassName({
  elevation = 'raised',
  padding = 'md',
  ruled = false,
  margin = false,
  interactive = false,
  className,
}: SheetStyleProps = {}): string {
  return cx(
    styles.sheet,
    elevation !== 'raised' && styles[elevation],
    styles[`pad-${padding}`],
    ruled && styles.ruled,
    margin && styles.margin,
    interactive && styles.interactive,
    className,
  )
}

/**
 * The paper surface everything sits on. Exposes --sheet-pad-x, --sheet-pad-y and
 * --sheet-margin to children that need to line up with the margin or the rules.
 */
export function Sheet({ as = 'div', elevation, padding, ruled, margin, interactive, className, ...rest }: SheetProps) {
  // The ref is typed for a div; every allowed tag is an HTMLElement with the same props.
  const Tag = as as 'div'
  return <Tag className={sheetClassName({ elevation, padding, ruled, margin, interactive, className })} {...rest} />
}
