import { create } from 'zustand'

/** The invite being offered in the app (via link or a chat message). */
export const useInviteOffer = create<{ code: string | null }>(() => ({ code: null }))
export const openInvite = (code: string) => useInviteOffer.setState({ code })
export const closeInvite = () => useInviteOffer.setState({ code: null })

/** Invite code from a same-origin `/invite/{code}` URL, or null. */
export function inviteCodeFromUrl(href: string): string | null {
  try {
    const url = new URL(href, location.origin)
    if (url.origin !== location.origin) return null
    return url.pathname.match(/^\/invite\/([A-Za-z0-9]+)\/?$/)?.[1] ?? null
  } catch {
    return null
  }
}
