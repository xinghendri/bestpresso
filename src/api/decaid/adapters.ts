import type { BrewProfile, BrewingScreenModel, PreviousShot } from '../../domain/brewing.ts'
import { createId } from '../../utils/browserCompatibility.ts'
import { reconcileStageReasons } from '../../features/brew/stageMoveOn.ts'
import { sourceForRecord } from '../../features/profiles/profileLibraryModel.ts'
import { isSteamHeatingEnabled } from '../../features/machine/steamHeating.ts'
import { t } from '../../i18n/index.ts'
import { profileStepsToTargetPoints } from './profileTargetPoints.ts'
import { profileConfiguredTargetYield, profileTargetYield } from './profileWorkflow.ts'
import type { DecaidProfileRecord, DecaidWorkflow, FavoriteAssignments, ShotRecord } from './types.ts'

const MM_TO_ML = [0,16,43,70,97,124,151,179,206,233,261,288,316,343,371,398,426,453,481,509,537,564,592,620,648,676,704,732,760,788,816,844,872,900,929,957,985,1013,1042,1070,1104,1138,1172,1207,1242,1277,1312,1347,1382,1417,1453,1488,1523,1559,1594,1630,1665,1701,1736,1772,1808,1843,1879,1915,1951,1986,2022,2058]
export const STEAM_HEATER_READY_C = 130

const numberString = (value: unknown, fallback: string) => value === null || value === undefined || value === '' || Number.isNaN(Number(value)) ? fallback : String(value)
const finiteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const textValue = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim()
const ESPRESSO_EXTRACTION_SUBSTATES = new Set(['preinfusion', 'pouring'])
export function shotStage(profileFrame: number | undefined, substate: string | undefined, stepNames: string[] | undefined) {
  const frame = typeof profileFrame === 'number' && Number.isFinite(profileFrame)
    ? Math.max(0, Math.floor(profileFrame))
    : undefined
  const configuredName = frame === undefined ? undefined : stepNames?.[frame]?.trim()
  if (configuredName) return { stageIndex: frame, stageName: configuredName.replaceAll('_', ' ') }

  const normalizedSubstate = substate?.toLowerCase()
  const stageNameFallback = normalizedSubstate === 'preinfusion' ? 'preinfusion' as const
    : normalizedSubstate === 'pouringdone' ? 'cooling' as const
      : normalizedSubstate === 'pouring' || frame === undefined ? 'extraction' as const : 'stageNumber' as const
  const stageName = stageNameFallback === 'stageNumber' ? `Stage ${frame! + 1}`
    : { preinfusion: 'Pre-infusion', cooling: 'Cooling', extraction: 'Extraction' }[stageNameFallback]
  return { stageIndex: frame, stageName, stageNameFallback }
}

export { profileStepsToTargetPoints }

