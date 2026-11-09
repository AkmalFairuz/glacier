import type { ReactNode } from 'react'
import { GlacierMark } from '../../ui/GlacierMark'
import { Strata } from '../../ui/Strata'
import s from './AuthScreen.module.css'

/** Auth backdrop: wordmark, the card, and the ice strata horizon underneath it. */
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className={s.screen}>
      <p className={s.wordmark}>
        <GlacierMark className={s.mark} />
        Glacier
      </p>
      <main className={s.card}>{children}</main>
      <Strata className={s.horizon} />
    </div>
  )
}
