import { useEffect, useRef } from 'react'
import { Button } from '../../../ui/Button'
import { Field } from '../../../ui/Field'
import { Select } from '../../../ui/Select'
import { SettingsSection } from '../../../ui/SettingsSection'
import { Toggle } from '../../../ui/Toggle'
import { useCameraPreview } from '../hooks/useCameraPreview'
import { useMediaDevices } from '../hooks/useMediaDevices'
import { settings, useSettings, type Settings, type VideoQuality } from '../settingsStore'
import s from './voice.module.css'

export function CameraPage() {
  const st = useSettings()
  const devices = useMediaDevices()
  const preview = useCameraPreview()
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (video.current) video.current.srcObject = preview.stream
  }, [preview.stream])

  return (
    <>
      <SettingsSection title="Preview" description={preview.error ?? preview.actual}>
        <div className={s.preview}>
          {preview.stream ? (
            <video ref={video} className={st.mirrorVideo ? `${s.video} ${s.mirror}` : s.video} autoPlay playsInline muted />
          ) : (
            <p className={s.previewEmpty}>Camera is off</p>
          )}
        </div>
        <div>
          <Button variant={preview.on ? 'ghost' : 'primary'} onClick={preview.toggle}>
            {preview.on ? 'Stop preview' : 'Test video'}
          </Button>
        </div>
      </SettingsSection>
      <SettingsSection title="Camera">
        <div className={s.columns}>
          <Field label="Camera">
            <Select value={st.videoDeviceId} options={devices.cameras} onChange={(videoDeviceId) => settings.set({ videoDeviceId })} />
          </Field>
          <Field label="Quality">
            <Select<VideoQuality>
              value={st.videoQuality}
              onChange={(videoQuality) => settings.set({ videoQuality })}
              options={[
                { value: '360p', label: '360p' },
                { value: '720p', label: '720p (recommended)' },
                { value: '1080p', label: '1080p' },
              ]}
            />
          </Field>
          <Field label="Frame rate">
            <Select
              value={String(st.videoFps)}
              onChange={(v) => settings.set({ videoFps: Number(v) as Settings['videoFps'] })}
              options={[
                { value: '15', label: '15 fps' },
                { value: '30', label: '30 fps' },
                { value: '60', label: '60 fps' },
              ]}
            />
          </Field>
        </div>
        <Toggle label="Mirror my video" checked={st.mirrorVideo} onChange={(mirrorVideo) => settings.set({ mirrorVideo })} />
      </SettingsSection>
    </>
  )
}
