import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSettings } from './settingsStore'

/** Reflects Appearance and Accessibility settings onto <html>, where CSS picks them up. */
export function useApplyAppearance() {
  const a = useSettings(
    useShallow((s) => ({ theme: s.theme, density: s.density, chatFontSize: s.chatFontSize, motion: s.motion, underlineLinks: s.underlineLinks })),
  )
  useEffect(() => {
    const root = document.documentElement
    if (a.theme === 'system') delete root.dataset.theme
    else root.dataset.theme = a.theme
    root.dataset.density = a.density
    root.dataset.motion = a.motion
    root.dataset.underlineLinks = String(a.underlineLinks)
    root.style.setProperty('--chat-font-size', `${a.chatFontSize}px`)
  }, [a])
}
