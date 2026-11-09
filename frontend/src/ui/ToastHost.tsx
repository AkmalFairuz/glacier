import { useEffect, useRef } from 'react'
import { LuCircleAlert, LuCircleCheck, LuInfo, LuX } from 'react-icons/lu'
import { dismissToast, useToasts } from './toast'
import s from './ToastHost.module.css'

const ICONS = { error: <LuCircleAlert />, success: <LuCircleCheck />, info: <LuInfo /> }

/** Renders toasts in the top layer so they stay above open dialogs. Mount once. */
export function ToastHost() {
  const toasts = useToasts((st) => st.toasts)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.matches(':popover-open')) el.hidePopover()
    // Re-showing moves the stack above any dialog opened since.
    if (toasts.length) el.showPopover()
  }, [toasts])

  return (
    <div ref={ref} popover="manual" className={s.host} role="region" aria-label="Notifications">
      <ol className={s.stack}>
        {toasts.map((t) => (
          <li key={t.id} className={`${s.toast} ${s[t.kind]}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <span className={s.icon}>{ICONS[t.kind]}</span>
            <p className={s.message}>{t.message}</p>
            <button type="button" className={s.close} aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
              <LuX />
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
