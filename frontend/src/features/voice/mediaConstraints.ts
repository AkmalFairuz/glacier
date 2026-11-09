import type { Settings, VideoQuality } from '../settings/settingsStore'

const SIZES: Record<VideoQuality, [number, number]> = { '360p': [640, 360], '720p': [1280, 720], '1080p': [1920, 1080] }

export function cameraConstraints(s: Settings): MediaTrackConstraints {
  const [width, height] = SIZES[s.videoQuality]
  return {
    width: { ideal: width },
    height: { ideal: height },
    frameRate: { ideal: s.videoFps },
    ...(s.videoDeviceId !== 'default' && { deviceId: { ideal: s.videoDeviceId } }),
  }
}

export function screenOptions(s: Settings): DisplayMediaStreamOptions {
  const size = s.screenResolution === 'source' ? null : SIZES[s.screenResolution]
  return {
    video: { frameRate: { ideal: s.screenFps }, ...(size && { width: { max: size[0] }, height: { max: size[1] } }) },
    audio: s.screenAudio,
  }
}
