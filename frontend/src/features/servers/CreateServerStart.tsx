import { LuBookOpen, LuChevronRight, LuGamepad2, LuHeart, LuPencil, LuUsers } from 'react-icons/lu'
import { Button } from '../../ui/Button'
import type { ServerTemplate, TemplateInfo } from './templates'
import s from './CreateServerModal.module.css'

const TEMPLATES: TemplateInfo[] = [
  { id: 'gaming', label: 'Gaming', icon: <LuGamepad2 /> },
  { id: 'friends', label: 'Friends', icon: <LuHeart /> },
  { id: 'study_group', label: 'Study group', icon: <LuBookOpen /> },
  { id: 'school_club', label: 'School club', icon: <LuUsers /> },
]

function Option({ info, onPick }: { info: TemplateInfo; onPick: (t: ServerTemplate) => void }) {
  return (
    <button type="button" className={s.option} onClick={() => onPick(info.id)}>
      <span className={s.optionIcon}>{info.icon}</span>
      <span className={s.optionLabel}>{info.label}</span>
      <LuChevronRight className={s.chevron} aria-hidden="true" />
    </button>
  )
}

export function CreateServerStart({ onPick, onJoin }: { onPick: (t: ServerTemplate) => void; onJoin: () => void }) {
  return (
    <>
      <header className={s.header}>
        <h2 className={s.title}>Create your server</h2>
        <p className={s.lede}>Start from scratch, or pick a template with channels already set up.</p>
      </header>
      <div className={s.scroll}>
        <Option info={{ id: 'blank', label: 'Create my own', icon: <LuPencil /> }} onPick={onPick} />
        <h3 className={s.groupLabel}>Start from a template</h3>
        <div className={s.options}>
          {TEMPLATES.map((t) => (
            <Option key={t.id} info={t} onPick={onPick} />
          ))}
        </div>
      </div>
      <footer className={s.footer}>
        <h3 className={s.footerTitle}>Have an invite already?</h3>
        <Button className={s.wide} onClick={onJoin}>
          Join a server
        </Button>
      </footer>
    </>
  )
}
