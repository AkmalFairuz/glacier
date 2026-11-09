import { LuMenu } from 'react-icons/lu'
import { IconButton } from '../ui/IconButton'
import { layout } from './layoutStore'
import s from './MobileNavButton.module.css'

export function MobileNavButton() {
  return <IconButton className={s.button} label="Open navigation" icon={<LuMenu />} onClick={layout.toggleNav} tooltipSide="bottom" />
}
