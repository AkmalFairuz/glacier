import type { Channel, User } from '../../lib/types'
import { FILTERS } from './parseQuery'

export type Suggestion =
  | { kind: 'filter'; token: string; hint: string }
  | { kind: 'user'; user: User }
  | { kind: 'channel'; channel: Channel }
  | { kind: 'has'; value: 'link' | 'file' | 'image' }

const MAX = 8

/** The word being typed (the last one, when the caret is at the end). */
export const currentToken = (text: string) => text.split(/\s+/).at(-1) ?? ''

/** Suggestions for the word being typed: filter names, or values for from:/in:/has:. */
export function suggest(text: string, users: User[], channels: Channel[], allowIn: boolean): Suggestion[] {
  const token = currentToken(text).toLowerCase()
  const [key, value = ''] = token.includes(':') ? [token.slice(0, token.indexOf(':')), token.slice(token.indexOf(':') + 1)] : [token, null]
  if (value !== null) {
    const v = value.replace(/^[@#]/, '')
    if (key === 'from') {
      return users
        .filter((u) => u.username.startsWith(v) || u.display_name.toLowerCase().startsWith(v))
        .slice(0, MAX)
        .map((user) => ({ kind: 'user', user }))
    }
    if (key === 'in' && allowIn) {
      return channels
        .filter((c) => (c.name ?? '').toLowerCase().startsWith(v))
        .slice(0, MAX)
        .map((channel) => ({ kind: 'channel', channel }))
    }
    if (key === 'has') {
      return (['link', 'file', 'image'] as const).filter((h) => h.startsWith(v)).map((value) => ({ kind: 'has', value }))
    }
    return []
  }
  return FILTERS.filter((f) => (allowIn || f.token !== 'in:') && f.token.startsWith(token)).map((f) => ({ kind: 'filter', token: f.token, hint: f.hint }))
}

/** Text after accepting a suggestion: the current word is replaced. */
export function accept(text: string, s: Suggestion): string {
  const head = text.slice(0, text.length - currentToken(text).length)
  switch (s.kind) {
    case 'filter':
      return head + s.token
    case 'user':
      return `${head}from:${s.user.username} `
    case 'channel':
      return `${head}in:${s.channel.name} `
    case 'has':
      return `${head}has:${s.value} `
  }
}
