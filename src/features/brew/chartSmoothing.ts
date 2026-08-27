import type { LiveShotPoint } from '../../domain/brewing'

type SmoothableShotKey = 'pressure' | 'flow' | 'temperature'

export type ChartSmoothingTimeConstants = Record<SmoothableShotKey, number>

export const DEFAULT_CHART_SMOOTHING_MS: ChartSmoothingTimeConstants = {
  pressure: 160,
  flow: 180,
  temperature: 240,
}

const SMOOTHABLE_KEYS: SmoothableShotKey[] = ['pressure', 'flow', 'temperature']

interface FilterState {
  elapsedMs: number
  value: number
}

export function smoothShotTelemetry(points: LiveShotPoint[], timeConstants: ChartSmoothingTimeConstants = DEFAULT_CHART_SMOOTHING_MS) {
  const state: Partial<Record<SmoothableShotKey, FilterState>> = {}

  return points.map((point) => {
    const next = { ...point }

    for (const key of SMOOTHABLE_KEYS) {
      const rawValue = point[key]
      if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
        delete state[key]
        continue
      }

      const previous = state[key]
      const elapsed = point.elapsedMs - (previous?.elapsedMs ?? point.elapsedMs)
      const timeConstant = Math.max(1, timeConstants[key])
      const value = previous && elapsed > 0
        ? previous.value + (1 - Math.exp(-elapsed / timeConstant)) * (rawValue - previous.value)
        : rawValue

      next[key] = value
      state[key] = { elapsedMs: point.elapsedMs, value }
    }

    return next
  })
}
