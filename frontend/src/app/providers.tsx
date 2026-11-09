import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryClient } from '../lib/queryClient'
import { ConfirmHost } from '../ui/ConfirmDialog'
import { ToastHost } from '../ui/ToastHost'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ConfirmHost />
      <ToastHost />
    </QueryClientProvider>
  )
}
