import { useMemo } from 'react'
import { useSettings, type Clock } from './settingsStore'

const formatter = (clock: Clock) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', ...(clock !== 'auto' && { hour12: clock === '12h' }) })

/** Message time formatter honoring Settings > Appearance > Time format. */
export function useTimeFormat() {
  const clock = useSettings((s) => s.clock)
  return useMemo(() => {
    const fmt = formatter(clock)
    return (iso: string) => fmt.format(new Date(iso))
  }, [clock])
}
