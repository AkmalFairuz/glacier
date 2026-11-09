import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LuTrash2 } from 'react-icons/lu'
import { useNavigate } from 'react-router'
import type { Server } from '../../lib/types'
import { Button } from '../../ui/Button'
import { confirmDialog } from '../../ui/confirm'
import { SettingsSection } from '../../ui/SettingsSection'
import { serversApi } from './api'
import { removeServer } from './cache'

/** Owner-only, irreversible actions. */
export function DangerZone({ server, onDone }: { server: Server; onDone: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const remove = useMutation({
    mutationFn: () => serversApi.remove(server.id),
    onSuccess: () => {
      onDone()
      removeServer(qc, server.id)
      navigate('/channels/@me')
    },
  })

  const onDelete = async () => {
    const ok = await confirmDialog({
      title: `Delete ${server.name}`,
      message: 'All channels, messages and roles are permanently deleted. This cannot be undone.',
      confirmLabel: 'Delete server',
      danger: true,
    })
    if (ok) remove.mutate()
  }

  return (
    <SettingsSection title="Delete server" description="Permanently removes the server for everyone.">
      <div>
        <Button variant="danger" icon={<LuTrash2 />} loading={remove.isPending} onClick={() => void onDelete()}>
          Delete server
        </Button>
      </div>
    </SettingsSection>
  )
}
