import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './cx'

export interface VisuallyHiddenProps extends ComponentPropsWithoutRef<'span'> {
  /** Element to render. Default span. */
  as?: 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'p'
}

/** Content for screen readers only: present in the accessibility tree, invisible on screen. */
export function VisuallyHidden({ as: Tag = 'span', className, ...rest }: VisuallyHiddenProps) {
  return <Tag className={cx('visually-hidden', className)} {...rest} />
}
