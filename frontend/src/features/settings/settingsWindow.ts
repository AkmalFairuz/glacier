import { create } from 'zustand'

export type SettingsPageId =
  | 'account'
  | 'profile'
  | 'security'
  | 'appearance'
  | 'accessibility'
  | 'voice'
  | 'camera'
  | 'screen'
  | 'sounds'
  | 'voice-advanced'
  | 'notifications'
  | 'keybinds'

export const useSettingsDialog = create<{ open: boolean; page: SettingsPageId }>(() => ({ open: false, page: 'account' }))

export const openSettings = (page: SettingsPageId = 'account') => useSettingsDialog.setState({ open: true, page })
export const closeSettings = () => useSettingsDialog.setState({ open: false })
export const showSettingsPage = (page: SettingsPageId) => useSettingsDialog.setState({ page })
