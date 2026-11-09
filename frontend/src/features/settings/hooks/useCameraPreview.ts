import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { cameraConstraints } from '../../voice/mediaConstraints'
import { useSettings } from '../settingsStore'

/** Camera preview for Settings > Camera, following the chosen device and quality. */
export function useCameraPreview() {
  const constraints = useSettings(useShallow((s) => ({ videoDeviceId: s.videoDeviceId, videoQuality: s.videoQuality, videoFps: s.videoFps })))
  const [on, setOn] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!on) return
    let current: MediaStream | null = null
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: cameraConstraints({ ...useSettings.getState(), ...constraints }) })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        current = s
        setStream(s)
        setError(null)
      })
      .catch(() => {
        setError('Could not open the camera. Check browser permissions.')
        setOn(false)
      })
    return () => {
      cancelled = true
      current?.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
  }, [on, constraints])

  const settings = stream?.getVideoTracks()[0]?.getSettings()
  const actual = settings?.width ? `${settings.width}×${settings.height} at ${Math.round(settings.frameRate ?? 0)} fps` : null
  return { on, toggle: () => setOn((v) => !v), stream, error, actual }
}
