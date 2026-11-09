import { create } from 'zustand'

type LayoutState = { navOpen: boolean; membersOpen: boolean }

export const useLayout = create<LayoutState>(() => ({ navOpen: false, membersOpen: window.innerWidth > 1100 }))

export const layout = {
  toggleNav: () => useLayout.setState((s) => ({ navOpen: !s.navOpen })),
  closeNav: () => useLayout.setState({ navOpen: false }),
  toggleMembers: () => useLayout.setState((s) => ({ membersOpen: !s.membersOpen })),
}
