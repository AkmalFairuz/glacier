import { useEffect } from 'react'
import { Navigate, Outlet, useParams } from 'react-router'
import { SidebarFrame } from '../../app/SidebarFrame'
import { Spinner } from '../../ui/Spinner'
import { ChannelSidebar } from '../channels/ChannelSidebar'
import { voiceApi } from '../voice/api'
import { voiceStates } from '../voice/voiceStore'
import { useServers } from './hooks'

export function ServerLayout() {
  const { serverId } = useParams()
  const { data: servers, isLoading } = useServers()
  const server = servers?.find((s) => s.id === serverId)

  useEffect(() => {
    if (!serverId) return
    voiceApi
      .serverStates(serverId)
      .then((list) => voiceStates.replaceServer(serverId, list))
      .catch(() => undefined)
  }, [serverId])

  if (isLoading) return <Spinner />
  if (!server) return <Navigate to="/channels/@me" replace />

  return (
    <>
      <SidebarFrame>
        <ChannelSidebar server={server} />
      </SidebarFrame>
      <Outlet />
    </>
  )
}
