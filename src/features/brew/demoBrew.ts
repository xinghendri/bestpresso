import type { BrewProfile, LiveShotPoint } from '../../domain/brewing'
import { demoShotPoints } from '../../fixtures/brewingFixture.ts'

export const DEMO_PROFILE_LONG_PRESS_MS = 700
export const DEMO_BREW_TICK_MS = 100

const numericKeys: Array<keyof Pick<LiveShotPoint, 'pressure' | 'flow' | 'targetPressure' | 'targetFlow' | 'temperature' | 'weight' | 'weightFlow'>> = [
  'pressure',
  'flow',
  'targetPressure',
  'targetFlow',
  'temperature',
  'weight',
  'weightFlow',
]

const finiteNumber = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

export interface DemoBrewDefinition {
  profileName: string
  targetYield?: number
  durationMs: number
  points: LiveShotPoint[]
}

export function demoBrewForProfile(profile: BrewProfile): DemoBrewDefinition {
  const targetYield = finiteNumber(profile.targetYield)
  const profileTemperature = finiteNumber(profile.temperature)
  const referenceTemperature = 92
  const referenceYield = demoShotPoints.at(-1)?.weight ?? 40.2
  const yieldScale = targetYield !== undefined && targetYield > 0 ? targetYield / referenceYield : 1
  const temperatureOffset = profileTemperature === undefined ? 0 : profileTemperature - referenceTemperature
  const points = demoShotPoints.map((point) => ({
    ...point,
    temperature: point.temperature === undefined ? undefined : point.temperature + temperatureOffset,
    weight: point.weight === undefined ? undefined : point.weight * yieldScale,
  }))
  return {
    profileName: profile.name,
    targetYield: targetYield !== undefined && targetYield > 0 ? targetYield : undefined,
    durationMs: points.at(-1)?.elapsedMs ?? 0,
    points,
  }
}

export function demoBrewPointsAtElapsed(points: LiveShotPoint[], elapsedMs: number) {
  if (!points.length) return []
  const clampedElapsedMs = Math.max(0, Math.min(elapsedMs, points.at(-1)?.elapsedMs ?? elapsedMs))
  const visible = points.filter((point) => point.elapsedMs <= clampedElapsedMs)
  const previous = visible.at(-1) ?? points[0]
  if (previous.elapsedMs === clampedElapsedMs) return visible
  const next = points.find((point) => point.elapsedMs > clampedElapsedMs)
  if (!next) return visible
  const duration = Math.max(1, next.elapsedMs - previous.elapsedMs)
  const progress = (clampedElapsedMs - previous.elapsedMs) / duration
  const interpolated: LiveShotPoint = { ...previous, elapsedMs: clampedElapsedMs }
  numericKeys.forEach((key) => {
    const from = previous[key]
    const to = next[key]
    if (typeof from === 'number' && typeof to === 'number') interpolated[key] = from + (to - from) * progress
  })
  return [...visible, interpolated]
}
