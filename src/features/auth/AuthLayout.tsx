import { useEffect, useState } from 'react'
import { Wordmark } from '../../components'
import { useKeyboardInset } from '../../hooks'
import { AnimatedOutlet } from '../shell/AnimatedOutlet'
import { TOAST_OFFSET_NO_TABBAR, useToastOffset } from '../shell/useToastOffset'
import styles from './auth.module.css'

/** The brand tick draws itself once per visit, not on every move between auth screens. */
let brandDrawn = false

/**
 * The frame for the signed-out screens (sign in, forgot password, set password, email links):
 * the wordmark over a centred column of paper. The screens swap with a soft transition while
 * the wordmark stays put. Keeps clear of the iOS keyboard by padding for --keyboard-inset.
 */
export function AuthLayout() {
  const [drawBrand] = useState(() => !brandDrawn)
  useEffect(() => {
    brandDrawn = true
  }, [])
  useKeyboardInset()
  useToastOffset(TOAST_OFFSET_NO_TABBAR)

  return (
    <div className={styles.screen}>
      <main className={styles.column}>
        <header className={styles.brand}>
          <Wordmark size="lg" animated={drawBrand} />
        </header>
        <AnimatedOutlet className={styles.outlet} />
      </main>
    </div>
  )
}
