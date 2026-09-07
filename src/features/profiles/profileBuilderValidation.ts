import type { DecaidProfile } from '../../api/decaid/types'
import { profileDraftToDecaidProfile } from './profileBuilderModel.ts'
import type { BuilderStage, ProfileDraft } from './profileBuilderModel.ts'

export type ProfileBuilderIssueSeverity = 'error' | 'warning'
export type ProfileBuilderIssuePanel = 'profile' | 'target' | 'conditions'

export interface ProfileBuilderIssue {
  id: string
  severity: ProfileBuilderIssueSeverity
  message: string
  field: string
  panel: ProfileBuilderIssuePanel
  stageId?: string
  stageIndex?: number
}

export interface ProfileBuilderValidation {
  issues: ProfileBuilderIssue[]
  errors: ProfileBuilderIssue[]
  warnings: ProfileBuilderIssue[]
  canSave: boolean
}

const MAX_STAGES = 20
const MAX_AXIS_VALUE = 15.9
const MAX_TEMPERATURE = 127.5
const MAX_STAGE_SECONDS = 127
const MAX_STAGE_VOLUME = 1023
const MAX_SOFTWARE_TARGET = 10_000

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function stagePanel(field: string): ProfileBuilderIssuePanel {
  return field === 'exit' || field === 'weight' || field === 'volume' ? 'conditions' : 'target'
}

function pushRangeIssue(
  issues: ProfileBuilderIssue[],
  stage: BuilderStage,
  stageIndex: number,
  field: string,
  label: string,
  value: unknown,
  minimum: number,
  maximum: number,
  issueKey = field,
) {
  if (!finite(value)) {
    issues.push({ id: `${stage.id}-${issueKey}-number`, severity: 'error', message: `${label} must be a number.`, field, panel: stagePanel(field), stageId: stage.id, stageIndex })
    return
  }
  if (value < minimum || value > maximum) {
    issues.push({ id: `${stage.id}-${issueKey}-range`, severity: 'error', message: `${label} must be between ${minimum} and ${maximum}.`, field, panel: stagePanel(field), stageId: stage.id, stageIndex })
  }
}

function expectedAxisAtStageStart(stages: BuilderStage[], stageIndex: number, axis: 'pressure' | 'flow') {
  if (stageIndex === 0) return 0
  const previous = stages[stageIndex - 1]
  if (previous.pump === axis) return previous.target
  if (previous.limiter?.type === axis && finite(previous.limiter.value) && previous.limiter.value > 0) return previous.limiter.value
  return 0
}

function axisDescription(axis: 'pressure' | 'flow', value: number) {
  return `${value} ${axis === 'pressure' ? 'bar' : 'ml/s'}`
}

