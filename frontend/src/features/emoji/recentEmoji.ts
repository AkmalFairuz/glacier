const KEY = 'glacier.recentEmoji'
const MAX = 18

/** Recently used emoji, kept per device. */
export function recentEmoji(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function rememberEmoji(unicode: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([unicode, ...recentEmoji().filter((e) => e !== unicode)].slice(0, MAX)))
  } catch {
    /* storage unavailable: recents just won't persist */
  }
}
