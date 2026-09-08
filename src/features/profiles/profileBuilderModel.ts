import type { DecaidProfile, DecaidProfileStep } from '../../api/decaid/types'
import { profileStepsToTargetPoints } from '../../api/decaid/profileTargetPoints.ts'
import type { ProfileTargetPoint } from '../../domain/brewing'

export type BuilderPump = 'pressure' | 'flow'
export type BuilderTransition = 'fast' | 'smooth'
export type BuilderSensor = 'coffee' | 'water'
export type BuilderExitType = 'pressure' | 'flow'
export type BuilderExitCondition = 'over' | 'under'
export type BuilderMode = 'create' | 'edit' | 'import'

export interface BuilderImportIssue {
  id: string
  severity: 'error' | 'warning'
  message: string
  field: string
  stageId?: string
}

export interface BuilderThreshold {
  type: BuilderExitType
  condition: BuilderExitCondition
  value: number
}

export interface BuilderLimiter {
  type: BuilderExitType
  value: number
  range?: number
}

export type BuilderPumpMemory = Partial<Record<BuilderPump, number>>

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
  importIssues?: BuilderImportIssue[]
}

export function builderPumpMemory(stage: BuilderStage): BuilderPumpMemory {
  return {
    [stage.pump]: stage.target,
    ...(stage.limiter && stage.limiter.value > 0 ? { [stage.limiter.type]: stage.limiter.value } : {}),
  }
}

export function switchBuilderPump(stage: BuilderStage, pump: BuilderPump, remembered: BuilderPumpMemory) {
  const memory: BuilderPumpMemory = {
    ...remembered,
    [stage.pump]: stage.target,
    ...(stage.limiter && stage.limiter.value > 0 ? { [stage.limiter.type]: stage.limiter.value } : {}),
  }
  if (pump === stage.pump) return { patch: {}, memory }

  const target = memory[pump] ?? (pump === 'pressure' ? 9 : 2)
  memory[pump] = target
  return {
    memory,
    patch: {
      pump,
      target,
      limiter: stage.limiter
        ? { type: stage.pump, value: stage.target, range: stage.limiter.range }
        : stage.limiter,
    } satisfies Partial<BuilderStage>,
  }
}

let builderStageIdSequence = 0

function nextBuilderStageId(prefix: string, index: number) {
  builderStageIdSequence += 1
  return `${prefix}-${Date.now()}-${index}-${builderStageIdSequence}`
}

export function duplicateBuilderStage(stage: BuilderStage, index: number): BuilderStage {
  return {
    ...stage,
    id: nextBuilderStageId('stage-copy', index),
    name: `${stage.name} copy`,
    exit: stage.exit ? { ...stage.exit } : stage.exit,
    limiter: stage.limiter ? { ...stage.limiter } : stage.limiter,
    ...(stage.source ? { source: structuredClone(stage.source) } : {}),
  }
}

export function moveBuilderStage(stages: BuilderStage[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= stages.length || toIndex >= stages.length) return stages
  const reordered = [...stages]
  const [stage] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, stage)
  return reordered
}

export function stageIndexAfterMove(index: number | null, fromIndex: number, toIndex: number) {
  if (index === null || fromIndex === toIndex) return index
  if (index === fromIndex) return toIndex
  if (fromIndex < toIndex && index > fromIndex && index <= toIndex) return index - 1
  if (fromIndex > toIndex && index >= toIndex && index < fromIndex) return index + 1
  return index
}

export function volumeCountStartAfterDelete(currentIndex: number, deletedIndex: number, remainingStageCount: number, volumeFallbackActive: boolean) {
  if (currentIndex === deletedIndex) return volumeFallbackActive ? -1 : Math.min(deletedIndex, remainingStageCount - 1)
  if (currentIndex > deletedIndex) return currentIndex - 1
  return currentIndex
}

const numeric = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.abs(parsed) < 1e-9 ? 0 : parsed : fallback
}

