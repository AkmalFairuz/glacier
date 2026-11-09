import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { LuCheck, LuChevronDown } from 'react-icons/lu'
import s from './Select.module.css'

/** `group` renders a heading above consecutive options with the same group. */
export type Option<T extends string> = { value: T; label: string; group?: string }

type Props<T extends string> = {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  placeholder?: string
  /** Needed when the select is not inside a <Field> label. */
  'aria-label'?: string
  className?: string
}

const GAP = 4
const MARGIN = 8

/**
 * Custom select (WAI-ARIA select-only combobox). The option list is a
 * popover in the top layer, so it is never clipped by scroll containers and
 * Esc or an outside click closes just the list, not a surrounding dialog.
 */
export function Select<T extends string>({ value, options, onChange, disabled, placeholder = 'Select…', className, ...aria }: Props<T>) {
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const search = useRef({ text: '', at: 0 })
  const selected = options.findIndex((o) => o.value === value)

  const place = useCallback(() => {
    const anchor = button.current?.getBoundingClientRect()
    const el = list.current
    if (!anchor || !el) return
    el.style.minWidth = `${anchor.width}px`
    const below = innerHeight - anchor.bottom - GAP - MARGIN
    const above = anchor.top - GAP - MARGIN
    const flip = el.offsetHeight > below && above > below
    el.style.maxHeight = `${Math.min(320, flip ? above : below)}px`
    el.style.left = `${Math.max(MARGIN, Math.min(anchor.left, innerWidth - el.offsetWidth - MARGIN))}px`
    el.style.top = flip ? `${anchor.top - GAP - el.offsetHeight}px` : `${anchor.bottom + GAP}px`
  }, [])

  // The button is the popover's invoker, so the browser toggles it on click
  // and does not treat that click as an outside click.
  useLayoutEffect(() => {
    if (button.current && list.current) button.current.popoverTargetElement = list.current
  }, [])

  useEffect(() => {
    const el = list.current
    const onToggle = (e: Event) => {
      const nowOpen = (e as ToggleEvent).newState === 'open'
      setOpen(nowOpen)
      if (nowOpen) setActive(Math.max(0, selected))
    }
    el?.addEventListener('toggle', onToggle)
    return () => el?.removeEventListener('toggle', onToggle)
  }, [selected])

  useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, listId])

  const show = () => list.current?.showPopover()
  const hide = () => list.current?.hidePopover()
  const choose = (index: number) => {
    const option = options[index]
    if (option && option.value !== value) onChange(option.value)
    hide()
  }

  /** Type-to-find: jumps to the next option starting with the typed text. */
  const findByText = (key: string, from: number) => {
    const now = Date.now()
    search.current = { text: now - search.current.at < 600 ? search.current.text + key.toLowerCase() : key.toLowerCase(), at: now }
    const text = search.current.text
    const order = [...options.keys()].map((i) => (from + (text.length === 1 ? 1 : 0) + i) % options.length)
    return order.find((i) => options[i].label.toLowerCase().startsWith(text)) ?? -1
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1
    const isChar = e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey
    if (!open) {
      const start = {
        ArrowDown: Math.max(0, selected),
        ArrowUp: Math.max(0, selected),
        Home: 0,
        End: last,
        Enter: Math.max(0, selected),
        ' ': Math.max(0, selected),
      }[e.key]
      if (start !== undefined) {
        e.preventDefault()
        show()
        setActive(start)
      } else if (isChar) {
        const hit = findByText(e.key, Math.max(0, selected))
        if (hit >= 0) onChange(options[hit].value)
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        return setActive((a) => Math.min(last, a + 1))
      case 'ArrowUp':
        e.preventDefault()
        return setActive((a) => Math.max(0, a - 1))
      case 'Home':
      case 'PageUp':
        e.preventDefault()
        return setActive(0)
      case 'End':
      case 'PageDown':
        e.preventDefault()
        return setActive(last)
      case 'Enter':
      case ' ':
        e.preventDefault()
        return choose(active)
      case 'Tab':
        return choose(active)
      default:
        if (isChar) {
          const hit = findByText(e.key, active)
          if (hit >= 0) setActive(hit)
        }
    }
  }

  return (
    <span className={[s.wrap, className].filter(Boolean).join(' ')}>
      <button
        ref={button}
        type="button"
        role="combobox"
        className={s.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onKeyDown={onKeyDown}
        // Space activates buttons on keyup; keydown already handled it.
        onKeyUp={(e) => e.key === ' ' && e.preventDefault()}
        {...aria}
      >
        <span className={selected < 0 ? `${s.value} ${s.placeholder}` : s.value}>{selected < 0 ? placeholder : options[selected].label}</span>
        <LuChevronDown className={s.chevron} aria-hidden="true" />
      </button>
      <ul
        ref={list}
        id={listId}
        role="listbox"
        popover="auto"
        className={s.list}
        aria-label={aria['aria-label']}
        // A <label> around the select must not re-activate the button.
        onClick={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
      >
        {options.flatMap((o, i) => [
          ...(o.group && o.group !== options[i - 1]?.group
            ? [
                <li key={`group:${o.group}`} role="presentation" className={s.group}>
                  {o.group}
                </li>,
              ]
            : []),
          <li
            key={o.value}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === selected}
            className={i === active ? `${s.option} ${s.active}` : s.option}
            onMouseMove={() => active !== i && setActive(i)}
            onClick={() => choose(i)}
          >
            <span className={s.label}>{o.label}</span>
            {i === selected && <LuCheck className={s.check} aria-hidden="true" />}
          </li>,
        ])}
      </ul>
    </span>
  )
}
