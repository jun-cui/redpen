import { ChevronLeft } from 'lucide-react'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { ButtonLink } from '../Button/ButtonLink'
import { cx } from '../cx'
import styles from './Page.module.css'

export interface PageProps extends ComponentPropsWithRef<'div'> {
  /** reading: 720px of content (default); wide: 1120px for two-column desktop layouts. */
  width?: 'reading' | 'wide'
  /** Element to render. Default div (the app shell provides <main>). */
  as?: 'div' | 'main' | 'section' | 'article'
}

/** Page wrapper: centred column, responsive gutters, top safe-area padding. */
export function Page({ width = 'reading', as: Tag = 'div', className, ...rest }: PageProps) {
  return <Tag className={cx(styles.page, styles[width], className)} {...rest} />
}

export interface PageHeaderProps {
  /** The page's h1, set in the serif. */
  title: ReactNode
  /** Small uppercase label above the title. */
  eyebrow?: ReactNode
  description?: ReactNode
  /** Buttons beside the title on wider screens, below it on phones. */
  actions?: ReactNode
  /** A back link above the title. */
  back?: { to: string; label: string }
  className?: string
}

/** Serif page title with optional eyebrow, description, actions and back link. */
export function PageHeader({ title, eyebrow, description, actions, back, className }: PageHeaderProps) {
  return (
    <header className={cx(styles.header, className)}>
      {back ? (
        <ButtonLink to={back.to} variant="ghost" size="sm" leadingIcon={<ChevronLeft />} className={styles.back}>
          {back.label}
        </ButtonLink>
      ) : null}
      <div className={styles.row}>
        <div className={styles.titles}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h1 className={styles.title}>{title}</h1>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </header>
  )
}