const optionalNumeric = (value: unknown) => {
  if (value === null) return null
  if (value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.abs(parsed) < 1e-9 ? 0 : parsed : undefined
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

function isNumeric(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNumericLike(value: unknown) {
  if (isNumeric(value)) return true
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
}

function stageFromDecaid(step: DecaidProfileStep, index: number, importIssues: BuilderImportIssue[]): BuilderStage {
  const stageId = `source-stage-${index}`
  const addIssue = (severity: BuilderImportIssue['severity'], field: string, message: string) => importIssues.push({
    id: `import-stage-${index}-${field}`,
    severity,
    message,
    field,
    stageId,
  })
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

  if (declaredPump !== 'pressure' && declaredPump !== 'flow') addIssue('error', 'pump', 'Choose pressure or flow control.')
  if (transitionValue !== 'fast' && transitionValue !== 'smooth') addIssue('error', 'transition', 'Choose a fast or smooth transition.')
  if (step.sensor !== 'coffee' && step.sensor !== 'water') addIssue('error', 'sensor', 'Choose the coffee or water temperature sensor.')
  const targetValue = pump === 'pressure' ? step.pressure ?? pumpObject?.pressure : step.flow ?? pumpObject?.flow
  for (const [field, value] of [['target', targetValue], ['temperature', step.temperature], ['seconds', step.seconds ?? step.duration], ['volume', step.volume]] as const) {
    if (!isNumericLike(value)) addIssue('error', field, `${field === 'target' ? 'The stage target' : field[0].toUpperCase() + field.slice(1)} must be a number.`)
  }
  if (step.exit !== undefined && step.exit !== null) {
    if (step.exit.type !== 'pressure' && step.exit.type !== 'flow') addIssue('error', 'exit', 'Choose a supported pressure or flow move-on condition.')
    if (step.exit.condition !== 'over' && step.exit.condition !== 'under') addIssue('error', 'exit', 'Choose whether the move-on value is over or under the threshold.')
    if (!isNumericLike(step.exit.value)) addIssue('error', 'exit', 'The move-on threshold must be a number.')
  }
  if (step.limiter !== undefined && step.limiter !== null) {
    if (!isNumericLike(step.limiter.value)) addIssue('error', 'limiter', 'The limiter value must be a number.')
    if (!isNumericLike(step.limiter.range)) addIssue('error', 'limiter', 'The limiter response range is required and must be a number.')
  }

  return {
    id: stageId,
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
    limiter: step.limiter === null ? null : typeof limiterValue === 'number' ? {
      type: pump === 'pressure' ? 'flow' : 'pressure',
      value: limiterValue,
      ...(typeof limiterRange === 'number' ? { range: limiterRange } : {}),
    } : undefined,
    source: { ...step },
  }
}

export function profileDraftFromDecaidProfile(profile: DecaidProfile, options: {
  mode: Extract<BuilderMode, 'edit' | 'import'>
  sourceProfileId?: string
  sourceMetadata?: Record<string, unknown> | null
  existingTitles?: string[]
  copyName?: boolean
}): ProfileDraft {
  const importIssues: BuilderImportIssue[] = []
  const addProfileIssue = (severity: BuilderImportIssue['severity'], field: string, message: string) => importIssues.push({ id: `import-profile-${field}`, severity, message, field })
  const parsedTitle = splitBuilderProfileTitle(profile.title, profile.category)
  const beverageType = profile.beverage_type
  const validBeverageType = beverageType === 'calibrate' || beverageType === 'cleaning' || beverageType === 'manual' || beverageType === 'pourover' ? beverageType : 'espresso'
  if (typeof profile.title !== 'string' || !profile.title.trim()) addProfileIssue('error', 'title', 'Enter a profile name.')
  if (beverageType !== undefined && !['espresso', 'calibrate', 'cleaning', 'manual', 'pourover'].includes(String(beverageType))) addProfileIssue('error', 'beverageType', 'Choose a supported beverage type.')
  for (const [field, value, label] of [
    ['targetVolumeCountStart', profile.target_volume_count_start, 'Volume count start'],
    ['tankTemperature', profile.tank_temperature, 'Tank temperature'],
  ] as const) {
    if (!isNumericLike(value)) addProfileIssue('error', field, `${label} is required and must be a number.`)
  }
  return {
    version: profile.version,
    title: options.copyName === false
      ? parsedTitle.title
      : copiedProfileName(parsedTitle.title, parsedTitle.category, options.existingTitles ?? []),
    category: parsedTitle.category,
    beverageType: validBeverageType,
    author: typeof profile.author === 'string' ? profile.author : '',
    notes: typeof profile.notes === 'string' ? profile.notes : '',
    targetWeight: optionalNumeric(profile.target_weight),
    targetVolume: optionalNumeric(profile.target_volume),
    targetVolumeCountStart: numeric(profile.target_volume_count_start),
    tankTemperature: numeric(profile.tank_temperature),
    stages: profile.steps?.map((step, index) => stageFromDecaid(step, index, importIssues)) ?? [],
    sourceProfile: { ...profile, steps: profile.steps?.map((step) => ({ ...step })) },
    sourceProfileId: options.sourceProfileId,
    sourceMetadata: options.sourceMetadata,
    ...(importIssues.length ? { importIssues } : {}),
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
  else serialized.limiter = stage.limiter ? {
    value: stage.limiter.value,
    ...(typeof stage.limiter.range === 'number' ? { range: stage.limiter.range } : {}),
  } : null
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
  return profileStepsToTargetPoints(stages.map(stageToDecaid))
}

export function nextBuilderStage(index: number): BuilderStage {
  return {
    id: nextBuilderStageId('stage', index),
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
