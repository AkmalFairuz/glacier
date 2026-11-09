import { useId, type ReactNode } from 'react'
import { LuX } from 'react-icons/lu'
import { Dialog } from './Dialog'
import { IconButton } from './IconButton'
import s from './Modal.module.css'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
  children: ReactNode
}

/** Titled dialog with a scrolling body and optional footer actions. */
export function Modal({ open, onClose, title, description, size = 'sm', footer, children }: Props) {
  const titleId = useId()
  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId} size={size}>
      <div className={s.panel}>
        <header className={s.header}>
          <div>
            <h2 id={titleId} className={s.title}>
              {title}
            </h2>
            {description && <p className={s.description}>{description}</p>}
          </div>
          <IconButton label="Close" icon={<LuX />} onClick={onClose} tooltipSide="bottom" />
        </header>
        <div className={s.body}>{children}</div>
        {footer && <footer className={s.footer}>{footer}</footer>}
      </div>
    </Dialog>
  )
}
