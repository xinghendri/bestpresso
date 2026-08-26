import type { BrewProfile, BrewingScreenModel, PreviousShot, ProfileTargetPoint } from '../../domain/brewing'
import type { DecaidProfileRecord, DecaidProfileStep, DecaidWorkflow, FavoriteAssignments, MachineSnapshot, ShotRecord } from './types'

const MM_TO_ML = [0,16,43,70,97,124,151,179,206,233,261,288,316,343,371,398,426,453,481,509,537,564,592,620,648,676,704,732,760,788,816,844,872,900,929,957,985,1013,1042,1070,1104,1138,1172,1207,1242,1277,1312,1347,1382,1417,1453,1488,1523,1559,1594,1630,1665,1701,1736,1772,1808,1843,1879,1915,1951,1986,2022,2058]
export const STEAM_HEATER_READY_C = 130

const numberString = (value: unknown, fallback: string) => value === null || value === undefined || value === '' || Number.isNaN(Number(value)) ? fallback : String(value)
const finiteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const textValue = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim()
const ESPRESSO_EXTRACTION_SUBSTATES = new Set(['preinfusion', 'pouring'])

export function isEspressoExtractionSnapshot(snapshot: Pick<MachineSnapshot, 'state'>) {
  const state = (typeof snapshot.state === 'string' ? snapshot.state : snapshot.state?.state)?.toLowerCase()
  const substate = (typeof snapshot.state === 'object' ? snapshot.state?.substate : undefined)?.toLowerCase()
  if (state && state !== 'espresso') return false
  if (substate) return ESPRESSO_EXTRACTION_SUBSTATES.has(substate)
  return state === 'espresso'
}

export function shotStage(profileFrame: number | undefined, substate: string | undefined, stepNames: string[] | undefined) {
  const frame = typeof profileFrame === 'number' && Number.isFinite(profileFrame)
    ? Math.max(0, Math.floor(profileFrame))
    : undefined
  const configuredName = frame === undefined ? undefined : stepNames?.[frame]?.trim()
  if (configuredName) return { stageIndex: frame, stageName: configuredName.replaceAll('_', ' ') }

  const normalizedSubstate = substate?.toLowerCase()
  const stageName = normalizedSubstate === 'preinfusion'
    ? 'Pre-infusion'
    : normalizedSubstate === 'pouringdone'
      ? 'Cooling'
      : normalizedSubstate === 'pouring'
        ? 'Extraction'
        : frame === undefined ? 'Extraction' : `Stage ${frame + 1}`
  return { stageIndex: frame, stageName }
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

  for (const step of steps) {
    const pump = typeof step.pump === 'object' && step.pump !== null ? step.pump : undefined
    const pressureValue = finiteNumber(pump?.pressure) ?? finiteNumber(step.pressure)
    const flowValue = finiteNumber(pump?.flow) ?? finiteNumber(step.flow)
    const pressure = pressureValue === -1 ? previousPressure : pressureValue ?? previousPressure
    const flow = flowValue === -1 ? previousFlow : flowValue ?? previousFlow
    const durationMs = Math.max(0, (finiteNumber(step.seconds) ?? finiteNumber(step.duration) ?? 0) * 1000)
    const transition = step.transition
    const transitionType = typeof transition === 'string' ? transition : transition?.type ?? 'instant'
    const smoothLegacyTransition = transitionType === 'smooth'
    const rampDurationMs = smoothLegacyTransition
      ? durationMs
      : transitionType === 'fast' || transitionType === 'instant'
        ? 0
        : Math.min(durationMs, Math.max(0, (finiteNumber(typeof transition === 'object' ? transition.duration : undefined) ?? 0) * 1000))

    points.push({ elapsedMs, pressure: previousPressure, flow: previousFlow })
    if (rampDurationMs > 0) {
      const samples = 8
      for (let sample = 1; sample <= samples; sample += 1) {
        const rawProgress = sample / samples
        const progress = transitionProgress(smoothLegacyTransition ? 'linear' : transitionType, rawProgress)
        points.push({
          elapsedMs: elapsedMs + rampDurationMs * rawProgress,
          pressure: previousPressure + (pressure - previousPressure) * progress,
          flow: previousFlow + (flow - previousFlow) * progress,
        })
      }
    } else {
      points.push({ elapsedMs, pressure, flow })
    }
    elapsedMs += durationMs
    points.push({ elapsedMs, pressure, flow })
    previousPressure = pressure
    previousFlow = flow
  }

  return points
}

