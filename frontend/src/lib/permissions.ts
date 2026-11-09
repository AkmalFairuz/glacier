export const Perm = {
  VIEW_CHANNEL: 1,
  SEND_MESSAGES: 2,
  ATTACH_FILES: 4,
  ADD_REACTIONS: 8,
  MANAGE_MESSAGES: 16,
  MANAGE_CHANNELS: 32,
  MANAGE_ROLES: 64,
  MANAGE_SERVER: 128,
  KICK_MEMBERS: 256,
  BAN_MEMBERS: 512,
  CREATE_INVITE: 1024,
  CONNECT: 2048,
  SPEAK: 4096,
  VIDEO: 8192,
  ADMINISTRATOR: 16384,
} as const

export type PermKey = keyof typeof Perm

export function can(perms: number | undefined, bit: number): boolean {
  if (perms === undefined) return false
  return (perms & Perm.ADMINISTRATOR) !== 0 || (perms & bit) === bit
}

export type PermInfo = { key: PermKey; label: string; description: string; channel: boolean }

export const PERMISSION_INFO: PermInfo[] = [
  { key: 'VIEW_CHANNEL', label: 'View channels', description: 'See channels and read their history.', channel: true },
  { key: 'SEND_MESSAGES', label: 'Send messages', description: 'Post in text channels.', channel: true },
  { key: 'ATTACH_FILES', label: 'Attach files', description: 'Upload images and files.', channel: true },
  { key: 'ADD_REACTIONS', label: 'Add reactions', description: 'React to messages with emoji.', channel: true },
  { key: 'MANAGE_MESSAGES', label: 'Manage messages', description: "Delete other members' messages.", channel: true },
  { key: 'CONNECT', label: 'Connect to voice', description: 'Join voice channels.', channel: true },
  { key: 'SPEAK', label: 'Speak', description: 'Transmit audio in voice channels.', channel: true },
  { key: 'VIDEO', label: 'Video and screen', description: 'Share camera or screen in voice.', channel: true },
  { key: 'CREATE_INVITE', label: 'Create invites', description: 'Generate invite links.', channel: false },
  { key: 'MANAGE_CHANNELS', label: 'Manage channels', description: 'Create, edit and delete channels.', channel: true },
  { key: 'MANAGE_ROLES', label: 'Manage roles', description: 'Edit roles below their own and channel permissions.', channel: true },
  { key: 'MANAGE_SERVER', label: 'Manage server', description: 'Rename the server, edit its icon, manage invites.', channel: false },
  { key: 'KICK_MEMBERS', label: 'Kick members', description: 'Remove members from the server.', channel: false },
  { key: 'BAN_MEMBERS', label: 'Ban members', description: 'Remove and block members from rejoining.', channel: false },
  { key: 'ADMINISTRATOR', label: 'Administrator', description: 'Every permission, bypassing channel overrides.', channel: false },
]
