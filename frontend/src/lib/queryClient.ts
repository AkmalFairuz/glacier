import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from '../ui/toast'
import { ApiError, errorMessage } from './api'

declare module '@tanstack/react-query' {
  interface Register {
    /** `inlineError`: the form shows this mutation's error itself, so no toast. */
    mutationMeta: { inlineError?: boolean }
  }
}

/** Server failures and lost connections are worth a toast; 4xx on reads are handled by the page. */
const worthToasting = (error: unknown) => !(error instanceof ApiError) || error.status >= 500

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => worthToasting(error) && toast.error(errorMessage(error)),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.inlineError || (error instanceof ApiError && error.status === 401)) return
      toast.error(errorMessage(error))
    },
  }),
})