export function parseProfileTitle(title: string | undefined) {
  const fullTitle = title?.trim() || 'Untitled profile'
  const separatorIndex = fullTitle.indexOf('/')
  if (separatorIndex < 0) return { name: fullTitle, category: undefined }

  const category = fullTitle.slice(0, separatorIndex).trim()
  const name = fullTitle.slice(separatorIndex + 1).trim()
  if (!category || !name) return { name: fullTitle, category: undefined }

  return {
    name,
    category: category.toLowerCase() === 'popular' ? undefined : category,
  }
}

export function profilesWithParsedTitles(profiles: BrewProfile[]): BrewProfile[] {
  return sortProfilesForDirectory(profiles.map((profile) => ({ ...profile, ...parseProfileTitle(profile.name) })))
}

export const isCleaningProfile = (profile: Pick<BrewProfile, 'beverageType'>) => profile.beverageType?.toLowerCase() === 'cleaning'

export function sortProfilesForDirectory(profiles: BrewProfile[]) {
  return profiles
    .map((profile, index) => ({ profile, index }))
    .sort((left, right) => Number(isCleaningProfile(left.profile)) - Number(isCleaningProfile(right.profile)) || left.index - right.index)
    .map(({ profile }) => profile)
}

export function profileRecordsToDomain(records: DecaidProfileRecord[], workflow: DecaidWorkflow, fallback: BrewProfile[]) {
  const visible = records.filter((record) => record.visibility !== 'hidden' && record.visibility !== 'deleted' && record.profile?.title)
  if (!visible.length) return profilesWithParsedTitles(fallback)
  return sortProfilesForDirectory(visible.map((record): BrewProfile => {
    const profile = record.profile ?? {}
    const metadata = record.metadata ?? {}
    const isActive = profile.title === workflow.profile?.title
    const parsedTitle = parseProfileTitle(profile.title)
    return {
      id: record.id || profile.title || crypto.randomUUID(),
      name: parsedTitle.name,
      category: parsedTitle.category,
      beverageType: profile.beverage_type,
      description: textValue(metadata.description, metadata.profileDescription, metadata.notes, metadata.profileNotes, metadata.profile_notes, profile.description, profile.notes, profile.profile_notes),
      temperature: numberString(isActive ? workflow.profile?.steps?.[0]?.temperature : metadata.temperature ?? profile.steps?.[0]?.temperature, '—'),
      grindSetting: numberString(isActive ? workflow.context?.grinderSetting : metadata.grinderSetting, '—'),
      dose: numberString(isActive ? workflow.context?.targetDoseWeight : metadata.targetDoseWeight ?? profile.dose_weight, '18'),
      targetYield: numberString(isActive ? workflow.context?.targetYield : metadata.targetYield ?? profile.target_weight, '—'),
      targetPoints: profileStepsToTargetPoints(isActive ? workflow.profile?.steps : profile.steps),
      stepNames: (isActive ? workflow.profile?.steps : profile.steps)?.map((step, index) => textValue(step.name) ?? `Stage ${index + 1}`),
    }
  }))
}

export function activeProfileForWorkflow(profiles: BrewProfile[], records: DecaidProfileRecord[], workflow: DecaidWorkflow) {
  const activeRecord = records.find((record) => record.profile?.title === workflow.profile?.title)
  if (activeRecord?.id) {
    const activeById = profiles.find((profile) => profile.id === activeRecord.id)
    if (activeById) return activeById
  }
  const activeTitle = parseProfileTitle(workflow.profile?.title)
  return profiles.find((profile) => profile.name === activeTitle.name && profile.category === activeTitle.category)
}

export function favoriteProfiles(profiles: BrewProfile[], assignments: FavoriteAssignments | null) {
  return favoriteProfileSlots(profiles, assignments)
    .map((id) => profiles.find((profile) => profile.id === id))
    .filter((profile): profile is BrewProfile => Boolean(profile))
}

export function favoriteProfileSlots(profiles: BrewProfile[], assignments: FavoriteAssignments | null) {
  if (assignments === null) {
    return Array.from({ length: 5 }, (_, slot) => profiles[slot]?.id ?? null)
  }
  const seen = new Set<string>()
  return Array.from({ length: 5 }, (_, slot) => {
    const id = assignments[slot]
    if (!id || seen.has(id) || !profiles.some((profile) => profile.id === id)) return null
    seen.add(id)
    return id
  })
}

export function carouselProfiles(profiles: BrewProfile[], assignments: FavoriteAssignments | null, activeProfileId?: string, retainedAdHocProfileId?: string | null) {
  const favorites = favoriteProfiles(profiles, assignments)
  const inferredAdHocProfileId = activeProfileId && !favorites.some((profile) => profile.id === activeProfileId)
    ? activeProfileId
    : undefined
  const adHocProfileId = retainedAdHocProfileId === undefined ? inferredAdHocProfileId : retainedAdHocProfileId ?? undefined
  const adHocProfile = adHocProfileId ? profiles.find((profile) => profile.id === adHocProfileId) : undefined
  return adHocProfile && !favorites.some((profile) => profile.id === adHocProfile.id)
    ? [...favorites, adHocProfile]
    : favorites
}

