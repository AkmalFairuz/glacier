import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { LuCheck, LuChevronRight } from 'react-icons/lu'
import s from './Menu.module.css'

type Action = { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; checked?: boolean; disabled?: boolean }
type Submenu = { label: string; icon?: ReactNode; submenu: MenuEntry[] }

export type MenuEntry = Action | Submenu | { heading: string } | 'divider'

/** `flip`: the parent item's left edge; a submenu that would overflow the right side opens to the left of it. */
export type MenuAnchor = { x: number; y: number; flip?: number }

type Props = { anchor: MenuAnchor | null; items: MenuEntry[]; onClose: () => void; label: string }

/** Context menu in the top layer. Entries with `submenu` open a nested menu to the side (hover, click or →). */
export function Menu(props: Props) {
  const tree = useId()
  const { anchor, onClose } = props

  // Clicks anywhere outside this menu and its submenus close the whole tree.
  useEffect(() => {
    if (!anchor) return
    const onDown = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.(`[data-menu-tree="${tree}"]`)) onClose()
    }
    const id = window.setTimeout(() => document.addEventListener('mousedown', onDown))
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onDown)
    }
  }, [anchor, onClose, tree])

  return <MenuList {...props} tree={tree} onCloseAll={onClose} focusFirst nested={false} />
}

type ListProps = Props & { tree: string; onCloseAll: () => void; focusFirst: boolean; nested: boolean }

function MenuList({ anchor, items, onClose, onCloseAll, label, tree, focusFirst, nested }: ListProps) {
  const ref = useRef<HTMLUListElement>(null)
  const [sub, setSub] = useState<{ index: number; anchor: MenuAnchor; focus: boolean } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !anchor) return
    // Top layer, so menus also appear above dialogs and profile cards.
    if (!el.matches(':popover-open')) el.showPopover()
    const rect = el.getBoundingClientRect()
    const overflows = anchor.x + rect.width > innerWidth - 8
    const x = overflows && anchor.flip !== undefined ? anchor.flip - rect.width - 4 : anchor.x
    el.style.left = `${Math.max(8, Math.min(x, innerWidth - rect.width - 8))}px`
    el.style.top = `${Math.max(8, Math.min(anchor.y, innerHeight - rect.height - 8))}px`
    if (focusFirst) el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [anchor, focusFirst])

  if (!anchor) return null

  const openSub = (index: number, button: HTMLElement, focus: boolean) => {
    const rect = button.getBoundingClientRect()
    setSub({ index, focus, anchor: { x: rect.right + 4, y: rect.top - 5, flip: rect.left } })
  }
  const closeSub = () => {
    if (!sub) return
    // One <li> per entry, so the entry index finds the opener even with headings and dividers before it.
    ref.current?.children[sub.index]?.querySelector<HTMLButtonElement>(':scope > button')?.focus()
    setSub(null)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    // Submenus render inside this list in the React tree; keep their keys from reaching the parent.
    e.stopPropagation()
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>(':scope > li > button:not(:disabled)') ?? [])]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Tab') onCloseAll()
    if (e.key === 'Escape' || (e.key === 'ArrowLeft' && nested)) onClose()
    if (e.key === 'ArrowDown') buttons[(index + 1) % buttons.length]?.focus()
    if (e.key === 'ArrowUp') buttons[(index - 1 + buttons.length) % buttons.length]?.focus()
    if (e.key.startsWith('Arrow')) e.preventDefault()
  }

  return (
    <ul ref={ref} popover="manual" role="menu" aria-label={label} className={s.menu} onKeyDown={onKeyDown} data-menu-tree={tree}>
      {items.map((item, i) => {
        if (item === 'divider') return <li key={i} role="separator" className={s.divider} />
        if ('heading' in item) {
          return (
            <li key={i} role="presentation" className={s.heading}>
              {item.heading}
            </li>
          )
        }
        if ('submenu' in item) {
          const open = sub?.index === i
          return (
            <li key={i} role="none">
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={open}
                className={open ? `${s.item} ${s.expanded}` : s.item}
                onMouseEnter={(e) => !open && openSub(i, e.currentTarget, false)}
                onClick={(e) => openSub(i, e.currentTarget, true)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openSub(i, e.currentTarget, true)
                  }
                }}
              >
                <span className={s.icon}>{item.icon}</span>
                {item.label}
                <LuChevronRight className={s.chevron} aria-hidden="true" />
              </button>
              {open && (
                <MenuList
                  anchor={sub.anchor}
                  items={item.submenu}
                  onClose={closeSub}
                  onCloseAll={onCloseAll}
                  label={item.label}
                  tree={tree}
                  focusFirst={sub.focus}
                  nested
                />
              )}
            </li>
          )
        }
        const checkable = item.checked !== undefined
        return (
          <li key={i} role="none">
            <button
              type="button"
              role={checkable ? 'menuitemcheckbox' : 'menuitem'}
              aria-checked={checkable ? item.checked : undefined}
              disabled={item.disabled}
              className={item.danger ? `${s.item} ${s.danger}` : s.item}
              onMouseEnter={() => setSub(null)}
              onClick={() => {
                item.onSelect()
                if (!checkable) onCloseAll()
              }}
            >
              <span className={s.icon}>{checkable ? item.checked && <LuCheck /> : item.icon}</span>
              {item.label}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
