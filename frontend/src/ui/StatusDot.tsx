import type { StatusSetting } from '../lib/types'
import s from './StatusDot.module.css'

/** The status badge on its own, for menus and pickers. */
export function StatusDot({ status }: { status: StatusSetting }) {
  return <span className={`${s.dot} ${s[status]}`} aria-hidden="true" />
}
