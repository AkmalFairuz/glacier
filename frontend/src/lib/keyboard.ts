/** Shortcut combos are stored as "Ctrl+Shift+KeyM" (modifiers + KeyboardEvent.code). */
const MODIFIER_CODES = new Set(['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'])

export const isModifier = (code: string) => MODIFIER_CODES.has(code)

export function comboFromEvent(e: KeyboardEvent, withModifiers = true): string {
  const mods = withModifiers ? [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Meta'].filter(Boolean) : []
  return [...mods, e.code].join('+')
}

const NAMES: Record<string, string> = {
  Space: 'Space',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  CapsLock: 'Caps Lock',
  Escape: 'Esc',
  Meta: navigator.platform.startsWith('Mac') ? '⌘' : 'Win',
  Alt: navigator.platform.startsWith('Mac') ? '⌥' : 'Alt',
}

function keyName(part: string): string {
  if (NAMES[part]) return NAMES[part]
  if (part.startsWith('Key')) return part.slice(3)
  if (part.startsWith('Digit')) return part.slice(5)
  if (part.startsWith('Numpad')) return `Num ${part.slice(6)}`
  if (part.startsWith('Arrow')) return part.slice(5)
  return part
}

export const formatCombo = (combo: string) => combo.split('+').map(keyName).join(' + ')

/** True when focus is in a text field and the key would type a character there. */
export function typingInField(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  const editable = !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
  const typesText = /^(Key|Digit|Space|Backquote|Minus|Equal|Bracket|Backslash|Semicolon|Quote|Comma|Period|Slash|Numpad)/.test(e.code)
  return editable && typesText && !e.ctrlKey && !e.metaKey && !e.altKey
}
