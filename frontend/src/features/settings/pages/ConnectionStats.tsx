import { useEffect, useState } from 'react'
import { useRoomUsers } from '../../voice/useVoiceRoom'
import { peerStats, type PeerStats } from '../../voice/voiceSession'
import { useVoice } from '../../voice/voiceStore'
import s from './voice.module.css'

const STATE_LABEL: Record<RTCPeerConnectionState, string> = {
  new: 'Starting',
  connecting: 'Connecting',
  connected: 'Connected',
  disconnected: 'Interrupted',
  failed: 'Failed',
  closed: 'Closed',
}

export function ConnectionStats() {
  const session = useVoice((st) => st.session)
  const lookup = useRoomUsers(session?.serverId ?? null)
  const [stats, setStats] = useState<PeerStats[]>([])

  useEffect(() => {
    if (!session) return
    const load = () => void peerStats().then(setStats)
    load()
    const timer = window.setInterval(load, 2000)
    return () => window.clearInterval(timer)
  }, [session])

  if (!session) return <p className={s.hint}>You are not in a call.</p>
  if (!stats.length) return <p className={s.hint}>Nobody else is in your call yet.</p>

  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th scope="col">Participant</th>
          <th scope="col">Status</th>
          <th scope="col">Round trip</th>
          <th scope="col">Packets lost</th>
        </tr>
      </thead>
      <tbody>
        {stats.map((p) => (
          <tr key={p.userId}>
            <td>{lookup(p.userId)?.display_name ?? 'Unknown'}</td>
            <td>{STATE_LABEL[p.state]}</td>
            <td>{p.rttMs === null ? '—' : `${p.rttMs} ms`}</td>
            <td>{p.packetsLost}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
