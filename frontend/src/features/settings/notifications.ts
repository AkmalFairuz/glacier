import { keys } from '../../lib/keys'
import { queryClient } from '../../lib/queryClient'
import type { Channel, Message, User } from '../../lib/types'
import { settings } from './settingsStore'
import { playSound } from './sounds'

export const notificationsSupported = typeof Notification !== 'undefined'

export const notificationPermission = (): NotificationPermission | 'unsupported' => (notificationsSupported ? Notification.permission : 'unsupported')

/** Plays the message sound and shows a desktop notification when the settings call for it. */
export function notifyMessage(message: Message) {
  const s = settings.get()
  const me = queryClient.getQueryData<User>(keys.me)
  if (s.notifyLevel === 'none' || message.author.id === me?.id) return
  const dm = queryClient.getQueryData<Channel[]>(keys.dms)?.find((c) => c.id === message.channel_id)
  if (s.notifyLevel === 'dms' && !dm) return
  const viewing = document.hasFocus() && !document.hidden && location.pathname.endsWith(`/${message.channel_id}`)
  if (viewing) return

  playSound('message')
  if (!s.notifications || notificationPermission() !== 'granted') return
  const where = dm ? (dm.type === 'group_dm' ? (dm.name ?? 'Group DM') : 'Direct message') : 'New message'
  const body = message.content || `Sent ${message.attachments.length === 1 ? 'a file' : `${message.attachments.length} files`}`
  const notification = new Notification(`${message.author.display_name} · ${where}`, {
    body: body.length > 140 ? `${body.slice(0, 139)}…` : body,
    icon: message.author.avatar_url ?? undefined,
    tag: message.channel_id,
  })
  notification.onclick = () => {
    window.focus()
    const path = dm ? `/channels/@me/${dm.id}` : null
    if (path) void import('../../app/router').then(({ router }) => router.navigate(path))
    notification.close()
  }
}
