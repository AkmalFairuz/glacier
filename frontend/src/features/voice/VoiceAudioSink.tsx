import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { applyOutput } from '../settings/hooks/applyOutput'
import { useSettings } from '../settings/settingsStore'
import { useVoice } from './voiceStore'

/** Plays every remote participant's audio (voice and shared screen audio); mounted once so calls survive navigation. */
export function VoiceAudioSink() {
  const remote = useVoice((s) => s.remote)
  const deafened = useVoice((s) => s.deafened)
  return (
    <div hidden>
      {Object.entries(remote).flatMap(([userId, media]) =>
        media.streams.map((stream) => <RemoteAudio key={`${userId}:${stream.id}`} stream={stream} muted={deafened} />),
      )}
    </div>
  )
}

function RemoteAudio({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null)
  const output = useSettings(useShallow((s) => ({ deviceId: s.outputDeviceId, volume: s.outputVolume })))
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  useEffect(() => {
    if (ref.current) applyOutput(ref.current, output.deviceId, output.volume)
  }, [output])
  return <audio ref={ref} autoPlay muted={muted} />
}
