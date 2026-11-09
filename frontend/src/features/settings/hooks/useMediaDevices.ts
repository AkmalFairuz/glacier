import { useCallback, useEffect, useState } from 'react'
import type { Option } from '../../../ui/Select'

type Devices = { inputs: Option<string>[]; outputs: Option<string>[]; cameras: Option<string>[]; labelled: boolean }

const EMPTY: Devices = { inputs: [], outputs: [], cameras: [], labelled: false }

function toOptions(list: MediaDeviceInfo[], kind: MediaDeviceKind, fallback: string): Option<string>[] {
  const devices = list.filter((d) => d.kind === kind && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
  return [{ value: 'default', label: 'System default' }, ...devices.map((d, i) => ({ value: d.deviceId, label: d.label || `${fallback} ${i + 1}` }))]
}

const toDevices = (list: MediaDeviceInfo[]): Devices => ({
  inputs: toOptions(list, 'audioinput', 'Microphone'),
  outputs: toOptions(list, 'audiooutput', 'Speaker'),
  cameras: toOptions(list, 'videoinput', 'Camera'),
  labelled: list.some((d) => d.label),
})

/** Lists audio/video devices and refreshes when hardware is plugged in or removed. */
export function useMediaDevices() {
  const [devices, setDevices] = useState<Devices>(EMPTY)

  const refresh = useCallback(() => navigator.mediaDevices.enumerateDevices().then((list) => setDevices(toDevices(list))), [])

  /** Device names are hidden until the page has media permission. */
  const requestAccess = useCallback(
    async (kind: 'audio' | 'video') => {
      const stream = await navigator.mediaDevices.getUserMedia({ [kind]: true })
      stream.getTracks().forEach((t) => t.stop())
      await refresh()
    },
    [refresh],
  )

  useEffect(() => {
    const update = () => void navigator.mediaDevices.enumerateDevices().then((list) => setDevices(toDevices(list)))
    update()
    navigator.mediaDevices.addEventListener('devicechange', update)
    return () => navigator.mediaDevices.removeEventListener('devicechange', update)
  }, [])

  return { ...devices, requestAccess }
}

export const canPickOutput = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype
