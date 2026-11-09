import { create } from 'zustand'

/** `serverId`/`channelId` outlive `open` so the window keeps its content while closing. */
export const useChannelSettings = create<{ open: boolean; serverId: string | null; channelId: string | null }>(() => ({
  open: false,
  serverId: null,
  channelId: null,
}))

export const openChannelSettings = (serverId: string, channelId: string) => useChannelSettings.setState({ open: true, serverId, channelId })
export const closeChannelSettings = () => useChannelSettings.setState({ open: false })
