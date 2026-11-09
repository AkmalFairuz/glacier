import type { KeyboardEvent } from 'react'
import s from './Tabs.module.css'

type Tab<T extends string> = { id: T; label: string }

type Props<T extends string> = { label: string; tabs: Tab<T>[]; value: T; onChange: (id: T) => void }

export function Tabs<T extends string>({ label, tabs, value, onChange }: Props<T>) {
  const onKeyDown = (e: KeyboardEvent) => {
    const index = tabs.findIndex((t) => t.id === value)
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    onChange(tabs[(index + delta + tabs.length) % tabs.length].id)
  }

  return (
    <nav role="tablist" aria-label={label} className={s.tabs} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          tabIndex={tab.id === value ? 0 : -1}
          className={s.tab}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
