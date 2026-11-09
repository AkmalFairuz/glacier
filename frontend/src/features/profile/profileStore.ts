import { create } from 'zustand'

type Target = { userId: string; serverId: string | null }
export type FullProfileTab = 'activity' | 'servers'
type Card = Target & { anchor: { top: number; left: number; right: number; bottom: number } }

/** One card, one full profile and one invite picker at a time, openable from anywhere. */
export const useProfileView = create<{ card: Card | null; full: (Target & { tab: FullProfileTab }) | null; inviting: string | null }>(() => ({
  card: null,
  full: null,
  inviting: null,
}))

export function openProfileCard(userId: string, serverId: string | null, anchor: Element) {
  const { top, left, right, bottom } = anchor.getBoundingClientRect()
  useProfileView.setState({ card: { userId, serverId, anchor: { top, left, right, bottom } } })
}

export const closeProfileCard = () => useProfileView.setState({ card: null })

export function openFullProfile(userId: string, serverId: string | null, tab: FullProfileTab = 'activity') {
  useProfileView.setState({ card: null, full: { userId, serverId, tab } })
}

/** Pick one of your servers and DM this user an invite to it. */
export const openInviteToServer = (userId: string) => useProfileView.setState({ card: null, inviting: userId })
export const closeInviteToServer = () => useProfileView.setState({ inviting: null })

export const closeFullProfile = () => useProfileView.setState({ full: null })
