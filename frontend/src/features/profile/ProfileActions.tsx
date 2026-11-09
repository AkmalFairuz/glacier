import { useMutation } from '@tanstack/react-query'
import { LuMessageSquare, LuPencil } from 'react-icons/lu'
import { useNavigate } from 'react-router'
import { queryClient } from '../../lib/queryClient'
import { Button } from '../../ui/Button'
import { openDm } from '../dms/api'
import { upsertDm } from '../dms/cache'
import { openSettings } from '../settings/settingsWindow'
import { closeFullProfile, closeProfileCard } from './profileStore'
import type { ProfileData } from './useProfileData'

/** Message (or Edit profile, for yourself). */
export function ProfileActions({ data }: { data: ProfileData }) {
  const navigate = useNavigate()
  const user = data.user
  const message = useMutation({
    mutationFn: () => openDm([user!.id]),
    onSuccess: (dm) => {
      upsertDm(queryClient, dm)
      closeProfileCard()
      closeFullProfile()
      navigate(`/channels/@me/${dm.id}`)
    },
  })
  if (!user) return null

  if (data.isMe) {
    return (
      <Button
        variant="primary"
        icon={<LuPencil />}
        onClick={() => {
          closeProfileCard()
          closeFullProfile()
          openSettings('profile')
        }}
      >
        Edit profile
      </Button>
    )
  }
  return (
    <Button variant="primary" icon={<LuMessageSquare />} loading={message.isPending} onClick={() => message.mutate()}>
      Message
    </Button>
  )
}
