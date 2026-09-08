import type { ProfileTargetPoint } from '../../domain/brewing'
import type { DecaidProfileStep } from './types'

const numericValue = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const transitionProgress = (type: string, progress: number) => {
  if (type === 'ease-in') return progress * progress
  if (type === 'ease-out') return 1 - (1 - progress) ** 2
  if (type === 'ease-in-out') return progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2
  return progress
}

export function profileStepsToTargetPoints(steps: DecaidProfileStep[] | undefined): ProfileTargetPoint[] {
  if (!steps?.length) return []
  const points: ProfileTargetPoint[] = []
  let elapsedMs = 0
  let previousPressure = 0
  let previousFlow = 0
  let previousTemperature = numericValue(steps[0]?.temperature) ?? 0

  for (const step of steps) {
    const pump = typeof step.pump === 'object' && step.pump !== null ? step.pump : undefined
    const pumpMode = typeof step.pump === 'string' ? step.pump : pump?.target
    const activePressure = numericValue(pump?.pressure) ?? numericValue(step.pressure)
    const activeFlow = numericValue(pump?.flow) ?? numericValue(step.flow)
    const limiter = numericValue(step.limiter?.value)
    const limiterIsActive = typeof limiter === 'number' && limiter > 0
    const pressure = pumpMode === 'pressure'
      ? activePressure === -1 ? previousPressure : activePressure ?? previousPressure
      : limiterIsActive ? limiter : 0
    const flow = pumpMode === 'flow'
      ? activeFlow === -1 ? previousFlow : activeFlow ?? previousFlow
      : limiterIsActive ? limiter : 0
    const temperature = numericValue(step.temperature) ?? previousTemperature
    const durationMs = Math.max(0, (numericValue(step.seconds) ?? numericValue(step.duration) ?? 0) * 1000)
    const transition = step.transition
    const transitionType = typeof transition === 'string' ? transition : transition?.type ?? 'instant'
    const smoothLegacyTransition = transitionType === 'smooth'
    const rampDurationMs = smoothLegacyTransition
      ? durationMs
      : transitionType === 'fast' || transitionType === 'instant'
        ? 0
        : Math.min(durationMs, Math.max(0, (numericValue(typeof transition === 'object' ? transition.duration : undefined) ?? 0) * 1000))

    points.push({ elapsedMs, pressure: previousPressure, flow: previousFlow, temperature: previousTemperature })
    if (rampDurationMs > 0) {
      const samples = 8
      for (let sample = 1; sample <= samples; sample += 1) {
        const rawProgress = sample / samples
        const progress = transitionProgress(smoothLegacyTransition ? 'linear' : transitionType, rawProgress)
        points.push({
          elapsedMs: elapsedMs + rampDurationMs * rawProgress,
          pressure: previousPressure + (pressure - previousPressure) * progress,
          flow: previousFlow + (flow - previousFlow) * progress,
          temperature: previousTemperature + (temperature - previousTemperature) * progress,
        })
      }
    } else {
      points.push({ elapsedMs, pressure, flow, temperature })
    }
    elapsedMs += durationMs
    points.push({ elapsedMs, pressure, flow, temperature })
    previousPressure = pressure
    previousFlow = flow
    previousTemperature = temperature
  }

  return points
}
