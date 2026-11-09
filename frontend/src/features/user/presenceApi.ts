import { useMutation } from '@tanstack/react-query'
import { client, unwrap } from '../../lib/api'
import type { UpdatePresence } from '../../lib/types'
import { myPresence, useMyPresence } from '../members/presenceStore'

export const presenceApi = {
  update: (body: UpdatePresence) => unwrap(client.PATCH('/api/users/@me/presence', { body })),
}

/** Changes the user's status or custom status, showing the change right away. */
export function useUpdatePresence() {
  return useMutation({
    mutationFn: presenceApi.update,
    onMutate: (body) => {
      const previous = useMyPresence.getState()
      myPresence.set({
        status: body.status ?? previous.status,
        custom_status: body.custom_status === undefined ? previous.custom_status : body.custom_status,
      })
      return previous
    },
    onError: (_error, _body, previous) => previous && myPresence.set(previous),
    onSuccess: (settings) => myPresence.set(settings),
  })
}
