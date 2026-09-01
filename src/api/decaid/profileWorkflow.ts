import type { BrewProfile } from '../../domain/brewing.ts'
import { VALUE_ADJUSTMENTS } from '../../domain/valueAdjustments.ts'
import type { DecaidProfile, DecaidProfileRecord, DecaidWorkflowPatch } from './types.ts'

export const BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY = 'bestpressoTargetYield'

export const profileUsesStopAtWeight = (profile?: DecaidProfile) => {
  const targetWeight = Number(profile?.target_weight)
  return Number.isFinite(targetWeight) && targetWeight > 0
}

export const profileTargetYield = (profile?: DecaidProfile, configuredTarget: unknown = profile?.target_weight) => {
  const targetYield = Number(configuredTarget)
  return profileUsesStopAtWeight(profile) && Number.isFinite(targetYield) ? targetYield : undefined
}

const positiveTargetYield = (value: unknown) => {
  const targetYield = Number(value)
  return Number.isFinite(targetYield) && targetYield > 0 ? targetYield : undefined
}

const nonNegativeTargetYield = (value: unknown) => {
  const targetYield = Number(value)
  return Number.isFinite(targetYield) && targetYield >= 0 ? targetYield : undefined
}

export const profileUserTargetYield = (metadata?: Record<string, unknown> | null) => (
  Object.prototype.hasOwnProperty.call(metadata ?? {}, BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY)
    ? nonNegativeTargetYield(metadata?.[BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY])
    : undefined
)

export const profileUserTargetNeedsWorkflowSync = (metadata: Record<string, unknown> | null | undefined, workflowTarget: unknown) => {
  const userTarget = profileUserTargetYield(metadata)
  if (userTarget === undefined) return false
  return (positiveTargetYield(workflowTarget) ?? 0) !== userTarget
}

export const profileConfiguredTargetYield = (profile?: DecaidProfile, metadata?: Record<string, unknown> | null, activeTarget?: unknown) => {
  const sourceTarget = profileUsesStopAtWeight(profile) ? positiveTargetYield(profile?.target_weight) : undefined
  const userTarget = profileUserTargetYield(metadata)
  if (userTarget === 0) return undefined
  if (sourceTarget === undefined && userTarget === undefined) return undefined

  const configuredTarget = activeTarget === undefined
    ? positiveTargetYield(sourceTarget === undefined ? userTarget : metadata?.targetYield)
    : positiveTargetYield(activeTarget)
  return configuredTarget ?? userTarget ?? sourceTarget
}

export const workflowValuesForProfile = (record: DecaidProfileRecord, profile: BrewProfile) => {
  const profileTemperature = Number(profile.temperature)
  const profileDose = Number(profile.dose)
  const profileYield = Number(profile.targetYield)
  const profileGrindSetting = Number(profile.grindSetting)
  const temperature = Number.isFinite(profileTemperature) ? profileTemperature : Number(record.profile?.steps?.[0]?.temperature) || 92
  const dose = Number.isFinite(profileDose) ? profileDose : VALUE_ADJUSTMENTS.dose.defaultValue
  const grinderSetting = String(Number.isFinite(profileGrindSetting) ? profileGrindSetting : VALUE_ADJUSTMENTS.grindSetting.defaultValue)
  const usesStopAtWeight = profileUsesStopAtWeight(record.profile)
  const savedUserTarget = profileUserTargetYield(record.metadata)
  const targetYield = Number.isFinite(profileYield)
    ? profileYield > 0 ? profileYield : null
    : savedUserTarget === 0 ? null : savedUserTarget ?? profileTargetYield(record.profile) ?? null
  const workflowProfile = {
    ...record.profile,
    target_weight: targetYield,
    steps: record.profile?.steps?.map((step) => ({ ...step, temperature })) ?? [],
  }
  const patch: DecaidWorkflowPatch = {
    profile: workflowProfile,
    context: { grinderSetting, targetDoseWeight: dose, targetYield },
  }
  const metadata: Record<string, unknown> = {
    ...(record.metadata ?? {}),
    temperature,
    grinderSetting,
    targetDoseWeight: dose,
    targetYield,
  }
  if (Number.isFinite(profileYield)) {
    if (profileYield <= 0) metadata[BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY] = 0
    else if (usesStopAtWeight) delete metadata[BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY]
    else metadata[BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY] = targetYield
  } else if (savedUserTarget !== undefined) {
    metadata[BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY] = savedUserTarget
  } else if (usesStopAtWeight) {
    delete metadata[BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY]
  }

  return {
    patch,
    metadata,
  }
}
