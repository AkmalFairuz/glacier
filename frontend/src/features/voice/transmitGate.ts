import { settings } from '../settings/settingsStore'
import type { Microphone } from './microphone'
import { setSpeaking } from './speaking'
import { useVoice } from './voiceStore'

const TICK_MS = 40
const HANGOVER_MS = 250

let mic: Microphone | null = null
let userId = ''
let timer: number | undefined
let pttHeld = false
let lastOpen = 0
let lastLoud = 0
let floor = -70

/** Threshold used for voice activity: adaptive noise floor or the manual slider. */
export function effectiveThreshold(): number {
  const s = settings.get()
  return s.autoSensitivity ? Math.min(-30, floor + 14) : s.sensitivity
}

/** Tracks a slowly rising noise floor so automatic sensitivity adapts to the room. */
function trackFloor(db: number) {
  floor = db < floor ? db : Math.min(-25, floor + 0.12)
}

function tick() {
  if (!mic) return
  const s = settings.get()
  const db = mic.level()
  const now = performance.now()
  trackFloor(db)
  const loud = db > effectiveThreshold()
  if (loud) lastLoud = now

  let wantOpen: boolean
  if (s.inputMode === 'ptt') {
    if (pttHeld) lastOpen = now
    wantOpen = pttHeld || now - lastOpen < s.pttReleaseMs
  } else {
    wantOpen = now - lastLoud < HANGOVER_MS
  }
  const open = wantOpen && !useVoice.getState().muted
  if (mic.track.enabled !== open) mic.track.enabled = open
  setSpeaking(userId, open && now - lastLoud < HANGOVER_MS)
}

/** Starts deciding when the microphone transmits (mute, voice activity, push-to-talk). */
export function startGate(m: Microphone, me: string) {
  stopGate()
  mic = m
  userId = me
  mic.track.enabled = false
  timer = window.setInterval(tick, TICK_MS)
}

export function stopGate() {
  window.clearInterval(timer)
  timer = undefined
  if (userId) setSpeaking(userId, false)
  mic = null
}

export function setPushToTalk(held: boolean) {
  pttHeld = held
  if (mic) tick()
}

/** Live input level (dBFS) of the call microphone, or null when not in a call. */
export const callInputLevel = () => mic?.level() ?? null
