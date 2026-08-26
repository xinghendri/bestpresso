export interface ChartTimeTick {
  offsetMs: number
  x: number
  label: string
}

const APPROXIMATE_CHARACTER_WIDTH = 6.5
const LABEL_GAP = 4

const estimatedLabelWidth = (label: string) => label.length * APPROXIMATE_CHARACTER_WIDTH

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
