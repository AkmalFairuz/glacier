import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { UserPanel } from '../features/user/UserPanel'
import { VoiceStatusBar } from '../features/voice/VoiceStatusBar'
import s from './SidebarFrame.module.css'

/**
 * The second column. Voice status and the account panel float as one card
 * across the bottom of the server rail and this column; its height is shared
 * as --dock-height so both columns keep their content clear of it.
 */
export function SidebarFrame({ children }: { children: ReactNode }) {
  const dock = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = dock.current
    if (!el) return
    const root = document.documentElement
    const observer = new ResizeObserver(() => root.style.setProperty('--dock-height', `${el.offsetHeight}px`))
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--dock-height')
    }
  }, [])

  return (
    <div className={s.frame}>
      {children}
      <div ref={dock} className={s.dock}>
        <VoiceStatusBar />
        <UserPanel />
      </div>
    </div>
  )
}
