import type { ReactNode } from 'react'
import { LuAccessibility, LuBell, LuIdCard, LuKeyboard, LuLock, LuMic, LuPalette, LuUserRound } from 'react-icons/lu'
import type { User } from '../../lib/types'
import type { NavGroup } from '../../ui/SettingsNav'
import { AccessibilityPage } from './pages/AccessibilityPage'
import { AccountPage } from './pages/AccountPage'
import { AppearancePage } from './pages/AppearancePage'
import { CameraPage } from './pages/CameraPage'
import { KeybindsPage } from './pages/KeybindsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ProfilePage } from './pages/ProfilePage'
import { ScreenSharePage } from './pages/ScreenSharePage'
import { SecurityPage } from './pages/SecurityPage'
import { SoundsPage } from './pages/SoundsPage'
import { VoiceAdvancedPage } from './pages/VoiceAdvancedPage'
import { VoicePage } from './pages/VoicePage'
import type { SettingsPageId } from './settingsWindow'

export const SETTINGS_GROUPS: NavGroup[] = [
  {
    label: 'User settings',
    items: [
      { id: 'account', label: 'My Account', icon: <LuUserRound />, keywords: 'username member since' },
      { id: 'profile', label: 'Profile', icon: <LuIdCard />, keywords: 'avatar display name about bio banner color' },
      { id: 'security', label: 'Security', icon: <LuLock />, keywords: 'password sessions sign out devices' },
    ],
  },
  {
    label: 'App settings',
    items: [
      {
        id: 'appearance',
        label: 'Appearance',
        icon: <LuPalette />,
        keywords: 'theme color dark light midnight aurora ember sandstone lichen heather compact cozy font size time clock',
      },
      { id: 'accessibility', label: 'Accessibility', icon: <LuAccessibility />, keywords: 'motion animation underline links' },
      {
        id: 'voice-video',
        label: 'Voice & Video',
        icon: <LuMic />,
        children: [
          { id: 'voice', label: 'Voice', keywords: 'microphone speaker volume mic test input profile noise echo push to talk sensitivity' },
          { id: 'camera', label: 'Camera', keywords: 'video webcam preview quality mirror' },
          { id: 'screen', label: 'Screen share', keywords: 'stream resolution frame rate audio' },
          { id: 'sounds', label: 'Sounds', keywords: 'effects join leave mute ring' },
          { id: 'voice-advanced', label: 'Advanced', keywords: 'connection stats reset layout' },
        ],
      },
      { id: 'notifications', label: 'Notifications', icon: <LuBell />, keywords: 'desktop alerts messages dm' },
      { id: 'keybinds', label: 'Keybinds', icon: <LuKeyboard />, keywords: 'shortcuts hotkeys keyboard mute deafen push to talk' },
    ],
  },
]

/** The window's top bar names the current page. */
const TITLES: Record<SettingsPageId, string> = {
  account: 'My Account',
  profile: 'Profile',
  security: 'Security',
  appearance: 'Appearance',
  accessibility: 'Accessibility',
  voice: 'Voice',
  camera: 'Camera',
  screen: 'Screen share',
  sounds: 'Sounds',
  'voice-advanced': 'Advanced',
  notifications: 'Notifications',
  keybinds: 'Keybinds',
}

export const pageTitle = (page: SettingsPageId) => TITLES[page]

export function renderPage(page: SettingsPageId, user: User): ReactNode {
  switch (page) {
    case 'account':
      return <AccountPage user={user} />
    case 'profile':
      return <ProfilePage user={user} />
    case 'security':
      return <SecurityPage />
    case 'appearance':
      return <AppearancePage />
    case 'accessibility':
      return <AccessibilityPage />
    case 'voice':
      return <VoicePage />
    case 'camera':
      return <CameraPage />
    case 'screen':
      return <ScreenSharePage />
    case 'sounds':
      return <SoundsPage />
    case 'voice-advanced':
      return <VoiceAdvancedPage />
    case 'notifications':
      return <NotificationsPage />
    case 'keybinds':
      return <KeybindsPage />
  }
}
