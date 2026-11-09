import { useEffect } from 'react'
import { gateway, useGatewayStatus } from '../lib/gateway'

/** After this long without input the tab reports itself idle. */
const IDLE_AFTER_MS = 10 * 60 * 1000
const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

/**
 * Tells the server when this tab goes idle and comes back. The user shows as Idle to others
 * only when every open tab is idle (and their chosen status is Online).
 */
export function useIdleReporter() {
  useEffect(() => {
    let idle = false
    let lastInput = 0
    let timer = 0
    const report = (value: boolean) => {
      if (idle === value) return
      idle = value
      gateway.send('ACTIVITY', { idle: value })
    }
    const arm = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => report(true), IDLE_AFTER_MS)
    }
    const onInput = () => {
      const now = Date.now()
      if (!idle && now - lastInput < 5000) return // pointermove fires constantly
      lastInput = now
      report(false)
      arm()
    }
    // A new connection starts active on the server; repeat the idle state after reconnecting.
    const unsubscribe = useGatewayStatus.subscribe((st, prev) => {
      if (st.status === 'ready' && prev.status !== 'ready' && idle) gateway.send('ACTIVITY', { idle: true })
    })
    for (const name of INPUT_EVENTS) window.addEventListener(name, onInput, { passive: true })
    arm()
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
      for (const name of INPUT_EVENTS) window.removeEventListener(name, onInput)
    }
  }, [])
}
