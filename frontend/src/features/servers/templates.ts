import type { ReactNode } from 'react'
import type { components } from '../../lib/api-schema'

export type ServerTemplate = components['schemas']['ServerTemplate']

export type TemplateInfo = { id: ServerTemplate; label: string; icon: ReactNode }
