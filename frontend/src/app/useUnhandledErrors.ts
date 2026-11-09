import { useEffect } from 'react'
import { ApiError, errorMessage } from '../lib/api'
import { toast } from '../ui/toast'

/** Fire-and-forget API calls (reactions, typing…) still surface their failures. */
export function useUnhandledErrors() {
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (!(e.reason instanceof ApiError) || e.reason.status === 401) return
      e.preventDefault()
      toast.error(errorMessage(e.reason))
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [])
}
