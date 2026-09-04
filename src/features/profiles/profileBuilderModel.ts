import type { DecaidProfile, DecaidProfileStep } from '../../api/decaid/types'
import type { ProfileTargetPoint } from '../../domain/brewing'

export type BuilderPump = 'pressure' | 'flow'
export type BuilderTransition = 'fast' | 'smooth'
export type BuilderSensor = 'coffee' | 'water'
export type BuilderExitType = 'pressure' | 'flow'
export type BuilderExitCondition = 'over' | 'under'
export type BuilderMode = 'create' | 'edit' | 'import'

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
  weight?: number | null
  exit?: BuilderThreshold | null
  limiter?: BuilderLimiter | null
  source?: DecaidProfileStep
}

export interface ProfileDraft {
  version?: string | null
  title: string
  category?: string
  beverageType: 'espresso' | 'calibrate' | 'cleaning' | 'manual' | 'pourover'
  author: string
  notes: string
  targetWeight?: number | null
  targetVolume?: number | null
  targetVolumeCountStart: number
  tankTemperature: number
  stages: BuilderStage[]
  sourceProfile?: DecaidProfile
  sourceProfileId?: string
  sourceMetadata?: Record<string, unknown> | null
}

const numeric = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const optionalNumeric = (value: unknown) => {
  if (value === null) return null
  if (value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function splitBuilderProfileTitle(title: string | undefined, explicitCategory?: string) {
  const fullTitle = title?.trim() || 'Untitled profile'
  const separatorIndex = fullTitle.indexOf('/')
  if (separatorIndex < 0) return { title: fullTitle, category: explicitCategory?.trim() || undefined }
  const category = fullTitle.slice(0, separatorIndex).trim()
  const profileTitle = fullTitle.slice(separatorIndex + 1).trim()
  return category && profileTitle
    ? { title: profileTitle, category }
    : { title: fullTitle, category: explicitCategory?.trim() || undefined }
}

export function composeBuilderProfileTitle(title: string, category?: string) {
  const cleanTitle = title.trim() || 'Untitled profile'
  const cleanCategory = category?.trim()
  return cleanCategory ? `${cleanCategory} / ${cleanTitle}` : cleanTitle
}

export function copiedProfileName(sourceTitle: string, category: string | undefined, existingTitles: string[]) {
  const occupied = new Set(existingTitles.map((title) => {
    const parsed = splitBuilderProfileTitle(title)
    return composeBuilderProfileTitle(parsed.title, parsed.category).toLowerCase()
  }))
  for (let copy = 1; copy < 1000; copy += 1) {
    const candidate = `${sourceTitle} (${String(copy).padStart(2, '0')})`
    if (!occupied.has(composeBuilderProfileTitle(candidate, category).toLowerCase())) return candidate
  }
  return `${sourceTitle} (${Date.now()})`
}

function stageFromDecaid(step: DecaidProfileStep, index: number): BuilderStage {
  const pumpObject = typeof step.pump === 'object' && step.pump !== null ? step.pump : undefined
  const declaredPump = typeof step.pump === 'string' ? step.pump : pumpObject?.target
  const pump: BuilderPump = declaredPump === 'pressure' || declaredPump === 'flow'
    ? declaredPump
    : optionalNumeric(step.pressure ?? pumpObject?.pressure) !== undefined ? 'pressure' : 'flow'
  const transitionValue = typeof step.transition === 'string' ? step.transition : step.transition?.type
  const transition: BuilderTransition = transitionValue === 'smooth' ? 'smooth' : 'fast'
  const exitType = step.exit?.type === 'flow' || step.exit?.type === 'pressure' ? step.exit.type : undefined
  const exitCondition = step.exit?.condition === 'under' || step.exit?.condition === 'over' ? step.exit.condition : undefined
  const exitValue = optionalNumeric(step.exit?.value)
  const limiterValue = optionalNumeric(step.limiter?.value)
  const limiterRange = optionalNumeric(step.limiter?.range)

  return {
    id: `source-stage-${index}`,
    name: typeof step.name === 'string' && step.name.trim() ? step.name : `Stage ${index + 1}`,
    pump,
    transition,
    target: numeric(pump === 'pressure' ? step.pressure ?? pumpObject?.pressure : step.flow ?? pumpObject?.flow),
    temperature: numeric(step.temperature),
    sensor: step.sensor === 'water' ? 'water' : 'coffee',
    seconds: numeric(step.seconds ?? step.duration),
    volume: numeric(step.volume),
    weight: optionalNumeric(step.weight),
    exit: step.exit === null ? null : exitType && exitCondition && typeof exitValue === 'number' ? { type: exitType, condition: exitCondition, value: exitValue } : undefined,
    limiter: step.limiter === null ? null : typeof limiterValue === 'number' ? { type: pump === 'pressure' ? 'flow' : 'pressure', value: limiterValue, range: typeof limiterRange === 'number' ? limiterRange : 0 } : undefined,
    source: { ...step },
  }
}

export function profileDraftFromDecaidProfile(profile: DecaidProfile, options: {
  mode: Extract<BuilderMode, 'edit' | 'import'>
  sourceProfileId?: string
  sourceMetadata?: Record<string, unknown> | null
  existingTitles?: string[]
}): ProfileDraft {
  const parsedTitle = splitBuilderProfileTitle(profile.title, profile.category)
  const beverageType = profile.beverage_type
  const validBeverageType = beverageType === 'calibrate' || beverageType === 'cleaning' || beverageType === 'manual' || beverageType === 'pourover' ? beverageType : 'espresso'
  return {
    version: profile.version,
    title: copiedProfileName(parsedTitle.title, parsedTitle.category, options.existingTitles ?? []),
    category: parsedTitle.category,
    beverageType: validBeverageType,
    author: typeof profile.author === 'string' ? profile.author : '',
    notes: typeof profile.notes === 'string' ? profile.notes : '',
    targetWeight: optionalNumeric(profile.target_weight),
    targetVolume: optionalNumeric(profile.target_volume),
    targetVolumeCountStart: numeric(profile.target_volume_count_start),
    tankTemperature: numeric(profile.tank_temperature),
    stages: profile.steps?.map(stageFromDecaid) ?? [],
    sourceProfile: { ...profile, steps: profile.steps?.map((step) => ({ ...step })) },
    sourceProfileId: options.sourceProfileId,
    sourceMetadata: options.sourceMetadata,
  }
}

function stageToDecaid(stage: BuilderStage): DecaidProfileStep {
  const serialized: DecaidProfileStep = {
    ...stage.source,
    name: stage.name,
    pump: stage.pump,
    transition: stage.transition,
    seconds: stage.seconds,
    volume: stage.volume,
    temperature: stage.temperature,
    sensor: stage.sensor,
  }
  delete serialized.duration
  if (stage.pump === 'pressure') {
    serialized.pressure = stage.target
    delete serialized.flow
  } else {
    serialized.flow = stage.target
    delete serialized.pressure
  }
  if (stage.weight === undefined) delete serialized.weight
  else serialized.weight = stage.weight
  if (stage.exit === undefined) delete serialized.exit
  else serialized.exit = stage.exit ? { ...stage.exit } : null
  if (stage.limiter === undefined) delete serialized.limiter
  else serialized.limiter = stage.limiter ? { value: stage.limiter.value, range: stage.limiter.range } : null
  return serialized
}

export function profileDraftToDecaidProfile(draft: ProfileDraft): DecaidProfile {
  const profile: DecaidProfile = {
    ...draft.sourceProfile,
    title: composeBuilderProfileTitle(draft.title, draft.category),
    notes: draft.notes,
    author: draft.author,
    beverage_type: draft.beverageType,
    steps: draft.stages.map(stageToDecaid),
    target_volume_count_start: draft.targetVolumeCountStart,
    tank_temperature: draft.tankTemperature,
  }
  if (draft.version === undefined) delete profile.version
  else profile.version = draft.version
  if (draft.targetVolume === undefined) delete profile.target_volume
  else profile.target_volume = draft.targetVolume
  if (draft.targetWeight === undefined) delete profile.target_weight
  else profile.target_weight = draft.targetWeight
  return profile
}

export function createDefaultProfileDraft(): ProfileDraft {
  return {
    version: '2.1',
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

function stageMaximumDurationMs(stage: BuilderStage) {
  const seconds = Number(stage.seconds)
  return Number.isFinite(seconds) ? Math.max(0, seconds) * 1000 : 0
}

export function profileMaximumDurationMs(stages: BuilderStage[]) {
  return stages.reduce((total, stage) => total + stageMaximumDurationMs(stage), 0)
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
    const stageEndMs = elapsedMs + stageMaximumDurationMs(stage)

    points.push({ elapsedMs, pressure, flow, temperature })
    if (stage.transition === 'fast') points.push({ elapsedMs, pressure: nextPressure, flow: nextFlow, temperature: stage.temperature })
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
