import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { dbToMeter, Microphone } from '../../voice/microphone'
import { callInputLevel, effectiveThreshold } from '../../voice/transmitGate'
import { useSettings } from '../settingsStore'
import { applyOutput } from './applyOutput'

const SILENT = -100

type Meter = { testing: boolean; level: number; threshold: number; error: string | null }

/** Shared by every meter on the Voice page. */
export const useMicMeter = create<Meter>(() => ({ testing: false, level: 0, threshold: 0, error: null }))
export const toggleMicTest = () => useMicMeter.setState((m) => ({ testing: !m.testing, error: null }))

/**
 * Drives the meter while the Voice page is open. When testing, opens the
 * microphone with the current settings and plays it back through the chosen
 * speaker; during a call the meter shows the call microphone instead.
 */
export function useMicTest() {
  const testing = useMicMeter((m) => m.testing)
  const mic = useSettings(
    useShallow((s) => ({
      inputDeviceId: s.inputDeviceId,
      inputVolume: s.inputVolume,
      inputProfile: s.inputProfile,
      echoCancellation: s.echoCancellation,
      noiseSuppression: s.noiseSuppression,
      autoGainControl: s.autoGainControl,
    })),
  )
  const output = useSettings(useShallow((s) => ({ outputDeviceId: s.outputDeviceId, outputVolume: s.outputVolume })))
  const ref = useRef<{ mic: Microphone; audio: HTMLAudioElement } | null>(null)

  useEffect(() => {
    if (!testing) return
    let cancelled = false
    Microphone.open(mic)
      .then((m) => {
        if (cancelled) return m.close()
        const audio = new Audio()
        audio.srcObject = new MediaStream([m.track])
        applyOutput(audio, useSettings.getState().outputDeviceId, useSettings.getState().outputVolume)
        void audio.play()
        ref.current = { mic: m, audio }
      })
      .catch(() => useMicMeter.setState({ testing: false, error: 'Could not open the microphone. Check browser permissions.' }))
    return () => {
      cancelled = true
      ref.current?.audio.pause()
      ref.current?.mic.close()
      ref.current = null
    }
  }, [testing, mic])

  useEffect(() => {
    if (ref.current) applyOutput(ref.current.audio, output.outputDeviceId, output.outputVolume)
  }, [output])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const db = ref.current?.mic.level() ?? callInputLevel() ?? SILENT
      useMicMeter.setState({ level: dbToMeter(db), threshold: dbToMeter(effectiveThreshold()) })
    }, 50)
    return () => {
      window.clearInterval(timer)
      useMicMeter.setState({ testing: false, level: 0 })
    }
  }, [])
}
