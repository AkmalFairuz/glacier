import type { Channel, ChannelPosition } from '../../lib/types'
import type { ChannelGroup } from './hooks'

/** A drop location: insert into `parentId` (null = uncategorized) at `index`. */
export type ChannelSlot = { parentId: string | null; index: number }

const parentOf = (g: ChannelGroup) => g.category?.id ?? null

/** Positions for every channel and category after a layout change (0…n per parent). */
export function toPositions(groups: ChannelGroup[]): ChannelPosition[] {
  const out: ChannelPosition[] = []
  groups.forEach((g) => g.channels.forEach((c, i) => out.push({ id: c.id, position: i, parent_id: parentOf(g) })))
  groups.filter((g) => g.category).forEach((g, i) => out.push({ id: g.category!.id, position: i, parent_id: null }))
  return out
}

export function moveChannel(groups: ChannelGroup[], channel: Channel, slot: ChannelSlot): ChannelGroup[] {
  const next = groups.map((g) => ({ ...g, channels: g.channels.filter((c) => c.id !== channel.id) }))
  let target = next.find((g) => parentOf(g) === slot.parentId)
  if (!target) {
    target = { category: null, channels: [] }
    next.unshift(target)
  }
  target.channels.splice(Math.min(slot.index, target.channels.length), 0, { ...channel, parent_id: slot.parentId })
  return next
}

export function moveCategory(groups: ChannelGroup[], categoryId: string, index: number): ChannelGroup[] {
  const loose = groups.filter((g) => !g.category)
  const cats = groups.filter((g) => g.category)
  const moving = cats.find((g) => g.category!.id === categoryId)
  if (!moving) return groups
  const rest = cats.filter((g) => g !== moving)
  rest.splice(Math.min(index, rest.length), 0, moving)
  return [...loose, ...rest]
}

/** Neighbour slot for keyboard "Move up/down" within the channel's own group. */
export function stepSlot(groups: ChannelGroup[], channel: Channel, delta: -1 | 1): ChannelSlot | null {
  const group = groups.find((g) => g.channels.some((c) => c.id === channel.id))
  if (!group) return null
  const index = group.channels.findIndex((c) => c.id === channel.id) + delta
  if (index < 0 || index >= group.channels.length) return null
  return { parentId: parentOf(group), index }
}

/** Only entries whose position or parent actually changed. */
export function changed(before: Channel[], after: ChannelPosition[]): ChannelPosition[] {
  return after.filter((p) => {
    const c = before.find((x) => x.id === p.id)
    return !c || c.position !== p.position || c.parent_id !== (p.parent_id ?? null)
  })
}
