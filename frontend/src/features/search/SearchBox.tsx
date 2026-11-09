import { useState, type KeyboardEvent } from 'react'
import { LuHash, LuSearch, LuX } from 'react-icons/lu'
import { Avatar } from '../../ui/Avatar'
import { search, useSearch, type SearchScope } from './searchStore'
import { accept, currentToken, suggest, type Suggestion } from './suggestions'
import { useSearchContext } from './useSearchContext'
import s from './SearchBox.module.css'

const HAS_LABEL = { link: 'Contains a link', file: 'Has a file', image: 'Has an image' }

function SuggestionRow({ item }: { item: Suggestion }) {
  switch (item.kind) {
    case 'filter':
      return (
        <>
          <span className={s.token}>{item.token}</span>
          <span className={s.hintText}>{item.hint}</span>
        </>
      )
    case 'user':
      return (
        <>
          <Avatar name={item.user.display_name} src={item.user.avatar_url} seed={item.user.id} size="xs" />
          <span className={s.token}>{item.user.display_name}</span>
          <span className={s.hintText}>@{item.user.username}</span>
        </>
      )
    case 'channel':
      return (
        <>
          <LuHash aria-hidden="true" />
          <span className={s.token}>{item.channel.name}</span>
        </>
      )
    case 'has':
      return (
        <>
          <span className={s.token}>{item.value}</span>
          <span className={s.hintText}>{HAS_LABEL[item.value]}</span>
        </>
      )
  }
}

/** Header search with autocomplete for from:, in: and has:. */
export function SearchBox({ scope, placeholder }: { scope: SearchScope; placeholder: string }) {
  const active = useSearch((st) => st.scope?.id === scope.id)
  const ctx = useSearchContext(scope)
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  // True once the user picks a row with the arrows or the mouse; Enter then takes that row.
  const [navigated, setNavigated] = useState(false)
  const items = focused && !dismissed ? suggest(text, ctx.users, ctx.channels, scope.kind === 'server') : []
  const index = Math.min(cursor, Math.max(0, items.length - 1))

  const update = (value: string) => {
    setText(value)
    setCursor(0)
    setDismissed(false)
    setNavigated(false)
  }
  const choose = (item: Suggestion) => update(accept(text, item))
  const submit = () => {
    if (!text.trim()) return
    search.run(scope, text.trim())
    setDismissed(true)
  }

  // Enter completes the word being typed (or the row the user moved to); otherwise it searches.
  const completes = () => items.length > 0 && (navigated || (currentToken(text) !== '' && accept(text, items[index]) !== text))

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (items.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setNavigated(true)
      setCursor((c) => (c + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length)
    } else if (items.length && e.key === 'Tab') {
      e.preventDefault()
      choose(items[index])
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (completes()) choose(items[index])
      else submit()
    } else if (e.key === 'Escape') {
      if (items.length) setDismissed(true)
      else {
        update('')
        search.close()
      }
    }
  }

  return (
    <div className={focused || text ? `${s.box} ${s.open}` : s.box}>
      <LuSearch className={s.icon} aria-hidden="true" />
      <input
        className={s.input}
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded={items.length > 0}
        aria-autocomplete="list"
        onChange={(e) => update(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
      />
      {(text || active) && (
        <button
          type="button"
          className={s.clear}
          aria-label="Clear search"
          onClick={() => {
            update('')
            search.close()
          }}
        >
          <LuX />
        </button>
      )}
      {items.length > 0 && (
        <ul className={s.hints} role="listbox" aria-label="Search suggestions">
          {items.map((item, i) => (
            <li key={i} role="option" aria-selected={i === index}>
              <button
                type="button"
                className={i === index ? `${s.hint} ${s.activeHint}` : s.hint}
                // Keep focus in the input while choosing.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => {
                  setCursor(i)
                  setNavigated(true)
                }}
                onClick={() => choose(item)}
              >
                <SuggestionRow item={item} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
