export interface ChartTimeTick {
  offsetMs: number
  x: number
  label: string
}

const APPROXIMATE_CHARACTER_WIDTH = 6.5
const LABEL_GAP = 4
const LONG_TIMELINE_THRESHOLD_MS = 90_000
const LONG_TIMELINE_LABEL_INTERVAL_MS = 15_000

const estimatedLabelWidth = (label: string) => label.length * APPROXIMATE_CHARACTER_WIDTH

export function shouldShowTimelineLabel(offsetMs: number, startMs: number, durationMs: number, preserveBoundary = false) {
  if (durationMs <= LONG_TIMELINE_THRESHOLD_MS || preserveBoundary) return true
  return (startMs + offsetMs) % LONG_TIMELINE_LABEL_INTERVAL_MS === 0
}

export function removeOverlappingFocusedTimeTicks(ticks: ChartTimeTick[]) {
  const visible: ChartTimeTick[] = []

  for (let index = ticks.length - 1; index >= 0; index -= 1) {
    const tick = ticks[index]
    const next = visible[0]
    const minimumDistance = next
      ? (estimatedLabelWidth(tick.label) + estimatedLabelWidth(next.label)) / 2 + LABEL_GAP
      : 0

    if (!next || next.x - tick.x >= minimumDistance) visible.unshift(tick)
  }

  return visible
}
