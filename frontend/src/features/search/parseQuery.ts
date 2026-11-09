import type { Channel, User } from '../../lib/types'

export type ParsedQuery = { q: string; author_id?: string; channel_id?: string; has?: 'link' | 'file' | 'image' }

export const FILTERS = [
  { token: 'from:', hint: 'user' },
  { token: 'in:', hint: 'channel' },
  { token: 'has:', hint: 'link, file or image' },
] as const

const HAS = ['link', 'file', 'image'] as const

/** Splits "from:kira in:general has:link exam" into API params, resolving names to ids. */
export function parseQuery(input: string, users: User[], channels: Channel[]): ParsedQuery {
  const words: string[] = []
  const out: ParsedQuery = { q: '' }
  for (const part of input.trim().split(/\s+/).filter(Boolean)) {
    const [key, ...rest] = part.split(':')
    const value = rest.join(':').replace(/^[@#]/, '').toLowerCase()
    if (key === 'from' && value) {
      out.author_id = users.find((u) => u.username === value || u.display_name.toLowerCase() === value)?.id ?? 'none'
    } else if (key === 'in' && value) {
      out.channel_id = channels.find((c) => c.name?.toLowerCase() === value)?.id ?? 'none'
    } else if (key === 'has' && (HAS as readonly string[]).includes(value)) {
      out.has = value as ParsedQuery['has']
    } else {
      words.push(part)
    }
  }
  out.q = words.join(' ')
  return out
}
