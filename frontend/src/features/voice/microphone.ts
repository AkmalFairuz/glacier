import { audioProcessing, type Settings } from '../settings/settingsStore'

export type MicOptions = Pick<Settings, 'inputDeviceId' | 'inputVolume' | 'inputProfile' | 'echoCancellation' | 'noiseSuppression' | 'autoGainControl'>

const SILENCE_DB = -100

export function audioConstraints(o: MicOptions): MediaTrackConstraints {
  return {
    ...audioProcessing(o),
    ...(o.inputDeviceId !== 'default' && { deviceId: { ideal: o.inputDeviceId } }),
  }
}

/**
 * A microphone routed through Web Audio: device → gain → output track.
 * The output track stays the same object when the device, processing or
 * volume change, so live calls never need to renegotiate.
 */
export class Microphone {
  readonly track: MediaStreamTrack
  private readonly ctx = new AudioContext()
  private readonly gain = this.ctx.createGain()
  private readonly analyser = this.ctx.createAnalyser()
  private readonly samples: Float32Array<ArrayBuffer>
  private source: MediaStreamAudioSourceNode | null = null
  private raw: MediaStream | null = null

  private constructor() {
    const dest = this.ctx.createMediaStreamDestination()
    this.analyser.fftSize = 1024
    this.samples = new Float32Array(this.analyser.fftSize)
    this.gain.connect(dest)
    this.gain.connect(this.analyser)
    this.track = dest.stream.getAudioTracks()[0]
  }

  static async open(options: MicOptions): Promise<Microphone> {
    const mic = new Microphone()
    try {
      await mic.configure(options)
      return mic
    } catch (err) {
      mic.close()
      throw err
    }
  }

  /** Re-acquires the device when needed and applies volume. */
  async configure(o: MicOptions) {
    const raw = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints(o) })
    this.source?.disconnect()
    this.raw?.getTracks().forEach((t) => t.stop())
    this.raw = raw
    this.source = this.ctx.createMediaStreamSource(raw)
    this.source.connect(this.gain)
    this.setVolume(o.inputVolume)
    await this.ctx.resume()
  }

  setVolume(percent: number) {
    this.gain.gain.setTargetAtTime(percent / 100, this.ctx.currentTime, 0.02)
  }

  /** Current loudness of what would be sent, in dBFS. */
  level(): number {
    this.analyser.getFloatTimeDomainData(this.samples)
    let sum = 0
    for (const v of this.samples) sum += v * v
    const rms = Math.sqrt(sum / this.samples.length)
    return rms > 0 ? Math.max(SILENCE_DB, 20 * Math.log10(rms)) : SILENCE_DB
  }

  /** Label of the physical device in use, when the browser exposes it. */
  deviceLabel(): string {
    return this.raw?.getAudioTracks()[0]?.label ?? ''
  }

  close() {
    this.source?.disconnect()
    this.raw?.getTracks().forEach((t) => t.stop())
    this.track.stop()
    void this.ctx.close()
  }
}

/** Maps dBFS (-100…0) to a 0…1 meter position. */
export const dbToMeter = (db: number) => Math.min(1, Math.max(0, (db + 100) / 100))
