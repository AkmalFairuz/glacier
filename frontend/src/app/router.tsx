import { createBrowserRouter, Navigate } from 'react-router'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { ChannelPage } from '../features/channels/ChannelPage'
import { DmHome } from '../features/dms/DmHome'
import { DmLayout } from '../features/dms/DmLayout'
import { DmPage } from '../features/dms/DmPage'
import { InviteAcceptPage } from '../features/invites/InviteAcceptPage'
import { DiscoverPage } from '../features/servers/DiscoverPage'
import { ServerIndexRedirect } from '../features/servers/ServerIndexRedirect'
import { ServerLayout } from '../features/servers/ServerLayout'
import { AppShell } from './AppShell'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/invite/:code', element: <InviteAcceptPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/channels/@me" replace /> },
      { path: 'discover', element: <DiscoverPage /> },
      {
        path: 'channels/@me',
        element: <DmLayout />,
        children: [
          { index: true, element: <DmHome /> },
          { path: ':channelId', element: <DmPage /> },
        ],
      },
      {
        path: 'channels/:serverId',
        element: <ServerLayout />,
        children: [
          { index: true, element: <ServerIndexRedirect /> },
          { path: ':channelId', element: <ChannelPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
