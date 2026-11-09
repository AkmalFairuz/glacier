import type { ProfileData } from './useProfileData'
import s from './ProfileFacts.module.css'

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const date = (iso: string) => dateFmt.format(new Date(iso))

/** Membership dates. */
export function ProfileFacts({ data }: { data: ProfileData }) {
  const { user, member, server } = data
  if (!user) return null
  return (
    <>
      <section className={s.block}>
        <h3 className={s.heading}>Member since</h3>
        <dl className={s.dates}>
          <div>
            <dt>Glacier</dt>
            <dd>{date(user.created_at)}</dd>
          </div>
          {member && server && (
            <div>
              <dt>{server.name}</dt>
              <dd>{date(member.joined_at)}</dd>
            </div>
          )}
        </dl>
      </section>
    </>
  )
}
