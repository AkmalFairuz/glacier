import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { gateway, type GatewayEvent } from '../lib/gateway'
import { keys } from '../lib/keys'
import type { Channel, Member, ReadReceipt, User } from '../lib/types'
import { useSession } from '../features/auth/useSession'
import { removeChannel, upsertChannel } from '../features/channels/cache'
import { bumpDm, removeDm, upsertDm } from '../features/dms/cache'
import { removeMember, upsertMember } from '../features/members/cache'
import { setPresence } from '../features/members/presenceStore'
import { addMessage, applyReaction, deleteMessage, updateMessage } from '../features/messages/cache'
import { startTyping, stopTyping } from '../features/messages/typingStore'
import { removeRole, upsertRole } from '../features/roles/cache'
import { adjustMemberCount, removeServer, upsertServer } from '../features/servers/cache'
import { notifyMessage } from '../features/settings/notifications'
import { reads } from '../features/reads/readStore'
import { handleVoiceEvent } from '../features/voice/voiceSession'

/** Server of a channel, from whichever server channel list is cached; null for DMs. */
function serverOfChannel(qc: QueryClient, channelId: string): string | null {
  for (const [key, list] of qc.getQueriesData<Channel[]>({ queryKey: ['channels'] })) {
    if (list?.some((c) => c.id === channelId)) return String(key[1])
  }
  return null
}

function apply(qc: QueryClient, event: GatewayEvent) {
  switch (event.t) {
    case 'READY':
      qc.setQueryData(keys.me, event.d.user)
      qc.setQueryData(keys.servers, event.d.servers)
      qc.setQueryData(keys.dms, event.d.dms)
      reads.hydrate(event.d.read_states ?? [], event.d.channel_heads ?? [], event.d.dms, event.d.dm_unread ?? [])
      for (const [userId, online] of Object.entries(event.d.dm_presence ?? {})) setPresence(userId, online)
      return
    case 'MESSAGE_CREATE':
      addMessage(qc, event.d)
      stopTyping(event.d.channel_id, event.d.author.id)
      bumpDm(qc, event.d.channel_id, event.d.id)
      notifyMessage(event.d)
      reads.bumpHead(event.d.channel_id, serverOfChannel(qc, event.d.channel_id), event.d.id)
      if (event.d.author.id !== qc.getQueryData<User>(keys.me)?.id && qc.getQueryData<Channel[]>(keys.dms)?.some((c) => c.id === event.d.channel_id)) {
        reads.countDm(event.d.channel_id)
      }
      return
    case 'MESSAGE_UPDATE':
      return updateMessage(qc, event.d)
    case 'MESSAGE_DELETE':
      return deleteMessage(qc, event.d.channel_id, event.d.id)
    case 'REACTION_ADD':
    case 'REACTION_REMOVE':
      return applyReaction(qc, event.d, event.t === 'REACTION_ADD')
    case 'TYPING_START':
      return startTyping(event.d.channel_id, event.d.user_id, event.d.display_name)
    case 'CHANNEL_CREATE':
    case 'CHANNEL_UPDATE':
      return event.d.server_id ? upsertChannel(qc, event.d) : upsertDm(qc, event.d)
    case 'CHANNEL_DELETE':
      return event.d.server_id ? removeChannel(qc, event.d.server_id, event.d.id) : removeDm(qc, event.d.id)
    case 'SERVER_CREATE':
    case 'SERVER_UPDATE':
      return upsertServer(qc, event.d)
    case 'SERVER_DELETE':
      return removeServer(qc, event.d.id)
    case 'MEMBER_ADD':
      upsertMember(qc, event.d)
      // The joiner's own SERVER_CREATE already carries the updated count.
      if (event.d.user.id === qc.getQueryData<User>(keys.me)?.id) return
      return adjustMemberCount(qc, event.d.server_id, 1)
    case 'MEMBER_UPDATE':
      return upsertMember(qc, event.d)
    case 'MEMBER_REMOVE':
      removeMember(qc, event.d.server_id, event.d.user_id)
      return adjustMemberCount(qc, event.d.server_id, -1)
    case 'ROLE_CREATE':
    case 'ROLE_UPDATE':
      return upsertRole(qc, event.d)
    case 'ROLE_DELETE':
      return removeRole(qc, event.d.server_id, event.d.id)
    case 'PERMISSIONS_CHANGED':
      void qc.invalidateQueries({ queryKey: keys.permissions(event.d.server_id) })
      void qc.invalidateQueries({ queryKey: keys.channels(event.d.server_id) })
      return
    case 'PRESENCE_UPDATE':
      return setPresence(event.d.user_id, event.d.online)
    case 'READ_STATE_UPDATE':
      return reads.setRead(event.d.channel_id, event.d.last_read_message_id)
    case 'RECEIPT_UPDATE':
      qc.setQueryData<ReadReceipt[]>(
        keys.receipts(event.d.channel_id),
        (list) =>
          list && [...list.filter((r) => r.user_id !== event.d.user_id), { user_id: event.d.user_id, last_read_message_id: event.d.last_read_message_id }],
      )
      return
    case 'USER_UPDATE':
      qc.setQueryData(keys.me, (me: { id: string } | undefined) => (me?.id === event.d.id ? event.d : me))
      qc.setQueriesData<Member[]>({ queryKey: ['members'] }, (list) => list?.map((m) => (m.user.id === event.d.id ? { ...m, user: event.d } : m)))
      return
  }
}

/** Keeps the gateway connected while signed in and folds its events into the query cache. */
export function useGatewaySync() {
  const qc = useQueryClient()
  const token = useSession((s) => s.token)

  useEffect(() => {
    if (!token) return
    const unsubscribe = gateway.subscribe((event) => {
      apply(qc, event)
      handleVoiceEvent(event)
    })
    gateway.connect(token)
    return () => {
      unsubscribe()
      gateway.close()
    }
  }, [qc, token])
}
