import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'system' | 'light' | 'dark'
/** `system` follows the OS reduced-motion preference; `full` animates even when the OS asks to reduce. */
export type Motion = 'system' | 'reduce' | 'full'
export type Density = 'cozy' | 'compact'
export type Clock = 'auto' | '12h' | '24h'
export type InputProfile = 'isolation' | 'studio' | 'custom'
export type InputMode = 'voice' | 'ptt'
export type VideoQuality = '360p' | '720p' | '1080p'
export type ScreenResolution = 'source' | '720p' | '1080p'
export type ScreenHint = 'motion' | 'detail'
export type NotifyLevel = 'all' | 'dms' | 'none'
export type SoundId = 'join' | 'leave' | 'mute' | 'message' | 'call'
export type KeybindAction = 'toggleMute' | 'toggleDeafen' | 'toggleVideo'

export type Settings = {
  theme: Theme
  density: Density
  chatFontSize: number
  clock: Clock
  motion: Motion
  underlineLinks: boolean

  inputDeviceId: string
  outputDeviceId: string
  /** Percent, 0–200. */
  inputVolume: number
  /** Percent, 0–100. */
  outputVolume: number
  inputProfile: InputProfile
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
  inputMode: InputMode
  autoSensitivity: boolean
  /** Voice activity threshold in dBFS, -100–0. */
  sensitivity: number
  pttKey: string | null
  pttReleaseMs: number

  videoDeviceId: string
  videoQuality: VideoQuality
  videoFps: 15 | 30 | 60
  mirrorVideo: boolean
  showNonVideo: boolean

  screenResolution: ScreenResolution
  screenFps: 5 | 15 | 30 | 60
  screenHint: ScreenHint
  screenAudio: boolean

  soundVolume: number
  sounds: Record<SoundId, boolean>

  notifications: boolean
  notifyLevel: NotifyLevel

  keybinds: Record<KeybindAction, string | null>
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  density: 'cozy',
  chatFontSize: 15,
  clock: 'auto',
  motion: 'system',
  underlineLinks: false,

  inputDeviceId: 'default',
  outputDeviceId: 'default',
  inputVolume: 100,
  outputVolume: 100,
  inputProfile: 'isolation',
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  inputMode: 'voice',
  autoSensitivity: true,
  sensitivity: -55,
  pttKey: null,
  pttReleaseMs: 200,

  videoDeviceId: 'default',
  videoQuality: '720p',
  videoFps: 30,
  mirrorVideo: true,
  showNonVideo: true,

  screenResolution: '1080p',
  screenFps: 30,
  screenHint: 'detail',
  screenAudio: false,

  soundVolume: 60,
  sounds: { join: true, leave: true, mute: true, message: true, call: true },

  notifications: false,
  notifyLevel: 'dms',

  keybinds: { toggleMute: null, toggleDeafen: null, toggleVideo: null },
}

const VOICE_KEYS = [
  'inputDeviceId',
  'outputDeviceId',
  'inputVolume',
  'outputVolume',
  'inputProfile',
  'echoCancellation',
  'noiseSuppression',
  'autoGainControl',
  'inputMode',
  'autoSensitivity',
  'sensitivity',
  'pttKey',
  'pttReleaseMs',
  'videoDeviceId',
  'videoQuality',
  'videoFps',
  'mirrorVideo',
  'showNonVideo',
  'screenResolution',
  'screenFps',
  'screenHint',
  'screenAudio',
] as const satisfies readonly (keyof Settings)[]

/** Device-local preferences, persisted in localStorage. */
export const useSettings = create<Settings>()(
  persist(() => DEFAULT_SETTINGS, {
    name: 'glacier.settings',
    version: 2,
    // v1 stored `reduceMotion: boolean`.
    migrate: (old, version) => {
      const s = old as Partial<Settings> & { reduceMotion?: boolean }
      if (version < 2) s.motion = s.reduceMotion ? 'reduce' : 'system'
      delete s.reduceMotion
      return s as Settings
    },
    merge: (persisted, current) => ({ ...current, ...(persisted as Partial<Settings>) }),
  }),
)

export const settings = {
  get: () => useSettings.getState(),
  set: (patch: Partial<Settings>) => useSettings.setState(patch),
  setSound: (id: SoundId, on: boolean) => useSettings.setState((s) => ({ sounds: { ...s.sounds, [id]: on } })),
  setKeybind: (action: KeybindAction, combo: string | null) => useSettings.setState((s) => ({ keybinds: { ...s.keybinds, [action]: combo } })),
  resetVoice: () => useSettings.setState(Object.fromEntries(VOICE_KEYS.map((k) => [k, DEFAULT_SETTINGS[k]]))),
}

/** Effective getUserMedia audio processing for the chosen input profile. */
export function audioProcessing(s: Pick<Settings, 'inputProfile' | 'echoCancellation' | 'noiseSuppression' | 'autoGainControl'>) {
  if (s.inputProfile === 'isolation') return { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  if (s.inputProfile === 'studio') return { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
  return { echoCancellation: s.echoCancellation, noiseSuppression: s.noiseSuppression, autoGainControl: s.autoGainControl }
}
