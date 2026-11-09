/** Inline pieces of a text paragraph. */
export type Inline = { kind: 'text'; text: string } | { kind: 'link'; href: string } | { kind: 'code'; text: string }

/** Top-level blocks of a message: prose or a fenced ``` code block. */
export type Block = { kind: 'text'; inlines: Inline[] } | { kind: 'codeblock'; lang: string | null; code: string }

const FENCE = /```(?:([\w#+.-]+)?\n)?([\s\S]*?)```/g
const INLINE_CODE = /`([^`\n]+)`/g
const URL = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]])/g

function linkify(text: string): Inline[] {
  return text
    .split(URL)
    .map((part, i): Inline => (i % 2 === 1 ? { kind: 'link', href: part } : { kind: 'text', text: part }))
    .filter((p) => p.kind !== 'text' || p.text !== '')
}

function inlines(text: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of text.matchAll(INLINE_CODE)) {
    out.push(...linkify(text.slice(last, m.index)), { kind: 'code', text: m[1] })
    last = m.index + m[0].length
  }
  out.push(...linkify(text.slice(last)))
  return out
}

export function parseMessage(content: string): Block[] {
  const blocks: Block[] = []
  let last = 0
  const pushText = (text: string) => {
    if (text.trim()) blocks.push({ kind: 'text', inlines: inlines(text.replace(/^\n+|\n+$/g, '')) })
  }
  for (const m of content.matchAll(FENCE)) {
    pushText(content.slice(last, m.index))
    blocks.push({ kind: 'codeblock', lang: m[1] ?? null, code: m[2].replace(/\n$/, '') })
    last = m.index + m[0].length
  }
  pushText(content.slice(last))
  return blocks
}
