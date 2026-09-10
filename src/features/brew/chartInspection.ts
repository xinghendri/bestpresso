import type { LiveShotPoint } from '../../domain/brewing'

const telemetryKeys = ['pressure', 'flow', 'temperature', 'weight'] as const

const interpolatedValue = (before: LiveShotPoint, after: LiveShotPoint, key: typeof telemetryKeys[number], ratio: number) => {
  const beforeValue = before[key]
  const afterValue = after[key]
  if (typeof beforeValue === 'number' && typeof afterValue === 'number') {
    return beforeValue + (afterValue - beforeValue) * ratio
  }
  if (typeof beforeValue === 'number') return beforeValue
  if (typeof afterValue === 'number') return afterValue
  return undefined
}

export function inspectShotTelemetry(points: LiveShotPoint[], elapsedMs: number): LiveShotPoint | null {
  if (points.length === 0) return null
  if (elapsedMs <= points[0].elapsedMs) return { ...points[0], elapsedMs }
  if (elapsedMs >= points[points.length - 1].elapsedMs) return { ...points[points.length - 1], elapsedMs }

  let low = 0
  let high = points.length - 1
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (points[middle].elapsedMs <= elapsedMs) low = middle
    else high = middle
  }

  const before = points[low]
  const after = points[high]
  const interval = Math.max(1, after.elapsedMs - before.elapsedMs)
  const ratio = Math.max(0, Math.min(1, (elapsedMs - before.elapsedMs) / interval))
  return telemetryKeys.reduce<LiveShotPoint>((inspection, key) => {
    const value = interpolatedValue(before, after, key, ratio)
    return value === undefined ? inspection : { ...inspection, [key]: value }
  }, { elapsedMs })
}
