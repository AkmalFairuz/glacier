import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

type Drag = { id: string; from: number; to: number }

/**
 * Pointer-based reordering for a vertical list (mouse, pen and touch), plus
 * ↑/↓ on the handle for keyboard users. `onMove(id, index)` gets the final index.
 */
export function useDragReorder(ids: string[], onMove: (id: string, index: number) => void) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const rows = useRef(new Map<string, HTMLElement>())

  const register = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) rows.current.set(id, el)
      else rows.current.delete(id)
    },
    [],
  )

  /** Insertion slot (0…n) for a pointer at `y`: rows whose middle is above it. */
  const slotAt = (y: number) =>
    ids.filter((id) => {
      const r = rows.current.get(id)?.getBoundingClientRect()
      return !!r && y > r.top + r.height / 2
    }).length

  const handleProps = (id: string, index: number) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      setDrag({ id, from: index, to: index })
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (drag?.id === id) setDrag({ ...drag, to: slotAt(e.clientY) })
    },
    onPointerUp: () => {
      if (drag?.id !== id) return
      const target = drag.to > drag.from ? drag.to - 1 : drag.to
      if (target !== drag.from) onMove(id, target)
      setDrag(null)
    },
    onPointerCancel: () => setDrag(null),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      const target = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1
      if (target < 0 || target >= ids.length) return
      e.preventDefault()
      onMove(id, target)
    },
  })

  /** Slot to draw the drop line at, or null when the drop would not move anything. */
  const indicator = drag && drag.to !== drag.from && drag.to !== drag.from + 1 ? drag.to : null
  return { draggingId: drag?.id ?? null, indicator, register, handleProps }
}
