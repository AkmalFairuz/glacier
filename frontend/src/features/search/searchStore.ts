import { create } from 'zustand'

/** Where a search runs: a whole server, or one DM. */
export type SearchScope = { kind: 'server'; id: string } | { kind: 'channel'; id: string }

type Search = { scope: SearchScope | null; query: string; highlight: { channelId: string; messageId: string } | null }

export const useSearch = create<Search>(() => ({ scope: null, query: '', highlight: null }))

export const search = {
  run: (scope: SearchScope, query: string) => useSearch.setState({ scope, query }),
  close: () => useSearch.setState({ scope: null, query: '' }),
  jumpTo: (channelId: string, messageId: string) => useSearch.setState({ highlight: { channelId, messageId } }),
  clearHighlight: () => useSearch.setState({ highlight: null }),
}

export const scopeKey = (scope: SearchScope) => `${scope.kind}:${scope.id}`
