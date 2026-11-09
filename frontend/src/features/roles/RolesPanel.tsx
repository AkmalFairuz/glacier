import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { errorMessage } from '../../lib/api'
import { keys } from '../../lib/keys'
import type { Role } from '../../lib/types'
import { Spinner } from '../../ui/Spinner'
import { rolesApi } from './api'
import { upsertRole } from './cache'
import { useRoles } from './hooks'
import { RoleEditor } from './RoleEditor'
import { RoleList } from './RoleList'
import s from './RolesPanel.module.css'

/** New order → positions: top of the list gets the highest position. */
function reorder(roles: Role[], id: string, index: number): Role[] {
  const ordered = roles.filter((r) => !r.is_default).sort((a, b) => b.position - a.position)
  const moving = ordered.find((r) => r.id === id)
  if (!moving) return roles
  const rest = ordered.filter((r) => r.id !== id)
  rest.splice(index, 0, moving)
  const positions = new Map(rest.map((r, i) => [r.id, rest.length - i]))
  return roles.map((r) => (positions.has(r.id) ? { ...r, position: positions.get(r.id)! } : r))
}

export function RolesPanel({ serverId }: { serverId: string }) {
  const qc = useQueryClient()
  const { data: roles, isLoading } = useRoles(serverId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: () => rolesApi.create(serverId, { name: 'New role' }),
    onSuccess: (role) => {
      upsertRole(qc, role)
      setSelectedId(role.id)
    },
  })
  const move = useMutation({
    mutationFn: ({ id, position }: { id: string; position: number }) => rolesApi.update(serverId, id, { position }),
    onError: () => void qc.invalidateQueries({ queryKey: keys.roles(serverId) }),
  })

  if (isLoading || !roles) return <Spinner />
  const selected = roles.find((r) => r.id === selectedId) ?? roles[0]
  const count = roles.filter((r) => !r.is_default).length

  const onMove = (id: string, index: number) => {
    qc.setQueryData<Role[]>(keys.roles(serverId), (list) => list && reorder(list, id, index))
    move.mutate({ id, position: count - index })
  }

  return (
    <div className={s.panel}>
      <RoleList
        roles={roles}
        selectedId={selected?.id ?? null}
        onSelect={setSelectedId}
        onCreate={() => create.mutate()}
        creating={create.isPending}
        onMove={onMove}
      />
      <div className={s.editor}>
        {move.error && (
          <p className={s.error} role="alert">
            Could not move the role: {errorMessage(move.error)}
          </p>
        )}
        {selected && <RoleEditor key={selected.id} role={selected} onDeleted={() => setSelectedId(null)} />}
      </div>
    </div>
  )
}
