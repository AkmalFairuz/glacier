import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { LuSearch } from 'react-icons/lu'
import type { MenuAnchor } from '../../ui/Menu'
import { Popover } from '../../ui/Popover'
import { Spinner } from '../../ui/Spinner'
import { CategoryRail } from './CategoryRail'
import { loadEmoji, searchEmoji, type Emoji, type EmojiGroup } from './emojiData'
import { EmojiSection } from './EmojiSection'
import { recentEmoji, rememberEmoji } from './recentEmoji'
import s from './EmojiPicker.module.css'

type Props = { anchor: MenuAnchor | null; onPick: (emoji: string) => void; onClose: () => void }

export function EmojiPicker({ anchor, onPick, onClose }: Props) {
  return (
    <Popover anchor={anchor} onClose={onClose} label="Pick an emoji">
      {anchor && <PickerBody onPick={onPick} onClose={onClose} />}
    </Popover>
  )
}

function PickerBody({ onPick, onClose }: Omit<Props, 'anchor'>) {
  const [groups, setGroups] = useState<EmojiGroup[] | null>(null)
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query.trim().toLowerCase().replace(/^:|:$/g, ''))
  const [hovered, setHovered] = useState<Emoji | null>(null)
  const [active, setActive] = useState('recent')
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    void loadEmoji().then((g) => alive && setGroups(g))
    return () => {
      alive = false
    }
  }, [])

  const all = useMemo(() => groups?.flatMap((g) => g.emojis) ?? [], [groups])
  const recent = useMemo(() => {
    const byUnicode = new Map(all.map((e) => [e.unicode, e]))
    return recentEmoji()
      .map((u) => byUnicode.get(u))
      .filter((e): e is Emoji => !!e)
  }, [all])
  const results = useMemo(() => (deferred ? searchEmoji(all, deferred) : null), [all, deferred])
  const sections = groups ? [...(recent.length ? [{ key: 'recent', name: 'Recently used', emojis: recent }] : []), ...groups] : []

  const pick = (e: Emoji) => {
    rememberEmoji(e.unicode)
    onPick(e.unicode)
    onClose()
  }

  // Highlight the category whose section is at the top of the scroll area.
  useEffect(() => {
    const root = scroller.current
    if (!root || results) return
    // Visible height of each section inside the top band; edge-touching neighbours count as 0.
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const x of entries) visible.set((x.target as HTMLElement).dataset.section!, x.isIntersecting ? x.intersectionRect.height : 0)
        const best = [...visible.entries()].sort((a, b) => b[1] - a[1])[0]
        if (best && best[1] > 0) setActive(best[0])
      },
      { root, rootMargin: '0px 0px -85% 0px' },
    )
    root.querySelectorAll('[data-section]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [groups, results])

  const jump = (key: string) => {
    setQuery('')
    setActive(key)
    requestAnimationFrame(() => scroller.current?.querySelector(`[data-section="${key}"]`)?.scrollIntoView({ block: 'start' }))
  }

  return (
    <div className={s.picker}>
      <header className={s.top}>
        <label className={s.search}>
          <LuSearch aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !results?.[0]) return
              // Keep the Enter from landing in whatever gets focus next (the composer).
              e.preventDefault()
              pick(results[0])
            }}
            placeholder={hovered ? `:${hovered.shortcode}:` : 'Find the perfect emoji'}
            aria-label="Search emoji"
          />
        </label>
      </header>
      <div className={s.body}>
        <CategoryRail sections={sections.map((x) => x.key)} active={results ? null : active} onJump={jump} />
        <div ref={scroller} className={s.scroller} onMouseLeave={() => setHovered(null)}>
          {!groups ? (
            <div className={s.loading}>
              <Spinner label="Loading emoji" />
            </div>
          ) : results ? (
            results.length ? (
              <EmojiSection sectionKey="results" name="Results" emojis={results} onPick={pick} onHover={setHovered} />
            ) : (
              <p className={s.none}>No emoji match “{query}”.</p>
            )
          ) : (
            sections.map((g) => <EmojiSection key={g.key} sectionKey={g.key} name={g.name} emojis={g.emojis} onPick={pick} onHover={setHovered} />)
          )}
        </div>
      </div>
      <footer className={s.preview} aria-live="polite">
        {hovered && (
          <>
            <span className={s.big} aria-hidden="true">
              {hovered.unicode}
            </span>
            <span className={s.code}>:{hovered.shortcode}:</span>
          </>
        )}
      </footer>
    </div>
  )
}
