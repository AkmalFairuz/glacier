import type { SignalData } from '../../lib/gateway'

export type LocalMedia = { main: MediaStream | null; screen: MediaStream | null }

type Callbacks = {
  signal: (data: SignalData) => void
  onStream: (stream: MediaStream) => void
  onChange: () => void
}

/** One RTCPeerConnection to one remote user, using the "perfect negotiation" pattern. */
export class Peer {
  readonly pc: RTCPeerConnection
  private makingOffer = false
  private ignoreOffer = false
  private settingRemoteAnswer = false
  private attached = false

  constructor(
    private readonly polite: boolean,
    iceServers: RTCIceServer[],
    private readonly local: () => LocalMedia,
    private readonly cb: Callbacks,
  ) {
    this.pc = new RTCPeerConnection({ iceServers })
    this.pc.onnegotiationneeded = () => void this.offer()
    this.pc.onicecandidate = ({ candidate }) => candidate && this.cb.signal({ candidate: candidate.toJSON() })
    this.pc.onconnectionstatechange = () => this.pc.connectionState === 'failed' && this.pc.restartIce()
    this.pc.ontrack = ({ track, streams }) => {
      const stream = streams[0] ?? new MediaStream([track])
      stream.onremovetrack = this.cb.onChange
      track.onunmute = this.cb.onChange
      track.onended = this.cb.onChange
      this.cb.onStream(stream)
    }
  }

  /** Sends our tracks. The joiner calls this immediately; the answerer on the first offer. */
  attach() {
    this.attached = true
    this.syncTracks()
  }

  /** Adds senders for new local tracks and removes senders whose track is gone. */
  syncTracks() {
    if (!this.attached) return
    const { main, screen } = this.local()
    const wanted = [
      ...(main?.getTracks().map((track) => ({ track, stream: main })) ?? []),
      ...(screen?.getTracks().map((track) => ({ track, stream: screen })) ?? []),
    ]
    const senders = this.pc.getSenders()
    for (const { track, stream } of wanted) {
      if (!senders.some((s) => s.track === track)) this.pc.addTrack(track, stream)
    }
    for (const sender of senders) {
      if (sender.track && !wanted.some((w) => w.track === sender.track)) this.pc.removeTrack(sender)
    }
    // Listen-only (no microphone): still negotiate so we receive the others.
    if (wanted.length === 0 && this.pc.getTransceivers().length === 0) {
      this.pc.addTransceiver('audio', { direction: 'recvonly' })
    }
  }

  async handle(data: SignalData) {
    if ('description' in data) {
      const description = data.description
      const readyForOffer = !this.makingOffer && (this.pc.signalingState === 'stable' || this.settingRemoteAnswer)
      const collision = description.type === 'offer' && !readyForOffer
      this.ignoreOffer = !this.polite && collision
      if (this.ignoreOffer) return
      this.settingRemoteAnswer = description.type === 'answer'
      await this.pc.setRemoteDescription(description)
      this.settingRemoteAnswer = false
      if (description.type === 'offer') {
        if (!this.attached) this.attach()
        await this.pc.setLocalDescription()
        if (this.pc.localDescription) this.cb.signal({ description: this.pc.localDescription.toJSON() })
      }
    } else if ('candidate' in data) {
      try {
        await this.pc.addIceCandidate(data.candidate)
      } catch (err) {
        if (!this.ignoreOffer) console.warn('ICE candidate rejected', err)
      }
    }
  }

  close() {
    this.pc.onnegotiationneeded = null
    this.pc.onicecandidate = null
    this.pc.ontrack = null
    this.pc.close()
  }

  private async offer() {
    try {
      this.makingOffer = true
      await this.pc.setLocalDescription()
      if (this.pc.localDescription) this.cb.signal({ description: this.pc.localDescription.toJSON() })
    } catch (err) {
      console.warn('Negotiation failed', err)
    } finally {
      this.makingOffer = false
    }
  }
}