export function parseProfileTitle(title: string | undefined) {
  const fullTitle = title?.trim() || t('shell.profile.untitled')
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

export const isCleaningProfile = (profile: Pick<BrewProfile, 'beverageType' | 'category'>) => (
  profile.beverageType?.trim().toLowerCase() === 'cleaning' || profile.category?.trim().toLowerCase() === 'cleaning'
)

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
    const chartSteps = profile.steps?.length ? profile.steps : isActive ? workflow.profile?.steps : undefined
    return {
      id: record.id || profile.title || createId(),
      source: sourceForRecord(record),
      createdAt: textValue(metadata.bestpressoCreatedAt),
      author: textValue(profile.author),
      name: parsedTitle.name,
      category: parsedTitle.category ?? textValue(profile.category),
      version: profile.version === null || profile.version === undefined ? undefined : String(profile.version),
      beverageType: profile.beverage_type,
      description: textValue(metadata.description, metadata.profileDescription, metadata.notes, metadata.profileNotes, metadata.profile_notes, profile.description, profile.notes, profile.profile_notes),
      temperature: numberString(isActive ? workflow.profile?.steps?.[0]?.temperature : metadata.temperature ?? profile.steps?.[0]?.temperature, '—'),
      grindSetting: numberString(isActive ? workflow.context?.grinderSetting : metadata.grinderSetting, '—'),
      dose: numberString(isActive ? workflow.context?.targetDoseWeight : metadata.targetDoseWeight ?? profile.dose_weight, '18'),
      targetYield: numberString(profileConfiguredTargetYield(profile, metadata, isActive ? workflow.context?.targetYield ?? workflow.profile?.target_weight : undefined), '—'),
      targetPoints: profileStepsToTargetPoints(chartSteps),
      stepNames: chartSteps?.map(step => textValue(step.name) ?? ''),
      profileSteps: isActive && workflow.profile?.steps?.length ? workflow.profile.steps : chartSteps,
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
    if (utility.id === 'water') {
      const waterMetrics = utility.metrics.some(metric => metric.id === 'maxDuration')
        ? utility.metrics
        : [...utility.metrics, { id: 'maxDuration' as const, value: '—', unit: 's' }]
      return { ...utility, metrics: waterMetrics.map(metric => {
        const value = metric.id === 'volume' ? workflow.hotWaterData?.volume
          : metric.id === 'temperature' ? workflow.hotWaterData?.targetTemperature
          : metric.id === 'maxDuration' ? workflow.hotWaterData?.duration : undefined
        return { ...metric, value: numberString(value, metric.value) }
      }) }
    }
    if (utility.id === 'steam') {
      const targetTemperature = finiteNumber(workflow.steamSettings?.targetTemperature)
      const enabled = targetTemperature === undefined ? utility.enabled : isSteamHeatingEnabled(targetTemperature)
      return {
        ...utility,
        enabled,
        metrics: utility.metrics.map((metric) => metric.id === 'target'
          ? enabled ? { ...metric, value: numberString(targetTemperature, metric.value) } : metric
          : metric.id === 'duration'
            ? { ...metric, value: numberString(workflow.steamSettings?.duration, metric.value) }
            : metric.id === 'flow'
              ? { ...metric, value: numberString(workflow.steamSettings?.flow, metric.value) }
              : metric),
      }
    }
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
  const rawBeverageType = shot.workflow?.profile?.beverage_type
  const isCleaning = rawBeverageType?.toLowerCase() === 'cleaning' || shot.workflow?.profile?.category?.trim().toLowerCase() === 'cleaning'
  const beverageType = isCleaning ? 'cleaning' : rawBeverageType
  const hasMachineSubstates = measurements.some((entry) => entry.machine?.state?.substate)
  const extraction = hasMachineSubstates && !isCleaning
    ? measurements.filter((entry) => ESPRESSO_EXTRACTION_SUBSTATES.has(entry.machine?.state?.substate?.toLowerCase() ?? ''))
    : measurements
  const firstTimestamp = extraction[0]?.machine?.timestamp
  const lastTimestamp = extraction.at(-1)?.machine?.timestamp
  const duration = firstTimestamp && lastTimestamp ? Math.max(0, Math.round((Date.parse(lastTimestamp) - Date.parse(firstTimestamp)) / 1000)) : undefined
  const lastWeight = [...extraction].reverse().find((entry) => entry.scale?.weight !== undefined)?.scale?.weight
  const startedAt = firstTimestamp ? Date.parse(firstTimestamp) : Number.NaN
  const stepNames = shot.workflow?.profile?.steps?.map(step => textValue(step.name) ?? '')
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
  const shotProfileTitle = textValue(shot.workflow?.profile?.title, shot.workflow?.name)
  return reconcileStageReasons({
    profileSteps: shot.workflow?.profile?.steps,
    telemetryStartedAt: Number.isFinite(startedAt) ? startedAt : undefined,
    stopReason: shot.stopReason ?? undefined,
    id: shot.id,
    profileName: shotProfileTitle ? parseProfileTitle(shotProfileTitle).name : 'Previous pull',
    ...(!shotProfileTitle ? { profileNameFallback: 'previousPull' as const } : {}),
    beverageType,
    timestamp: shot.timestamp ?? firstTimestamp ?? lastTimestamp,
    totalYield: numberString(shot.annotations?.actualYield ?? lastWeight, '—'),
    totalTime: numberString(duration, '—'),
    targetYield: profileTargetYield(shot.workflow?.profile),
    points,
  })
}
