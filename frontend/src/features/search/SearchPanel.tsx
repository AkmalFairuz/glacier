import { useInfiniteQuery } from '@tanstack/react-query'
import { LuX } from 'react-icons/lu'
import { useNavigate } from 'react-router'
import { keys } from '../../lib/keys'
import type { Message } from '../../lib/types'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { IconButton } from '../../ui/IconButton'
import { Spinner } from '../../ui/Spinner'
import { searchMessages } from './api'
import { parseQuery } from './parseQuery'
import { SearchResult } from './SearchResult'
import { scopeKey, search, useSearch } from './searchStore'
import { useSearchContext } from './useSearchContext'
import s from './SearchPanel.module.css'

/** Results column that replaces the member list while a search is open. */
export function SearchPanel() {
  const scope = useSearch((st) => st.scope)!
  const query = useSearch((st) => st.query)
  const navigate = useNavigate()
  const ctx = useSearchContext(scope)
  const params = parseQuery(query, ctx.users, ctx.channels)
  const results = useInfiniteQuery({
    queryKey: keys.search(scopeKey(scope), JSON.stringify(params)),
    queryFn: ({ pageParam }) => searchMessages(scope, params, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.has_more ? last.messages.at(-1)?.id : undefined),
  })
  const messages = results.data?.pages.flatMap((p) => p.messages) ?? []
  const channelName = (m: Message) => ctx.channels.find((c) => c.id === m.channel_id)?.name

  const open = (m: Message) => {
    search.jumpTo(m.channel_id, m.id)
    navigate(scope.kind === 'server' ? `/channels/${scope.id}/${m.channel_id}` : `/channels/@me/${m.channel_id}`)
  }

  return (
    <aside className={s.panel} aria-label="Search results">
      <header className={s.header}>
        <h2 className={s.title}>
          {results.isLoading ? 'Searching…' : `${messages.length}${results.hasNextPage ? '+' : ''} ${messages.length === 1 ? 'result' : 'results'}`}
        </h2>
        <IconButton label="Close search" icon={<LuX />} onClick={search.close} />
      </header>
      <div className={s.list}>
        {results.isLoading ? (
          <Spinner />
        ) : messages.length === 0 ? (
          <EmptyState title="No results" body="Try fewer words, or remove a filter." />
        ) : (
          <>
            {messages.map((m) => (
              <SearchResult key={m.id} message={m} channelName={channelName(m)} onOpen={() => open(m)} />
            ))}
            {results.hasNextPage && (
              <Button className={s.more} loading={results.isFetchingNextPage} onClick={() => void results.fetchNextPage()}>
                Load more
              </Button>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
