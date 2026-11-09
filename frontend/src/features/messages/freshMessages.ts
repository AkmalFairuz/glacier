/** Ids of messages that just arrived live, so only they get an entrance animation. */
const fresh = new Set<string>()

export function markFresh(id: string) {
  fresh.add(id)
  window.setTimeout(() => fresh.delete(id), 2000)
}

export const isFresh = (id: string) => fresh.has(id)
