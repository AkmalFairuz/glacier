import type { ReactNode } from 'react'
import s from './SettingsNav.module.css'

export type NavItem = { id: string; label: string; icon?: ReactNode; keywords?: string; children?: NavItem[] }
export type NavGroup = { label?: string; items: NavItem[] }

const matches = (item: NavItem, q: string) => `${item.label} ${item.keywords ?? ''}`.toLowerCase().includes(q)

/** Filters groups by a search query; a parent stays when one of its children matches. */
export function filterGroups(groups: NavGroup[], query: string): NavGroup[] {
  const q = query.trim().toLowerCase()
  if (!q) return groups
  return groups
    .map((g) => ({
      ...g,
      items: g.items
        .map((item) => (matches(item, q) ? item : { ...item, children: item.children?.filter((c) => matches(c, q)) }))
        .filter((item) => matches(item, q) || (item.children?.length ?? 0) > 0),
    }))
    .filter((g) => g.items.length > 0)
}

type Props = { groups: NavGroup[]; active: string; expandAll: boolean; onSelect: (id: string) => void }

export function SettingsNav({ groups, active, expandAll, onSelect }: Props) {
  const isActive = (item: NavItem) => item.id === active || !!item.children?.some((c) => c.id === active)
  return (
    <>
      {groups.map((group, gi) => (
        <div key={group.label ?? gi} className={s.group}>
          {group.label && <h3 className={s.groupLabel}>{group.label}</h3>}
          <ul className={s.list}>
            {group.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={s.item}
                  aria-current={isActive(item) ? 'page' : undefined}
                  onClick={() => onSelect(item.children?.[0]?.id ?? item.id)}
                >
                  {item.icon && <span className={s.icon}>{item.icon}</span>}
                  {item.label}
                </button>
                {item.children && (expandAll || isActive(item)) && (
                  <ul className={s.children}>
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <button type="button" className={s.child} aria-current={child.id === active ? 'page' : undefined} onClick={() => onSelect(child.id)}>
                          {child.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}
