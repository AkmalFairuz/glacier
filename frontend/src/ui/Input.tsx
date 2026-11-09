import type { InputHTMLAttributes, Ref } from 'react'
import s from './Input.module.css'

type Props = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }

export function Input({ className, ...rest }: Props) {
  return <input className={[s.input, className].filter(Boolean).join(' ')} {...rest} />
}
