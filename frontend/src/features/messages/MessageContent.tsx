import { inviteCodeFromUrl, openInvite } from '../invites/inviteStore'
import { parseMessage, type Inline } from './messageFormat'
import s from './MessageContent.module.css'

function InlineNode({ node }: { node: Inline }) {
  if (node.kind === 'link') {
    const invite = inviteCodeFromUrl(node.href)
    return (
      <a
        href={node.href}
        target="_blank"
        rel="noreferrer noopener"
        // Glacier invite links open the in-app offer instead of a new tab.
        onClick={(e) => {
          if (!invite) return
          e.preventDefault()
          openInvite(invite)
        }}
      >
        {node.href}
      </a>
    )
  }
  if (node.kind === 'code') return <code className={s.inlineCode}>{node.text}</code>
  return node.text
}

export function MessageContent({ content, edited }: { content: string; edited: boolean }) {
  if (!content && !edited) return null
  const blocks = parseMessage(content)
  return (
    <div className={s.content}>
      {blocks.map((block, i) =>
        block.kind === 'codeblock' ? (
          <pre key={i} className={s.codeBlock} data-lang={block.lang ?? undefined}>
            <code>{block.code}</code>
          </pre>
        ) : (
          <p key={i} className={s.text}>
            {block.inlines.map((node, j) => (
              <InlineNode key={j} node={node} />
            ))}
            {edited && i === blocks.length - 1 && <span className={s.edited}> (edited)</span>}
          </p>
        ),
      )}
      {edited && blocks.at(-1)?.kind !== 'text' && <span className={s.edited}>(edited)</span>}
    </div>
  )
}
