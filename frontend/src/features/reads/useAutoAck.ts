import { useEffect, useRef } from 'react'
import { compareIds } from '../../lib/format'
import { readsApi } from './api'
import { reads, useReads } from './readStore'

const THROTTLE_MS = 800

/**
 * Marks the channel read up to `newestId` while the reader can actually see
 * it: window focused and visible, and the list scrolled to the bottom.
 */
export function useAutoAck(channelId: string, newestId: string | undefined, atBottom: boolean) {
  const read = useReads((s) => s.read[channelId])
  const hydrated = useReads((s) => s.hydrated)
  const lastSent = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const tryAck = () => {
      if (!hydrated || !newestId || !atBottom || document.hidden || !document.hasFocus()) return
      if (read && compareIds(read, newestId) >= 0) return
      window.clearTimeout(timer.current)
      const wait = Math.max(0, lastSent.current + THROTTLE_MS - Date.now())
      timer.current = window.setTimeout(() => {
        lastSent.current = Date.now()
        reads.setRead(channelId, newestId)
        void readsApi.ack(channelId, newestId)
      }, wait)
    }
    tryAck()
    window.addEventListener('focus', tryAck)
    document.addEventListener('visibilitychange', tryAck)
    return () => {
      window.removeEventListener('focus', tryAck)
      document.removeEventListener('visibilitychange', tryAck)
    }
  }, [channelId, newestId, atBottom, read, hydrated])

  useEffect(() => () => window.clearTimeout(timer.current), [])
}
