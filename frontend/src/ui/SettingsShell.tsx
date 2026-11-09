import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LuArrowLeft, LuSearch, LuX } from 'react-icons/lu'
import { Dialog } from './Dialog'
import { IconButton } from './IconButton'
import { filterGroups, SettingsNav, type NavGroup } from './SettingsNav'
import s from './SettingsShell.module.css'

type Props = {
  open: boolean
  onClose: () => void
  label: string
  groups: NavGroup[]
  active: string
  onSelect: (id: string) => void
  title: string
  header?: ReactNode
  footer?: ReactNode
  /** The page fills the window height and manages its own scrolling. */
  fill?: boolean
  /** Show the section search box (worth it for long section lists). */
  searchable?: boolean
  children: ReactNode
}

/** Fixed-size settings window: searchable section sidebar, one page at a time. */
export function SettingsShell({ open, onClose, label, groups, active, onSelect, title, header, footer, fill, searchable = true, children }: Props) {
  const content = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'nav' | 'page'>('page')
  const visible = filterGroups(groups, query)

  useEffect(() => {
    content.current?.scrollTo({ top: 0 })
  }, [active])

  const select = (id: string) => {
    onSelect(id)
    setView('page')
  }

  return (
    <Dialog open={open} onClose={onClose} label={label} size="window" dismissible={false}>
      <div className={s.layout} data-view={view}>
        <nav className={s.sidebar} aria-label={`${label} sections`}>
          <div className={s.sidebarTop}>
            {header}
            <span className={s.mobileClose}>
              <IconButton label="Close settings" icon={<LuX />} onClick={onClose} tooltipSide="bottom" />
            </span>
          </div>
          {searchable && (
            <label className={s.search}>
              <LuSearch aria-hidden="true" />
              <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search settings" />
            </label>
          )}
          <div className={s.nav}>
            {visible.length ? (
              <SettingsNav groups={visible} active={active} expandAll={!!query.trim()} onSelect={select} />
            ) : (
              <p className={s.empty}>No settings match “{query}”.</p>
            )}
          </div>
          {footer && <div className={s.footer}>{footer}</div>}
        </nav>
        <section className={s.main} aria-label={title}>
          <header className={s.bar}>
            <span className={s.back}>
              <IconButton label="All settings" icon={<LuArrowLeft />} onClick={() => setView('nav')} tooltipSide="bottom" />
            </span>
            <h2 className={s.title}>{title}</h2>
            <IconButton label="Close settings" icon={<LuX />} onClick={onClose} tooltipSide="bottom" />
          </header>
          <div ref={content} className={fill ? `${s.content} ${s.fill}` : s.content} tabIndex={-1} autoFocus>
            <div key={active} className={s.page}>
              {children}
            </div>
          </div>
        </section>
      </div>
    </Dialog>
  )
}
