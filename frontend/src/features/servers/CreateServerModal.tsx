import { useState } from 'react'
import { LuX } from 'react-icons/lu'
import { Dialog } from '../../ui/Dialog'
import { IconButton } from '../../ui/IconButton'
import { CreateServerStart } from './CreateServerStart'
import { CustomizeServerStep } from './CustomizeServerStep'
import { JoinServerStep } from './JoinServerStep'
import type { ServerTemplate } from './templates'
import s from './CreateServerModal.module.css'

type Step = { id: 'start' } | { id: 'customize'; template: ServerTemplate } | { id: 'join' }
type Props = { open: boolean; onClose: () => void }

/** Create (from scratch or a template) or join a server, one step at a time. */
export function CreateServerModal({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>({ id: 'start' })
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const go = (next: Step, dir: 'forward' | 'back') => {
    setDirection(dir)
    setStep(next)
  }
  const close = () => {
    onClose()
    setStep({ id: 'start' })
  }

  return (
    <Dialog open={open} onClose={close} label="Add a server" size="sm">
      <div className={s.frame}>
        <span className={s.close}>
          <IconButton label="Close" icon={<LuX />} onClick={close} />
        </span>
        <div key={step.id} className={`${s.step} ${s[direction]}`}>
          {step.id === 'start' && (
            <CreateServerStart onPick={(template) => go({ id: 'customize', template }, 'forward')} onJoin={() => go({ id: 'join' }, 'forward')} />
          )}
          {step.id === 'customize' && <CustomizeServerStep template={step.template} onBack={() => go({ id: 'start' }, 'back')} onDone={close} />}
          {step.id === 'join' && <JoinServerStep onBack={() => go({ id: 'start' }, 'back')} onDone={close} />}
        </div>
      </div>
    </Dialog>
  )
}
