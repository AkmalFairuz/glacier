import { ChannelSettings } from './ChannelSettings'
import { closeChannelSettings, useChannelSettings } from './channelSettingsStore'
import { useChannels } from './hooks'

/** The one channel settings window. Mount once. */
export function ChannelSettingsHost() {
  const { open, serverId, channelId } = useChannelSettings()
  const channel = useChannels(serverId ?? undefined).data?.find((c) => c.id === channelId)
  if (!channel) return null
  return <ChannelSettings key={channel.id} channel={channel} open={open} onClose={closeChannelSettings} />
}
