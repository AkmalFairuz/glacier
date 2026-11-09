import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { errorMessage } from '../../lib/api'
import type { Channel, User } from '../../lib/types'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { dmsApi, openDm } from './api'
import { upsertDm } from './cache'
import { UserPicker } from './UserPicker'
import s from './NewDmModal.module.css'

const MAX_RECIPIENTS = 9

/** Starts a new conversation, or adds people to an existing group when `group` is given. */
type Props = { open: boolean; onClose: () => void; group?: Channel }

export function NewDmModal({ open, onClose, group }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<User[]>([])
  const existing = group?.recipients.map((u) => u.id) ?? []

  const start = useMutation({
    meta: { inlineError: true },
    mutationFn: async (): Promise<Channel> => {
      if (!group) return openDm(selected.map((u) => u.id))
      let channel = group
      for (const user of selected) channel = await dmsApi.addRecipient(group.id, user.id)
      return channel
    },
    onSuccess: (channel) => {
      upsertDm(qc, channel)
      setSelected([])
      onClose()
      navigate(`/channels/@me/${channel.id}`)
    },
  })

  const label = group ? 'Add people' : selected.length > 1 ? 'Start group' : 'Start conversation'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={group ? 'Add people' : 'New message'}
      description={group ? undefined : `Pick one person, or up to ${MAX_RECIPIENTS} for a group.`}
      footer={
        <Button variant="primary" disabled={!selected.length} loading={start.isPending} onClick={() => start.mutate()}>
          {label}
        </Button>
      }
    >
      <UserPicker selected={selected} onChange={setSelected} max={MAX_RECIPIENTS - existing.length + (group ? 1 : 0)} exclude={existing} />
      {start.error && <p className={s.error}>{errorMessage(start.error)}</p>}
    </Modal>
  )
}
