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
    title: 'New Profile',
    beverageType: 'espresso',
    author: '',
    notes: '',
    targetWeight: 0,
    targetVolume: 0,
    targetVolumeCountStart: 0,
    tankTemperature: 0,
    stages: [
      { id: 'preinfusion', name: 'Preinfusion', pump: 'flow', transition: 'fast', target: 2, temperature: 93, sensor: 'coffee', seconds: 10, weight: 0, volume: 0, exit: { type: 'pressure', condition: 'over', value: 4 }, limiter: { type: 'pressure', value: 4, range: 0.6 } },
      { id: 'ramp', name: 'Ramp', pump: 'flow', transition: 'fast', target: 6, temperature: 93, sensor: 'coffee', seconds: 20, weight: 0, volume: 0, exit: { type: 'pressure', condition: 'over', value: 9 }, limiter: { type: 'pressure', value: 9, range: 0.6 } },
      { id: 'extraction', name: 'Extraction', pump: 'pressure', transition: 'fast', target: 9, temperature: 93, sensor: 'coffee', seconds: 40, weight: 37, volume: 0 },
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
  let temperature = stages[0]?.temperature ?? 0

  for (const stage of stages) {
    const nextPressure = stage.pump === 'pressure'
      ? stage.target
      : stage.limiter?.type === 'pressure' ? stage.limiter.value : pressure
    const nextFlow = stage.pump === 'flow'
      ? stage.target
      : stage.limiter?.type === 'flow' ? stage.limiter.value : flow
    const stageEndMs = elapsedMs + stage.seconds * 1000

    points.push({ elapsedMs, pressure, flow, temperature })
    if (stage.transition === 'fast') {
      points.push({ elapsedMs, pressure: nextPressure, flow: nextFlow, temperature: stage.temperature })
    }
    points.push({ elapsedMs: stageEndMs, pressure: nextPressure, flow: nextFlow, temperature: stage.temperature })

    elapsedMs = stageEndMs
    pressure = nextPressure
    flow = nextFlow
    temperature = stage.temperature
  }
  return points
}

export function nextBuilderStage(index: number): BuilderStage {
  return {
    id: `stage-${Date.now()}-${index}`,
    name: 'New Step',
    pump: 'flow',
    transition: 'fast',
    target: 6,
    temperature: 93,
    sensor: 'coffee',
    seconds: 30,
    weight: 0,
    volume: 0,
    exit: { type: 'pressure', condition: 'over', value: 9 },
  }
}
