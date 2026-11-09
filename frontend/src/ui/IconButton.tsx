import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Tooltip } from './Tooltip'
import s from './IconButton.module.css'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string
  icon: ReactNode
  active?: boolean
  danger?: boolean
  size?: 'sm' | 'md'
  tooltipSide?: 'top' | 'right' | 'bottom'
}

export function IconButton({ label, icon, active, danger, size = 'md', tooltipSide, className, type = 'button', ...rest }: Props) {
  const classes = [s.button, s[size], active && s.active, danger && s.danger, className].filter(Boolean).join(' ')
  return (
    <Tooltip label={label} side={tooltipSide}>
      <button type={type} aria-label={label} aria-pressed={active} className={classes} {...rest}>
        {icon}
      </button>
    </Tooltip>
  )
}