function durationDescription(seconds: number) {
  return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`
}

function validateSerializedProfile(profile: DecaidProfile) {
  if (typeof profile.title !== 'string' || !profile.title.trim()) return 'The generated profile has no name.'
  if (!Array.isArray(profile.steps) || profile.steps.length === 0) return 'The generated profile has no stages.'
  if (!Number.isInteger(profile.target_volume_count_start)) return 'The generated volume-count start is not an integer.'
  if (!finite(profile.tank_temperature)) return 'The generated tank temperature is invalid.'
  for (const step of profile.steps) {
    if (!step || typeof step !== 'object') return 'The generated profile contains an invalid stage.'
    if (step.pump !== 'pressure' && step.pump !== 'flow') return 'The generated profile contains an unsupported pump mode.'
    if (step.transition !== 'fast' && step.transition !== 'smooth') return 'The generated profile contains an unsupported transition.'
    if (step.sensor !== 'coffee' && step.sensor !== 'water') return 'The generated profile contains an unsupported temperature sensor.'
    if (!finite(step.seconds) || !finite(step.volume) || !finite(step.temperature)) return 'The generated profile contains a missing stage value.'
    if (step.pump === 'pressure' ? !finite(step.pressure) : !finite(step.flow)) return 'The generated profile is missing its controlled-axis target.'
    if (step.exit !== undefined && step.exit !== null && (step.exit.type !== 'pressure' && step.exit.type !== 'flow' || step.exit.condition !== 'over' && step.exit.condition !== 'under' || !finite(step.exit.value))) return 'The generated profile contains an invalid move-on condition.'
    if (step.limiter !== undefined && step.limiter !== null && (!finite(step.limiter.value) || !finite(step.limiter.range))) return 'The generated profile contains an invalid limiter.'
  }
  try {
    const roundTrip = JSON.parse(JSON.stringify(profile)) as DecaidProfile
    if (JSON.stringify(roundTrip) !== JSON.stringify(profile)) return 'The profile cannot be round-tripped without changing its data.'
  } catch {
    return 'The profile cannot be encoded as Decaid-compatible JSON.'
  }
  return null
}

export function validateProfileDraft(draft: ProfileDraft): ProfileBuilderValidation {
  const issues: ProfileBuilderIssue[] = []
  const addProfile = (severity: ProfileBuilderIssueSeverity, id: string, field: string, message: string) => issues.push({ id, severity, field, message, panel: 'profile' })
  const addStage = (severity: ProfileBuilderIssueSeverity, stage: BuilderStage, stageIndex: number, id: string, field: string, message: string) => issues.push({ id: `${stage.id}-${id}`, severity, field, message, panel: stagePanel(field), stageId: stage.id, stageIndex })

  if (!draft.title.trim()) addProfile('error', 'profile-title', 'title', 'Enter a profile name.')
  if (!draft.stages.length) addProfile('error', 'profile-stages', 'stages', 'Add at least one brew stage.')
  if (draft.stages.length > MAX_STAGES) addProfile('error', 'profile-stage-count', 'stages', `Decent profiles support up to ${MAX_STAGES} stages.`)
  if (!['espresso', 'calibrate', 'cleaning', 'manual', 'pourover'].includes(draft.beverageType)) addProfile('error', 'profile-beverage', 'beverageType', 'Choose a supported beverage type.')
  if (!finite(draft.tankTemperature)) addProfile('error', 'profile-tank-temperature', 'tankTemperature', 'Tank temperature must be a number.')
  if (!Number.isInteger(draft.targetVolumeCountStart)) addProfile('error', 'profile-volume-start-integer', 'targetVolumeCountStart', 'Volume count start must be a whole stage number.')
  if (finite(draft.targetWeight) && (draft.targetWeight < 0 || draft.targetWeight > MAX_SOFTWARE_TARGET)) addProfile('error', 'profile-target-weight-range', 'targetWeight', `End shot yield must be between 0 and ${MAX_SOFTWARE_TARGET} g.`)
  if (finite(draft.targetVolume) && (draft.targetVolume < 0 || draft.targetVolume > MAX_SOFTWARE_TARGET)) addProfile('error', 'profile-target-volume-range', 'targetVolume', `End shot volume fallback must be between 0 and ${MAX_SOFTWARE_TARGET} ml.`)

  const volumeFallbackActive = finite(draft.targetVolume) && draft.targetVolume > 0
  if (volumeFallbackActive && (draft.targetVolumeCountStart < 0 || draft.targetVolumeCountStart >= draft.stages.length)) {
    addProfile('error', 'profile-volume-start-range', 'targetVolumeCountStart', 'Choose where volume measurement starts. The previously selected step no longer exists.')
  }
  if (!(finite(draft.targetWeight) && draft.targetWeight > 0) && !volumeFallbackActive) {
    addProfile('warning', 'profile-no-final-target', 'targetWeight', 'No final stop amount is set. This recipe will finish through its steps, or when you stop it manually.')
  }

  draft.stages.forEach((stage, stageIndex) => {
    if (!stage.name.trim()) addStage('warning', stage, stageIndex, 'name-empty', 'name', 'Name this step. A short name will make it easier to recognise.')
    if (stage.pump !== 'pressure' && stage.pump !== 'flow') addStage('error', stage, stageIndex, 'pump', 'pump', 'Choose pressure or flow control.')
    if (stage.transition !== 'fast' && stage.transition !== 'smooth') addStage('error', stage, stageIndex, 'transition', 'transition', 'Choose a fast or smooth transition.')
    if (stage.sensor !== 'coffee' && stage.sensor !== 'water') addStage('error', stage, stageIndex, 'sensor', 'sensor', 'Choose the coffee or water temperature sensor.')
    pushRangeIssue(issues, stage, stageIndex, 'target', `${stage.pump === 'pressure' ? 'Pressure' : 'Flow'} target`, stage.target, 0, MAX_AXIS_VALUE)
    pushRangeIssue(issues, stage, stageIndex, 'temperature', 'Temperature', stage.temperature, 0, MAX_TEMPERATURE)
    pushRangeIssue(issues, stage, stageIndex, 'seconds', 'Maximum time', stage.seconds, 0, MAX_STAGE_SECONDS)
    pushRangeIssue(issues, stage, stageIndex, 'volume', 'Stage volume', stage.volume, 0, MAX_STAGE_VOLUME)
    if (stage.weight !== undefined && stage.weight !== null) pushRangeIssue(issues, stage, stageIndex, 'weight', 'Move on yield', stage.weight, 0, MAX_SOFTWARE_TARGET)

    if (stage.exit) {
      if (stage.exit.type !== 'pressure' && stage.exit.type !== 'flow') addStage('error', stage, stageIndex, 'exit-type', 'exit', 'Choose a pressure or flow move-on condition.')
      if (stage.exit.condition !== 'over' && stage.exit.condition !== 'under') addStage('error', stage, stageIndex, 'exit-condition', 'exit', 'Choose whether the reading moves over or under the threshold.')
      pushRangeIssue(issues, stage, stageIndex, 'exit', 'Move-on threshold', stage.exit.value, 0, MAX_AXIS_VALUE)
      if (stage.limiter?.type === stage.exit.type && stage.exit.condition === 'over' && stage.exit.value > stage.limiter.value) {
        const axisName = stage.exit.type === 'pressure' ? 'Pressure' : 'Flow'
        addStage('warning', stage, stageIndex, 'exit-beyond-limiter', 'exit', `One move-on condition may not work. ${axisName} is limited to ${axisDescription(stage.exit.type, stage.limiter.value)}, so “above ${axisDescription(stage.exit.type, stage.exit.value)}” probably won't be reached. This step will still move on after ${durationDescription(stage.seconds)} or when another condition is met.`)
      }
      const expectedAtStart = expectedAxisAtStageStart(draft.stages, stageIndex, stage.exit.type)
      if (stage.exit.condition === 'over' ? expectedAtStart >= stage.exit.value : expectedAtStart <= stage.exit.value) {
        addStage('warning', stage, stageIndex, 'exit-already-met', 'exit', `This step may be skipped. It may begin around ${axisDescription(stage.exit.type, expectedAtStart)}, which already meets the move-on condition.`)
      }
    }
    if (stage.limiter) {
      const expectedLimiterType = stage.pump === 'pressure' ? 'flow' : 'pressure'
      if (stage.limiter.type !== expectedLimiterType) addStage('error', stage, stageIndex, 'limiter-type', 'limiter', `A ${stage.pump}-controlled stage can only limit ${expectedLimiterType}.`)
      pushRangeIssue(issues, stage, stageIndex, 'limiter', 'Limiter value', stage.limiter.value, 0, MAX_AXIS_VALUE, 'limiter-value')
      pushRangeIssue(issues, stage, stageIndex, 'limiter', 'Limiter response range', stage.limiter.range, 0, MAX_AXIS_VALUE, 'limiter-response')
    }
  })

  for (const sourceIssue of draft.importIssues ?? []) {
    issues.push({
      ...sourceIssue,
      panel: sourceIssue.stageId ? stagePanel(sourceIssue.field) : 'profile',
      stageIndex: sourceIssue.stageId ? draft.stages.findIndex((stage) => stage.id === sourceIssue.stageId) : undefined,
    })
  }

  try {
    const serialized = profileDraftToDecaidProfile(draft)
    const schemaError = validateSerializedProfile(serialized)
    if (schemaError && !issues.some((issue) => issue.severity === 'error')) addProfile('error', 'profile-round-trip', 'profile', schemaError)
  } catch {
    addProfile('error', 'profile-round-trip', 'profile', 'The profile cannot be converted to Decaid format without changing its data.')
  }

  const uniqueIssues = [...new Map(issues.map((issue) => [issue.id, issue])).values()]
  const errors = uniqueIssues.filter((issue) => issue.severity === 'error')
  const warnings = uniqueIssues.filter((issue) => issue.severity === 'warning')
  return { issues: uniqueIssues, errors, warnings, canSave: errors.length === 0 }
}

export function issueSummary(validation: ProfileBuilderValidation) {
  const parts: string[] = []
  if (validation.errors.length) parts.push(`${validation.errors.length} ${validation.errors.length === 1 ? 'error' : 'errors'}`)
  if (validation.warnings.length) parts.push(`${validation.warnings.length} ${validation.warnings.length === 1 ? 'warning' : 'warnings'}`)
  return parts.join(' · ') || 'Ready to save'
}
