import { useRef, useState, type PointerEvent, type RefObject } from 'react'
import type { ChannelSlot } from './channelOrder'
import type { ChannelGroup } from './hooks'

const THRESHOLD = 5

type Kind = 'channel' | 'category'
type Drag = { id: string; kind: Kind; startY: number; active: boolean }
export type Drop = { kind: 'channel'; slot: ChannelSlot } | { kind: 'category'; index: number }

/**
 * Pointer drag for the channel tree. Rows carry `data-drag-id` / `data-drag-kind`;
 * a drag only starts after a few pixels, so clicks still open channels.
 */
export function useChannelDrag(container: RefObject<HTMLElement | null>, groups: ChannelGroup[], onDrop: (id: string, drop: Drop) => void) {
  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const [state, setState] = useState<{ id: string; line: number | null; drop: Drop | null } | null>(null)

  const rows = () =>
    [...(container.current?.querySelectorAll<HTMLElement>('[data-drag-id]') ?? [])].map((el) => ({
      el,
      id: el.dataset.dragId!,
      kind: el.dataset.dragKind as Kind,
    }))

  const lineAt = (el: HTMLElement, after: boolean) => {
    const box = container.current!.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return (after ? r.bottom : r.top) - box.top + container.current!.scrollTop
  }

  const groupOf = (channelId: string) => groups.find((g) => g.channels.some((c) => c.id === channelId))
  const childrenOf = (parentId: string | null, without: string) =>
    (groups.find((g) => (g.category?.id ?? null) === parentId)?.channels ?? []).filter((c) => c.id !== without)

  /** Where a channel would land for a pointer at `y`. */
  const channelTarget = (y: number, dragged: string): { drop: Drop; line: number } | null => {
    const list = rows().filter((r) => r.id !== dragged)
    for (let i = 0; i < list.length; i++) {
      const r = list[i]
      const box = r.el.getBoundingClientRect()
      if (y >= box.top + box.height / 2) continue
      if (r.kind === 'channel') {
        const parentId = groupOf(r.id)?.category?.id ?? null
        return {
          drop: { kind: 'channel', slot: { parentId, index: childrenOf(parentId, dragged).findIndex((c) => c.id === r.id) } },
          line: lineAt(r.el, false),
        }
      }
      // Above a category header: end of whatever group precedes it.
      const prev = list[i - 1]
      const parentId = !prev ? null : prev.kind === 'category' ? prev.id : (groupOf(prev.id)?.category?.id ?? null)
      return {
        drop: { kind: 'channel', slot: { parentId, index: childrenOf(parentId, dragged).length } },
        line: prev ? lineAt(prev.el, true) : lineAt(r.el, false),
      }
    }
    const last = list.at(-1)
    if (!last) return null
    const parentId = last.kind === 'category' ? last.id : (groupOf(last.id)?.category?.id ?? null)
    return { drop: { kind: 'channel', slot: { parentId, index: childrenOf(parentId, dragged).length } }, line: lineAt(last.el, true) }
  }

  const categoryTarget = (y: number, dragged: string): { drop: Drop; line: number } | null => {
    const headers = rows().filter((r) => r.kind === 'category' && r.id !== dragged)
    const index = headers.findIndex((r) => {
      const box = r.el.getBoundingClientRect()
      return y < box.top + box.height / 2
    })
    if (index >= 0) return { drop: { kind: 'category', index }, line: lineAt(headers[index].el, false) }
    const all = rows()
    const last = all.at(-1)
    return last ? { drop: { kind: 'category', index: headers.length }, line: lineAt(last.el, true) } : null
  }

  const rowProps = (id: string, kind: Kind, enabled: boolean) =>
    enabled
      ? {
          'data-drag-id': id,
          'data-drag-kind': kind,
          'data-dragging': state?.id === id || undefined,
          onPointerDown: (e: PointerEvent<HTMLElement>) => {
            if (e.button !== 0 || (e.target as HTMLElement).closest('[data-no-drag]')) return
            drag.current = { id, kind, startY: e.clientY, active: false }
          },
          onPointerMove: (e: PointerEvent<HTMLElement>) => {
            const d = drag.current
            if (!d || d.id !== id) return
            if (!d.active) {
              if (Math.abs(e.clientY - d.startY) < THRESHOLD) return
              d.active = true
              e.currentTarget.setPointerCapture(e.pointerId)
            }
            const target = d.kind === 'channel' ? channelTarget(e.clientY, id) : categoryTarget(e.clientY, id)
            setState({ id, line: target?.line ?? null, drop: target?.drop ?? null })
          },
          onPointerUp: () => {
            const d = drag.current
            drag.current = null
            if (!d?.active) return
            // Swallow only the click that ends this drag.
            suppressClick.current = true
            window.setTimeout(() => (suppressClick.current = false))
            if (state?.drop) onDrop(id, state.drop)
            setState(null)
          },
          // Rows contain links; stop the browser's own link drag from cancelling ours.
          onDragStart: (e: { preventDefault: () => void }) => e.preventDefault(),
          onPointerCancel: () => {
            drag.current = null
            setState(null)
          },
          onClickCapture: (e: { preventDefault: () => void; stopPropagation: () => void }) => {
            if (!suppressClick.current) return
            suppressClick.current = false
            e.preventDefault()
            e.stopPropagation()
          },
        }
      : {}

  return { rowProps, line: state?.line ?? null, draggingId: state?.id ?? null }
}
