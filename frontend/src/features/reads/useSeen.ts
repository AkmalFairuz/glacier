import { useQuery } from '@tanstack/react-query'
import { compareIds } from '../../lib/format'
import { keys } from '../../lib/keys'
import type { Channel, Message } from '../../lib/types'
import { readsApi } from './api'

/** "Seen" / "Seen by N" for your latest message in a DM, or null. */
export function useSeen(channel: Channel | undefined, messages: Message[], meId: string | undefined): { label: string; names: string } | null {
  const isDm = !!channel && channel.server_id === null
  const { data: receipts = [] } = useQuery({
    queryKey: keys.receipts(channel?.id ?? ''),
    queryFn: () => readsApi.receipts(channel!.id),
    enabled: isDm,
  })
  const last = messages.at(-1)
  if (!isDm || !last || last.author.id !== meId) return null
  const seenBy = receipts.filter((r) => compareIds(r.last_read_message_id, last.id) >= 0)
  if (!seenBy.length) return null
  const names = seenBy.map((r) => channel!.recipients.find((u) => u.id === r.user_id)?.display_name ?? 'Someone').join(', ')
  return { label: channel!.type === 'dm' ? 'Seen' : seenBy.length === channel!.recipients.length - 1 ? 'Seen by everyone' : `Seen by ${seenBy.length}`, names }
}
