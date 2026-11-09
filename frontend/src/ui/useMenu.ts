import { useCallback, useState, type MouseEvent } from 'react'
import type { MenuAnchor } from './Menu'

export function useMenu() {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null)

  const openAtPointer = useCallback((e: MouseEvent) => {
    e.preventDefault()
    setAnchor({ x: e.clientX, y: e.clientY })
  }, [])

  const openBelow = useCallback((e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setAnchor({ x: rect.left, y: rect.bottom + 4 })
  }, [])

  const close = useCallback(() => setAnchor(null), [])

  return { anchor, openAtPointer, openBelow, close }
}
