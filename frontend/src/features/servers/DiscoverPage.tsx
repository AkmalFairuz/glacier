import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { LuSearch } from 'react-icons/lu'
import { useNavigate } from 'react-router'
import { MobileNavButton } from '../../app/MobileNavButton'
import { keys } from '../../lib/keys'
import type { Server } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { Spinner } from '../../ui/Spinner'
import { serversApi } from './api'
import { upsertServer } from './cache'
import { useServers } from './hooks'
import s from './DiscoverPage.module.css'

export function DiscoverPage() {
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query.trim())
  const { data = [], isLoading } = useQuery({ queryKey: keys.discover(deferred), queryFn: () => serversApi.discover(deferred) })

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>
          <span className={s.menu}>
            <MobileNavButton />
          </span>
          Discover
        </h1>
        <p className={s.subtitle}>Public servers anyone can join.</p>
        <label className={s.search}>
          <LuSearch aria-hidden="true" />
          <span className="visually-hidden">Search public servers</span>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" />
        </label>
      </header>
      {isLoading ? (
        <Spinner />
      ) : data.length === 0 ? (
        <p className={s.none}>{deferred ? `No public servers match “${deferred}”.` : 'No public servers yet.'}</p>
      ) : (
        <ul className={s.list}>
          {data.map((server) => (
            <DiscoverRow key={server.id} server={server} />
          ))}
        </ul>
      )}
    </main>
  )
}

function DiscoverRow({ server }: { server: Server }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const joined = useServers().data?.some((s) => s.id === server.id)
  const join = useMutation({
    mutationFn: () => serversApi.join(server.id),
    onSuccess: (joinedServer) => {
      upsertServer(qc, joinedServer)
      navigate(`/channels/${server.id}`)
    },
  })

  return (
    <li className={s.row}>
      <Avatar name={server.name} src={server.icon_url} seed={server.id} size="lg" />
      <div className={s.info}>
        <h2 className={s.name}>{server.name}</h2>
        {server.description && <p className={s.description}>{server.description}</p>}
      </div>
      <span className={s.count}>{server.member_count} members</span>
      {joined ? (
        <Button size="sm" onClick={() => navigate(`/channels/${server.id}`)}>
          Open
        </Button>
      ) : (
        <Button size="sm" variant="primary" loading={join.isPending} onClick={() => join.mutate()}>
          Join
        </Button>
      )}
    </li>
  )
}
