import { useState, type HTMLAttributes, type ReactNode } from 'react'
import { LuChevronDown, LuPlus } from 'react-icons/lu'
import { IconButton } from '../../ui/IconButton'
import s from './ChannelCategory.module.css'

type Props = {
  name: string
  onCreate?: () => void
  dragProps?: HTMLAttributes<HTMLElement>
  children: ReactNode
}

export function ChannelCategory({ name, onCreate, dragProps, children }: Props) {
  const [open, setOpen] = useState(true)
  return (
    <section className={s.category}>
      <header className={s.header} {...dragProps}>
        <button type="button" className={s.toggle} aria-expanded={open} onClick={() => setOpen(!open)}>
          {name}
          <LuChevronDown className={open ? s.chevron : `${s.chevron} ${s.closed}`} aria-hidden="true" />
        </button>
        {onCreate && (
          <span data-no-drag>
            <IconButton size="sm" label={`Create channel in ${name}`} icon={<LuPlus />} onClick={onCreate} />
          </span>
        )}
      </header>
      {open && <ul className={s.list}>{children}</ul>}
    </section>
  )
}
