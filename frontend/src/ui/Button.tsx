import type { ButtonHTMLAttributes, ReactNode } from 'react'
import s from './Button.module.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Blue (primary), no background (ghost), or red (danger). */
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: ReactNode
  loading?: boolean
}

export function Button({ variant = 'ghost', size = 'md', icon, loading, className, children, disabled, type = 'button', ...rest }: Props) {
  const classes = [s.button, s[variant], s[size], className].filter(Boolean).join(' ')
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {icon && <span className={s.icon}>{icon}</span>}
      {children}
    </button>
  )
}
