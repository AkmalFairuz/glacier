import { Navigate, useParams } from 'react-router'
import { EmptyState } from '../../ui/EmptyState'
import { Spinner } from '../../ui/Spinner'
import { useChannels } from '../channels/hooks'

/** Sends /channels/:serverId to the first text channel the user can see. */
export function ServerIndexRedirect() {
  const { serverId } = useParams()
  const { data: channels, isLoading } = useChannels(serverId)
  if (isLoading) return <Spinner />
  const first = [...(channels ?? [])].sort((a, b) => a.position - b.position).find((c) => c.type === 'text')
  if (!first) return <EmptyState title="No text channels" body="Nothing here you can read yet. Ask an admin for access." />
  return <Navigate to={`/channels/${serverId}/${first.id}`} replace />
}
