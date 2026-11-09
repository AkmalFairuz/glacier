export type Emoji = { unicode: string; label: string; shortcode: string; search: string }
export type EmojiGroup = { key: string; name: string; emojis: Emoji[] }

type Raw = { unicode: string; label: string; group?: number; order?: number; tags?: string[]; hexcode: string }

const GROUP_NAMES = [
  'Smileys & emotion',
  'People & body',
  'Components',
  'Animals & nature',
  'Food & drink',
  'Travel & places',
  'Activities',
  'Objects',
  'Symbols',
  'Flags',
]
const GROUP_KEYS = ['smileys', 'people', 'components', 'nature', 'food', 'travel', 'activities', 'objects', 'symbols', 'flags']

let loading: Promise<EmojiGroup[]> | null = null

/** Full Unicode emoji set, grouped and ordered; loaded on first use as its own chunk. */
export function loadEmoji(): Promise<EmojiGroup[]> {
  loading ??= Promise.all([import('emojibase-data/en/compact.json'), import('emojibase-data/en/shortcodes/github.json')]).then(([data, codes]) => {
    const shortcodes = codes.default as Record<string, string | string[]>
    const groups: EmojiGroup[] = GROUP_NAMES.map((name, i) => ({ key: GROUP_KEYS[i], name, emojis: [] }))
    const sorted = [...(data.default as Raw[])].filter((e) => e.group !== undefined && e.group !== 2).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    for (const e of sorted) {
      const code = shortcodes[e.hexcode]
      const shortcode = (Array.isArray(code) ? code[0] : code) ?? e.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')
      groups[e.group!].emojis.push({ unicode: e.unicode, label: e.label, shortcode, search: [e.label, shortcode, ...(e.tags ?? [])].join(' ').toLowerCase() })
    }
    return groups.filter((g) => g.emojis.length > 0)
  })
  return loading
}

/** Best matches first: exact shortcode or name, then prefix, then anywhere. */
export function searchEmoji(all: Emoji[], query: string): Emoji[] {
  const score = (e: Emoji) => {
    const label = e.label.toLowerCase()
    if (e.shortcode === query || label === query) return 0
    if (e.shortcode.startsWith(query) || label.startsWith(query)) return 1
    if (e.search.split(' ').some((word) => word.startsWith(query))) return 2
    return e.search.includes(query) ? 3 : -1
  }
  return all
    .map((e, i) => ({ e, i, rank: score(e) }))
    .filter((x) => x.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, 200)
    .map((x) => x.e)
}
