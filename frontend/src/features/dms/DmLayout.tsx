import { Outlet } from 'react-router'
import { SidebarFrame } from '../../app/SidebarFrame'
import { DmList } from './DmList'

export function DmLayout() {
  return (
    <>
      <SidebarFrame>
        <DmList />
      </SidebarFrame>
      <Outlet />
    </>
  )
}
