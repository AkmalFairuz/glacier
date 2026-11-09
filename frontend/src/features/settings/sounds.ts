import { settings, type SoundId } from './settingsStore'

type Note = { freq: number; at: number; dur: number }

/** Short synthesized cues; no audio files needed. */
const CUES: Record<SoundId | 'unmute', Note[]> = {
  join: [
    { freq: 523, at: 0, dur: 0.09 },
    { freq: 784, at: 0.08, dur: 0.14 },
  ],
  leave: [
    { freq: 784, at: 0, dur: 0.09 },
    { freq: 523, at: 0.08, dur: 0.14 },
  ],
  mute: [{ freq: 392, at: 0, dur: 0.07 }],
  unmute: [{ freq: 587, at: 0, dur: 0.07 }],
  message: [
    { freq: 880, at: 0, dur: 0.06 },
    { freq: 1175, at: 0.06, dur: 0.09 },
  ],
  call: [
    { freq: 659, at: 0, dur: 0.18 },
    { freq: 523, at: 0.22, dur: 0.18 },
    { freq: 659, at: 0.44, dur: 0.18 },
  ],
}

let ctx: AudioContext | null = null

/** Plays a cue if it is enabled in Settings > Sounds. `force` ignores the toggle (previews). */
export function playSound(id: SoundId | 'unmute', force = false) {
  const s = settings.get()
  const toggle: SoundId = id === 'unmute' ? 'mute' : id
  if ((!force && !s.sounds[toggle]) || s.soundVolume === 0) return
  ctx ??= new AudioContext()
  void ctx.resume()
  const volume = (s.soundVolume / 100) * 0.25
  const start = ctx.currentTime + 0.01
  for (const note of CUES[id]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = note.freq
    gain.gain.setValueAtTime(0, start + note.at)
    gain.gain.linearRampToValueAtTime(volume, start + note.at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.dur)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start + note.at)
    osc.stop(start + note.at + note.dur + 0.02)
  }
}
