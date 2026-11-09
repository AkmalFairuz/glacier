import type { Ref, TextareaHTMLAttributes } from 'react'
import s from './TextArea.module.css'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement>; bare?: boolean }

export function TextArea({ className, bare, ...rest }: Props) {
  return <textarea className={[s.textarea, bare && s.bare, className].filter(Boolean).join(' ')} {...rest} />
}
