import { useState } from 'react'
import { LuPlus } from 'react-icons/lu'
import { MobileNavButton } from '../../app/MobileNavButton'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { NewDmModal } from './NewDmModal'
import s from './DmHome.module.css'

export function DmHome() {
  const [creating, setCreating] = useState(false)
  return (
    <main className={s.home}>
      <div className={s.top}>
        <MobileNavButton />
      </div>
      <EmptyState
        title="No conversation open"
        body="Message a person or a small group by username."
        action={
          <Button variant="primary" icon={<LuPlus />} onClick={() => setCreating(true)}>
            New message
          </Button>
        }
      />
      <NewDmModal open={creating} onClose={() => setCreating(false)} />
    </main>
  )
}
