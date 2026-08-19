import type { BrewProfile, BrewingScreenModel, MachineReadiness, PreviousShot } from '../../domain/brewing'
import type { DecaidProfileRecord, DecaidWorkflow, MachineSnapshot, ShotRecord } from './types'

const MM_TO_ML = [0,16,43,70,97,124,151,179,206,233,261,288,316,343,371,398,426,453,481,509,537,564,592,620,648,676,704,732,760,788,816,844,872,900,929,957,985,1013,1042,1070,1104,1138,1172,1207,1242,1277,1312,1347,1382,1417,1453,1488,1523,1559,1594,1630,1665,1701,1736,1772,1808,1843,1879,1915,1951,1986,2022,2058]

const numberString = (value: unknown, fallback: string) => value === null || value === undefined || value === '' || Number.isNaN(Number(value)) ? fallback : String(value)

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
      temperature: numberString(profile.steps?.[0]?.temperature, '—'),
      grindSetting: numberString(isActive ? workflow.context?.grinderSetting : metadata.grinderSetting, '—'),
      dose: numberString(isActive ? workflow.context?.targetDoseWeight : metadata.targetDoseWeight ?? profile.dose_weight, '18'),
      targetYield: numberString(isActive ? workflow.context?.targetYield : metadata.targetYield ?? profile.target_weight, '—'),
    }
  })
}

export function applyWorkflow(model: BrewingScreenModel, workflow: DecaidWorkflow, records: DecaidProfileRecord[]) {
  const profiles = profileRecordsToDomain(records, workflow, model.profiles)
  const active = profiles.find((profile) => profile.name === workflow.profile?.title)
  const utilities = model.utilities.map((utility) => {
    if (utility.id === 'water') return { ...utility, metrics: utility.metrics.map((metric) => metric.label === 'Target yield' ? { ...metric, value: numberString(workflow.hotWaterData?.volume, metric.value) } : { ...metric, value: numberString(workflow.hotWaterData?.targetTemperature, metric.value) }) }
    if (utility.id === 'steam') return { ...utility, metrics: utility.metrics.map((metric) => metric.label === 'Target' ? { ...metric, value: numberString(workflow.steamSettings?.targetTemperature, metric.value) } : metric.label === 'Max time' ? { ...metric, value: numberString(workflow.steamSettings?.duration, metric.value) } : metric.label === 'Flow' ? { ...metric, value: numberString(workflow.steamSettings?.flow, metric.value) } : metric) }
    return utility
  })
  return { ...model, profiles, activeProfileId: active?.id, utilities }
}

export function readinessFromSnapshot(snapshot: MachineSnapshot): MachineReadiness {
  const state = typeof snapshot.state === 'string' ? snapshot.state : snapshot.state?.state
  if (state === 'sleeping') return 'sleeping'
  if (state === 'booting' || state === 'heating' || state === 'preheating') return 'heating'
  if (state === 'error' || state === 'needsWater') return 'disconnected'
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
  return {
    profileName: shot.workflow?.profile?.title || fallback.profileName,
    totalYield: numberString(shot.annotations?.actualYield ?? lastWeight, fallback.totalYield),
    totalTime: numberString(duration, fallback.totalTime),
  }
}