export function retainedAdHocProfileAtBrewStart(activeProfileId: string | undefined, retainedAdHocProfileId: string | null) {
  return retainedAdHocProfileId && activeProfileId === retainedAdHocProfileId ? retainedAdHocProfileId : null
}

export function applyWorkflow(model: BrewingScreenModel, workflow: DecaidWorkflow, records: DecaidProfileRecord[], assignments: FavoriteAssignments | null = null, retainedAdHocProfileId?: string | null) {
  const allProfiles = profileRecordsToDomain(records, workflow, model.profiles)
  const active = activeProfileForWorkflow(allProfiles, records, workflow)
  const profiles = carouselProfiles(allProfiles, assignments, active?.id, retainedAdHocProfileId)
  const utilities = model.utilities.map((utility) => {
    if (utility.id === 'water') return { ...utility, metrics: utility.metrics.map((metric) => metric.label === 'Volume' ? { ...metric, value: numberString(workflow.hotWaterData?.volume, metric.value) } : { ...metric, value: numberString(workflow.hotWaterData?.targetTemperature, metric.value) }) }
    if (utility.id === 'steam') return { ...utility, metrics: utility.metrics.map((metric) => metric.label === 'Target' ? { ...metric, value: numberString(workflow.steamSettings?.targetTemperature, metric.value) } : metric.label === 'Duration' ? { ...metric, value: numberString(workflow.steamSettings?.duration, metric.value) } : metric.label === 'Flow' ? { ...metric, value: numberString(workflow.steamSettings?.flow, metric.value) } : metric) }
    return utility
  })
  return { ...model, profiles, activeProfileId: active?.id ?? profiles[0]?.id, utilities }
}

export function tankMillilitres(level: number) {
  const index = Math.max(0, Math.floor(level))
  return MM_TO_ML[Math.min(index, MM_TO_ML.length - 1)]
}

export function tankSensorLevelForMillilitres(volume: number) {
  const index = MM_TO_ML.findIndex((millilitres) => millilitres >= volume)
  return index === -1 ? MM_TO_ML.length - 1 : index
}

export function shotToDomain(shot: ShotRecord): PreviousShot {
  const measurements = shot.measurements ?? []
  const hasMachineSubstates = measurements.some((entry) => entry.machine?.state?.substate)
  const extraction = hasMachineSubstates
    ? measurements.filter((entry) => ESPRESSO_EXTRACTION_SUBSTATES.has(entry.machine?.state?.substate?.toLowerCase() ?? ''))
    : measurements
  const firstTimestamp = extraction[0]?.machine?.timestamp
  const lastTimestamp = extraction.at(-1)?.machine?.timestamp
  const duration = firstTimestamp && lastTimestamp ? Math.max(0, Math.round((Date.parse(lastTimestamp) - Date.parse(firstTimestamp)) / 1000)) : undefined
  const lastWeight = [...extraction].reverse().find((entry) => entry.scale?.weight !== undefined)?.scale?.weight
  const startedAt = firstTimestamp ? Date.parse(firstTimestamp) : Number.NaN
  const stepNames = shot.workflow?.profile?.steps?.map((step, index) => textValue(step.name) ?? `Stage ${index + 1}`)
  const points = Number.isFinite(startedAt) ? extraction.flatMap((entry) => {
    const timestamp = entry.machine?.timestamp ? Date.parse(entry.machine.timestamp) : Number.NaN
    if (!Number.isFinite(timestamp)) return []
    return [{
      elapsedMs: Math.max(0, timestamp - startedAt),
      pressure: entry.machine?.pressure,
      flow: entry.machine?.flow,
      targetPressure: entry.machine?.targetPressure,
      targetFlow: entry.machine?.targetFlow,
      temperature: entry.machine?.mixTemperature ?? entry.machine?.groupTemperature,
      weight: entry.scale?.weight,
      weightFlow: entry.scale?.weightFlow,
      ...shotStage(entry.machine?.profileFrame, entry.machine?.state?.substate, stepNames),
    }]
  }) : []
  const shotProfileTitle = shot.workflow?.profile?.title || shot.workflow?.name || 'Previous pull'
  return {
    id: shot.id,
    profileName: parseProfileTitle(shotProfileTitle).name,
    timestamp: shot.timestamp ?? firstTimestamp ?? lastTimestamp,
    totalYield: numberString(shot.annotations?.actualYield ?? lastWeight, '—'),
    totalTime: numberString(duration, '—'),
    targetYield: shot.workflow?.context?.targetYield ?? shot.workflow?.profile?.target_weight ?? undefined,
    points,
  }
}
