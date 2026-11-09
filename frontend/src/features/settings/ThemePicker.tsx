import { useId } from 'react'
import { LuCheck } from 'react-icons/lu'
import { settings, useSettings } from './settingsStore'
import { THEMES, type Theme } from './themes'
import { applyTheme } from './useApplyAppearance'
import s from './ThemePicker.module.css'

/** Same rule as global.css: animate unless reduced motion is on and the user didn't choose "Always animate". */
function motionAllowed() {
  const motion = document.documentElement.dataset.motion
  return motion === 'full' || (motion !== 'reduce' && !matchMedia('(prefers-reduced-motion: reduce)').matches)
}

function choose(theme: Theme) {
  const apply = () => {
    applyTheme(theme)
    settings.set({ theme })
  }
  if (document.startViewTransition && motionAllowed()) document.startViewTransition(apply)
  else apply()
}

/** A miniature app shell drawn with the given theme's real tokens. */
function Preview({ theme, className = '' }: { theme: string; className?: string }) {
  return (
    <span className={`${s.preview} ${className}`} data-theme={theme}>
      <span className={s.rail}>
        <i />
        <i />
        <i />
      </span>
      <span className={s.side}>
        <i />
        <i className={s.current} />
        <i />
        <i />
      </span>
      <span className={s.main}>
        <span className={s.msg}>
          <b />
          <i />
        </span>
        <span className={s.msg}>
          <b />
          <i />
        </span>
        <span className={s.button} />
        <span className={s.composer} />
      </span>
    </span>
  )
}

export function ThemePicker() {
  const value = useSettings((st) => st.theme)
  const name = useId()
  return (
    <fieldset className={s.root}>
      <legend className={s.legend}>Color theme</legend>
      <div className={s.grid}>
        {THEMES.map((t) => (
          <label key={t.id} className={s.option}>
            <input type="radio" className={s.input} name={name} value={t.id} checked={value === t.id} onChange={() => choose(t.id)} />
            <span className={s.tile} aria-hidden="true">
              {t.id === 'system' ? (
                <>
                  <Preview theme="light" />
                  <Preview theme="dark" className={s.half} />
                </>
              ) : (
                <Preview theme={t.id} />
              )}
              <span className={s.check}>
                <LuCheck />
              </span>
            </span>
            <span className={s.name}>{t.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
