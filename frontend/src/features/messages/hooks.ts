import { useInfiniteQuery } from '@tanstack/react-query'
import { keys } from '../../lib/keys'
import type { Message } from '../../lib/types'
import { messagesApi, PAGE_SIZE } from './api'

/** Pages are newest-first; each page is sorted oldest → newest. */
export function useMessages(channelId: string) {
  return useInfiniteQuery({
    queryKey: keys.messages(channelId),
    queryFn: ({ pageParam }) => messagesApi.list(channelId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page: Message[]) => (page.length < PAGE_SIZE ? undefined : page[0].id),
    select: (data) => [...data.pages].reverse().flat(),
    staleTime: Infinity,
  })
}
