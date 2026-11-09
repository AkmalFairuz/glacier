import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { errorMessage } from '../../lib/api'
import type { Role } from '../../lib/types'
import { Button } from '../../ui/Button'
import { ColorSwatch } from '../../ui/ColorSwatch'
import { confirmDialog } from '../../ui/confirm'
import { Field } from '../../ui/Field'
import { Input } from '../../ui/Input'
import { Tabs } from '../../ui/Tabs'
import { rolesApi } from './api'
import { removeRole, upsertRole } from './cache'
import { PermissionToggleList } from './PermissionToggleList'
import { RoleMembers } from './RoleMembers'
import s from './RoleEditor.module.css'

type Tab = 'display' | 'permissions' | 'members'
type Props = { role: Role; onDeleted: () => void }

/** One role, split into Display, Permissions and Members tabs. */
export function RoleEditor({ role, onDeleted }: Props) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>(role.is_default ? 'permissions' : 'display')
  const [name, setName] = useState(role.name)
  const [color, setColor] = useState(role.color)
  const [permissions, setPermissions] = useState(role.permissions)

  const save = useMutation({
    meta: { inlineError: true },
    mutationFn: (body: Parameters<typeof rolesApi.update>[2]) => rolesApi.update(role.server_id, role.id, body),
    onSuccess: (updated) => upsertRole(qc, updated),
  })
  const remove = useMutation({
    mutationFn: () => rolesApi.remove(role.server_id, role.id),
    onSuccess: () => {
      removeRole(qc, role.server_id, role.id)
      onDeleted()
    },
  })
  const dirty = name !== role.name || color !== role.color || permissions !== role.permissions
  const tabs: { id: Tab; label: string }[] = role.is_default
    ? [{ id: 'permissions', label: 'Permissions' }]
    : [
        { id: 'display', label: 'Display' },
        { id: 'permissions', label: 'Permissions' },
        { id: 'members', label: 'Members' },
      ]

  const onDelete = async () => {
    const ok = await confirmDialog({
      title: `Delete ${role.name}`,
      message: 'Members lose this role and its permissions.',
      confirmLabel: 'Delete role',
      danger: true,
    })
    if (ok) remove.mutate()
  }

  return (
    <section className={s.editor} aria-label={`Edit ${role.is_default ? '@everyone' : role.name}`}>
      <header className={s.head}>
        <h3 className={s.title}>{role.is_default ? '@everyone' : role.name}</h3>
        {!role.is_default && (
          <Button variant="ghost" className={s.delete} loading={remove.isPending} onClick={() => void onDelete()}>
            Delete role
          </Button>
        )}
      </header>
      <Tabs label="Role sections" tabs={tabs} value={tab} onChange={setTab} />
      <div key={tab} className={s.panel}>
        {tab === 'display' && (
          <>
            <Field label="Role name">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
            </Field>
            <Field label="Color">
              <ColorSwatch label="Role color" value={color} onChange={setColor} />
            </Field>
          </>
        )}
        {tab === 'permissions' && <PermissionToggleList value={permissions} onChange={setPermissions} />}
        {tab === 'members' && <RoleMembers role={role} />}
      </div>
      {tab !== 'members' && dirty && (
        <footer className={s.footer} role="status">
          <span>You have unsaved changes</span>
          {save.error && <span className={s.error}>{errorMessage(save.error)}</span>}
          <Button
            variant="ghost"
            onClick={() => {
              setName(role.name)
              setColor(role.color)
              setPermissions(role.permissions)
            }}
          >
            Reset
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate({ name, color, permissions })}>
            Save changes
          </Button>
        </footer>
      )}
    </section>
  )
}
