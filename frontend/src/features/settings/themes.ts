/** Color themes in picker order. `system` follows the OS; the rest are set as `data-theme` on <html> (see themes.css). */
export const THEMES = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'ember', label: 'Ember' },
  { id: 'sandstone', label: 'Sandstone' },
  { id: 'lichen', label: 'Lichen' },
  { id: 'heather', label: 'Heather' },
] as const

export type Theme = (typeof THEMES)[number]['id']

export const isTheme = (value: unknown): value is Theme => THEMES.some((t) => t.id === value)
