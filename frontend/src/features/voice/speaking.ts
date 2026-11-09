import { create } from 'zustand'

/** user id -> currently speaking. Updated only on change. */
export const useSpeaking = create<Record<string, boolean>>(() => ({}))

export function setSpeaking(userId: string, on: boolean) {
  if (!!useSpeaking.getState()[userId] !== on) useSpeaking.setState({ [userId]: on })
}

const THRESHOLD_DB = -50
const HANGOVER_MS = 300

type Monitor = { source: MediaStreamAudioSourceNode; analyser: AnalyserNode; lastLoud: number }

let ctx: AudioContext | null = null
let timer: number | undefined
const monitors = new Map<string, Monitor>()
const samples = new Float32Array(512)

function tick() {
  const now = performance.now()
  for (const [userId, m] of monitors) {
    m.analyser.getFloatTimeDomainData(samples)
    let sum = 0
    for (const v of samples) sum += v * v
    const db = 20 * Math.log10(Math.sqrt(sum / samples.length) || 1e-6)
    if (db > THRESHOLD_DB) m.lastLoud = now
    setSpeaking(userId, now - m.lastLoud < HANGOVER_MS)
  }
}

/** Starts measuring a remote participant's audio for the speaking indicator. */
export function watchRemote(userId: string, stream: MediaStream) {
  const track = stream.getAudioTracks()[0]
  if (!track || monitors.has(userId)) return
  ctx ??= new AudioContext()
  void ctx.resume()
  const source = ctx.createMediaStreamSource(new MediaStream([track]))
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  source.connect(analyser)
  monitors.set(userId, { source, analyser, lastLoud: 0 })
  timer ??= window.setInterval(tick, 100)
}

export function unwatchRemote(userId: string) {
  monitors.get(userId)?.source.disconnect()
  monitors.delete(userId)
  setSpeaking(userId, false)
  if (!monitors.size) {
    window.clearInterval(timer)
    timer = undefined
  }
}

export function clearSpeaking() {
  for (const id of [...monitors.keys()]) unwatchRemote(id)
  useSpeaking.setState({}, true)
}
