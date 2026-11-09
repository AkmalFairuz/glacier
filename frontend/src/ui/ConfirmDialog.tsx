import { useId } from 'react'
import { Button } from './Button'
import { settleConfirm, useConfirmStore } from './confirm'
import { Dialog } from './Dialog'
import s from './ConfirmDialog.module.css'

/** Renders the dialog requested through confirmDialog(). Mount once near the root. */
export function ConfirmHost() {
  const open = useConfirmStore((st) => st.open)
  const pending = useConfirmStore((st) => st.pending)
  const titleId = useId()
  const messageId = useId()

  return (
    <Dialog open={open} onClose={() => settleConfirm(false)} labelledBy={titleId} role="alertdialog" dismissible={false}>
      {pending && (
        <form
          className={s.panel}
          aria-describedby={pending.message ? messageId : undefined}
          onSubmit={(e) => {
            e.preventDefault()
            settleConfirm(true)
          }}
        >
          <h2 id={titleId} className={s.title}>
            {pending.title}
          </h2>
          {pending.message && (
            <div id={messageId} className={s.message}>
              {pending.message}
            </div>
          )}
          <div className={s.actions}>
            <Button variant="ghost" onClick={() => settleConfirm(false)}>
              {pending.cancelLabel ?? 'Cancel'}
            </Button>
            <Button type="submit" variant={pending.danger ? 'danger' : 'primary'} autoFocus>
              {pending.confirmLabel ?? 'Confirm'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
