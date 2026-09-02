import type { ProfileTargetPoint } from '../../domain/brewing'

export type BuilderPump = 'pressure' | 'flow'
export type BuilderTransition = 'fast' | 'smooth'
export type BuilderSensor = 'coffee' | 'water'
export type BuilderExitType = 'pressure' | 'flow'
export type BuilderExitCondition = 'over' | 'under'

export interface BuilderThreshold {
  type: BuilderExitType
  condition: BuilderExitCondition
  value: number
}

export interface BuilderLimiter {
  type: BuilderExitType
  value: number
  range: number
}

export interface BuilderStage {
  id: string
  name: string
  pump: BuilderPump
  transition: BuilderTransition
  target: number
  temperature: number
  sensor: BuilderSensor
  seconds: number
  volume: number
  weight?: number
  exit?: BuilderThreshold
  limiter?: BuilderLimiter
}

export interface ProfileDraft {
  title: string
  beverageType: 'espresso' | 'cleaning' | 'manual' | 'pourover'
  author: string
  notes: string
  targetWeight?: number
  targetVolume?: number
  targetVolumeCountStart: number
  tankTemperature: number
  stages: BuilderStage[]
}

export function createDefaultProfileDraft(): ProfileDraft {
  return {
    title: 'My espresso profile',
    beverageType: 'espresso',
    author: '',
    notes: 'A balanced four-stage starting point.',
    targetWeight: 36,
    targetVolume: 42,
    targetVolumeCountStart: 1,
    tankTemperature: 0,
    stages: [
      { id: 'wet', name: 'Wet the puck', pump: 'flow', transition: 'fast', target: 3.5, temperature: 92, sensor: 'coffee', seconds: 12, volume: 100, weight: 4, exit: { type: 'pressure', condition: 'over', value: 4 }, limiter: { type: 'pressure', value: 6, range: 0.6 } },
      { id: 'rise', name: 'Build pressure', pump: 'pressure', transition: 'smooth', target: 9, temperature: 92, sensor: 'coffee', seconds: 6, volume: 100, limiter: { type: 'flow', value: 2.5, range: 0.4 } },
      { id: 'hold', name: 'Hold', pump: 'pressure', transition: 'fast', target: 9, temperature: 92, sensor: 'coffee', seconds: 18, volume: 100, limiter: { type: 'flow', value: 2.2, range: 0.4 } },
      { id: 'decline', name: 'Decline', pump: 'pressure', transition: 'smooth', target: 6, temperature: 92, sensor: 'coffee', seconds: 12, volume: 100, limiter: { type: 'flow', value: 2, range: 0.4 } },
    ],
  }
}

export function stageConstraintLabel(stage: BuilderStage) {
  const parts = [`${stage.seconds}s max`]
  if (stage.exit) parts.push(`${stage.exit.type} ${stage.exit.condition === 'over' ? '≥' : '≤'} ${stage.exit.value}`)
  if (stage.weight && stage.weight > 0) parts.push(`${stage.weight}g`)
  return parts.join(' · ')
}

export function builderTargetPoints(stages: BuilderStage[]): ProfileTargetPoint[] {
  const points: ProfileTargetPoint[] = []
  let elapsedMs = 0
  let pressure = 0
  let flow = 0

  for (const stage of stages) {
    const nextPressure = stage.pump === 'pressure' ? stage.target : pressure
    const nextFlow = stage.pump === 'flow' ? stage.target : flow
    points.push({ elapsedMs, pressure, flow })
    if (stage.transition === 'smooth') {
      points.push({ elapsedMs: elapsedMs + stage.seconds * 500, pressure: (pressure + nextPressure) / 2, flow: (flow + nextFlow) / 2 })
    }
    points.push({ elapsedMs, pressure: nextPressure, flow: nextFlow })
    elapsedMs += stage.seconds * 1000
    points.push({ elapsedMs, pressure: nextPressure, flow: nextFlow })
    pressure = nextPressure
    flow = nextFlow
  }
  return points
}

export function nextBuilderStage(index: number): BuilderStage {
  return {
    id: `stage-${Date.now()}-${index}`,
    name: `Stage ${index + 1}`,
    pump: 'pressure',
    transition: 'fast',
    target: 6,
    temperature: 92,
    sensor: 'coffee',
    seconds: 10,
    volume: 100,
  }
}
