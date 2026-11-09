type SinkElement = HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> }

/** Routes a media element to the chosen speaker and volume (0–100). */
export function applyOutput(el: HTMLMediaElement, deviceId: string, volume: number) {
  el.volume = Math.min(1, Math.max(0, volume / 100))
  const sink = el as SinkElement
  if (sink.setSinkId) void sink.setSinkId(deviceId === 'default' ? '' : deviceId).catch(() => undefined)
}
