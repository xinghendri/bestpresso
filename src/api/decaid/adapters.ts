import type { BrewProfile, BrewingScreenModel, MachineReadiness, PreviousShot, ProfileTargetPoint } from '../../domain/brewing'
import type { DecaidProfileRecord, DecaidProfileStep, DecaidWorkflow, FavoriteAssignments, MachineSnapshot, ShotRecord } from './types'

const MM_TO_ML = [0,16,43,70,97,124,151,179,206,233,261,288,316,343,371,398,426,453,481,509,537,564,592,620,648,676,704,732,760,788,816,844,872,900,929,957,985,1013,1042,1070,1104,1138,1172,1207,1242,1277,1312,1347,1382,1417,1453,1488,1523,1559,1594,1630,1665,1701,1736,1772,1808,1843,1879,1915,1951,1986,2022,2058]
export const STEAM_HEATER_READY_C = 130

const numberString = (value: unknown, fallback: string) => value === null || value === undefined || value === '' || Number.isNaN(Number(value)) ? fallback : String(value)
const finiteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined

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

export function profileRecordsToDomain(records: DecaidProfileRecord[], workflow: DecaidWorkflow, fallback: BrewProfile[]) {
  const visible = records.filter((record) => record.visibility !== 'hidden' && record.visibility !== 'deleted' && record.profile?.title)
  if (!visible.length) return fallback
  return visible.map((record): BrewProfile => {
    const profile = record.profile ?? {}
    const metadata = record.metadata ?? {}
    const isActive = profile.title === workflow.profile?.title
    return {
      id: record.id || profile.title || crypto.randomUUID(),
      name: profile.title || 'Untitled profile',
      temperature: numberString(isActive ? workflow.profile?.steps?.[0]?.temperature : metadata.temperature ?? profile.steps?.[0]?.temperature, '—'),
      grindSetting: numberString(isActive ? workflow.context?.grinderSetting : metadata.grinderSetting, '—'),
      dose: numberString(isActive ? workflow.context?.targetDoseWeight : metadata.targetDoseWeight ?? profile.dose_weight, '18'),
      targetYield: numberString(isActive ? workflow.context?.targetYield : metadata.targetYield ?? profile.target_weight, '—'),
      targetPoints: profileStepsToTargetPoints(isActive ? workflow.profile?.steps : profile.steps),
    }
  })
}

export function favoriteProfiles(profiles: BrewProfile[], assignments: FavoriteAssignments | null) {
  const assigned = Array.from({ length: 5 }, (_, slot) => assignments?.[slot])
    .map((id) => profiles.find((profile) => profile.id === id))
    .filter((profile): profile is BrewProfile => Boolean(profile))
  return assigned.length ? assigned : profiles.slice(0, 5)
}

export function applyWorkflow(model: BrewingScreenModel, workflow: DecaidWorkflow, records: DecaidProfileRecord[], assignments: FavoriteAssignments | null = null) {
  const allProfiles = profileRecordsToDomain(records, workflow, model.profiles)
  const profiles = favoriteProfiles(allProfiles, assignments)
  const active = profiles.find((profile) => profile.name === workflow.profile?.title)
  const utilities = model.utilities.map((utility) => {
    if (utility.id === 'water') return { ...utility, metrics: utility.metrics.map((metric) => metric.label === 'Target yield' ? { ...metric, value: numberString(workflow.hotWaterData?.volume, metric.value) } : { ...metric, value: numberString(workflow.hotWaterData?.targetTemperature, metric.value) }) }
    if (utility.id === 'steam') return { ...utility, metrics: utility.metrics.map((metric) => metric.label === 'Target' ? { ...metric, value: numberString(workflow.steamSettings?.targetTemperature, metric.value) } : metric.label === 'Max time' ? { ...metric, value: numberString(workflow.steamSettings?.duration, metric.value) } : metric.label === 'Flow' ? { ...metric, value: numberString(workflow.steamSettings?.flow, metric.value) } : metric) }
    return utility
  })
  return { ...model, profiles, activeProfileId: active?.id ?? profiles[0]?.id, utilities }
}

export function readinessFromSnapshot(snapshot: MachineSnapshot): MachineReadiness {
  const machineState = typeof snapshot.state === 'string' ? { state: snapshot.state } : snapshot.state
  const state = machineState?.state
  const substate = machineState?.substate
  if (state === 'sleeping') return 'sleeping'
  if (state === 'error' || state === 'needsWater') return 'disconnected'
  if (state === 'booting' || state === 'heating' || state === 'preheating' || (state === 'idle' && substate === 'preparingForShot')) return 'heating'
  if (snapshot.groupTemperature !== undefined && snapshot.targetGroupTemperature !== undefined && snapshot.groupTemperature < snapshot.targetGroupTemperature) return 'heating'
  return 'ready'
}

export function tankMillilitres(level: number) {
  const index = Math.max(0, Math.floor(level))
  return MM_TO_ML[Math.min(index, MM_TO_ML.length - 1)]
}

export function shotToDomain(shot: ShotRecord | null, fallback: PreviousShot): PreviousShot {
  if (!shot) return fallback
  const measurements = shot.measurements ?? []
  const extraction = measurements.filter((entry) => entry.machine?.state?.substate !== 'preparingForShot')
  const firstTimestamp = extraction[0]?.machine?.timestamp
  const lastTimestamp = extraction.at(-1)?.machine?.timestamp
  const duration = firstTimestamp && lastTimestamp ? Math.max(0, Math.round((Date.parse(lastTimestamp) - Date.parse(firstTimestamp)) / 1000)) : Number(fallback.totalTime)
  const lastWeight = [...extraction].reverse().find((entry) => entry.scale?.weight !== undefined)?.scale?.weight
  const startedAt = firstTimestamp ? Date.parse(firstTimestamp) : Number.NaN
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
    }]
  }) : fallback.points
  return {
    profileName: shot.workflow?.profile?.title || fallback.profileName,
    totalYield: numberString(shot.annotations?.actualYield ?? lastWeight, fallback.totalYield),
    totalTime: numberString(duration, fallback.totalTime),
    targetYield: shot.workflow?.context?.targetYield ?? shot.workflow?.profile?.target_weight ?? fallback.targetYield,
    points: points?.length ? points : fallback.points,
  }
}
